// The project has no Node type definitions, so the `process` global is typed here, for this one use.
interface NodeProcess {
  on(event: 'unhandledRejection', listener: (reason: unknown) => void): void;
  off(event: 'unhandledRejection', listener: (reason: unknown) => void): void;
}

/** Collects promise rejections nobody handled until `stop()` is called (a swallowed `.catch` must leave this empty). */
export function collectUnhandledRejections(): { reasons: unknown[]; stop: () => void } {
  const nodeProcess = (globalThis as unknown as { process: NodeProcess }).process;
  const reasons: unknown[] = [];
  const listener = (reason: unknown) => reasons.push(reason);
  nodeProcess.on('unhandledRejection', listener);
  return { reasons, stop: () => nodeProcess.off('unhandledRejection', listener) };
}
