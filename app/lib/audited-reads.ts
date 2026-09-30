import type { ShouldRevalidateFunctionArgs } from "react-router";

type Args = Pick<ShouldRevalidateFunctionArgs, "currentUrl" | "nextUrl" | "formMethod" | "formAction" | "defaultShouldRevalidate">;

/**
 * Revalidation for a page whose loader logs a sensitive read (an account opened): the
 * loader runs again only when what it shows changes, so the audit log records reads that happened.
 * `shown(url)` names what the page shows at that URL (null: nothing that needs the loader); a change of
 * search params that keeps it, such as another tab, reuses the data on screen. Another page, the same
 * URL again (a click on its link, an explicit revalidation) and changes still revalidate; the theme
 * switch doesn't.
 */
export function revalidateOnNewRead(shown: (url: URL) => string | null) {
  return ({ currentUrl, nextUrl, formMethod, formAction, defaultShouldRevalidate }: Args) => {
    if (formMethod) return formAction === "/theme" ? false : defaultShouldRevalidate;
    if (currentUrl.pathname !== nextUrl.pathname || currentUrl.href === nextUrl.href) return defaultShouldRevalidate;
    const next = shown(nextUrl);
    return next !== null && next !== shown(currentUrl) ? defaultShouldRevalidate : false;
  };
}

/** The case in front: the one picked in the URL if it's still waiting, else the oldest. */
export function frontIndex<T extends { person: { id: string } }>(cases: T[], picked: string | null): number {
  return Math.max(
    0,
    cases.findIndex((c) => c.person.id === picked),
  );
}
