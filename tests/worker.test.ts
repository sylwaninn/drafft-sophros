// The Worker's guards around the database: who is named as the actor, what /act accepts, how far a
// list pages. `cloudflare:workers` and `fetch` are stubbed: no network.
import { RouterContextProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const { rpc } = await import("~/lib/.server/db");
const { action } = await import("~/routes/act");
const { staffContext } = await import("~/lib/context");
const { MAX_PAGE, pageParam } = await import("~/lib/paging");

const staff = { email: "mod@test.dev", role: "moderator" } as const;
const calls: { fn: string; args: Record<string, unknown> }[] = [];

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push({ fn: url.pathname.replace("/rest/v1/rpc/", ""), args: JSON.parse(String(init?.body ?? "{}")) });
    return new Response("", { status: 200 });
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("rpc", () => {
  it("always names the staff member acting, whatever the arguments say", async () => {
    await rpc(staff, "admin_add_note", { p_user: "u1", p_actor: "someone@else.dev" });
    expect(calls).toEqual([{ fn: "admin_add_note", args: { p_user: "u1", p_actor: "mod@test.dev" } }]);
  });
});

describe("/act", () => {
  const run = (init: RequestInit) => {
    const context = new RouterContextProvider();
    context.set(staffContext, staff);
    const request = new Request("https://sophros.test/act", init);
    return action({ request, context, params: {} } as unknown as Parameters<typeof action>[0]);
  };
  const statusOf = (result: unknown) => (result as { init?: { status?: number } }).init?.status;

  it("takes a posted form", async () => {
    const body = new URLSearchParams({ intent: "note", user: "u1", body: "seen" });
    expect(statusOf(await run({ method: "POST", body }))).toBe(200);
    expect(calls.map((c) => c.fn)).toEqual(["admin_add_note"]);
  });

  it("refuses any other method, before touching the database", async () => {
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      const body = new URLSearchParams({ intent: "note", user: "u1", body: "seen" });
      expect(statusOf(await run({ method, body }))).toBe(405);
    }
    expect(calls).toEqual([]);
  });

  it("answers a body that isn't a form with a 400", async () => {
    const result = await run({ method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    expect(statusOf(result)).toBe(400);
    expect(calls).toEqual([]);
  });
});

describe("pageParam", () => {
  it("keeps whole pages within bounds", () => {
    expect(pageParam(null)).toBe(0);
    expect(pageParam("3")).toBe(3);
    expect(pageParam("2.7")).toBe(2);
    expect(pageParam("-4")).toBe(0);
    expect(pageParam("abc")).toBe(0);
    expect(pageParam("1e308")).toBe(MAX_PAGE);
    expect(pageParam("Infinity")).toBe(0);
  });
});
