import { describe, expect, it } from "vitest";
import { fromMember, memberWroteLast, replySending, teamReplies } from "~/lib/support";
import type { SupportMessage, SupportRequest } from "~/lib/types";

const message = (id: number, changes: Partial<SupportMessage> = {}): SupportMessage => ({
  id,
  author: "sup@drafft.test",
  body: "Try again?",
  createdAt: `2026-09-30T10:0${id}:00Z`,
  sentAt: `2026-09-30T10:0${id}:05Z`,
  error: null,
  direction: "out",
  ...changes,
});
const request = (replies: SupportMessage[]) => ({ replies }) as SupportRequest;
const byEmail = (id: number) => message(id, { author: "lea@drafft.test", body: "Still stuck", direction: "in" });

describe("a support thread", () => {
  it("tells the member's emails from the team's replies; without a direction, a message is the team's", () => {
    expect(fromMember(byEmail(2))).toBe(true);
    expect(fromMember(message(1))).toBe(false);
    expect(fromMember(message(1, { direction: undefined }))).toBe(false);
    expect(teamReplies(request([message(1), byEmail(2), message(3)])).map((m) => m.id)).toEqual([1, 3]);
  });

  it("waits for a team reply being emailed, never for a member's email", () => {
    expect(replySending(request([message(1), byEmail(2)]))).toBe(false);
    expect(replySending(request([message(1, { sentAt: null })]))).toBe(true);
    expect(replySending(request([message(1, { sentAt: null, error: "resend down" })]))).toBe(false);
    expect(replySending(request([byEmail(2)].map((m) => ({ ...m, sentAt: null }))))).toBe(false);
  });

  it("says when the member answered by email after the team's last reply", () => {
    expect(memberWroteLast(request([message(1), byEmail(2)]))).toBe(true);
    expect(memberWroteLast(request([byEmail(2), message(3)]))).toBe(false);
    expect(memberWroteLast(request([]))).toBe(false);
  });
});
