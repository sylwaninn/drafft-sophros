import { describe, expect, it } from "vitest";
import { letterShortcutsOn, preferenceCookie } from "~/lib/preferences";
import { action } from "~/routes/letter-shortcuts";

function post(letters: string, url = "https://sophros.example/letter-shortcuts") {
  const body = new FormData();
  body.set("letters", letters);
  return action({ request: new Request(url, { method: "POST", body }) } as Parameters<typeof action>[0]);
}

describe("letter shortcuts", () => {
  it("are on unless the cookie turns them off", () => {
    expect(letterShortcutsOn(undefined)).toBe(true);
    expect(letterShortcutsOn("on")).toBe(true);
    expect(letterShortcutsOn("junk")).toBe(true);
    expect(letterShortcutsOn("off")).toBe(false);
  });

  it("are saved in a long-lived, server-only cookie", async () => {
    const result = (await post("off")) as unknown as { init: ResponseInit | null };
    const cookie = new Headers(result.init?.headers).get("Set-Cookie");
    expect(cookie).toBe("letter_shortcuts=off; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly; Secure");
  });

  it("store only on or off", async () => {
    const result = (await post("<script>")) as unknown as { init: ResponseInit | null };
    expect(new Headers(result.init?.headers).get("Set-Cookie")).toMatch(/^letter_shortcuts=on;/);
  });

  it("drop Secure over plain http (local)", () => {
    expect(preferenceCookie("theme", "light", "http://localhost:5173/theme")).not.toContain("Secure");
  });
});
