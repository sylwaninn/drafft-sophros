// Live queues, Worker side. One Durable Object ("staff") holds ONE Supabase Realtime connection, with the
// secret key, on the private `staff:queues` topic (drafft-backend 20260928000071_staff_live_events), and
// relays each change to the staff browsers connected on /live. Browsers never get a Supabase token, and
// the relayed message is only {"queue": "<name>"}.
import { DurableObject } from "cloudflare:workers";
import { getConfig } from "~/lib/.server/config";
import type { LiveQueue } from "~/lib/live";
import { queueFromRealtime, realtimeUrl, TOPIC } from "./live-relay";

/** Phoenix heartbeat, and the watchdog that reconnects a silent upstream. */
const TICK_MS = 25_000;
/** A browser socket is re-authenticated (Access, staff role) at least this often: it reconnects. */
const MAX_SESSION_MS = 60 * 60_000;
const MAX_BACKOFF_MS = 60_000;

export class LiveQueues extends DurableObject<Env> {
  private upstream: WebSocket | null = null;
  private joined = false;
  private awaitingHeartbeat = false;
  private ref = 0;
  private failures = 0;

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") return new Response("Expected a WebSocket.", { status: 426 });
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ since: Date.now() });
    await this.ensureUpstream();
    await this.schedule(TICK_MS);
    return new Response(null, { status: 101, webSocket: client });
  }

  // Browsers only listen; anything they send is ignored.
  webSocketMessage(): void {}

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, "bye");
    } catch {
      // already closed
    }
    if (this.browsers().length === 0) this.closeUpstream();
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws, 1011);
  }

  /** Heartbeat, watchdog, reconnection and session expiry, while anyone listens. */
  async alarm(): Promise<void> {
    const now = Date.now();
    for (const ws of this.browsers()) {
      const { since } = (ws.deserializeAttachment() ?? { since: 0 }) as { since: number };
      if (now - since > MAX_SESSION_MS) ws.close(4001, "sign-in check");
    }
    if (this.browsers().length === 0) {
      this.closeUpstream();
      return;
    }
    if (this.upstream && this.awaitingHeartbeat) this.closeUpstream(); // no answer to the last one: dead
    if (!this.upstream) await this.ensureUpstream();
    if (this.upstream && this.joined) {
      this.awaitingHeartbeat = true;
      this.send({ topic: "phoenix", event: "heartbeat", payload: {} });
    }
    await this.schedule(this.upstream ? TICK_MS : this.backoff());
  }

  private browsers(): WebSocket[] {
    return this.ctx.getWebSockets();
  }

  private backoff(): number {
    return Math.min(MAX_BACKOFF_MS, 1000 * 2 ** this.failures) * (0.5 + Math.random() / 2);
  }

  private async schedule(ms: number): Promise<void> {
    const current = await this.ctx.storage.getAlarm();
    const at = Date.now() + ms;
    if (current === null || current > at) await this.ctx.storage.setAlarm(at);
  }

  private send(message: Record<string, unknown>): void {
    this.ref += 1;
    this.upstream?.send(JSON.stringify({ ...message, ref: String(this.ref) }));
  }

  private closeUpstream(): void {
    const ws = this.upstream;
    this.upstream = null;
    this.joined = false;
    this.awaitingHeartbeat = false;
    try {
      ws?.close(1000, "idle");
    } catch {
      // already closed
    }
  }

  private async ensureUpstream(): Promise<void> {
    if (this.upstream) return;
    const { supabaseUrl: url, supabaseKey: key } = getConfig();
    let ws: WebSocket | null = null;
    try {
      const res = await fetch(realtimeUrl(url, key), { headers: { upgrade: "websocket" } });
      ws = res.webSocket;
      if (!ws) throw new Error(`realtime answered ${res.status}`);
    } catch (error) {
      this.failures += 1;
      console.error("live: realtime connection failed", error instanceof Error ? error.message : error);
      await this.schedule(this.backoff());
      return;
    }
    ws.accept();
    this.upstream = ws;
    ws.addEventListener("message", (event) => this.onUpstream(ws, typeof event.data === "string" ? event.data : ""));
    ws.addEventListener("close", () => this.onUpstreamClosed(ws));
    ws.addEventListener("error", () => this.onUpstreamClosed(ws));
    const joinRef = String(this.ref + 1);
    this.send({
      topic: TOPIC,
      event: "phx_join",
      join_ref: joinRef,
      payload: {
        config: { broadcast: { self: false, ack: false }, presence: { key: "" }, postgres_changes: [], private: true },
        access_token: key,
      },
    });
  }

  private onUpstream(ws: WebSocket, frame: string): void {
    if (ws !== this.upstream) return;
    let message: { topic?: string; event?: string; payload?: { status?: string } };
    try {
      message = JSON.parse(frame);
    } catch {
      return;
    }
    if (message.event === "phx_reply") {
      if (message.topic === "phoenix") this.awaitingHeartbeat = false;
      else if (message.topic === TOPIC && message.payload?.status === "ok" && !this.joined) {
        this.joined = true;
        // Joined again after a cut: whatever changed meanwhile, the open pages catch up by re-reading.
        if (this.failures > 0) this.relay("reports");
        this.failures = 0;
      } else if (message.topic === TOPIC && message.payload?.status === "error") {
        console.error("live: realtime refused the staff topic");
        this.dropUpstream(ws);
      }
      return;
    }
    if (message.event === "phx_error" || message.event === "phx_close") {
      this.dropUpstream(ws);
      return;
    }
    const queue = queueFromRealtime(frame);
    if (queue) this.relay(queue);
  }

  private relay(queue: LiveQueue): void {
    const text = JSON.stringify({ queue });
    for (const ws of this.browsers()) {
      try {
        ws.send(text);
      } catch {
        // closing; its close handler cleans up
      }
    }
  }

  private dropUpstream(ws: WebSocket): void {
    if (ws !== this.upstream) return;
    this.failures += 1;
    this.closeUpstream();
    void this.schedule(this.backoff());
  }

  private onUpstreamClosed(ws: WebSocket): void {
    if (ws !== this.upstream) return;
    this.dropUpstream(ws);
  }
}
