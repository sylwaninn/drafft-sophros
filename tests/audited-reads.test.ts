// Pages whose loaders log a sensitive read: they run only for a read that happens.
// `cloudflare:workers` and `fetch` are stubbed: no network.
import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { revalidateOnNewRead, selfieCaseShown } from "~/lib/audited-reads";

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

describe("verifications revalidation", () => {
  const should = revalidateOnNewRead(selfieCaseShown);
  it("doesn't reload for tabs without a selfie", () => {
    expect(should(nav("/verifications", "/verifications?tab=reviews"))).toBe(false);
    expect(should(nav("/verifications?tab=reviews", "/verifications?tab=owed"))).toBe(false);
  });
  it("loads the selfie of the case that comes to the front", () => {
    expect(should(nav("/verifications?tab=reviews", "/verifications"))).toBe(true);
    expect(should(nav("/verifications", "/verifications?case=b"))).toBe(true);
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

  async function load(path: string, role = "moderator") {
    const calls: { path: string; args: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = new URL(input instanceof Request ? input.url : String(input));
      calls.push({ path: u.pathname, args: JSON.parse(String(init?.body ?? "{}")) });
      if (u.pathname.endsWith("/admin_verifications")) return Response.json(queue);
      if (u.pathname.endsWith("/admin_selfies")) return Response.json([{ path: "s.jpg", createdAt: "" }]);
      if (u.pathname.startsWith("/storage/v1/object/sign/")) return Response.json({ signedURL: "/object/sign/s.jpg?token=t" });
      return new Response("no network in tests", { status: 599 });
    });
    const { loader } = await import("~/routes/verifications");
    const { staffContext } = await import("~/lib/context");
    const context = new RouterContextProvider();
    context.set(staffContext, { email: "mod@test.dev", role: role as "moderator" });
    const data = await loader({ request: new Request(url(path)), context, params: {} } as unknown as Parameters<typeof loader>[0]);
    return { data, calls };
  }

  it("signs and logs the case in front only", async () => {
    const { data, calls } = await load("/verifications");
    expect(calls.map((c) => c.path.split("/").slice(0, 5).join("/"))).toEqual([
      "/rest/v1/rpc/admin_verifications",
      "/rest/v1/rpc/admin_selfies",
      "/storage/v1/object/sign",
    ]);
    expect(calls[1].args.p_user).toBe("u0");
    expect(data.selfie?.user).toBe("u0");
  });

  it("follows the picked case", async () => {
    const { data, calls } = await load("/verifications?case=u7");
    expect(calls[1].args.p_user).toBe("u7");
    expect(data.selfie?.user).toBe("u7");
  });

  it("reads no selfie on the other tabs, nor for support", async () => {
    for (const [path, role] of [
      ["/verifications?tab=reviews", "moderator"],
      ["/verifications?tab=owed", "moderator"],
      ["/verifications", "support"],
    ]) {
      const { data, calls } = await load(path, role);
      expect(calls.map((c) => c.path)).toEqual(["/rest/v1/rpc/admin_verifications"]);
      expect(data.selfie).toBeNull();
    }
  });
});
