import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Staff } from "~/lib/roles";

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

const { DbError, rpc } = await import("~/lib/.server/db");
const { deletionCheck } = await import("~/lib/.server/deletion");
const mockedRpc = vi.mocked(rpc);

const admin: Staff = { email: "admin@drafft.test", role: "admin" };
const ready = { status: "ready", outcome: "erased", emails: ["lea@drafft.test"], emailed: true };

beforeEach(() => {
  mockedRpc.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("the deletion preview on the account page", () => {
  it("asks nothing below admin", async () => {
    for (const role of ["support", "moderator"] as const) {
      expect(await deletionCheck({ email: "x@drafft.test", role }, "u1", "DR-ABC234")).toBeNull();
    }
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("passes the support reference it was opened from, normalised", async () => {
    mockedRpc.mockResolvedValueOnce(ready);
    expect(await deletionCheck(admin, "u1", " dr-abc234 ")).toEqual({ ok: true, preview: ready });
    expect(mockedRpc.mock.calls[0].slice(1)).toEqual(["admin_account_deletion_preview", { p_user: "u1", p_reference: "DR-ABC234" }]);
  });

  it.each([null, "", "email", "DR-12"])("passes no reference for %j", async (requested) => {
    mockedRpc.mockResolvedValueOnce(ready);
    await deletionCheck(admin, "u1", requested);
    expect(mockedRpc.mock.calls[0][2]).toEqual({ p_user: "u1", p_reference: null });
  });

  it("says a reference no request has", async () => {
    mockedRpc.mockRejectedValueOnce(new DbError("no support request has this reference", "unknown_reference", 400));
    expect(await deletionCheck(admin, "u1", "DR-ABC234")).toEqual({ ok: false, error: "No support request has the reference DR-ABC234." });
  });

  it("turns any other failure into a reason shown on the page, logged", async () => {
    for (const error of [new DbError("x", "forbidden", 403), new DbError("x", "PGRST202", 404), new TypeError("fetch failed")]) {
      mockedRpc.mockRejectedValueOnce(error);
      expect(await deletionCheck(admin, "u1", null)).toEqual({ ok: false, error: expect.stringMatching(/^Couldn't check/) });
    }
    expect(console.error).toHaveBeenCalledTimes(3);
  });
});
