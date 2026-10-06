/**
 * Local diagnostics log: a short ring buffer of errors and slow or failed database operations, kept on this device only
 * (nothing is sent anywhere). It lives in `localStorage`, not in IndexedDB, so it still works when IndexedDB is the thing
 * that is broken or slow. Entries hold error names, messages and timings; never card or set content.
 */

export const MAX_ENTRIES = 100;
/** An operation at least this slow is logged even though it succeeded. */
export const SLOW_MS = 1000;
export const STORAGE_KEY = 'quizly.diagnostics';

const KINDS = ['error', 'rejection', 'render', 'op-failed', 'op-slow'] as const;
export type LogKind = (typeof KINDS)[number];

export interface LogEntry {
  /** Wall-clock time of the (last) occurrence, ms since epoch. */
  at: number;
  kind: LogKind;
  /** Name of the database operation, for `op-*` entries. */
  op?: string;
  /** Total duration of the operation in ms. */
  ms?: number;
  /** Named checkpoints: ms since the operation started (e.g. `body` = when the transaction body finished). */
  phases?: Record<string, number>;
  message?: string;
  stack?: string;
  /** How many identical entries in a row this one stands for (absent = 1). */
  count?: number;
}

export type NewEntry = Omit<LogEntry, 'at' | 'count'>;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DiagnosticsOptions {
  store?: KeyValueStore;
  /** Wall clock, ms since epoch. */
  now?: () => number;
  /** Monotonic clock for durations, ms. */
  clock?: () => number;
  slowMs?: number;
  maxEntries?: number;
}

export interface Diagnostics {
  record(entry: NewEntry): void;
  recordError(kind: LogKind, error: unknown): void;
  entries(): LogEntry[];
  clear(): void;
  /**
   * Runs `run` and logs it when it fails or takes `slowMs` or longer. The result or the error always passes through
   * unchanged, whatever happens to the log. `checkpoint(name)` marks how far into the operation a stage was reached.
   */
  trace<T>(op: string, run: (checkpoint: (phase: string) => void) => Promise<T>): Promise<T>;
}

const MESSAGE_LIMIT = 300;
const STACK_LINES = 6;
const STACK_LIMIT = 800;

const clip = (text: string, limit: number) => (text.length > limit ? text.slice(0, limit) : text);

function asText(value: unknown): string {
  try {
    return String(value);
  } catch {
    return '[unprintable]';
  }
}

export function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    const described: { message: string; stack?: string } = { message: clip(`${error.name}: ${error.message}`, MESSAGE_LIMIT) };
    if (error.stack) described.stack = clip(error.stack.split('\n').slice(0, STACK_LINES).join('\n'), STACK_LIMIT);
    return described;
  }
  return { message: clip(asText(error), MESSAGE_LIMIT) };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Rebuilds a stored item as a clean entry, or null when it is not one (the log may have been edited or come from another version). */
function toEntry(value: unknown): LogEntry | null {
  if (!isObject(value) || !isNumber(value.at) || !KINDS.includes(value.kind as LogKind)) return null;
  const entry: LogEntry = { at: value.at, kind: value.kind as LogKind };
  if (typeof value.op === 'string') entry.op = value.op;
  if (isNumber(value.ms)) entry.ms = value.ms;
  if (typeof value.message === 'string') entry.message = value.message;
  if (typeof value.stack === 'string') entry.stack = value.stack;
  if (isNumber(value.count) && value.count > 1) entry.count = value.count;
  if (isObject(value.phases)) {
    const phases = Object.fromEntries(Object.entries(value.phases).filter(([, v]) => isNumber(v)));
    if (Object.keys(phases).length > 0) entry.phases = phases as Record<string, number>;
  }
  return entry;
}

const browserStore: KeyValueStore = {
  getItem: (key) => globalThis.localStorage.getItem(key),
  setItem: (key, value) => globalThis.localStorage.setItem(key, value),
  removeItem: (key) => globalThis.localStorage.removeItem(key),
};

export function createDiagnostics(options: DiagnosticsOptions = {}): Diagnostics {
  const store = options.store ?? browserStore;
  const now = options.now ?? (() => Date.now());
  const clock = options.clock ?? (() => performance.now());
  const slowMs = options.slowMs ?? SLOW_MS;
  const maxEntries = options.maxEntries ?? MAX_ENTRIES;

  function entries(): LogEntry[] {
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) return [];
      const data: unknown = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.map(toEntry).filter((e): e is LogEntry => e !== null);
    } catch {
      return [];
    }
  }

  function write(list: LogEntry[]): void {
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      try {
        // most likely out of space: keep the newer half
        store.setItem(STORAGE_KEY, JSON.stringify(list.slice(Math.ceil(list.length / 2))));
      } catch {
        // diagnostics must never get in the way of the app
      }
    }
  }

  function record(entry: NewEntry): void {
    try {
      const list = entries();
      const last = list[list.length - 1];
      if (last && last.kind === entry.kind && last.op === entry.op && last.message === entry.message) {
        last.count = (last.count ?? 1) + 1;
        last.at = now();
      } else {
        const clean: LogEntry = { at: now(), kind: entry.kind };
        for (const key of ['op', 'ms', 'phases', 'message', 'stack'] as const) {
          if (entry[key] !== undefined) Object.assign(clean, { [key]: entry[key] });
        }
        list.push(clean);
      }
      write(list.slice(-maxEntries));
    } catch {
      // diagnostics must never get in the way of the app
    }
  }

  function clear(): void {
    try {
      store.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  async function trace<T>(op: string, run: (checkpoint: (phase: string) => void) => Promise<T>): Promise<T> {
    const started = clock();
    const phases: Record<string, number> = {};
    const checkpoint = (phase: string) => {
      phases[phase] = Math.round(clock() - started);
    };
    const withPhases = () => (Object.keys(phases).length > 0 ? { phases: { ...phases } } : {});
    try {
      const result = await run(checkpoint);
      const ms = Math.round(clock() - started);
      if (ms >= slowMs) record({ kind: 'op-slow', op, ms, ...withPhases() });
      return result;
    } catch (error) {
      record({ kind: 'op-failed', op, ms: Math.round(clock() - started), ...withPhases(), ...describeError(error) });
      throw error;
    }
  }

  return {
    record,
    recordError: (kind, error) => record({ kind, ...describeError(error) }),
    entries,
    clear,
    trace,
  };
}

/** The app-wide log, backed by `localStorage`. */
export const diagnostics = createDiagnostics();

/** Plain-text report to paste into a message: environment lines first, then the log, oldest entry first. */
export function formatReport(log: readonly LogEntry[], environment: ReadonlyArray<readonly [string, string]>, createdAt: number): string {
  const lines = ['Quizly diagnostics', `Created: ${new Date(createdAt).toISOString()}`, ...environment.map(([label, value]) => `${label}: ${value}`), ''];
  if (log.length === 0) {
    lines.push('Log: no entries');
  } else {
    lines.push(`Log: ${log.length} ${log.length === 1 ? 'entry' : 'entries'}, oldest first`);
    for (const entry of log) {
      let line = `${new Date(entry.at).toISOString()}  ${entry.kind}`;
      if (entry.op) line += `  ${entry.op}`;
      if (entry.ms !== undefined) line += `  ${entry.ms} ms`;
      if (entry.phases) line += `  (${Object.entries(entry.phases).map(([name, ms]) => `${name} ${ms} ms`).join(', ')})`;
      if (entry.message) line += `  ${entry.message}`;
      if (entry.count && entry.count > 1) line += `  x${entry.count}`;
      lines.push(line);
      // the first stack line repeats the message
      for (const frame of (entry.stack ?? '').split('\n').slice(1)) lines.push(`    ${frame.trim()}`);
    }
  }
  return lines.join('\n');
}
