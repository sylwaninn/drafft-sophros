import { describe, expect, it } from "vitest";
import { categoryLabel, suggestedCategory, termsSection, typedReason } from "~/lib/reasons";

describe("reason categories", () => {
  it("names every category the database knows, and still shows a new one", () => {
    const ids =
      "harassment hate sexual_content violence_illegal underage impersonation scam_commercial privacy fake_account evasion photo_guidelines identity_check other";
    for (const id of ids.split(" ")) expect(categoryLabel(id)).not.toBe(id);
    expect(categoryLabel("new_rule")).toBe("new rule");
  });

  it("links each part of the terms to its anchor on getdrafft.com", () => {
    expect(termsSection("community_guidelines")).toEqual({ label: "Community guidelines", url: "https://getdrafft.com/terms#community" });
    expect(termsSection("to_use_drafft").url).toBe("https://getdrafft.com/terms#eligibility");
    expect(termsSection("moderation_and_sanctions").url).toBe("https://getdrafft.com/terms#moderation");
    expect(termsSection("terms_of_use").url).toBe("https://getdrafft.com/terms");
    expect(termsSection("unknown").url).toBe("https://getdrafft.com/terms");
  });

  it("suggests a category only where the decision says it, never for a ban", () => {
    expect(suggestedCategory("selfie")).toBe("identity_check");
    expect(suggestedCategory("photo")).toBe("photo_guidelines");
    expect(suggestedCategory("review")).toBeUndefined();
    expect(suggestedCategory("banned")).toBeUndefined();
  });
});

describe("typedReason", () => {
  it("keeps a reason the person wrote, trimmed", () => {
    expect(typedReason("  the report mentions threats ")).toBe("the report mentions threats");
    expect(typedReason("x".repeat(1200))).toHaveLength(1000);
  });

  it("refuses nothing, blanks and the old default", () => {
    for (const value of [null, undefined, 3, "", "   ", "opened in sophros", " Opened in Sophros "]) expect(typedReason(value)).toBeNull();
  });
});
