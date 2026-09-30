import { describe, expect, it } from "vitest";
import {
  auditedReason,
  categoryLabel,
  conversationAccess,
  isOverrideBasis,
  READ_REASON_MAX,
  REASON_MAX,
  reasonCategories,
  statementReady,
  suggestedCategory,
  termsLink,
  typedReason,
} from "~/lib/reasons";
import { holdChanges, isHold } from "~/lib/types";

describe("reason categories", () => {
  it("names every category the database knows, and still shows a new one", () => {
    const ids =
      "harassment hate sexual_content violence_illegal underage impersonation scam_commercial privacy fake_account evasion photo_guidelines identity_check other";
    for (const id of ids.split(" ")) expect(categoryLabel(id)).not.toBe(id);
    expect(categoryLabel("new_rule")).toBe("new rule");
    expect(categoryLabel("constructor")).toBe("constructor");
  });

  it("links each part of the terms to its anchor on getdrafft.com", () => {
    expect(termsLink("community")).toEqual({ label: "Community guidelines", url: "https://getdrafft.com/terms#community" });
    expect(termsLink("eligibility").url).toBe("https://getdrafft.com/terms#eligibility");
    expect(termsLink("moderation").url).toBe("https://getdrafft.com/terms#moderation");
    expect(termsLink(null)).toEqual({ label: "Terms of use", url: "https://getdrafft.com/terms" });
  });

  it("reads admin_reason_categories' answer, and nothing else", () => {
    expect(
      reasonCategories([
        { id: "harassment", termsAnchor: "community" },
        { id: "other", termsAnchor: null },
        { id: "new_rule", termsAnchor: "somewhere" },
        { id: "", termsAnchor: "community" },
        { termsSection: "community_guidelines" },
        null,
      ]),
    ).toEqual([
      { id: "harassment", termsAnchor: "community" },
      { id: "other", termsAnchor: null },
      { id: "new_rule", termsAnchor: null },
    ]);
    for (const value of [null, {}, "harassment"]) expect(reasonCategories(value)).toEqual([]);
  });

  it("suggests a category only where the decision says it, never for a ban", () => {
    expect(suggestedCategory("selfie")).toBe("identity_check");
    expect(suggestedCategory("photo")).toBe("photo_guidelines");
    expect(suggestedCategory("review")).toBeUndefined();
    expect(suggestedCategory("banned")).toBeUndefined();
  });
});

describe("statementReady", () => {
  const listed = reasonCategories([
    { id: "hate", termsAnchor: "community" },
    { id: "identity_check", termsAnchor: "moderation" },
  ]);

  it("needs a category the database lists", () => {
    expect(statementReady({}, listed)).toBe(false);
    expect(statementReady({ category: "hate" }, listed)).toBe(true);
    expect(statementReady({ category: "made_up" }, listed)).toBe(false);
  });

  it("isn't ready on a preselected category when the list couldn't be read", () => {
    expect(statementReady({ category: suggestedCategory("selfie") }, [])).toBe(false);
  });

  it("takes a note of 1,000 characters, not more", () => {
    expect(statementReady({ category: "hate", details: ` ${"x".repeat(1000)} ` }, listed)).toBe(true);
    expect(statementReady({ category: "hate", details: "x".repeat(1001) }, listed)).toBe(false);
  });
});

describe("typedReason", () => {
  it("keeps a reason the person wrote, trimmed", () => {
    expect(typedReason("  the report mentions threats ")).toBe("the report mentions threats");
    expect(typedReason("x".repeat(1200))).toHaveLength(1000);
    expect(typedReason("x".repeat(1200), READ_REASON_MAX)).toHaveLength(READ_REASON_MAX);
  });

  it("refuses nothing, blanks and the old default", () => {
    for (const value of [null, undefined, 3, "", "   ", "opened in sophros", " Opened in Sophros "]) expect(typedReason(value)).toBeNull();
  });
});

describe("auditedReason", () => {
  it("says where the conversation was opened from", () => {
    expect(auditedReason("insults", "report 1a2b3c4d")).toBe("insults (opened from report 1a2b3c4d)");
    expect(auditedReason("insults", "  ")).toBe("insults");
  });

  it("keeps the place to 200 characters and the whole within the audit log's limit", () => {
    const logged = auditedReason("r".repeat(1000), "p".repeat(400));
    expect(logged).toHaveLength(REASON_MAX);
    expect(logged).toContain(`(opened from ${"p".repeat(200)})`);
    // A reason as long as the drawer takes, from the longest place, is never cut.
    const typed = "r".repeat(READ_REASON_MAX);
    expect(auditedReason(typed, "p".repeat(200)).startsWith(`${typed} (`)).toBe(true);
  });
});

describe("conversation access", () => {
  it("keeps the bases the database names, and an override only when it says true", () => {
    expect(conversationAccess({ basis: ["report", "hold"], canOverride: true })).toEqual({ basis: ["report", "hold"], canOverride: true });
    expect(conversationAccess({})).toEqual({ basis: [], canOverride: false });
    expect(conversationAccess({ basis: null, canOverride: "true" })).toEqual({ basis: [], canOverride: false });
    expect(conversationAccess({ basis: ["report", "curiosity", "toString"] })).toEqual({ basis: ["report"], canOverride: false });
    expect(conversationAccess(null)).toEqual({ basis: [], canOverride: false });
  });

  it("knows the two reasons for an override", () => {
    expect(isOverrideBasis("legal_request")).toBe(true);
    expect(isOverrideBasis("member_safety")).toBe(true);
    for (const value of ["", "curiosity", "toString", null]) expect(isOverrideBasis(value)).toBe(false);
  });
});

describe("holds", () => {
  it("knows the three holds", () => {
    expect(["review", "selfie", "banned"].every(isHold)).toBe(true);
    for (const value of ["deleted", "", null]) expect(isHold(value)).toBe(false);
  });

  it("offers only a hold that changes the account", () => {
    expect(holdChanges(null, "review")).toBe(true);
    expect(holdChanges("review", "selfie")).toBe(true);
    expect(holdChanges("review", "review")).toBe(false);
    expect(holdChanges("banned", "review")).toBe(false);
    expect(holdChanges("banned", "banned")).toBe(false);
  });
});
