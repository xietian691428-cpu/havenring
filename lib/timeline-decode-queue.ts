import { isIosWebKit } from "@/lib/composer-platform-limits";

type QueueTask<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

const queue: QueueTask<unknown>[] = [];
let active = 0;

function maxConcurrency(): number {
  if (isIosWebKit()) return 1;
  if (typeof navigator !== "undefined" && /android/i.test(navigator.userAgent || "")) {
    return 2;
  }
  return 3;
}

function drainQueue() {
  while (active < maxConcurrency() && queue.length > 0) {
    const task = queue.shift();
    if (!task) break;
    active += 1;
    void task
      .run()
      .then(task.resolve, task.reject)
      .finally(() => {
        active -= 1;
        drainQueue();
      });
  }
}

/** Serialize heavy timeline media work on memory-constrained WebKit. */
export function runTimelineDecodeTask<T>(run: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push({ run, resolve: resolve as (value: unknown) => void, reject });
    drainQueue();
  });
}
