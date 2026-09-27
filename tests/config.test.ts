import { describe, expect, it } from "vitest";
import { loadConfig } from "~/lib/config";

const production = {
  DRAFFT_ENV: "production",
  AUTH_MODE: "access",
  ACCESS_TEAM_DOMAIN: "https://drafft.cloudflareaccess.com/",
  ACCESS_AUD: "aud",
  SUPABASE_URL: "https://ref.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_x",
  MEDIA_PUBLIC_URL: "https://media.example/",
};

describe("loadConfig", () => {
  it("reads an Access-protected environment", () => {
    const config = loadConfig(production);
    expect(config.auth).toEqual({ mode: "access", teamDomain: "https://drafft.cloudflareaccess.com", audience: "aud" });
    expect(config.mediaUrl).toBe("https://media.example");
    expect(config.stream).toBeNull();
  });

  it("refuses the dev identity outside the local database", () => {
    expect(() => loadConfig({ ...production, AUTH_MODE: "dev", DEV_STAFF_EMAIL: "me@x.dev" })).toThrow(/local only/);
    expect(() => loadConfig({ ...production, DRAFFT_ENV: "staging", AUTH_MODE: "dev", DEV_STAFF_EMAIL: "me@x.dev" })).toThrow(/local only/);
  });

  it("allows it locally", () => {
    const config = loadConfig({ ...production, DRAFFT_ENV: "local", AUTH_MODE: "dev", DEV_STAFF_EMAIL: "Me@X.dev", SUPABASE_URL: "http://127.0.0.1:55421" });
    expect(config.auth).toEqual({ mode: "dev", email: "me@x.dev" });
  });

  it("needs Access settings when not in dev mode", () => {
    expect(() => loadConfig({ ...production, ACCESS_AUD: "" })).toThrow(/ACCESS_AUD/);
  });

  it("refuses a plain http database outside local", () => {
    expect(() => loadConfig({ ...production, SUPABASE_URL: "http://ref.supabase.co" })).toThrow(/https/);
  });
});
