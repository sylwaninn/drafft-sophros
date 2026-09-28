import { describe, expect, it, vi } from "vitest";
import { parseLiveMessage, startLive, type LiveSocket } from "~/lib/live";
import { handleLive, queueFromRealtime, realtimeUrl } from "../workers/live-relay";

class FakeSocket implements LiveSocket {
  onopen: LiveSocket["onopen"] = null;
  onmessage: LiveSocket["onmessage"] = null;
  onclose: LiveSocket["onclose"] = null;
  onerror: LiveSocket["onerror"] = null;
  closed = false;
  close() {
    this.closed = true;
  }
  open() {
    this.onopen?.({});
  }
  say(data: unknown) {
    this.onmessage?.({ data });
  }
  drop() {
    this.onclose?.({});
  }
}

function live() {
  const sockets: FakeSocket[] = [];
  const onChange = vi.fn();
  const onReconnect = vi.fn();
  const handle = startLive({
    url: "wss://sophros.test/live",
    connect: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
    onChange,
    onReconnect,
  });
  return { sockets, onChange, onReconnect, handle };
}

describe("parseLiveMessage", () => {
  it("keeps a known queue only", () => {
    expect(parseLiveMessage('{"queue":"reports"}')).toBe("reports");
    expect(parseLiveMessage('{"queue":"payroll"}')).toBeNull();
    // The failed events and the providers' circuits (drafft-backend 20260928000121).
    expect(parseLiveMessage('{"queue":"events"}')).toBe("events");
    expect(parseLiveMessage("not json")).toBeNull();
    expect(parseLiveMessage('{"queue":"reports","x":"' + "a".repeat(300) + '"}')).toBeNull();
    expect(parseLiveMessage(new ArrayBuffer(2))).toBeNull();
  });
});

describe("startLive", () => {
  it("groups a burst of changes into one re-read, after 500 ms", () => {
    vi.useFakeTimers();
    const { sockets, onChange, handle } = live();
    sockets[0].open();
    sockets[0].say('{"queue":"reports"}');
    vi.advanceTimersByTime(300);
    sockets[0].say('{"queue":"photos"}');
    sockets[0].say('{"queue":"reports"}');
    sockets[0].say("garbage");
    vi.advanceTimersByTime(499);
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["reports", "photos"]);
    handle.stop();
    vi.useRealTimers();
  });

  it("ignores messages that name no queue", () => {
    vi.useFakeTimers();
    const { sockets, onChange, handle } = live();
    sockets[0].say('{"queue":"unknown"}');
    vi.advanceTimersByTime(1000);
    expect(onChange).not.toHaveBeenCalled();
    handle.stop();
    vi.useRealTimers();
  });

  it("reconnects after a cut, then catches up", () => {
    vi.useFakeTimers();
    const { sockets, onReconnect, handle } = live();
    sockets[0].open();
    sockets[0].drop();
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(sockets).toHaveLength(2);
    expect(onReconnect).not.toHaveBeenCalled();
    sockets[1].open();
    expect(onReconnect).toHaveBeenCalledTimes(1);
    handle.stop();
    expect(sockets[1].closed).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(2);
    vi.useRealTimers();
  });
});

describe("queueFromRealtime", () => {
  const frame = (topic: string, event: string, inner: string, queue: unknown) =>
    JSON.stringify({ topic, event, payload: { type: "broadcast", event: inner, payload: { queue } } });

  it("relays a staff queue broadcast", () => {
    expect(queueFromRealtime(frame("realtime:staff:queues", "broadcast", "queue", "support"))).toBe("support");
  });

  it("drops everything else", () => {
    expect(queueFromRealtime(frame("realtime:user:1", "broadcast", "queue", "support"))).toBeNull();
    expect(queueFromRealtime(frame("realtime:staff:queues", "broadcast", "other", "support"))).toBeNull();
    expect(queueFromRealtime(frame("realtime:staff:queues", "broadcast", "queue", "someone@example.com"))).toBeNull();
    expect(queueFromRealtime(JSON.stringify({ topic: "phoenix", event: "phx_reply", payload: {} }))).toBeNull();
    expect(queueFromRealtime("{")).toBeNull();
  });

  it("builds the Realtime URL with the key encoded", () => {
    expect(realtimeUrl("https://ref.supabase.co", "sb/x")).toBe("https://ref.supabase.co/realtime/v1/websocket?apikey=sb%2Fx&vsn=1.0.0");
  });
});

describe("handleLive", () => {
  const upgrade = (headers: Record<string, string> = {}) =>
    new Request("https://sophros.test/live", { headers: { upgrade: "websocket", origin: "https://sophros.test", ...headers } });
  const relay = () => ({ fetch: vi.fn(async () => new Response("relayed")) });
  const refuse = (status: number) => async () => {
    throw Object.assign(new Error("no"), { status });
  };

  it("refuses a request without Access", async () => {
    const live = relay();
    const res = await handleLive(upgrade(), refuse(401), live);
    expect(res.status).toBe(401);
    expect(live.fetch).not.toHaveBeenCalled();
  });

  it("refuses someone who isn't staff", async () => {
    const live = relay();
    expect((await handleLive(upgrade(), refuse(403), live)).status).toBe(403);
    expect(live.fetch).not.toHaveBeenCalled();
  });

  it("refuses another site, before any sign-in check", async () => {
    const live = relay();
    const identify = vi.fn(async () => ({}));
    expect((await handleLive(upgrade({ origin: "https://evil.test" }), identify, live)).status).toBe(403);
    const noOrigin = new Request("https://sophros.test/live", { headers: { upgrade: "websocket" } });
    expect((await handleLive(noOrigin, identify, live)).status).toBe(403);
    expect(identify).not.toHaveBeenCalled();
  });

  it("refuses a plain request", async () => {
    expect((await handleLive(new Request("https://sophros.test/live"), async () => ({}), relay())).status).toBe(426);
  });

  it("passes a staff member's socket to the relay", async () => {
    const live = relay();
    const res = await handleLive(upgrade(), async () => ({ email: "a@b.c", role: "support" }), live);
    expect(await res.text()).toBe("relayed");
  });

  it("lets other errors surface", async () => {
    await expect(handleLive(upgrade(), async () => Promise.reject(new Error("db down")), relay())).rejects.toThrow("db down");
  });
});
