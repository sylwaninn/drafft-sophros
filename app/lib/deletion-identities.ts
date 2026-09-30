// What the deletion record of a kept account says about its sign-in identities (admin_account_deletion,
// drafft-backend #49): which kinds existed and each Apple or Google sign-in's dates, never an identity in
// clear; `{}` once the retention purge cleared it.
import { formatDate } from "~/components/app/format";
import type { AccountDeletion, DeletionOAuthSignIn } from "~/lib/types";

export type DeletionIdentitiesView =
  { purged: true; purgedAt: string | null } | { purged: false; email: boolean; phone: boolean; oauth: DeletionOAuthSignIn[] };

/** Purged when the record says so, or when the summary is gone (`{}`). */
export function deletionIdentities(d: Pick<AccountDeletion, "identities" | "identitiesPurgedAt">): DeletionIdentitiesView {
  const ids = d.identities;
  if (d.identitiesPurgedAt || !("email" in ids)) return { purged: true, purgedAt: d.identitiesPurgedAt ?? null };
  return { purged: false, email: Boolean(ids.email), phone: Boolean(ids.phone), oauth: Array.isArray(ids.oauth) ? ids.oauth : [] };
}

const providerNames: Record<string, string> = { apple: "Apple", google: "Google" };

export function providerName(provider: string) {
  return providerNames[provider] ?? provider;
}

/** "Apple, added 12 Jan 2026, 10:00, last used 3 Mar 2026, 09:12". */
export function oauthSignInLine(o: DeletionOAuthSignIn) {
  return [
    providerName(o.provider),
    o.createdAt ? `added ${formatDate(o.createdAt)}` : null,
    o.lastSignInAt ? `last used ${formatDate(o.lastSignInAt)}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/** The rows of the "Deleted by the person" panel about sign-in identities. */
export function deletionIdentityRows(d: Pick<AccountDeletion, "identities" | "identitiesPurgedAt">): [string, string | string[] | null][] {
  const v = deletionIdentities(d);
  if (v.purged) return [["Sign-in then", v.purgedAt ? `Purged on ${formatDate(v.purgedAt)}` : "Purged"]];
  return [
    ["Email then", v.email ? "Yes" : "No"],
    ["Phone then", v.phone ? "Yes" : "No"],
    ["Apple or Google then", v.oauth.length > 0 ? v.oauth.map(oauthSignInLine) : null],
  ];
}
