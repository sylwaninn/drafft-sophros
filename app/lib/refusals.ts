// What the database's refusals (their stable code, DbError.code) mean for the person on the page. Plain
// strings: route modules share them with the functions they export.
export const refusals = {
  forbidden: "Your role doesn't allow this.",
  reason_required: "Say why: the reason goes to the audit log.",
  not_found: "It's gone, or already handled.",
  own_role: "You can't change your own role.",
  invalid_role: "Unknown role.",
  empty_reply: "Write the reply first.",
  one_account: "These flags belong to more than one account.",
  invalid_ids: "Choose between 1 and 200 events.",
  invalid_category: "Unknown reason category: nothing was applied. Reload the page and choose again.",
  category_required: "Choose the reason they're told.",
  details_too_long: "The note for them is 1,000 characters at most.",
  invalid_target: "That message isn't one of theirs in this conversation: nothing was applied.",
  no_basis: "No report, help request or hold concerns these two: only an admin can read it, as an override.",
  override_basis_required: "Say why you read it without a basis: a legal request or members' safety.",
  invalid_reference: "Give the support reference (DR-XXXXXX), or email.",
  unknown_reference: "No support request has this reference.",
  already_deleted: "This account is deleted already.",
  already_requested: "A deletion of this account is already on its way.",
  // Postgres' check_violation: a text longer than the database keeps.
  "23514": "Too long for the audit log: shorten the reason and try again.",
} as const satisfies Record<string, string>;

export type RefusalCode = keyof typeof refusals;

/** The explanation for a refusal code, if sophros knows it. */
export function refusalMessage(code: string): string | undefined {
  return Object.hasOwn(refusals, code) ? refusals[code as RefusalCode] : undefined;
}
