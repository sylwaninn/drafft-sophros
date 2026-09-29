// What the database's refusals (their stable code, DbError.code) mean for the person on the page. Plain
// strings: route modules share them with the functions they export.
export const refusals: Record<string, string> = {
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
  no_basis: "No report, help request or hold concerns these two: only an admin can read it, as an override.",
};
