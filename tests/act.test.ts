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
const { action, decisionCall, idempotencyKey, Refusal } = await import("~/routes/act");
const mockedRpc = vi.mocked(rpc);

type Answer = { data: { ok: boolean; message?: string; error?: string }; init: { status?: number } | null };

async function post(fields: Record<string, string> | [string, string][]): Promise<Answer> {
  const context = new RouterContextProvider();
  context.set(staffContext, { email: "mod@drafft.test", role: "moderator" });
  const request = new Request("http://sophros.test/act", { method: "POST", body: new URLSearchParams(fields) });
  return (await action({ request, context, params: {} } as unknown as Parameters<typeof action>[0])) as unknown as Answer;
}

const ban = {
  intent: "flags",
  ids: [7],
  reason: "account banned",
  hold: "banned",
  holdReason: "nudity in a chat",
  category: "sexual_content",
  details: "Photos sexuelles envoyées sans accord.",
};

/** The categories the database lists, as admin_reason_categories answers. */
const categories = ["harassment", "hate", "sexual_content", "identity_check", "photo_guidelines", "other"].map((id) => ({
  id,
  termsAnchor: id === "identity_check" ? "moderation" : id === "other" ? null : "community",
}));

// Each decision call answers the next queued answer (a value, or a refusal); the category list answers
// on its own, whenever a decision that tells the member reads it.
let queued: (() => unknown)[];
let listed: unknown;
beforeEach(() => {
  queued = [];
  listed = categories;
  mockedRpc.mockReset();
  mockedRpc.mockImplementation(async (_staff, fn) => {
    if (fn === "admin_reason_categories") {
      if (listed instanceof Error) throw listed;
      return listed;
    }
    const next = queued.shift();
    return next ? next() : null;
  });
});
const reply = (value: unknown) => queued.push(() => value);
const refuse = (error: Error) =>
  queued.push(() => {
    throw error;
  });
/** The calls that decide something: the category list left out. */
const calls = () => mockedRpc.mock.calls.filter((c) => c[1] !== "admin_reason_categories");

describe("decisionCall", () => {
  it("makes a flag decision with its hold one call, with what the member is told", () => {
    expect(decisionCall(ban)).toEqual({
      fn: "admin_decide_flags",
      args: {
        p_ids: [7],
        p_reason: "account banned",
        p_hold: "banned",
        p_hold_reason: "nudity in a chat",
        p_category: "sexual_content",
        p_details: "Photos sexuelles envoyées sans accord.",
      },
    });
    expect(decisionCall({ intent: "flags", ids: [7], reason: "nothing wrong" })).toEqual({
      fn: "admin_decide_flags",
      args: { p_ids: [7], p_reason: "nothing wrong", p_hold: null, p_hold_reason: null },
    });
  });

  it("makes a photo refusal with its hold one call", () => {
    expect(
      decisionCall({ intent: "photo", media: "m1", reason: "profile photo refused", hold: "review", category: "photo_guidelines" }),
    ).toEqual({
      fn: "admin_decide_photo",
      args: { p_media: "m1", p_reason: "profile photo refused", p_hold: "review", p_category: "photo_guidelines", p_details: null },
    });
    expect(decisionCall({ intent: "media", media: "m1", approved: true })).toEqual({
      fn: "admin_review_media",
      args: { p_media: "m1", p_approved: true, p_reason: null },
    });
    expect(decisionCall({ intent: "media", media: "m1", approved: false, category: "photo_guidelines", details: "  " })).toEqual({
      fn: "admin_review_media",
      args: { p_media: "m1", p_approved: false, p_reason: null, p_category: "photo_guidelines", p_details: null },
    });
  });

  it("tells the member nothing when nothing reaches them", () => {
    expect(decisionCall({ intent: "flags", ids: [7], reason: "nothing wrong", category: "hate" })?.args).not.toHaveProperty("p_category");
  });

  it("refuses a decision the member is told about without its reason category", () => {
    const { category: _, ...uncategorised } = ban;
    expect(() => decisionCall(uncategorised)).toThrow(Refusal);
    expect(() => decisionCall({ intent: "media", media: "m1", approved: false })).toThrow("Choose the reason they're told.");
    expect(() => decisionCall({ intent: "photo", media: "m1", hold: "banned", category: " " })).toThrow(Refusal);
    expect(() => decisionCall({ ...ban, details: "x".repeat(1001) })).toThrow("1,000 characters");
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
    reply(null);
    const answer = await post({ intent: "decide", message: "Account banned.", decision: JSON.stringify(ban) });
    expect(answer.data).toEqual({ ok: true, message: "Account banned." });
    expect(calls()).toHaveLength(1);
    expect(calls()[0][1]).toBe("admin_decide_flags");
  });

  it("answers a refused decision with a 4xx, nothing partly applied", async () => {
    refuse(new DbError("not allowed", "forbidden", 400));
    const answer = await post({ intent: "decide", message: "Account banned.", decision: JSON.stringify(ban) });
    expect(answer.init?.status).toBe(400);
    expect(answer.data).toEqual({ ok: false, error: "Your role doesn't allow this." });
    expect(calls()).toHaveLength(1);
  });

  it("refuses an unknown decision without calling the database", async () => {
    const answer = await post({ intent: "decide", decision: "{not json" });
    expect(answer.init?.status).toBe(400);
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("closes a report and holds its account in one call, with what they're told", async () => {
    reply(null);
    await post({ intent: "report", report: "r1", user: "u1", resolution: "insults", hold: "banned", category: "harassment", details: "" });
    expect(calls()).toHaveLength(1);
    expect(calls()[0].slice(1)).toEqual([
      "admin_close_report",
      { p_report: "r1", p_resolution: "insults", p_hold: "banned", p_category: "harassment", p_details: null },
    ]);
  });

  it("closes a report without a hold, telling nobody", async () => {
    reply(null);
    await post({ intent: "report", report: "r1", user: "u1", resolution: "nothing found", hold: "" });
    expect(calls()[0].slice(1)).toEqual(["admin_close_report", { p_report: "r1", p_resolution: "nothing found", p_hold: null }]);
  });

  it("refuses a hold without its reason category, before calling the database", async () => {
    const forms: Record<string, string>[] = [
      { intent: "report", report: "r1", user: "u1", resolution: "insults", hold: "review" },
      { intent: "hold", user: "u1", state: "banned", reason: "fake photos" },
      { intent: "media", media: "m1", approved: "false" },
      { intent: "delete-message", match: "x", message: "m", user: "u1", reason: "insult" },
    ];
    for (const fields of forms) {
      const answer = await post(fields);
      expect(answer.init?.status).toBe(400);
      expect(answer.data).toEqual({ ok: false, error: "Choose the reason they're told." });
    }
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("puts a hold with its statement, and lifts one without", async () => {
    await post({
      intent: "hold",
      user: "u1",
      state: "selfie",
      reason: "stolen photos?",
      category: "identity_check",
      details: "Merci d'envoyer un selfie.",
    });
    await post({ intent: "hold", user: "u1", state: "", reason: "selfie matches the photos", category: "hate" });
    expect(calls().map((c) => c.slice(1))).toEqual([
      [
        "admin_set_hold",
        {
          p_user: "u1",
          p_state: "selfie",
          p_reason: "stolen photos?",
          p_category: "identity_check",
          p_details: "Merci d'envoyer un selfie.",
        },
      ],
      ["admin_set_hold", { p_user: "u1", p_state: null, p_reason: "selfie matches the photos" }],
    ]);
  });

  it("explains an unknown category: nothing was applied", async () => {
    refuse(new DbError("unknown reason category", "invalid_category", 400));
    const answer = await post({ intent: "hold", user: "u1", state: "review", reason: "x", category: "made_up" });
    expect(answer.data).toEqual({ ok: false, error: "Unknown reason category: nothing was applied. Reload the page and choose again." });
  });

  it("says a report already closed is gone, with a 4xx", async () => {
    refuse(new DbError("no open report", "not_found", 400));
    const answer = await post({ intent: "report", report: "r1", user: "u1", resolution: "again", hold: "banned", category: "harassment" });
    expect(answer.init?.status).toBe(400);
    expect(answer.data).toEqual({ ok: false, error: "It's gone, or already handled." });
  });

  it("no longer applies a list of changes one by one", async () => {
    const answer = await post({ intent: "batch", ops: "[]" });
    expect(answer.init?.status).toBe(400);
    expect(mockedRpc).not.toHaveBeenCalled();
  });
});

describe("message deletion", () => {
  it("logs it with the author's statement and the conversation's override, then deletes it", async () => {
    const { deleteMessage } = await import("~/lib/.server/stream");
    reply(null);
    const answer = await post({
      intent: "delete-message",
      match: "match-1",
      message: "msg-9",
      user: "u1",
      reason: "threat",
      override: "true",
      override_basis: "member_safety",
      category: "harassment",
      details: "",
    });
    expect(calls()[0].slice(1)).toEqual([
      "admin_log",
      {
        p_action: "message.delete",
        p_user: "u1",
        p_target: "match-1/msg-9",
        p_reason: "threat",
        p_override: true,
        p_override_basis: "member_safety",
        p_category: "harassment",
        p_details: null,
      },
    ]);
    expect(deleteMessage).toHaveBeenCalledWith("msg-9");
    expect(answer.data.ok).toBe(true);
  });

  it("deletes nothing when the conversation has no basis", async () => {
    const { deleteMessage } = await import("~/lib/.server/stream");
    vi.mocked(deleteMessage).mockClear();
    refuse(new DbError("no basis", "no_basis", 400));
    const answer = await post({ intent: "delete-message", match: "m", message: "x", user: "u1", reason: "r", category: "hate" });
    expect(answer.data.ok).toBe(false);
    expect(deleteMessage).not.toHaveBeenCalled();
  });
});

describe("message deletion, checks", () => {
  it("refuses an override without its reason, before the database", async () => {
    for (const basis of ["", "curiosity"]) {
      const answer = await post({
        intent: "delete-message",
        match: "m",
        message: "x",
        user: "u1",
        reason: "r",
        override: "true",
        override_basis: basis,
        category: "hate",
      });
      expect(answer.init?.status).toBe(400);
      expect(answer.data.error).toMatch(/legal request or members' safety/);
    }
    expect(calls()).toEqual([]);
  });

  it("sends no override basis for a conversation with a basis", async () => {
    await post({ intent: "delete-message", match: "m", message: "x", user: "u1", reason: "r", override: "", category: "hate" });
    expect(calls()[0][2]).not.toHaveProperty("p_override_basis");
    expect(calls()[0][2]).toMatchObject({ p_override: false });
  });

  it("explains a message that isn't the author's", async () => {
    refuse(new DbError("the author must be one of the two members", "invalid_target", 400));
    const answer = await post({ intent: "delete-message", match: "m", message: "x", user: "u9", reason: "r", category: "hate" });
    expect(answer.data).toEqual({ ok: false, error: "That message isn't one of theirs in this conversation: nothing was applied." });
  });
});

describe("statements, checked against the categories the database lists", () => {
  it("refuses a category the database doesn't list, before deciding", async () => {
    const answer = await post({ intent: "hold", user: "u1", state: "review", reason: "x", category: "made_up" });
    expect(answer.init?.status).toBe(400);
    expect(answer.data.error).toMatch(/Unknown reason category/);
    expect(calls()).toEqual([]);
    const decided = await post({ intent: "decide", decision: JSON.stringify({ ...ban, category: "made_up" }) });
    expect(decided.data.error).toMatch(/Unknown reason category/);
    expect(calls()).toEqual([]);
  });

  it("reads the list once per request, only for a decision the member is told about", async () => {
    await post({ intent: "hold", user: "u1", state: "review", reason: "x", category: "hate" });
    await post({ intent: "hold", user: "u1", state: "", reason: "back" });
    await post({ intent: "media", media: "m1", approved: "true" });
    expect(mockedRpc.mock.calls.filter((c) => c[1] === "admin_reason_categories")).toHaveLength(1);
  });

  it("leaves the category to the database when the list can't be read", async () => {
    listed = new Error("network");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const answer = await post({ intent: "hold", user: "u1", state: "review", reason: "x", category: "hate" });
    expect(answer.data.ok).toBe(true);
    expect(calls()[0][2]).toMatchObject({ p_category: "hate" });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("answers a decide without its category with a 400, deciding nothing", async () => {
    const answer = await post({ intent: "decide", decision: JSON.stringify({ ...ban, category: undefined }) });
    expect(answer.init?.status).toBe(400);
    expect(answer.data).toEqual({ ok: false, error: "Choose the reason they're told." });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("approves a photo from a form without any category", async () => {
    const answer = await post({ intent: "media", media: "m1", approved: "true" });
    expect(answer.data.ok).toBe(true);
    expect(calls()[0].slice(1)).toEqual(["admin_review_media", { p_media: "m1", p_approved: true, p_reason: null }]);
  });

  it("sends a note of exactly 1,000 characters, trimmed", () => {
    const note = "x".repeat(1000);
    expect(decisionCall({ ...ban, details: ` ${note} ` })?.args.p_details).toBe(note);
  });

  it("refuses a category that isn't text, and a photo decision without one", () => {
    expect(() => decisionCall({ ...ban, category: 5 })).toThrow(Refusal);
    expect(() => decisionCall({ intent: "photo", media: "m1" })).toThrow("Choose the reason they're told.");
  });

  it("refuses a resolution the hold's reason couldn't repeat", async () => {
    const answer = await post({
      intent: "report",
      report: "r1",
      user: "u1",
      resolution: "x".repeat(993),
      hold: "review",
      category: "hate",
    });
    expect(answer.init?.status).toBe(400);
    expect(calls()).toEqual([]);
  });

  it("answers a refusal of the database with its status", async () => {
    refuse(new DbError("not allowed", "forbidden", 403));
    const answer = await post({ intent: "hold", user: "u1", state: "review", reason: "x", category: "hate" });
    expect(answer.init?.status).toBe(403);
    expect(answer.data.error).toBe("Your role doesn't allow this.");
  });
});

describe("support replies", () => {
  const key = crypto.randomUUID();

  it("sends the reply form's key, so the database sends a reply once", async () => {
    const reply = { intent: "support-reply", id: "12", body: "Bonjour", close: "true", key };
    await post(reply);
    await post(reply);
    expect(calls()).toHaveLength(2);
    for (const call of calls()) {
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
    reply(2);
    const answer = await post([
      ["intent", "events-replay"],
      ["id", "7"],
      ["id", "9"],
      ["id", "7"],
    ]);
    expect(calls()[0].slice(1)).toEqual(["admin_replay_events", { p_ids: [7, 9], p_reason: null }]);
    expect(answer.data).toEqual({ ok: true, message: "2 events sent again." });
  });

  it("discards with the reason", async () => {
    reply(1);
    const answer = await post({ intent: "events-discard", id: "7", reason: "match gone" });
    expect(calls()[0].slice(1)).toEqual(["admin_discard_events", { p_ids: [7], p_reason: "match gone" }]);
    expect(answer.data).toEqual({ ok: true, message: "1 event discarded." });
  });

  it("says when someone else handled them first", async () => {
    reply(0);
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
    refuse(new DbError("not allowed", "forbidden", 400));
    const answer = await post({ intent: "events-discard", id: "7", reason: "x" });
    expect(answer.data).toEqual({ ok: false, error: "Your role doesn't allow this." });
  });
});
