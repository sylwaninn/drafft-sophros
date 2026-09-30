// A support thread: the team's replies (written here, emailed by the backend) and the member's messages that came
// back by email (drafft-backend, "Support by email": the support mail Worker files them and reopens the request).
import type { SupportMessage, SupportRequest } from "~/lib/types";

/** Written by the member and received by email. Before the backend said who wrote a message, all were the team's. */
export function fromMember(m: SupportMessage): boolean {
  return m.direction === "in";
}

/** The team's replies only. */
export function teamReplies(r: SupportRequest): SupportMessage[] {
  return r.replies.filter((m) => !fromMember(m));
}

/** A reply of the team still on its way (the backend emails it a moment later): the page checks back until it's sent. */
export function replySending(r: SupportRequest): boolean {
  return teamReplies(r).some((m) => !m.sentAt && !m.error);
}

/** The member wrote last, by email, after the team: the request waits for an answer. */
export function memberWroteLast(r: SupportRequest): boolean {
  const last = r.replies.at(-1);
  return !!last && fromMember(last);
}
