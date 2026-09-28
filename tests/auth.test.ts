// The Access token check (app/lib/.server/auth.ts) against a fake team: its keys, its database answer.
// No network: `fetch` is stubbed, keys are generated per run.
import { exportJWK, generateKeyPair, SignJWT, type JWK, type JWTPayload } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const TEAM = "https://team.cloudflareaccess.test";
const AUD = "aud-test";

vi.mock("cloudflare:workers", () => ({
  env: {
    DRAFFT_ENV: "production",
    AUTH_MODE: "access",
    ACCESS_TEAM_DOMAIN: TEAM,
    ACCESS_AUD: AUD,
    SUPABASE_URL: "https://db.test",
    SUPABASE_SECRET_KEY: "fake",
    MEDIA_PUBLIC_URL: "https://media.test",
  },
}));

const { AuthError, identify } = await import("~/lib/.server/auth");

type Key = { kid: string; privateKey: CryptoKey; publicKey: CryptoKey; jwk: JWK };
async function key(kid: string): Promise<Key> {
  const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
  return { kid, privateKey, publicKey, jwk: { ...(await exportJWK(publicKey)), kid, alg: "RS256", use: "sig" } };
}

let k1: Key;
let rogue: Key;
let jwksStatus = 200;
const staffEmails = new Set(["mod@test.dev"]);

beforeAll(async () => {
  k1 = await key("k1");
  rogue = await key("k1"); // someone else's key under a known kid
});

beforeEach(() => {
  jwksStatus = 200;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.href === `${TEAM}/cdn-cgi/access/certs`) {
      return new Response(JSON.stringify({ keys: [k1.jwk] }), { status: jwksStatus });
    }
    if (url.pathname === "/rest/v1/rpc/admin_whoami") {
      const { p_email } = JSON.parse(String(init?.body)) as { p_email: string };
      return Response.json(staffEmails.has(p_email) ? "moderator" : null);
    }
    return new Response("no network in tests", { status: 599 });
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const now = () => Math.floor(Date.now() / 1000);
const claims = (extra: JWTPayload = {}): JWTPayload => ({
  iss: TEAM,
  aud: [AUD],
  email: "mod@test.dev",
  sub: "u1",
  iat: now(),
  exp: now() + 3600,
  ...extra,
});

/** A token signed by `signer`, with claims left out when set to undefined. */
function sign(payload: JWTPayload, signer: Key = k1) {
  const clean = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
  return new SignJWT(clean).setProtectedHeader({ alg: "RS256", kid: signer.kid, typ: "JWT" }).sign(signer.privateKey);
}

const bytes = (v: string) => new TextEncoder().encode(v);
const b64u = (data: Uint8Array) =>
  btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const hs256 = (secret: string) => async (input: string) => {
  const hmac = await crypto.subtle.importKey("raw", bytes(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", hmac, bytes(input)));
};
/** A hand-built token, for the algorithms jose won't sign with a public key. */
async function forge(header: object, payload: object, mac?: (input: string) => Promise<Uint8Array>) {
  const input = `${b64u(bytes(JSON.stringify(header)))}.${b64u(bytes(JSON.stringify(payload)))}`;
  return `${input}.${mac ? b64u(await mac(input)) : ""}`;
}
async function pem(publicKey: CryptoKey) {
  const der = new Uint8Array(await crypto.subtle.exportKey("spki", publicKey));
  const body = btoa(String.fromCharCode(...der)).replace(/.{64}/g, "$&\n");
  return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----\n`;
}

const request = (headers: Record<string, string>) => new Request("https://sophros.test/", { headers });
const withToken = (token: string) => request({ "cf-access-jwt-assertion": token });

async function status(req: Request): Promise<number> {
  try {
    await identify(req);
    return 200;
  } catch (error) {
    if (error instanceof AuthError) return error.status;
    throw error;
  }
}

describe("identify with Cloudflare Access", () => {
  it("accepts a valid token, from the header or the cookie", async () => {
    expect(await identify(withToken(await sign(claims())))).toEqual({ email: "mod@test.dev", role: "moderator" });
    expect(await status(request({ cookie: `CF_Authorization=${await sign(claims())}` }))).toBe(200);
  });

  it("lowercases the email", async () => {
    expect((await identify(withToken(await sign(claims({ email: "MOD@TEST.DEV" }))))).email).toBe("mod@test.dev");
  });

  it("refuses staff it doesn't know with a 403", async () => {
    expect(await status(withToken(await sign(claims({ email: "nobody@test.dev" }))))).toBe(403);
  });

  it("refuses a missing token", async () => {
    expect(await status(request({}))).toBe(401);
  });

  it("refuses tokens that aren't RS256 signatures from the team", async () => {
    const forged = [
      await forge({ alg: "none", typ: "JWT" }, claims()),
      await forge({ alg: "none", kid: "k1" }, claims()),
      await forge({ alg: "HS256", kid: "k1" }, claims(), hs256(await pem(k1.publicKey))),
      await forge({ alg: "HS256", kid: "k1" }, claims(), hs256(JSON.stringify(k1.jwk))),
      await forge({ alg: "HS256", kid: "k1" }, claims(), hs256(String(k1.jwk.n))),
      await sign(claims(), rogue),
      "garbage",
    ];
    for (const token of forged) expect(await status(withToken(token))).toBe(401);
  });

  it("requires exp, iat and email", async () => {
    for (const missing of ["exp", "iat", "email"]) {
      expect(await status(withToken(await sign(claims({ [missing]: undefined }))))).toBe(401);
    }
    expect(await status(withToken(await sign(claims({ email: "" }))))).toBe(401);
  });

  it("refuses expired, not yet valid, foreign audience or issuer", async () => {
    const bad = [
      claims({ exp: now() - 1 }),
      claims({ nbf: now() + 60 }),
      claims({ aud: ["another-aud"] }),
      claims({ iss: "https://other.cloudflareaccess.test" }),
      claims({ iss: `${TEAM}/` }),
    ];
    for (const payload of bad) expect(await status(withToken(await sign(payload)))).toBe(401);
  });

  it("uses the header first, without falling back to the cookie", async () => {
    const good = await sign(claims());
    expect(await status(request({ "cf-access-jwt-assertion": good, cookie: "CF_Authorization=garbage" }))).toBe(200);
    expect(await status(request({ "cf-access-jwt-assertion": "garbage", cookie: `CF_Authorization=${good}` }))).toBe(401);
  });

  it("answers a malformed cookie with a 401, not a crash", async () => {
    expect(await status(request({ cookie: "CF_Authorization=%E0%A4%A" }))).toBe(401);
  });

  it("logs why a token was refused, never the token", async () => {
    const token = await sign(claims({ exp: now() - 1 }));
    await status(withToken(token));
    expect(console.warn).toHaveBeenCalledWith("sophros: Access token refused", { code: "ERR_JWT_EXPIRED", claim: "exp" });
    const logged = JSON.stringify(vi.mocked(console.warn).mock.calls);
    expect(logged).not.toContain(token.split(".")[2]);
  });
});

describe("identify when the team's keys are out of reach", () => {
  it("refuses with a 401 and logs an error", async () => {
    vi.resetModules();
    const fresh = await import("~/lib/.server/auth");
    jwksStatus = 503;
    await expect(fresh.identify(withToken(await sign(claims())))).rejects.toMatchObject({ status: 401 });
    expect(console.error).toHaveBeenCalledWith("sophros: Access token refused", { code: "ERR_JOSE_GENERIC" });
  });
});
