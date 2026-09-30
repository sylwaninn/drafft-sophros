import { describe, expect, it } from "vitest";
import {
  confirmationTo,
  deletedMessage,
  deletionAvailability,
  deletionLink,
  deletionOutcome,
  deletionPrefill,
  deletionReference,
} from "~/lib/deletion";
import type { Staff } from "~/lib/roles";
import type { ReadyDeletion } from "~/lib/types";

const erased: ReadyDeletion = { status: "ready", outcome: "erased", emails: ["lea@drafft.test"], emailed: true };
const kept = (basis: "ban" | "hold" | "report"): ReadyDeletion => ({ ...erased, outcome: "kept", basis });
const admin: Staff = { email: "admin@drafft.test", role: "admin" };
const moderator: Staff = { email: "mod@drafft.test", role: "moderator" };

describe("the request behind a deletion", () => {
  it("takes a support reference or email, normalised", () => {
    expect(deletionReference(" dr-abc234 ")).toBe("DR-ABC234");
    expect(deletionReference("Email")).toBe("email");
    expect(deletionReference(" email ")).toBe("email");
    expect(deletionReference("EMAIL")).toBe("email");
  });

  it.each(["", "DR-12", "asked on the phone", "phone", "DR-ABC2345", "xDR-ABC234", "DR_ABC234", "DR- ABC234", "DR-ABC23!"])(
    "refuses %j",
    (value) => expect(deletionReference(value)).toBeNull(),
  );

  it("refuses nothing given", () => {
    expect(deletionReference(null)).toBeNull();
    expect(deletionReference(undefined)).toBeNull();
  });
});

describe("opening the deletion from a support request", () => {
  const request = { reference: "DR-ABC234", person: { id: "u1" } };

  it("links admins to the account with the request's reference, which the dialog takes back", () => {
    const link = deletionLink(admin, request);
    expect(link).toBe("/accounts/u1?delete=DR-ABC234");
    const params = new URL(link!, "http://sophros.test").searchParams;
    expect(deletionPrefill(params)).toEqual({ open: true, reference: "DR-ABC234" });
    expect(deletionReference(params.get("delete"))).toBe("DR-ABC234");
  });

  it("offers no link below admin, without an account, or for an account deleted already", () => {
    expect(deletionLink(moderator, request)).toBeNull();
    expect(deletionLink(admin, { ...request, person: null })).toBeNull();
    expect(deletionLink(admin, { ...request, person: { id: "u1", deleted: true } })).toBeNull();
    expect(deletionLink(admin, { ...request, person: { id: "u1", deletedAt: "2026-09-01T00:00:00Z" } })).toBeNull();
    expect(deletionLink(admin, { ...request, person: { id: "u1", deletedAt: null } })).not.toBeNull();
  });

  it("stays closed from the menu, with no reference given for the admin", () => {
    expect(deletionPrefill(new URLSearchParams())).toEqual({ open: false, reference: "" });
    expect(deletionPrefill(new URLSearchParams("delete="))).toEqual({ open: true, reference: "" });
  });
});

describe("whether the account can be deleted now", () => {
  it("can when the preview is ready", () => {
    expect(deletionAvailability({ ok: true, preview: erased })).toEqual({ ok: true, preview: erased });
  });

  it("says why it can't: deleted already, on its way, or the preview failed", () => {
    expect(deletionAvailability({ ok: true, preview: { status: "deleted" } })).toEqual({
      ok: false,
      why: "This account is deleted already.",
    });
    expect(deletionAvailability({ ok: true, preview: { status: "pending" } })).toEqual({
      ok: false,
      why: "A deletion of this account is already on its way.",
    });
    expect(deletionAvailability({ ok: false, error: "Couldn't check." })).toEqual({ ok: false, why: "Couldn't check." });
  });

  it("offers nothing below admin", () => {
    expect(deletionAvailability(null)).toEqual({ ok: false, why: null });
  });
});

describe("saying what will happen", () => {
  it("says it will be erased, never why it would be kept, and that it's decided again", () => {
    const text = deletionOutcome(erased);
    expect(text).toMatch(/^Erased/);
    expect(text).toMatch(/except those with a held or banned member/);
    expect(text).toMatch(/Checked again when it runs/);
    expect(text).not.toMatch(/because/);
  });

  it.each([
    ["ban", /it is banned/],
    ["hold", /it is held for review/],
    ["report", /a report about it is still open/],
  ] as const)("says it will be kept, because of a %s", (basis, why) => {
    expect(deletionOutcome(kept(basis))).toMatch(/^Kept for members' safety, because/);
    expect(deletionOutcome(kept(basis))).toMatch(why);
  });

  it("says where the confirmation goes", () => {
    expect(confirmationTo(erased)).toBe("lea@drafft.test, in their language");
    expect(confirmationTo({ emails: ["a@drafft.test", "b@drafft.test"], emailed: true })).toBe(
      "a@drafft.test and b@drafft.test, in their language",
    );
    expect(confirmationTo({ emails: [], emailed: false })).toMatch(/^nobody: .* the team gets an email/);
  });

  it("mentions the request's address when the preview didn't have the reference", () => {
    expect(confirmationTo(erased, false)).toMatch(/lea@drafft.test, in their language, and the support request's address/);
    expect(confirmationTo({ emails: [], emailed: false }, false)).toMatch(/^the support request's address if you give one/);
  });
});

describe("the message once it is queued", () => {
  it("says the outcome expected and who gets the confirmation", () => {
    expect(deletedMessage({ expected: "erased", emails: ["lea@drafft.test"], emailed: true })).toBe(
      "Deletion on its way: the account will be erased, unless a report or hold arrives first. Confirmation to lea@drafft.test.",
    );
    expect(deletedMessage({ expected: "kept", emails: ["lea@drafft.test"], emailed: true })).toMatch(
      /kept for members' safety\. Confirmation to lea@drafft.test\.$/,
    );
  });

  it("never claims an email went out when there's no address", () => {
    const text = deletedMessage({ expected: "erased", emails: [], emailed: false });
    expect(text).toMatch(/No address to confirm to: the team gets an email/);
    expect(text).not.toMatch(/Confirmation to/);
  });
});
