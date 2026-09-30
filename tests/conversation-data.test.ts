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

/**
 * The database: admin_match answers the match (`found: false`: null), admin_conversation_access its
 * access (`access`, or `not_found`), admin_log answers `log` (a refusal code, with `status`, or fine).
 */
function database({
  basis = ["report"],
  canOverride = false,
  access,
  found = true,
  log,
  status = 400,
}: { basis?: string[]; canOverride?: boolean; access?: unknown; found?: boolean; log?: string; status?: number } = {}) {
  calls = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const fn = new URL(String(input)).pathname.split("/rpc/")[1];
    const args = JSON.parse(String(init?.body ?? "{}"));
    calls.push({ fn, args });
    if (fn === "admin_match") return Response.json(found ? match : null);
    if (fn === "admin_conversation_access")
      return found
        ? Response.json(access ?? { basis, canOverride })
        : Response.json({ message: "no such conversation", hint: "not_found" }, { status: 400 });
    if (fn === "admin_log") return log ? Response.json({ message: "refused", hint: log }, { status }) : new Response(null, { status: 204 });
    return new Response("no network in tests", { status: 599 });
  });
}

function context(role: "moderator" | "admin" = "moderator") {
  const c = new RouterContextProvider();
  c.set(staffContext, { email: `${role}@test.dev`, role });
  return c;
}

type Answer = {
  data: { ok: boolean; code?: string; error?: string; messages?: unknown; streamError?: string };
  init: { status?: number } | null;
};

async function gate() {
  return loader({
    request: new Request("https://sophros.test/conversation-data/match-1"),
    context: context(),
    params: { id: "match-1" },
  } as unknown as Parameters<typeof loader>[0]);
}

async function status(promise: Promise<unknown>): Promise<number | undefined> {
  try {
    await promise;
    return undefined;
  } catch (thrown) {
    return (thrown as { init?: { status?: number } }).init?.status;
  }
}

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
    const answer = await gate();
    expect(answer.access).toEqual({ basis: ["report", "hold"], canOverride: true });
    expect(calls.map((c) => c.fn).sort()).toEqual(["admin_conversation_access", "admin_match"]);
    expect(channelMessages).not.toHaveBeenCalled();
  });

  it("reads an odd answer as no basis and no override", async () => {
    for (const access of [{}, { basis: null, canOverride: "true" }, { basis: ["report", "curiosity"] }]) {
      database({ access });
      const answer = await gate();
      expect(answer.access.canOverride).toBe(false);
      expect(answer.access.basis.every((b) => b === "report")).toBe(true);
    }
  });

  it("answers 404 for a match that doesn't exist", async () => {
    database({ found: false });
    expect(await status(gate())).toBe(404);
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
    expect(answer.data).toEqual({
      ok: true,
      messages: { exists: true, messages: [{ id: "m1", type: "regular", text: "hi" }], hasMore: false },
    });
    expect(channelMessages).toHaveBeenCalledWith("match-1", 80, undefined);
  });

  it("keeps the logged reason within the audit log's limit, the place in full", async () => {
    database();
    await read({ reason: "r".repeat(2000), from: "p".repeat(300) });
    const logged = String(calls.find((c) => c.fn === "admin_log")?.args.p_reason);
    expect(logged.length).toBeLessThanOrEqual(1000);
    expect(logged.endsWith(`(opened from ${"p".repeat(200)})`)).toBe(true);
  });

  it("logs no place when there is none", async () => {
    database();
    await read({ reason: "insults", from: "" });
    expect(calls.find((c) => c.fn === "admin_log")?.args.p_reason).toBe("insults");
  });

  it("reads nothing, and logs nothing, for a match that doesn't exist", async () => {
    database({ found: false });
    const answer = await read({ reason: "insults", from: "report 1" });
    expect(answer.init?.status).toBe(404);
    expect(answer.data).toMatchObject({ ok: false, code: "not_found" });
    expect(calls.map((c) => c.fn)).toEqual(["admin_match"]);
    expect(channelMessages).not.toHaveBeenCalled();
  });

  it("says Stream failed once the reading is logged, and logs the failure", async () => {
    database();
    vi.mocked(channelMessages).mockRejectedValueOnce(new Error("Stream 503"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const answer = await read({ reason: "insults", from: "report 1" });
    expect(answer.data).toEqual({ ok: true, messages: null, streamError: "Stream 503" });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
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

  it("passes an admin's override with why, then reads, and explains a moderator's", async () => {
    database({ basis: [], canOverride: true });
    await read({ reason: "threat to meet her", from: "account Léa", override: "true", override_basis: "member_safety" }, "admin");
    const logs = calls.filter((c) => c.fn === "admin_log");
    expect(logs).toHaveLength(2);
    for (const log of logs) expect(log.args).toMatchObject({ p_override: true, p_override_basis: "member_safety" });
    expect(channelMessages).toHaveBeenCalled();
    vi.mocked(channelMessages).mockClear();

    database({ basis: [], log: "forbidden" });
    const answer = await read({ reason: "threat to meet her", from: "account Léa", override: "true", override_basis: "legal_request" });
    expect(answer.data).toMatchObject({ ok: false, code: "forbidden", error: "Reading a conversation without a basis takes an admin." });
    expect(channelMessages).not.toHaveBeenCalled();
  });

  it("reads nothing, and logs nothing, as an override without why", async () => {
    database({ basis: [], canOverride: true });
    for (const basis of [undefined, "", "curiosity"]) {
      const fields: Record<string, string> = { reason: "threat", from: "account Léa", override: "true" };
      if (basis !== undefined) fields.override_basis = basis;
      const answer = await read(fields, "admin");
      expect(answer.data).toMatchObject({ ok: false, code: "override_basis_required" });
    }
    expect(calls).toEqual([]);
    expect(channelMessages).not.toHaveBeenCalled();
  });

  it("sends no override basis without an override", async () => {
    database();
    await read({ reason: "insults", from: "report 1", override: "false", override_basis: "legal_request" });
    expect(calls.find((c) => c.fn === "admin_log")?.args).not.toHaveProperty("p_override_basis");
  });

  it("explains the database's refusals in the drawer's words, with their status", async () => {
    database({ log: "forbidden", status: 403 });
    const forbidden = await read({ reason: "insults", from: "report 1" });
    expect(forbidden.init?.status).toBe(403);
    expect(forbidden.data).toMatchObject({ ok: false, code: "forbidden", error: "Your role doesn't allow this." });

    database({ log: "reason_required" });
    const reason = await read({ reason: "insults", from: "report 1" });
    expect(reason.data.error).toBe("Say why you're reading it: the reason goes to the audit log on both accounts.");

    database({ log: "override_basis_required" });
    const basis = await read({ reason: "insults", from: "report 1", override: "true", override_basis: "legal_request" }, "admin");
    expect(basis.data.error).toMatch(/legal request or members' safety/);
    expect(channelMessages).not.toHaveBeenCalled();
  });

  it("asks older messages with the same reason", async () => {
    database();
    await read({ reason: "insults", from: "report 1, older messages", before: "m9" });
    expect(channelMessages).toHaveBeenCalledWith("match-1", 80, "m9");
  });
});
