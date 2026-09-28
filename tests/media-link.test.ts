// Media links: the same signature as the backend and the media Worker, and /media/<key> only for keys
// drafft issues. `cloudflare:workers` is stubbed: no network.
import { RouterContextProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  env: {
    DRAFFT_ENV: "production",
    AUTH_MODE: "access",
    ACCESS_TEAM_DOMAIN: "https://team.cloudflareaccess.test",
    ACCESS_AUD: "aud",
    SUPABASE_URL: "https://db.test",
    SUPABASE_SECRET_KEY: "fake",
    MEDIA_PUBLIC_URL: "https://media.test/",
    MEDIA_SIGNING_KEY: "test-signing-key",
  },
}));

const { mediaExpiry, mediaLink, mediaSignature } = await import("~/lib/media-link");
const { loader } = await import("~/routes/media");
const { staffContext } = await import("~/lib/context");

const key = "u/0b6f1f5e-8f0c-4a5e-9d3b-2f8a1c7e4d10/photos/a.jpg";

describe("media links", () => {
  it("sign like the backend and the media Worker (shared vector)", async () => {
    expect(await mediaSignature("test-signing-key", key, 1700000000)).toBe("I1YxT7hgXlCCw0Jkq79-oMnamOJOSSZn9MRs6E3d3Uw");
  });

  it("last one hour to one hour and a quarter, on a quarter hour", () => {
    const now = Date.UTC(2026, 8, 28, 10, 7, 30);
    const exp = mediaExpiry(now);
    expect(exp % 900).toBe(0);
    expect(exp - now / 1000).toBeGreaterThanOrEqual(3600);
    expect(exp - now / 1000).toBeLessThan(4500);
  });

  it("stay plain without a signing key, and keep only the widths the Worker knows", async () => {
    expect(await mediaLink("https://media.test", null, key)).toBe(`https://media.test/${key}`);
    expect(await mediaLink("https://media.test", null, key, 640)).toBe(`https://media.test/${key}?w=640`);
    expect(await mediaLink("https://media.test", null, key, 641)).toBe(`https://media.test/${key}`);
  });
});

describe("/media/<key>", () => {
  const context = () => {
    const c = new RouterContextProvider();
    c.set(staffContext, { email: "mod@test.dev", role: "moderator" });
    return c;
  };
  const call = (path: string) =>
    loader({
      params: { "*": path },
      request: new Request(`https://sophros.test/media/${path}`),
      context: context(),
    } as never);

  it("redirects to a signed link", async () => {
    const res = (await call(key)) as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toMatch(
      new RegExp(`^https://media\\.test/${key.replace(/\./g, "\\.")}\\?exp=\\d+&sig=[A-Za-z0-9_-]{43}$`),
    );
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=600");
  });

  it("refuses anything that isn't a drafft media key", async () => {
    for (const path of ["u/x/photos/a.jpg", `${key}/../../secret`, "", "selfies/a.jpg"]) {
      await expect(call(path)).rejects.toMatchObject({ init: { status: 404 } });
    }
  });
});
