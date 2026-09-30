// The deletion record's identities summary (drafft-backend #49): kinds and sign-in dates, "purged" once cleared.
import { describe, expect, it } from "vitest";
import { deletionIdentities, deletionIdentityRows, oauthSignInLine, providerName } from "~/lib/deletion-identities";

const summary = {
  email: true,
  phone: false,
  oauth: [
    { provider: "apple", createdAt: "2026-01-12T09:00:00Z", lastSignInAt: "2026-03-03T08:12:00Z" },
    { provider: "google", createdAt: "2026-02-01T10:00:00Z", lastSignInAt: null },
  ],
};

describe("deletionIdentities", () => {
  it("reads the summary while it is kept", () => {
    expect(deletionIdentities({ identities: summary, identitiesPurgedAt: null })).toEqual({ purged: false, ...summary });
  });

  it("says purged when identities_purged_at is set", () => {
    expect(deletionIdentities({ identities: {}, identitiesPurgedAt: "2027-01-12T03:00:00Z" })).toEqual({
      purged: true,
      purgedAt: "2027-01-12T03:00:00Z",
    });
  });

  it("says purged when the summary is empty, even without the date", () => {
    expect(deletionIdentities({ identities: {} })).toEqual({ purged: true, purgedAt: null });
  });

  it("tolerates a summary without sign-ins", () => {
    const v = deletionIdentities({ identities: { email: false, phone: true, oauth: [] } });
    expect(v).toEqual({ purged: false, email: false, phone: true, oauth: [] });
  });
});

describe("oauthSignInLine", () => {
  it("names the provider and its dates", () => {
    expect(oauthSignInLine(summary.oauth[0])).toBe("Apple, added 12 Jan 2026, 10:00, last used 3 Mar 2026, 09:12");
  });

  it("leaves out a date it doesn't have", () => {
    expect(oauthSignInLine(summary.oauth[1])).toBe("Google, added 1 Feb 2026, 11:00");
    expect(oauthSignInLine({ provider: "github", createdAt: null, lastSignInAt: null })).toBe("github");
  });

  it("keeps an unknown provider's own name", () => {
    expect(providerName("azure")).toBe("azure");
  });
});

describe("deletionIdentityRows", () => {
  it("shows Email and Phone as yes or no, and one line per sign-in", () => {
    expect(deletionIdentityRows({ identities: summary })).toEqual([
      ["Email then", "Yes"],
      ["Phone then", "No"],
      ["Apple or Google then", ["Apple, added 12 Jan 2026, 10:00, last used 3 Mar 2026, 09:12", "Google, added 1 Feb 2026, 11:00"]],
    ]);
  });

  it("shows no sign-in as none", () => {
    expect(deletionIdentityRows({ identities: { email: false, phone: true, oauth: [] } })).toEqual([
      ["Email then", "No"],
      ["Phone then", "Yes"],
      ["Apple or Google then", null],
    ]);
  });

  it("shows a single purged row once cleared", () => {
    expect(deletionIdentityRows({ identities: {}, identitiesPurgedAt: "2027-01-12T03:00:00Z" })).toEqual([
      ["Sign-in then", "Purged on 12 Jan 2027, 04:00"],
    ]);
    expect(deletionIdentityRows({ identities: {} })).toEqual([["Sign-in then", "Purged"]]);
  });
});
