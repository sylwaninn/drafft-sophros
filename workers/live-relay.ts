// Live queues, the parts without Worker bindings (tested in tests/live.test.ts): the /live gate and the
// Realtime frames the relay accepts.
import { isLiveQueue, type LiveQueue } from "~/lib/live";

export const TOPIC = "realtime:staff:queues";
/** The queue a Realtime frame announces, or null (joins, replies, heartbeats, anything else). */
export function queueFromRealtime(frame: string): LiveQueue | null {
  try {
    const message = JSON.parse(frame) as { topic?: string; event?: string; payload?: { event?: string; payload?: { queue?: unknown } } };
    if (message.topic !== TOPIC || message.event !== "broadcast" || message.payload?.event !== "queue") return null;
    const queue = message.payload.payload?.queue;
    return isLiveQueue(queue) ? queue : null;
  } catch {
    return null;
  }
}

/** The Realtime endpoint for a project URL (https → wss is done by fetch's upgrade; keep http(s)). */
export function realtimeUrl(supabaseUrl: string, key: string): string {
  return `${supabaseUrl}/realtime/v1/websocket?apikey=${encodeURIComponent(key)}&vsn=1.0.0`;
}

interface Identified {
  status?: number;
  message?: string;
}

/**
 * GET /live: a WebSocket upgrade from a sophros page, for a staff member (the same check as every page:
 * Access JWT, then the staff table), from sophros itself (Origin).
 */
export async function handleLive(
  request: Request,
  identify: (request: Request) => Promise<unknown>,
  live: { fetch: (request: Request) => Promise<Response> },
): Promise<Response> {
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return new Response("Expected a WebSocket.", { status: 426 });
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return new Response("Cross-site request refused.", { status: 403 });
  try {
    await identify(request);
  } catch (error) {
    const { status } = error as Identified;
    if (status === 401 || status === 403) return new Response("Not allowed.", { status });
    throw error;
  }
  return live.fetch(request);
}
