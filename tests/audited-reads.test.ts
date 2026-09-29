// Sensitive reads: an account page's loader runs only for a read that happens, and a selfie opens only
// for a reason typed by the person.
// `cloudflare:workers` and `fetch` are stubbed: no network.
import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { revalidateOnNewRead } from "~/lib/audited-reads";
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

const url = (path: string) => new URL(path, "https://sophros.test");
const nav = (from: string, to: string) => ({ currentUrl: url(from), nextUrl: url(to), defaultShouldRevalidate: true });

describe("account revalidation", () => {
  const should = revalidateOnNewRead(() => "");
  it("doesn't read the account again for another tab", () => {
    expect(should(nav("/accounts/a", "/accounts/a?tab=safety"))).toBe(false);
    expect(should(nav("/accounts/a?tab=safety", "/accounts/a"))).toBe(false);
  });
  it("reads another account, the same link again, and after a change", () => {
    expect(should(nav("/accounts/a", "/accounts/b"))).toBe(true);
    expect(should(nav("/accounts/a?tab=safety", "/accounts/a?tab=safety"))).toBe(true);
    expect(should({ ...nav("/accounts/a", "/accounts/a"), formMethod: "POST", formAction: "/act" })).toBe(true);
  });
  it("keeps the router's answer for a failed change, and ignores the theme switch", () => {
    expect(should({ ...nav("/accounts/a", "/accounts/a"), formMethod: "POST", formAction: "/act", defaultShouldRevalidate: false })).toBe(
      false,
    );
    expect(should({ ...nav("/accounts/a", "/accounts/a"), formMethod: "POST", formAction: "/theme" })).toBe(false);
  });
});

describe("verifications loader", () => {
  afterEach(() => vi.unstubAllGlobals());

  const person = (id: string) => ({ id, name: id, photo: null, moderation: "selfie" });
  const queue = {
    selfies: Array.from({ length: 30 }, (_, i) => ({ person: person(`u${i}`), selfieAt: "", cause: null, since: "", photos: [] })),
    reviews: [],
    waitingSelfie: [],
  };

  it("reads the queue and no selfie: each opens for a reason typed on the case", async () => {
    const calls = stubDatabase({ admin_verifications: queue });
    const { loader } = await import("~/routes/verifications");
    const data = await loader({
      request: new Request(url("/verifications?case=u7")),
      context: staffAs("moderator"),
      params: {},
    } as unknown as Parameters<typeof loader>[0]);
    expect(calls.map((c) => c.path)).toEqual(["/rest/v1/rpc/admin_verifications"]);
    expect(data).toEqual({ queue });
  });
});

describe("selfie-data", () => {
  afterEach(() => vi.unstubAllGlobals());

  async function open(fields: Record<string, string>, answer: unknown = [{ path: "s.jpg", createdAt: "" }]) {
    const calls = stubDatabase({ admin_selfies: answer });
    const { action } = await import("~/routes/selfie-data");
    const request = new Request(url("/selfie-data"), { method: "POST", body: new URLSearchParams(fields) });
    const result = (await action({ request, context: staffAs("moderator"), params: {} } as unknown as Parameters<
      typeof action
    >[0])) as unknown as {
      data: unknown;
      init: { status?: number } | null;
    };
    return { calls, result };
  }

  it("logs the viewing with the reason typed, then signs the latest selfie", async () => {
    const { calls, result } = await open({ user: "u7", reason: "  comparing with photo 2  " });
    expect(calls.map((c) => c.path.split("/").slice(0, 5).join("/"))).toEqual(["/rest/v1/rpc/admin_selfies", "/storage/v1/object/sign"]);
    expect(calls[0].args).toEqual({ p_user: "u7", p_reason: "comparing with photo 2", p_actor: "mod@test.dev" });
    expect(result.data).toEqual({ ok: true, user: "u7", url: "https://db.test/storage/v1/object/sign/s.jpg?token=t" });
  });

  it("opens nothing without a reason of the person's own", async () => {
    for (const reason of ["", "   ", "Opened in sophros"]) {
      const { calls, result } = await open({ user: "u7", reason });
      expect(calls).toEqual([]);
      expect(result.init?.status).toBe(400);
      expect(result.data).toMatchObject({ ok: false });
    }
  });

  it("explains a refusal from the database", async () => {
    const { result } = await open({ user: "u7", reason: "checking" }, { status: 400, hint: "forbidden" });
    expect(result.data).toEqual({ ok: false, error: "Your role doesn't allow this." });
  });
});

/** Answers PostgREST calls by function name (`{ status, hint }`: a refusal) and signs any object. */
function stubDatabase(answers: Record<string, unknown>) {
  const calls: { path: string; args: Record<string, unknown> }[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = new URL(input instanceof Request ? input.url : String(input));
    calls.push({ path: u.pathname, args: JSON.parse(String(init?.body ?? "{}")) });
    const fn = u.pathname.split("/rpc/")[1];
    if (fn && fn in answers) {
      const answer = answers[fn] as { status?: number; hint?: string };
      if (answer && typeof answer === "object" && "hint" in answer)
        return Response.json({ message: "refused", hint: answer.hint }, { status: answer.status ?? 400 });
      return Response.json(answer);
    }
    if (u.pathname.startsWith("/storage/v1/object/sign/")) return Response.json({ signedURL: "/object/sign/s.jpg?token=t" });
    return new Response("no network in tests", { status: 599 });
  });
  return calls;
}

function staffAs(role: "support" | "moderator" | "admin") {
  const context = new RouterContextProvider();
  context.set(staffContext, { email: role === "admin" ? "admin@test.dev" : "mod@test.dev", role });
  return context;
}
