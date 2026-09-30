// A verification selfie, opened for a reason the person types (no default): admin_selfies logs the
// viewing (selfie.view) with it and returns the files; the latest is shown through a 5-minute link.
// Posted, so the reason stays out of URLs, and nothing else on the page reloads.
import { data } from "react-router";
import { staffContext } from "~/lib/context";
import { DbError, rpc, signedUrl } from "~/lib/.server/db";
import { refusalMessage } from "~/lib/refusals";
import { typedReason } from "~/lib/reasons";
import type { Route } from "./+types/selfie-data";

/** The selfie's link (null: they never sent one), or why it isn't shown. */
export type SelfieResult = { ok: true; user: string; url: string | null } | { ok: false; error: string };

export async function action({ request, context }: Route.ActionArgs) {
  const staff = context.get(staffContext);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return result({ ok: false, error: "That wasn't a form." }, 400);
  }
  const user = String(form.get("user") ?? "").trim();
  const reason = typedReason(form.get("reason"));
  if (!reason) return result({ ok: false, error: "Say why you're opening the selfie: the reason goes to the audit log." }, 400);
  let files: { path: string }[];
  try {
    files = selfieFiles(await rpc<unknown>(staff, "admin_selfies", { p_user: user, p_reason: reason }));
  } catch (error) {
    if (error instanceof DbError)
      return result({ ok: false, error: refusalMessage(error.code) ?? error.message }, error.status === 403 ? 403 : 400);
    throw error;
  }
  if (files.length === 0) return result({ ok: true, user, url: null });
  try {
    return result({ ok: true, user, url: await signedUrl("verification-selfies", files[0].path) });
  } catch (error) {
    // Storage failed, not the selfie: say so, so nobody takes it for a missing one.
    console.error("selfie-data sign", user, error);
    return result({ ok: false, error: "The selfie link couldn't be made. Try again." }, 502);
  }
}

/** admin_selfies' answer, newest first: the entries with a path. */
export function selfieFiles(value: unknown): { path: string }[] {
  if (!Array.isArray(value)) return [];
  return value.filter((f): f is { path: string } => !!f && typeof f === "object" && typeof (f as { path?: unknown }).path === "string");
}

function result(value: SelfieResult, status = 200) {
  return data(value, { status });
}
