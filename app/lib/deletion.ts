// Deleting an account at the member's request (drafft-backend: admin_delete_account). Admins only: nothing undoes
// it. The member asked by email, from the account's address, or gave its phone number and confirmed it.
import type { DeletionPreview } from "~/lib/types";

/** The request behind a deletion as the backend takes it: a support reference (DR-XXXXXX, uppercase) or "email"
 * (a message outside the support requests). Null: neither. */
export function deletionReference(value: string): string | null {
  const v = value.trim();
  if (v.toLowerCase() === "email") return "email";
  return /^DR-[A-Z0-9]{6}$/i.test(v) ? v.toUpperCase() : null;
}

const basis: Record<NonNullable<DeletionPreview["basis"]>, string> = {
  ban: "it is banned",
  hold: "it is held for review",
  report: "a report about it is still open",
};

/** What will happen, said before confirming. */
export function deletionOutcome(p: DeletionPreview): string {
  if (p.outcome === "erase") {
    return "Erased: profile, chats, photos and videos, selfies, data exports and the sign-in. It can't be undone.";
  }
  return `Kept for members' safety, because ${p.basis ? basis[p.basis] : "the database says so"}: hidden from everyone and signed out for good, its data kept as the privacy policy says. It can't be undone.`;
}

/** Where the member's confirmation goes (the address the account has now). */
export function confirmationTo(p: DeletionPreview): string {
  return p.email ? `${p.email}, in their language` : "nobody: the account has no email";
}
