// Live queues, browser side. The Worker's /live socket says which queue changed ({"queue": "reports"}),
// never who or what; the page then re-reads its own loaders. Shared by the hook and the tests.

/** The queues drafft-backend announces on `staff:queues` (migration 20260928000071_staff_live_events). */
export const LIVE_QUEUES = ["reports", "photos", "media", "verifications", "accounts", "support"] as const;
export type LiveQueue = (typeof LIVE_QUEUES)[number];

export function isLiveQueue(value: unknown): value is LiveQueue {
  return typeof value === "string" && (LIVE_QUEUES as readonly string[]).includes(value);
}

/** The queue a /live message names, or null for anything else (malformed, unknown). */
export function parseLiveMessage(data: unknown): LiveQueue | null {
  if (typeof data !== "string" || data.length > 200) return null;
  try {
    const message = JSON.parse(data) as { queue?: unknown } | null;
    return isLiveQueue(message?.queue) ? message.queue : null;
  } catch {
    return null;
  }
}

/** Every queue feeds the sidebar counters and "What's waiting", which every page shows: all revalidate. */
export function concernsPage(_queue: LiveQueue): boolean {
  return true;
}

export interface LiveSocket {
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  close(code?: number, reason?: string): void;
}

export interface LiveOptions {
  url: string;
  connect: (url: string) => LiveSocket;
  /** Called once per burst of changes, `debounceMs` after the last one. */
  onChange: (queues: LiveQueue[]) => void;
  /** Called when the socket (re)opens after a cut, to catch up on what was missed. */
  onReconnect?: () => void;
  debounceMs?: number;
  maxBackoffMs?: number;
  timers?: { set: (fn: () => void, ms: number) => unknown; clear: (id: unknown) => void };
}

/** One /live connection: reconnects with backoff, groups bursts of changes. `stop()` ends it. */
export function startLive({
  url,
  connect,
  onChange,
  onReconnect,
  debounceMs = 500,
  maxBackoffMs = 30_000,
  timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) },
}: LiveOptions): { stop: () => void } {
  let socket: LiveSocket | null = null;
  let stopped = false;
  let attempts = 0;
  let opened = false;
  let pending = new Set<LiveQueue>();
  let debounce: unknown = null;
  let retry: unknown = null;

  const flush = () => {
    debounce = null;
    const queues = [...pending];
    pending = new Set();
    if (queues.length) onChange(queues);
  };

  const open = () => {
    retry = null;
    if (stopped) return;
    const s = connect(url);
    socket = s;
    s.onopen = () => {
      if (opened) onReconnect?.();
      opened = true;
      attempts = 0;
    };
    s.onmessage = ({ data }) => {
      const queue = parseLiveMessage(data);
      if (!queue || !concernsPage(queue)) return;
      pending.add(queue);
      if (debounce !== null) timers.clear(debounce);
      debounce = timers.set(flush, debounceMs);
    };
    s.onerror = () => {};
    s.onclose = () => {
      if (socket !== s) return;
      socket = null;
      if (stopped) return;
      const delay = Math.min(maxBackoffMs, 1000 * 2 ** attempts) * (0.5 + Math.random() / 2);
      attempts += 1;
      retry = timers.set(open, delay);
    };
  };

  open();
  return {
    stop() {
      stopped = true;
      if (debounce !== null) timers.clear(debounce);
      if (retry !== null) timers.clear(retry);
      const s = socket;
      socket = null;
      s?.close(1000, "page closed");
    },
  };
}
