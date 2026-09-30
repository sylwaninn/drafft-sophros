// Deleting an account at the member's request (drafft-backend: admin_account_deletion_preview,
// admin_delete_account). Admins only: nothing undoes it. The member wrote to support from the account's email
// address, or from another address giving its phone number, and confirmed it was them.
import { can, type Staff } from "~/lib/roles";
import type { DeleteAccountResult, DeletionCheck, DeletionConfirmation, ReadyDeletion, RetentionBasis, SupportRequest } from "~/lib/types";

/** A request as the backend takes it: its support reference, uppercase, or "email" for a message outside them. */
export type DeletionReference = `DR-${string}` | "email";

/** The request behind a deletion, normalised. Null: neither a support reference nor "email". */
export function deletionReference(value: string | null | undefined): DeletionReference | null {
  const v = (value ?? "").trim();
  if (v.toLowerCase() === "email") return "email";
  return /^DR-[A-Z0-9]{6}$/i.test(v) ? (v.toUpperCase() as DeletionReference) : null;
}

/** From a support request, the account page with its deletion dialog open on this request. Null below admin,
 * without an account, or for an account deleted already (erased, or kept for members' safety). */
export function deletionLink(staff: Staff, r: Pick<SupportRequest, "reference" | "person">): string | null {
  if (!can(staff, "admin") || !r.person || r.person.deleted || r.person.deletedAt) return null;
  return `/accounts/${r.person.id}?${new URLSearchParams({ delete: r.reference })}`;
}

/** Opened from a support request (`?delete=DR-XXXXXX`): the dialog opens with that reference. Otherwise it stays
 * closed and the reference is left for the admin to give. */
export function deletionPrefill(params: URLSearchParams): { open: boolean; reference: string } {
  return { open: params.has("delete"), reference: params.get("delete") ?? "" };
}

/** Whether the account can be deleted now, and if not, why (null: not for this role). */
export function deletionAvailability(check: DeletionCheck): { ok: true; preview: ReadyDeletion } | { ok: false; why: string | null } {
  if (!check) return { ok: false, why: null };
  if (!check.ok) return { ok: false, why: check.error };
  switch (check.preview.status) {
    case "deleted":
      return { ok: false, why: "This account is deleted already." };
    case "pending":
      return { ok: false, why: "A deletion of this account is already on its way." };
    case "ready":
      return { ok: true, preview: check.preview };
  }
}

const basis: Record<RetentionBasis, string> = {
  ban: "it is banned",
  hold: "it is held for review",
  report: "a report about it is still open",
};

/** What will happen, said before confirming. */
export function deletionOutcome(p: ReadyDeletion): string {
  if (p.outcome === "erased") {
    return (
      "Erased: profile, chats (except those with a held or banned member), photos and videos, selfies, data exports " +
      "and the sign-in. Checked again when it runs: a report or hold arriving first keeps it. It can't be undone."
    );
  }
  return `Kept for members' safety, because ${basis[p.basis]}: hidden from everyone and signed out for good, its data kept as the privacy policy says. It can't be undone.`;
}

/** Where the member's confirmation goes. `withRequest`: the preview had the request's reference, so its address
 * is in the list; without it, the address of a support request given in the dialog is added too. */
export function confirmationTo(c: DeletionConfirmation, withRequest = true): string {
  if (!c.emailed) {
    return withRequest
      ? "nobody: there's no address to write to, so the team gets an email to confirm another way"
      : "the support request's address if you give one, otherwise nobody: the team gets an email to confirm another way";
  }
  return `${c.emails.join(" and ")}, in their language${withRequest ? "" : ", and the support request's address if you give one"}`;
}

/** The toast once the deletion is queued: the outcome expected now and where the confirmation goes. */
export function deletedMessage(r: DeleteAccountResult): string {
  const outcome =
    r.expected === "erased"
      ? "Deletion on its way: the account will be erased, unless a report or hold arrives first."
      : "Deletion on its way: the account will be kept for members' safety.";
  const told = r.emailed
    ? `Confirmation to ${r.emails.join(" and ")}.`
    : "No address to confirm to: the team gets an email to confirm another way.";
  return `${outcome} ${told}`;
}
