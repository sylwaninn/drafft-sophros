import type { ShouldRevalidateFunctionArgs } from "react-router";

/** How long the queue counters may stay unread while moving between pages. */
export const COUNTS_STALE_MS = 60_000;

type Args = Pick<ShouldRevalidateFunctionArgs, "formMethod" | "nextUrl" | "defaultShouldRevalidate">;

/**
 * The root loader's revalidation: it holds the queue counters the sidebar and "What's waiting" show.
 * They are read again after every change, on the way to "/", and on any other navigation once they
 * are older than `staleMs`; a click between two pages within that time doesn't cost a query.
 * The clock is the browser's: the time of the last read the router asked for (or of hydration).
 */
export function rootRevalidation(staleMs = COUNTS_STALE_MS, now: () => number = Date.now) {
  let readAt = now();
  return ({ formMethod, nextUrl, defaultShouldRevalidate }: Args) => {
    const decision = formMethod ? defaultShouldRevalidate : nextUrl.pathname === "/" || now() - readAt >= staleMs;
    if (decision) readAt = now();
    return decision;
  };
}
