import { describe, expect, it } from "vitest";
import { can } from "~/lib/roles";
import { ago } from "~/components/ui";

describe("can", () => {
  it("gives each role the rights of the ones before", () => {
    expect(can({ email: "a", role: "admin" }, "moderator")).toBe(true);
    expect(can({ email: "m", role: "moderator" }, "support")).toBe(true);
    expect(can({ email: "s", role: "support" }, "moderator")).toBe(false);
    expect(can({ email: "m", role: "moderator" }, "admin")).toBe(false);
  });
});

describe("ago", () => {
  const now = Date.parse("2026-09-27T12:00:00Z");
  it("says how long ago, in the largest unit", () => {
    expect(ago("2026-09-27T11:59:30Z", now)).toBe("30 s ago");
    expect(ago("2026-09-27T09:00:00Z", now)).toBe("3 h ago");
    expect(ago("2026-09-20T12:00:00Z", now)).toBe("7 d ago");
    expect(ago("2026-09-28T12:00:00Z", now)).toBe("in 1 d");
  });
});
