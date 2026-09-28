// Per-browser preferences kept in cookies, so the server renders the page with them (no flash).

/** Single-letter shortcuts decide in the review queues unless turned off. */
export const letterShortcutsCookie = "letter_shortcuts";

export function letterShortcutsOn(value: string | undefined): boolean {
  return value !== "off";
}

export function preferenceCookie(name: string, value: string, url: string): string {
  const secure = new URL(url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly${secure}`;
}
