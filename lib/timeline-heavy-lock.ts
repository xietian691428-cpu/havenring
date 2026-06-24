/** Serialize heavy timeline work (refresh + sync) on memory-constrained WebKit. */
let tail: Promise<unknown> = Promise.resolve();

export function runTimelineHeavyTask<T>(fn: () => Promise<T>): Promise<T> {
  const next = tail.then(fn, fn);
  tail = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}
