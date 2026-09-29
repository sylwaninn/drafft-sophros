// A verification selfie, opened for a reason the person types (no default): admin_selfies logs the
// viewing (selfie.view) with it and returns the files; the latest is shown through a 5-minute link.
// Posted, so the reason stays out of URLs, and nothing else on the page reloads.
import { data } from "react-router";
import { staffContext } from "~/lib/context";
import { DbError, rpc, signedUrl } from "~/lib/.server/db";
import { refusals } from "~/lib/refusals";
import { typedReason } from "~/lib/reasons";
import type { Route } from "./+types/selfie-data";

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
  try {
    const files = await rpc<{ path: string; createdAt: string }[]>(staff, "admin_selfies", { p_user: user, p_reason: reason });
    return result({ ok: true, user, url: files[0] ? await signedUrl("verification-selfies", files[0].path) : null });
  } catch (error) {
    if (error instanceof DbError)
      return result({ ok: false, error: refusals[error.code] ?? error.message }, error.status === 403 ? 403 : 400);
    throw error;
  }
}

function result(value: SelfieResult, status = 200) {
  return data(value, { status });
}
