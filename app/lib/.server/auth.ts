// Who is asking. In staging and production, Cloudflare Access stands in front of the Worker (SSO, MFA,
// the team's policy) and signs each request with a JWT; it is verified here too, so a request that
// reached the Worker some other way is refused. Then the database says whether that email is staff, and
// with which role. Locally (AUTH_MODE=dev, local database only), the identity is DEV_STAFF_EMAIL.
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Role, Staff } from "~/lib/roles";
import { getConfig } from "./config";
import { call } from "./db";

export class AuthError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
    readonly email?: string,
  ) {
    super(message);
  }
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

async function accessEmail(request: Request, teamDomain: string, audience: string): Promise<string> {
  const token = request.headers.get("cf-access-jwt-assertion") ?? cookie(request, "CF_Authorization");
  if (!token) throw new AuthError(401, "No Cloudflare Access token: open sophros through its Access URL.");
  jwks ??= createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: teamDomain, audience });
    if (typeof payload.email !== "string" || !payload.email) throw new Error("no email in the token");
    return payload.email.toLowerCase();
  } catch {
    throw new AuthError(401, "Your Cloudflare Access session is invalid or expired. Reload to sign in again.");
  }
}

function cookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function identify(request: Request): Promise<Staff> {
  const { auth } = getConfig();
  let email: string;
  if (auth.mode === "dev") {
    const host = new URL(request.url).hostname;
    if (host !== "localhost" && host !== "127.0.0.1") throw new AuthError(403, "Dev sign-in only answers on localhost.");
    email = auth.email;
  } else {
    email = await accessEmail(request, auth.teamDomain, auth.audience);
  }
  const role = await call<Role | null>("admin_whoami", { p_email: email });
  if (!role) throw new AuthError(403, "This account isn't on the sophros staff for this environment.", email);
  return { email, role };
}
