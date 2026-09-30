// The database, through PostgREST with the secret key: only the service-role `admin_*` functions of
// drafft-backend (migration 20260927000007_sophros). Each call names the staff member acting; the
// database checks their role and writes the audit log.
import { data } from "react-router";
import type { Staff } from "~/lib/roles";
import { getConfig } from "./config";

/** A refusal the database explains with a stable code (its `hint`): forbidden, reason_required and so on. */
export class DbError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { supabaseUrl, supabaseKey } = getConfig();
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      authorization: `Bearer ${supabaseKey}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) {
    let body: { message?: string; hint?: string; code?: string } = {};
    try {
      body = JSON.parse(text);
    } catch {
      // Not PostgREST speaking (a proxy, a timeout): keep the status.
    }
    throw new DbError(body.message ?? `${fn}: HTTP ${res.status}`, body.hint ?? body.code ?? "error", res.status);
  }
  return (text ? JSON.parse(text) : null) as T;
}

/** An admin function, as this staff member: the actor always comes last, so no argument can replace it. */
export function rpc<T>(staff: Staff, fn: `admin_${string}`, args: Record<string, unknown> = {}): Promise<T> {
  return call<T>(fn, { ...args, p_actor: staff.email });
}

/**
 * An admin function for a loader: refusals become HTTP errors the page's error boundary shows
 * (a role too low for the page, an account that doesn't exist).
 */
export async function query<T>(staff: Staff, fn: `admin_${string}`, args: Record<string, unknown> = {}): Promise<T> {
  try {
    return await rpc<T>(staff, fn, args);
  } catch (error) {
    if (error instanceof DbError) {
      if (error.code === "forbidden") throw data("Your role doesn't open this page.", { status: 403 });
      if (error.code === "not_found" || error.code === "22P02") throw data("Not found.", { status: 404 });
    }
    throw error;
  }
}

/** Short-lived URL for a private object (verification selfies). Throws when Storage doesn't give one. */
export async function signedUrl(bucket: string, path: string, expiresIn = 300): Promise<string> {
  const { supabaseUrl, supabaseKey } = getConfig();
  const res = await fetch(`${supabaseUrl}/storage/v1/object/sign/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: { apikey: supabaseKey, authorization: `Bearer ${supabaseKey}`, "content-type": "application/json" },
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) throw new Error(`storage sign ${bucket}: HTTP ${res.status}`);
  const { signedURL } = (await res.json()) as { signedURL?: string };
  if (!signedURL) throw new Error(`storage sign ${bucket}: no URL in the answer`);
  return `${supabaseUrl}/storage/v1${signedURL}`;
}
