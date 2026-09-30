import { describe, expect, it } from "vitest";
import { delivery, fromMember, listBadge, memberWroteBack, replySending, sender, teamReplies } from "~/lib/support";
import type { MemberEmail, Person, SupportRequest, TeamReply } from "~/lib/types";

const at = (minute: number, second = 0) => new Date(Date.UTC(2026, 8, 30, 10, minute, second)).toISOString();

type Delivery = Pick<TeamReply, "sentAt" | "error">;
const reply = (id: number, state: Delivery = { sentAt: at(id, 5), error: null }): TeamReply =>
  ({ id, author: "sup@drafft.test", body: "Try again?", createdAt: at(id), direction: "out", ...state }) as TeamReply;
const byEmail = (id: number): MemberEmail => ({
  id,
  author: "lea@drafft.test",
  body: "Still stuck",
  createdAt: at(id),
  sentAt: at(id),
  error: null,
  direction: "in",
});
const request = (replies: SupportRequest["replies"], changes: Partial<SupportRequest> = {}) =>
  ({ replies, handled_at: null, person: null, ...changes }) as SupportRequest;

describe("a support thread", () => {
  it("tells the member's emails from the team's replies", () => {
    expect(fromMember(byEmail(2))).toBe(true);
    expect(fromMember(reply(1))).toBe(false);
    expect(teamReplies(request([reply(1), byEmail(2), reply(3)])).map((m) => m.id)).toEqual([1, 3]);
  });

  it("says where a reply of the team stands", () => {
    expect(delivery(reply(1))).toBe("sent");
    expect(delivery(reply(1, { sentAt: null, error: null }))).toBe("sending");
    expect(delivery(reply(1, { sentAt: null, error: "resend down" }))).toBe("failed");
  });

  it("waits for a team reply being emailed, never for a member's email", () => {
    expect(replySending(request([reply(1), byEmail(2)]))).toBe(false);
    expect(replySending(request([reply(1, { sentAt: null, error: null })]))).toBe(true);
    expect(replySending(request([reply(1, { sentAt: null, error: "resend down" })]))).toBe(false);
    expect(replySending(request([byEmail(2)]))).toBe(false);
  });

  it("says the member wrote back only after a reply of the team, while the request is open", () => {
    expect(memberWroteBack(request([reply(1), byEmail(2)]))).toBe(true);
    expect(memberWroteBack(request([byEmail(2), reply(3)]))).toBe(false);
    expect(memberWroteBack(request([]))).toBe(false);
    // An answer to the acknowledgement: nobody from the team has answered yet.
    expect(memberWroteBack(request([byEmail(1)]))).toBe(false);
    // Closed after their "thanks", without a reply.
    expect(memberWroteBack(request([reply(1), byEmail(2)], { handled_at: at(3) }))).toBe(false);
  });

  it("reads the thread by time, whatever order it comes in", () => {
    expect(memberWroteBack(request([byEmail(2), reply(1)]))).toBe(true);
    expect(memberWroteBack(request([reply(3), byEmail(2)]))).toBe(false);
  });

  it("picks the list badge: the member wrote back, else the team's replies", () => {
    expect(listBadge(request([reply(1), byEmail(2)]))).toEqual({ kind: "wrote-back" });
    expect(listBadge(request([reply(1), byEmail(2), reply(3)]))).toEqual({ kind: "replies", count: 2 });
    expect(listBadge(request([reply(1), byEmail(2)], { handled_at: at(3) }))).toEqual({ kind: "replies", count: 1 });
    expect(listBadge(request([byEmail(1)]))).toBeNull();
    expect(listBadge(request([]))).toBeNull();
  });

  it("names the member by name, else by address, and the team by the staff member", () => {
    const lea: Person = { id: "u1", name: "Léa" };
    expect(sender(request([], { person: lea }), byEmail(1))).toBe("Léa");
    expect(sender(request([], { person: null }), byEmail(1))).toBe("lea@drafft.test");
    expect(sender(request([], { person: { ...lea, name: "" } }), byEmail(1))).toBe("lea@drafft.test");
    expect(sender(request([], { person: lea }), reply(2))).toBe("sup@drafft.test");
  });
});
