// What deleting an account at the member's request would do, for the account page (admins only).
import { deletionReference } from "~/lib/deletion";
import { can, type Staff } from "~/lib/roles";
import type { DeletionCheck, DeletionPreview } from "~/lib/types";
import { DbError, rpc } from "./db";

/**
 * The deletion preview, with the request's reference when the page was opened from one (its address then gets
 * the confirmation too). Null below admin, without a call. A failure doesn't break the account page: it comes
 * back as `{ ok: false, error }`, logged, and the page says why it can't delete.
 */
export async function deletionCheck(staff: Staff, user: string, requested: string | null): Promise<DeletionCheck> {
  if (!can(staff, "admin")) return null;
  // An "email" reference adds no address; a malformed one is refused when the admin confirms.
  const reference = deletionReference(requested);
  try {
    const preview = await rpc<DeletionPreview>(staff, "admin_account_deletion_preview", {
      p_user: user,
      p_reference: reference?.startsWith("DR-") ? reference : null,
    });
    return { ok: true, preview };
  } catch (error) {
    console.error("admin_account_deletion_preview", error);
    if (error instanceof DbError && error.code === "unknown_reference")
      return { ok: false, error: `No support request has the reference ${reference}.` };
    return { ok: false, error: "Couldn't check what deleting this account would do. Reload the page." };
  }
}
