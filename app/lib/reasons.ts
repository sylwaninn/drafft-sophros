// Why a decision was made, as the member is told it (DSA art. 17 statement of reasons, drafft-backend
// migration 20260930000401): a reason category from admin_reason_categories, each tied to a part of the
// terms, and an optional note written by the team, sent to the member as written. The reason typed for
// the audit log stays internal. Shared by the pages and the Worker: nothing server-only here.
import type { Hold } from "./types";

/** The part of the terms a category falls under: its anchor on getdrafft.com/terms (null: the terms as a whole). */
export type TermsAnchor = "community" | "eligibility" | "moderation";

/** A category as admin_reason_categories returns it. */
export interface ReasonCategory {
  id: string;
  termsAnchor: TermsAnchor | null;
}

/** What the member is told with a decision: the category, and the team's note if any. */
export interface Statement {
  category?: string;
  details?: string;
}

/** A statement as sent: the category chosen, and the note if any. */
export interface Told {
  category: string;
  details?: string;
}

/** The note for the member: sent as written, at most this long (sophros and the database refuse more, never cut it). */
export const DETAILS_MAX = 1000;

/** Any reason written for the audit log: the database's limit (admin_audit.reason). */
export const REASON_MAX = 1000;

/** A report's resolution when it holds the account: the hold's reason repeats it after "report: ". */
export const RESOLUTION_MAX = REASON_MAX - "report: ".length;

/** The part of `from` (where a conversation was opened from) that goes into the logged reason. */
export const FROM_MAX = 200;

/**
 * A reason typed to read a conversation: shorter, since the logged reason also says where it was opened
 * from (`auditedReason`), and the whole must fit REASON_MAX.
 */
export const READ_REASON_MAX = REASON_MAX - FROM_MAX - " (opened from )".length;

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
  return Object.hasOwn(labels, id) ? labels[id] : id.replaceAll("_", " ");
}

const TERMS_URL = "https://getdrafft.com/terms";

const anchors: Record<TermsAnchor, string> = {
  community: "Community guidelines",
  eligibility: "To use drafft",
  moderation: "Moderation and sanctions",
};

function isAnchor(value: unknown): value is TermsAnchor {
  return typeof value === "string" && Object.hasOwn(anchors, value);
}

/** The part of the terms a category falls under, with its link on getdrafft.com; the whole terms for null. */
export function termsLink(anchor: TermsAnchor | null): { label: string; url: string } {
  return anchor ? { label: anchors[anchor], url: `${TERMS_URL}#${anchor}` } : { label: "Terms of use", url: TERMS_URL };
}

/**
 * admin_reason_categories' answer, checked: the categories with an id; an anchor sophros doesn't know
 * reads as the whole terms. Empty for anything else (the forms then say to reload).
 */
export function reasonCategories(value: unknown): ReasonCategory[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((c: unknown) => {
    if (!c || typeof c !== "object") return [];
    const { id, termsAnchor } = c as { id?: unknown; termsAnchor?: unknown };
    return typeof id === "string" && id ? [{ id, termsAnchor: isAnchor(termsAnchor) ? termsAnchor : null }] : [];
  });
}

/** The category a decision suggests on its own, preselected but open to change: none for a ban. */
export function suggestedCategory(decision: Hold | "photo"): string | undefined {
  if (decision === "selfie") return "identity_check";
  if (decision === "photo") return "photo_guidelines";
  return undefined;
}

/**
 * Filled in: a category among the ones the database offers (so none when they couldn't be read, nor a
 * preselected one it doesn't have), and a note that fits.
 */
export function statementReady(value: Statement, categories: readonly ReasonCategory[]): boolean {
  return categories.some((c) => c.id === value.category) && (value.details ?? "").trim().length <= DETAILS_MAX;
}

/** The dashboard's old default reason for opening a conversation, refused by the database. */
const placeholderReasons = new Set(["opened in sophros"]);

/**
 * A reason written by the person for reading something private (a conversation, a selfie): trimmed,
 * at most `max` characters, and never empty or the old default. Null when there isn't one.
 */
export function typedReason(value: unknown, max = REASON_MAX): string | null {
  if (typeof value !== "string") return null;
  const reason = value.trim().slice(0, max).trim();
  return reason && !placeholderReasons.has(reason.toLowerCase()) ? reason : null;
}

/**
 * The reason logged for reading a conversation: the person's, then where it was opened from, the whole
 * within REASON_MAX (the reason is cut, never the place), so the database never refuses it for its length.
 */
export function auditedReason(reason: string, from: string): string {
  const place = from.trim().slice(0, FROM_MAX);
  const suffix = place ? ` (opened from ${place})` : "";
  return `${reason.slice(0, REASON_MAX - suffix.length).trimEnd()}${suffix}`;
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
  hold: { title: "Hold", description: "One of them is on hold or banned, and someone other than you put it." },
};

function isBasis(value: unknown): value is Basis {
  return typeof value === "string" && Object.hasOwn(basisLabels, value);
}

/** admin_conversation_access' answer, checked: known bases only, and an override only when it says `true`. */
export function conversationAccess(value: unknown): ConversationAccess {
  const { basis, canOverride } = (value && typeof value === "object" ? value : {}) as { basis?: unknown; canOverride?: unknown };
  return { basis: Array.isArray(basis) ? basis.filter(isBasis) : [], canOverride: canOverride === true };
}

/** Why an admin reads a conversation without a basis: the only two the database accepts. */
export type OverrideBasis = "legal_request" | "member_safety";

export const overrideBases: Record<OverrideBasis, { title: string; description: string }> = {
  legal_request: { title: "Legal request", description: "A court, the police or another authority asked for it." },
  member_safety: { title: "Members' safety", description: "Someone may be at risk, and nothing on record covers it yet." },
};

export function isOverrideBasis(value: unknown): value is OverrideBasis {
  return typeof value === "string" && Object.hasOwn(overrideBases, value);
}
