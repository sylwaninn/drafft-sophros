/** The furthest page a list goes to: beyond it, the search should be narrowed instead. */
export const MAX_PAGE = 1000;

/** A `?page=` value as a whole page number between 0 and MAX_PAGE; anything else is the first page. */
export function pageParam(value: string | null): number {
  const page = Math.trunc(Number(value));
  return Number.isFinite(page) ? Math.min(MAX_PAGE, Math.max(0, page)) : 0;
}
