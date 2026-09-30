// A support thread: the team's replies (written here, emailed by the backend) and the member's messages that came
// back by email (drafft-backend, "Support by email": the support mail Worker hands them to `support-inbound`, whose
// receive_support_email files them in their request and reopens it).
import type { MemberEmail, SupportMessage, SupportRequest, TeamReply } from "~/lib/types";

/** Written by the member and received by email. */
export function fromMember(m: SupportMessage): m is MemberEmail {
  return m.direction === "in";
}

/** The team's replies only (everything not received from the member: a row from before the backend said who wrote
 * it was the team's). */
export function teamReplies(r: SupportRequest): TeamReply[] {
  return r.replies.filter((m): m is TeamReply => !fromMember(m));
}

/** Where a reply of the team stands: the backend emails it a moment later, and retries it when that fails. */
export function delivery(m: TeamReply): "sending" | "sent" | "failed" {
  if (m.error !== null) return "failed";
  return m.sentAt !== null ? "sent" : "sending";
}

/** A reply of the team still on its way: the page checks back until it's sent. */
export function replySending(r: SupportRequest): boolean {
  return teamReplies(r).some((m) => delivery(m) === "sending");
}

/** The thread oldest first (admin_support already orders it by creation; the check below doesn't rely on it). */
function ordered(r: SupportRequest): SupportMessage[] {
  return [...r.replies].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

/** The member wrote back by email after a reply of the team, and the request isn't handled: it waits for the team.
 * An email that only follows the acknowledgement doesn't count: nobody has answered yet, the request is just open. */
export function memberWroteBack(r: SupportRequest): boolean {
  if (r.handled_at) return false;
  const thread = ordered(r);
  const last = thread.at(-1);
  return !!last && fromMember(last) && thread.some((m) => !fromMember(m));
}

/** What the list shows before a request's message: the member wrote back, else how many replies the team sent. */
export type ListBadge = { kind: "wrote-back" } | { kind: "replies"; count: number } | null;

export function listBadge(r: SupportRequest): ListBadge {
  if (memberWroteBack(r)) return { kind: "wrote-back" };
  const count = teamReplies(r).length;
  return count > 0 ? { kind: "replies", count } : null;
}

/** Who a message is from, as the thread shows it: the member by name (else their address), or the staff member. */
export function sender(r: SupportRequest, m: SupportMessage): string {
  return fromMember(m) ? r.person?.name || m.author : m.author;
}
