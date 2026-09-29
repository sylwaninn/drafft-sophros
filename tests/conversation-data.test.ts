// Reading a conversation: the gate (basis, override) reads no message and logs nothing; the reading
// needs a reason typed by the person, and the database's refusals come back explained.
// `cloudflare:workers`, `fetch` and Stream are stubbed: no network.
import { RouterContextProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { staffContext } from "~/lib/context";

vi.mock("cloudflare:workers", () => ({
  env: {
    DRAFFT_ENV: "production",
    AUTH_MODE: "access",
    ACCESS_TEAM_DOMAIN: "https://team.cloudflareaccess.test",
    ACCESS_AUD: "aud",
    SUPABASE_URL: "https://db.test",
    SUPABASE_SECRET_KEY: "fake",
    MEDIA_PUBLIC_URL: "https://media.test",
  },
}));
vi.mock("~/lib/.server/stream", () => ({
  channelMessages: vi.fn(async () => ({ exists: true, messages: [{ id: "m1", type: "regular", text: "hi" }], hasMore: false })),
}));

const { channelMessages } = await import("~/lib/.server/stream");
const { action, loader } = await import("~/routes/conversation-data");

const match = { id: "match-1", createdAt: "", endedAt: null, endedBy: null, a: { id: "a" }, b: { id: "b" }, sessions: [] };
type Call = { fn: string; args: Record<string, unknown> };
let calls: Call[];

/** The database: admin_match and admin_conversation_access answer, admin_log answers `log` (a refusal code, or fine). */
function database({ basis = ["report"], canOverride = false, log }: { basis?: string[]; canOverride?: boolean; log?: string } = {}) {
  calls = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const fn = new URL(String(input)).pathname.split("/rpc/")[1];
    const args = JSON.parse(String(init?.body ?? "{}"));
    calls.push({ fn, args });
    if (fn === "admin_match") return Response.json(match);
    if (fn === "admin_conversation_access") return Response.json({ basis, canOverride });
    if (fn === "admin_log")
      return log ? Response.json({ message: "refused", hint: log }, { status: 400 }) : new Response(null, { status: 204 });
    return new Response("no network in tests", { status: 599 });
  });
}

function context(role: "moderator" | "admin" = "moderator") {
  const c = new RouterContextProvider();
  c.set(staffContext, { email: `${role}@test.dev`, role });
  return c;
}

type Answer = { data: { ok: boolean; code?: string; error?: string | null; messages?: unknown }; init: { status?: number } | null };

async function read(fields: Record<string, string>, role: "moderator" | "admin" = "moderator"): Promise<Answer> {
  const request = new Request("https://sophros.test/conversation-data/match-1", { method: "POST", body: new URLSearchParams(fields) });
  return (await action({ request, context: context(role), params: { id: "match-1" } } as unknown as Parameters<
    typeof action
  >[0])) as unknown as Answer;
}

beforeEach(() => vi.mocked(channelMessages).mockClear());
afterEach(() => vi.unstubAllGlobals());

describe("conversation gate", () => {
  it("says why it may be read, without reading or logging it", async () => {
    database({ basis: ["report", "hold"], canOverride: true });
    const gate = await loader({
      request: new Request("https://sophros.test/conversation-data/match-1"),
      context: context(),
      params: { id: "match-1" },
    } as unknown as Parameters<typeof loader>[0]);
    expect(gate.access).toEqual({ basis: ["report", "hold"], canOverride: true });
    expect(calls.map((c) => c.fn).sort()).toEqual(["admin_conversation_access", "admin_match"]);
    expect(channelMessages).not.toHaveBeenCalled();
  });
});

describe("conversation reading", () => {
  it("logs the reading on both accounts with the reason typed and where it was opened from, then reads", async () => {
    database();
    const answer = await read({ reason: " insults in the report ", from: "report 1a2b3c4d", override: "false" });
    const logs = calls.filter((c) => c.fn === "admin_log");
    expect(logs.map((c) => c.args.p_user).sort()).toEqual(["a", "b"]);
    for (const log of logs) {
      expect(log.args).toMatchObject({
        p_action: "conversation.view",
        p_target: "match-1",
        p_reason: "insults in the report (opened from report 1a2b3c4d)",
        p_override: false,
      });
    }
    expect(answer.data.ok).toBe(true);
    expect(channelMessages).toHaveBeenCalledWith("match-1", 80, undefined);
  });

  it("reads nothing and logs nothing without a reason of the person's own", async () => {
    database();
    for (const reason of ["", "  ", "opened in sophros"]) {
      const answer = await read({ reason, from: "conversations list" });
      expect(answer.init?.status).toBe(400);
      expect(answer.data).toMatchObject({ ok: false, code: "reason_required" });
    }
    expect(calls).toEqual([]);
    expect(channelMessages).not.toHaveBeenCalled();
  });

  it("explains a conversation without a basis, and reads nothing", async () => {
    database({ basis: [], log: "no_basis" });
    const answer = await read({ reason: "curious", from: "conversations list" });
    expect(answer.data).toMatchObject({ ok: false, code: "no_basis" });
    expect(answer.data.error).toMatch(/only an admin/);
    expect(channelMessages).not.toHaveBeenCalled();
  });

  it("passes an admin's override, and explains a moderator's", async () => {
    database({ basis: [], canOverride: true });
    await read({ reason: "threat to meet her", from: "account Léa", override: "true" }, "admin");
    expect(calls.filter((c) => c.fn === "admin_log").every((c) => c.args.p_override === true)).toBe(true);
    vi.mocked(channelMessages).mockClear();

    database({ basis: [], log: "forbidden" });
    const answer = await read({ reason: "threat to meet her", from: "account Léa", override: "true" });
    expect(answer.data).toMatchObject({ ok: false, code: "forbidden", error: "Reading a conversation without a basis takes an admin." });
    expect(channelMessages).not.toHaveBeenCalled();
  });

  it("asks older messages with the same reason", async () => {
    database();
    await read({ reason: "insults", from: "report 1, older messages", before: "m9" });
    expect(channelMessages).toHaveBeenCalledWith("match-1", 80, "m9");
  });
});
