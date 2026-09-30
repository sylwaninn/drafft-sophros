import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { staffContext } from "~/lib/context";

// The database is mocked: each test says what the one call answers.
vi.mock("~/lib/.server/db", () => {
  class DbError extends Error {
    constructor(
      message: string,
      readonly code: string,
      readonly status: number,
    ) {
      super(message);
    }
  }
  return { DbError, rpc: vi.fn() };
});
vi.mock("~/lib/.server/stream", () => ({ deleteMessage: vi.fn() }));

const { DbError, rpc } = await import("~/lib/.server/db");
const { action, decisionCall, idempotencyKey } = await import("~/routes/act");
const mockedRpc = vi.mocked(rpc);

type Answer = { data: { ok: boolean; message?: string; error?: string }; init: { status?: number } | null };

async function post(fields: Record<string, string> | [string, string][]): Promise<Answer> {
  const context = new RouterContextProvider();
  context.set(staffContext, { email: "mod@drafft.test", role: "moderator" });
  const request = new Request("http://sophros.test/act", { method: "POST", body: new URLSearchParams(fields) });
  return (await action({ request, context, params: {} } as unknown as Parameters<typeof action>[0])) as unknown as Answer;
}

const ban = { intent: "flags", ids: [7], reason: "account banned", hold: "banned", holdReason: "nudity in a chat" };

beforeEach(() => mockedRpc.mockReset());

describe("decisionCall", () => {
  it("makes a flag decision with its hold one call", () => {
    expect(decisionCall(ban)).toEqual({
      fn: "admin_decide_flags",
      args: { p_ids: [7], p_reason: "account banned", p_hold: "banned", p_hold_reason: "nudity in a chat" },
    });
    expect(decisionCall({ intent: "flags", ids: [7], reason: "nothing wrong" })).toEqual({
      fn: "admin_decide_flags",
      args: { p_ids: [7], p_reason: "nothing wrong", p_hold: null, p_hold_reason: null },
    });
  });

  it("makes a photo refusal with its hold one call", () => {
    expect(decisionCall({ intent: "photo", media: "m1", reason: "profile photo refused", hold: "review" })).toEqual({
      fn: "admin_decide_photo",
      args: { p_media: "m1", p_reason: "profile photo refused", p_hold: "review" },
    });
    expect(decisionCall({ intent: "media", media: "m1", approved: true })).toEqual({
      fn: "admin_review_media",
      args: { p_media: "m1", p_approved: true, p_reason: null },
    });
  });

  it("refuses what the dashboard doesn't decide", () => {
    expect(decisionCall(null)).toBeNull();
    expect(decisionCall({ intent: "hold", user: "u", state: "banned", reason: "x" })).toBeNull();
    expect(decisionCall({ ...ban, hold: "deleted" })).toBeNull();
    expect(decisionCall({ ...ban, ids: [] })).toBeNull();
    expect(decisionCall({ ...ban, ids: [1.5] })).toBeNull();
    expect(decisionCall({ intent: "media", media: "m1", approved: "yes" })).toBeNull();
  });
});

describe("act", () => {
  it("applies a decision in a single database call", async () => {
    mockedRpc.mockResolvedValueOnce(null);
    const answer = await post({ intent: "decide", message: "Account banned.", decision: JSON.stringify(ban) });
    expect(answer.data).toEqual({ ok: true, message: "Account banned." });
    expect(mockedRpc).toHaveBeenCalledTimes(1);
    expect(mockedRpc.mock.calls[0][1]).toBe("admin_decide_flags");
  });

  it("answers a refused decision with a 4xx, nothing partly applied", async () => {
    mockedRpc.mockRejectedValueOnce(new DbError("not allowed", "forbidden", 400));
    const answer = await post({ intent: "decide", message: "Account banned.", decision: JSON.stringify(ban) });
    expect(answer.init?.status).toBe(400);
    expect(answer.data).toEqual({ ok: false, error: "Your role doesn't allow this." });
    expect(mockedRpc).toHaveBeenCalledTimes(1);
  });

  it("refuses an unknown decision without calling the database", async () => {
    const answer = await post({ intent: "decide", decision: "{not json" });
    expect(answer.init?.status).toBe(400);
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("closes a report and holds its account in one call", async () => {
    mockedRpc.mockResolvedValueOnce(null);
    await post({ intent: "report", report: "r1", user: "u1", resolution: "insults", hold: "banned" });
    expect(mockedRpc).toHaveBeenCalledTimes(1);
    expect(mockedRpc.mock.calls[0].slice(1)).toEqual(["admin_close_report", { p_report: "r1", p_resolution: "insults", p_hold: "banned" }]);
  });

  it("says a report already closed is gone, with a 4xx", async () => {
    mockedRpc.mockRejectedValueOnce(new DbError("no open report", "not_found", 400));
    const answer = await post({ intent: "report", report: "r1", user: "u1", resolution: "again", hold: "banned" });
    expect(answer.init?.status).toBe(400);
    expect(answer.data).toEqual({ ok: false, error: "It's gone, or already handled." });
  });

  it("no longer applies a list of changes one by one", async () => {
    const answer = await post({ intent: "batch", ops: "[]" });
    expect(answer.init?.status).toBe(400);
    expect(mockedRpc).not.toHaveBeenCalled();
  });
});

describe("support replies", () => {
  const key = crypto.randomUUID();

  it("sends the reply form's key, so the database sends a reply once", async () => {
    mockedRpc.mockResolvedValue(null);
    const reply = { intent: "support-reply", id: "12", body: "Bonjour", close: "true", key };
    await post(reply);
    await post(reply);
    expect(mockedRpc).toHaveBeenCalledTimes(2);
    for (const call of mockedRpc.mock.calls) {
      expect(call.slice(1)).toEqual(["admin_reply_support", { p_id: 12, p_body: "Bonjour", p_close: true, p_idempotency_key: key }]);
    }
  });

  it("sends no key rather than a malformed one", () => {
    expect(idempotencyKey(key.toUpperCase())).toBe(key);
    expect(idempotencyKey("")).toBeNull();
    expect(idempotencyKey("1; drop table")).toBeNull();
  });
});

describe("failed events", () => {
  it("replays a batch in one call", async () => {
    mockedRpc.mockResolvedValueOnce(2);
    const answer = await post([
      ["intent", "events-replay"],
      ["id", "7"],
      ["id", "9"],
      ["id", "7"],
    ]);
    expect(mockedRpc.mock.calls[0].slice(1)).toEqual(["admin_replay_events", { p_ids: [7, 9], p_reason: null }]);
    expect(answer.data).toEqual({ ok: true, message: "2 events sent again." });
  });

  it("discards with the reason", async () => {
    mockedRpc.mockResolvedValueOnce(1);
    const answer = await post({ intent: "events-discard", id: "7", reason: "match gone" });
    expect(mockedRpc.mock.calls[0].slice(1)).toEqual(["admin_discard_events", { p_ids: [7], p_reason: "match gone" }]);
    expect(answer.data).toEqual({ ok: true, message: "1 event discarded." });
  });

  it("says when someone else handled them first", async () => {
    mockedRpc.mockResolvedValueOnce(0);
    const answer = await post({ intent: "events-replay", id: "7" });
    expect(answer.data).toEqual({ ok: true, message: "Nothing to replay: already handled." });
  });

  it("refuses ids that aren't events without calling the database", async () => {
    for (const ids of [[], ["x"], ["1.5"], ["-3"], Array.from({ length: 201 }, (_, i) => String(i + 1))]) {
      const answer = await post([["intent", "events-replay"], ...ids.map((id) => ["id", id] as [string, string])]);
      expect(answer.init?.status).toBe(400);
    }
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("explains a role that can't", async () => {
    mockedRpc.mockRejectedValueOnce(new DbError("not allowed", "forbidden", 400));
    const answer = await post({ intent: "events-discard", id: "7", reason: "x" });
    expect(answer.data).toEqual({ ok: false, error: "Your role doesn't allow this." });
  });
});

describe("deleting an account at the member's request", () => {
  const ask = (changes: Record<string, string> = {}) =>
    post({ intent: "delete-account", user: "u1", reason: "asked by email", reference: "DR-ABC234", ...changes });

  it.each(["DR-12", "", "phone"])("refuses the reference %j without calling the database", async (reference) => {
    const answer = await ask({ reference });
    expect(answer.init?.status).toBe(400);
    expect(answer.data).toEqual({ ok: false, error: "Give the support reference (DR-XXXXXX), or email." });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("sends the normalised reference in one call", async () => {
    mockedRpc.mockResolvedValue({ expected: "erased", emails: ["lea@drafft.test"], emailed: true });
    await ask({ reference: " dr-abc234 " });
    await ask({ reference: "EMAIL" });
    expect(mockedRpc).toHaveBeenCalledTimes(2);
    expect(mockedRpc.mock.calls[0].slice(1)).toEqual([
      "admin_delete_account",
      { p_user: "u1", p_reason: "asked by email", p_reference: "DR-ABC234" },
    ]);
    expect(mockedRpc.mock.calls[1][2]).toMatchObject({ p_reference: "email" });
  });

  it("says the outcome the backend expects and where the confirmation goes", async () => {
    mockedRpc.mockResolvedValueOnce({ expected: "erased", emails: ["lea@drafft.test"], emailed: true });
    expect((await ask()).data).toEqual({
      ok: true,
      message: "Deletion on its way: the account will be erased, unless a report or hold arrives first. Confirmation to lea@drafft.test.",
    });
    mockedRpc.mockResolvedValueOnce({ expected: "kept", emails: [], emailed: false });
    expect((await ask()).data).toEqual({
      ok: true,
      message:
        "Deletion on its way: the account will be kept for members' safety. No address to confirm to: the team gets an email to confirm another way.",
    });
  });

  it("leaves the role to the database", async () => {
    mockedRpc.mockRejectedValueOnce(new DbError("not allowed", "forbidden", 403));
    const answer = await ask();
    expect(answer.init?.status).toBe(403);
    expect(answer.data).toEqual({ ok: false, error: "Your role doesn't allow this." });
    expect(mockedRpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["already_deleted", "This account is deleted already."],
    ["already_requested", "A deletion of this account is already on its way."],
    ["invalid_reference", "Give the support reference (DR-XXXXXX), or email."],
    ["unknown_reference", "No support request has this reference."],
    ["reason_required", "Say why: the reason goes to the audit log."],
    ["not_found", "It's gone, or already handled."],
  ])("explains %s", async (code, error) => {
    mockedRpc.mockRejectedValueOnce(new DbError("refused", code, 400));
    const answer = await ask();
    expect(answer.init?.status).toBe(400);
    expect(answer.data).toEqual({ ok: false, error });
  });

  it("lets the database refuse an empty reason", async () => {
    mockedRpc.mockRejectedValueOnce(new DbError("say why", "reason_required", 400));
    const answer = await ask({ reason: "  " });
    expect(mockedRpc.mock.calls[0][2]).toMatchObject({ p_reason: "" });
    expect(answer.data).toEqual({ ok: false, error: "Say why: the reason goes to the audit log." });
  });

  it("keeps the database's own message for a code it doesn't know", async () => {
    mockedRpc.mockRejectedValueOnce(new DbError("something new", "constructor", 400));
    expect((await ask()).data).toEqual({ ok: false, error: "something new" });
  });
});
