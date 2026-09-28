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
