// The drawer's older messages: every failure says why, instead of the conversation seeming to start there.
import { afterEach, describe, expect, it, vi } from "vitest";
import { olderMessages } from "~/lib/older-messages";

const page = { exists: true, messages: [{ id: "m1", type: "regular", text: "hi" }], hasMore: true };

afterEach(() => vi.restoreAllMocks());

describe("olderMessages", () => {
  it("gives the page", async () => {
    expect(await olderMessages(Response.json({ ok: true, messages: page }))).toEqual({ ok: true, page });
  });

  it("says Stream failed", async () => {
    expect(await olderMessages(Response.json({ ok: true, messages: null, streamError: "Stream 503" }))).toEqual({
      ok: false,
      error: "Stream couldn't be read: Stream 503",
    });
  });

  it("gives the refusal's words", async () => {
    const refused = Response.json({ ok: false, code: "no_basis", error: "Only an admin can read it." }, { status: 400 });
    expect(await olderMessages(refused)).toEqual({ ok: false, error: "Only an admin can read it." });
  });

  it("says a server error with its status, and logs it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await olderMessages(new Response("<html>oops</html>", { status: 500, headers: { "content-type": "text/html" } }))).toEqual({
      ok: false,
      error: "The older messages couldn't be read (HTTP 500).",
    });
    expect(error).toHaveBeenCalled();
  });
});
