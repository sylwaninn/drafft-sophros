// Why a decision was made, as the member is told it (DSA art. 17 statement of reasons, drafft-backend
// migration 20260930000401): a reason category from admin_reason_categories, each tied to a part of the
// terms, and an optional note written by the team, sent to the member as written. The reason typed for
// the audit log stays internal. Shared by the pages and the Worker: nothing server-only here.
import type { Hold } from "./types";

/** A category as admin_reason_categories returns it. */
export interface ReasonCategory {
  id: string;
  termsSection: string;
}

/** What the member is told with a decision: the category, and the team's note if any. */
export interface Statement {
  category?: string;
  details?: string;
}

/** The note for the member: sent as written, at most this long (the database refuses more). */
export const DETAILS_MAX = 1000;

const labels: Record<string, string> = {
  harassment: "Harassment, threats or insults",
  hate: "Hate or discrimination",
  sexual_content: "Sexual content or nudity",
  violence_illegal: "Violence or illegal content",
  underage: "Under 18",
  impersonation: "Impersonation, or someone else's photos",
  scam_commercial: "Scam, selling or asking for money",
  privacy: "Someone's private information shared",
  fake_account: "Fake, duplicate or automated account",
  evasion: "Getting around a restriction or a ban",
  photo_guidelines: "Photo outside the photo guidelines",
  identity_check: "Identity check: the photos must be them",
  other: "Another breach of the terms",
};

/** A category as staff read it; one added in the database before sophros knows it shows its id. */
export function categoryLabel(id: string): string {
  return labels[id] ?? id.replaceAll("_", " ");
}

const TERMS_URL = "https://getdrafft.com/terms";

const sections: Record<string, { label: string; anchor: string }> = {
  community_guidelines: { label: "Community guidelines", anchor: "#community" },
  to_use_drafft: { label: "To use drafft", anchor: "#eligibility" },
  moderation_and_sanctions: { label: "Moderation and sanctions", anchor: "#moderation" },
  terms_of_use: { label: "Terms of use", anchor: "" },
};

/** The part of the terms a category applies, with its link on getdrafft.com. */
export function termsSection(section: string): { label: string; url: string } {
  const known = sections[section];
  return known ? { label: known.label, url: TERMS_URL + known.anchor } : { label: "Terms of use", url: TERMS_URL };
}

/** The category a decision suggests on its own, preselected but open to change: none for a ban. */
export function suggestedCategory(decision: Hold | "photo"): string | undefined {
  if (decision === "selfie") return "identity_check";
  if (decision === "photo") return "photo_guidelines";
  return undefined;
}

/** The dashboard's old default reason for opening a conversation, refused by the database. */
const placeholderReasons = new Set(["opened in sophros"]);

/**
 * A reason written by the person for reading something private (a conversation, a selfie): trimmed,
 * at most 1,000 characters, and never empty or the old default. Null when there isn't one.
 */
export function typedReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reason = value.trim().slice(0, 1000);
  return reason && !placeholderReasons.has(reason.toLowerCase()) ? reason : null;
}

/** Why the team may read a conversation, as admin_conversation_access names it. */
export type Basis = "report" | "support" | "hold";

export interface ConversationAccess {
  basis: Basis[];
  /** Admins may read one without a basis, as a logged override. */
  canOverride: boolean;
}

export const basisLabels: Record<Basis, { title: string; description: string }> = {
  report: { title: "Report", description: "One of them reported the other." },
  support: { title: "Help request", description: "One of them wrote to support, still open or in the last 90 days." },
  hold: { title: "Hold", description: "One of them is on hold or banned." },
};
