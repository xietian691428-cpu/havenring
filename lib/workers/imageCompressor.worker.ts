/**
 * Off-thread JPEG resize/compress — keeps main-thread WebKit heap stable on iOS.
 */

export type ImageCompressorRequest = {
  id: string;
  buffer: ArrayBuffer;
  mimeType: string;
  maxDim: number;
  quality: number;
};

export type ImageCompressorResponse =
  | { id: string; ok: true; buffer: ArrayBuffer; mimeType: string }
  | { id: string; ok: false; reason: string };

type WorkerScope = typeof globalThis & {
  postMessage: (message: ImageCompressorResponse, transfer?: Transferable[]) => void;
  onmessage: ((event: MessageEvent<ImageCompressorRequest>) => void) | null;
};

const scope = self as unknown as WorkerScope;

async function compressInWorker(req: ImageCompressorRequest): Promise<ImageCompressorResponse> {
  const { id, buffer, mimeType, maxDim, quality } = req;
  if (typeof OffscreenCanvas === "undefined") {
    return { id, ok: false, reason: "no-offscreen-canvas" };
  }

  const source = new Blob([buffer], { type: mimeType || "image/jpeg" });
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(source);
    const ratio = Math.min(maxDim / bitmap.width, maxDim / bitmap.height, 1);
    const width = Math.max(1, Math.round(bitmap.width * ratio));
    const height = Math.max(1, Math.round(bitmap.height * ratio));
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { id, ok: false, reason: "no-2d-context" };
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    bitmap = null;
    const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
    const out = await blob.arrayBuffer();
    return { id, ok: true, buffer: out, mimeType: "image/jpeg" };
  } catch (error) {
    if (bitmap) bitmap.close();
    const reason = error instanceof Error ? error.message : "compress-failed";
    return { id, ok: false, reason };
  }
}

scope.onmessage = (event: MessageEvent<ImageCompressorRequest>) => {
  void compressInWorker(event.data).then((result) => {
    if (result.ok) {
      scope.postMessage(result, [result.buffer]);
    } else {
      scope.postMessage(result);
    }
  });
};
