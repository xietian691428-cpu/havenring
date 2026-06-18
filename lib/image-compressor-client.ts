/**
 * Client for off-thread image compression with main-thread fallback.
 */

let worker: Worker | null = null;
let workerFailed = false;

type CompressOpts = {
  maxDim: number;
  quality: number;
};

function getWorker(): Worker | null {
  if (workerFailed || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("./workers/imageCompressor.worker.ts", import.meta.url));
    worker.addEventListener("error", () => {
      workerFailed = true;
      worker?.terminate();
      worker = null;
    });
    return worker;
  } catch {
    workerFailed = true;
    return null;
  }
}

function compressInWorker(
  file: File,
  opts: CompressOpts
): Promise<Blob> {
  return file.arrayBuffer().then((buffer) =>
    compressImageBuffer(buffer, file.type || "image/jpeg", opts)
  );
}

/** Off-thread resize/encode — shared by composer + timeline thumb pipeline. */
export function compressImageBuffer(
  buffer: ArrayBuffer,
  mimeType: string,
  opts: CompressOpts
): Promise<Blob> {
  const instance = getWorker();
  if (!instance) {
    return Promise.reject(new Error("worker-unavailable"));
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        id?: string;
        ok?: boolean;
        buffer?: ArrayBuffer;
        mimeType?: string;
        reason?: string;
      };
      if (data?.id !== id) return;
      instance.removeEventListener("message", onMessage);
      if (data.ok && data.buffer) {
        resolve(new Blob([data.buffer], { type: data.mimeType || "image/jpeg" }));
        return;
      }
      reject(new Error(data.reason || "compress-failed"));
    };

    instance.addEventListener("message", onMessage);
    instance.postMessage(
      {
        id,
        buffer,
        mimeType: mimeType || "image/jpeg",
        maxDim: opts.maxDim,
        quality: opts.quality,
      },
      [buffer]
    );
  });
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("invalid-image"));
    };
    img.src = url;
  });
}

/** Main-thread fallback — releases canvas memory immediately after encode. */
export async function compressImageOnMainThread(file: File, opts: CompressOpts): Promise<Blob> {
  const img = await loadImageFromFile(file);
  const ratio = Math.min(opts.maxDim / img.width, opts.maxDim / img.height, 1);
  const width = Math.round(img.width * ratio);
  const height = Math.round(img.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.width = 0;
    canvas.height = 0;
    throw new Error("canvas-unavailable");
  }
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        canvas.width = 0;
        canvas.height = 0;
        if (blob) resolve(blob);
        else reject(new Error("compression-failed"));
      },
      "image/jpeg",
      opts.quality
    );
  });
}

/** Prefer worker compression; fall back to main thread when unsupported. */
export async function compressImageFile(file: File, opts: CompressOpts): Promise<Blob> {
  try {
    return await compressInWorker(file, opts);
  } catch {
    return compressImageOnMainThread(file, opts);
  }
}
