import { describe, expect, it } from "vitest";
import { confirmationTo, deletionOutcome, deletionReference } from "~/lib/deletion";
import type { DeletionPreview } from "~/lib/types";

const preview = (changes: Partial<DeletionPreview> = {}): DeletionPreview => ({
  outcome: "erase",
  basis: null,
  deleted: false,
  pending: false,
  email: "lea@drafft.test",
  ...changes,
});

describe("deleting an account at the member's request", () => {
  it("takes a support reference or email, and nothing else", () => {
    expect(deletionReference(" dr-abc234 ")).toBe("DR-ABC234");
    expect(deletionReference("Email")).toBe("email");
    expect(deletionReference("")).toBeNull();
    expect(deletionReference("DR-12")).toBeNull();
    expect(deletionReference("asked on the phone")).toBeNull();
  });

  it("says before confirming whether it will be erased or kept, and why", () => {
    expect(deletionOutcome(preview())).toMatch(/^Erased/);
    expect(deletionOutcome(preview({ outcome: "keep", basis: "report" }))).toMatch(/a report about it is still open/);
    expect(deletionOutcome(preview({ outcome: "keep", basis: "ban" }))).toMatch(/it is banned/);
  });

  it("says where the confirmation goes", () => {
    expect(confirmationTo(preview())).toBe("lea@drafft.test, in their language");
    expect(confirmationTo(preview({ email: null }))).toMatch(/nobody/);
  });
});
