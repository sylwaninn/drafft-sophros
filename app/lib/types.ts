// Shapes returned by the admin_* functions (jsonb), as the dashboard reads them.

/** The holds an account can be under, strictest last. */
export const HOLDS = ["review", "selfie", "banned"] as const;
export type Hold = (typeof HOLDS)[number];

export function isHold(value: unknown): value is Hold {
  return (HOLDS as readonly unknown[]).includes(value);
}

/**
 * Whether putting `next` on an account changes its hold: not on a banned account (lifting a ban takes
 * an admin, from its page), and not the hold it already has (nothing would be recorded, nor told).
 */
export function holdChanges(current: Hold | null | undefined, next: Hold): boolean {
  return current !== "banned" && current !== next;
}

export interface Person {
  id: string;
  name?: string;
  moderation?: Hold | null;
  photo?: string | null;
  /** Erased: nothing left but the id. */
  deleted?: boolean;
  /** Deleted by its owner but kept for members' safety (reported, held or banned). */
  deletedAt?: string | null;
}

export interface Overview {
  accounts: number;
  onboarded: number;
  signups7d: number;
  active1d: number;
  active7d: number;
  opened1d: number;
  premium: number;
  matches7d: number;
  holds: Partial<Record<Hold, number>>;
  selfiesToCheck: number;
  openReports: number;
  openSupport: number;
  openDataRequests: number;
  mediaToReview: number;
  openFlags: number;
  signupsByDay: { day: string; count: number }[];
}

export interface UserRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  moderation: Hold | null;
  paused: boolean;
  deleted_at: string | null;
  onboarded_at: string | null;
  created_at: string;
  last_active_at: string;
  last_opened_at: string | null;
  photo: string | null;
  premium: boolean;
  flags: number;
  reports: number;
}

export interface Media {
  id: string;
  kind: "photo" | "video";
  key: string;
  posterKey: string | null;
  position: number;
  status: "pending" | "approved" | "rejected";
  width: number;
  height: number;
  createdAt: string;
  reviewRequestedAt: string | null;
}

export interface Flag {
  id: number;
  context: "chat" | "profile";
  key: string;
  verdict: "rejected" | "review";
  labels: string[];
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  person?: Person | null;
  userFlags30d?: number;
}

export interface Report {
  id: string;
  reason: string;
  details: string;
  createdAt: string;
  handledAt: string | null;
  handledBy: string | null;
  resolution: string | null;
  reporter: Person | null;
  reported: Person | null;
  reportedCount30d?: number;
  match?: string | null;
}

export interface SupportRequest {
  id: number;
  reference: string;
  email: string;
  language: string;
  topic: string;
  message: string;
  context: Record<string, unknown>;
  created_at: string;
  handled_at: string | null;
  handled_by: string | null;
  person: Person | null;
  replies: { id: number; author: string; body: string; createdAt: string; sentAt: string | null; error: string | null }[];
}

export interface DataRequest {
  id: number;
  kind: string;
  created_at: string;
  fulfilled_at: string | null;
  fulfilled_by: string | null;
  person: Person | null;
  email: string | null;
}

export interface MatchRow {
  id: string;
  createdAt: string;
  endedAt: string | null;
  endedBy: string | null;
  a: Person;
  b: Person;
  sessions?: number;
  reported?: boolean;
  chatFlags?: number;
}

export interface AuditEntry {
  id: number;
  actor: string;
  action: string;
  user_id: string | null;
  target: string | null;
  reason: string | null;
  details: Record<string, unknown>;
  created_at: string;
  person: Person | null;
}

export interface Related {
  person: Person;
  /** previous account: this one signed up again with the identity of a kept deleted account; later: the reverse. */
  via: "install" | "ip" | "identity" | "previous account" | "later account";
  detail: string | null;
  at: string | null;
}

export interface Device {
  install_id: string;
  model: string;
  os_version: string;
  app_version: string;
  app_build: string;
  locale: string;
  timezone: string;
  ip: string | null;
  country: string | null;
  opens: number;
  first_seen_at: string;
  last_seen_at: string;
}

/** Why an account deleted by its owner was kept (admin_account_deletion). */
export interface AccountDeletion {
  deletedAt: string;
  basis: "ban" | "hold" | "report";
  legalBasis: "member_safety";
  moderation: Hold | null;
  reports: { id: string; reason: string; createdAt: string; handledAt: string | null; resolution: string | null }[];
  holds: { state: Hold; note: string | null; createdAt: string }[];
  /** Which sign-in identities existed, never their values; `{}` once the retention purge cleared them. */
  identities: DeletionIdentities | Record<string, never>;
  /** When the retention purge cleared `identities`; absent while admin_account_deletion doesn't return it. */
  identitiesPurgedAt?: string | null;
}

/** An Apple or Google sign-in of a deleted account: the provider and its dates, no provider id or email. */
export interface DeletionOAuthSignIn {
  provider: string;
  createdAt: string | null;
  lastSignInAt: string | null;
}

export interface DeletionIdentities {
  email: boolean;
  phone: boolean;
  oauth: DeletionOAuthSignIn[];
}

export interface UserDetail {
  profile: Record<string, unknown> & {
    id: string;
    name: string;
    birthdate: string | null;
    gender: string | null;
    moderation: Hold | null;
    paused: boolean;
    deleted_at: string | null;
    created_at: string;
    last_active_at: string;
    onboarded_at: string | null;
    voice_intro_key: string | null;
    language?: string;
  };
  auth: {
    email: string | null;
    phone: string | null;
    emailConfirmedAt: string | null;
    phoneConfirmedAt: string | null;
    createdAt: string;
    lastSignInAt: string | null;
    signupLanguage: string | null;
    providers: { provider: string; email: string | null; createdAt: string; lastSignInAt: string | null }[];
  };
  sessions: { id: string; createdAt: string; refreshedAt: string | null; userAgent: string | null; ip: string | null }[];
  media: Media[];
  sports: { sport: string; perWeek: number }[];
  prompts: { question: string; answer: string }[];
  wallet: Record<string, unknown> | null;
  purchases: { id: string; type: string; product_id: string | null; environment: string | null; event_at: string; effect: string }[];
  location: { lat: number; lng: number; updatedAt: string } | null;
  devices: Device[];
  ips: { ip: string; country: string | null; first_seen_at: string; last_seen_at: string }[];
  pushTokens: { environment: string; updatedAt: string; token: string }[];
  deviceCheck: { environment: string; updatedAt: string; flaggedAt: string | null } | null;
  moderationLog: { state: Hold | null; note: string | null; actor: string | null; createdAt: string }[];
  marks: { kind: string; state: Hold; createdAt: string }[];
  selfies: { id: number; createdAt: string }[];
  stats: Record<string, number>;
  /** Moderators and admins only: support gets `hidden.matches` instead. */
  matches?: { id: string; createdAt: string; endedAt: string | null; endedBy: string | null; other: Person }[];
  /** For support: how many chat photo flags and matches the account has, without them. */
  hidden?: { chatFlags: number; matches: number };
  blocksGiven: { person: Person; createdAt: string }[];
  blocksReceived: { person: Person; createdAt: string }[];
  reportsReceived: (Report & { reporter: Person | null })[];
  reportsMade: { id: string; reason: string; details: string; reported: Person; createdAt: string }[];
  flags: Flag[];
  support: { id: number; reference: string; topic: string; createdAt: string; handledAt: string | null }[];
  dataRequests: { id: number; kind: string; created_at: string; fulfilled_at: string | null }[];
  notes: { id: number; author: string; body: string; created_at: string }[];
  related: Related[];
}
