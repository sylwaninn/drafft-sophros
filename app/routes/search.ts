// ⌘K account search: the first matches for a name, email, phone or id.
import { staffContext } from "~/lib/context";
import { query } from "~/lib/.server/db";
import type { UserRow } from "~/lib/types";
import type { Route } from "./+types/search";

export async function loader({ request, context }: Route.LoaderArgs) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return { accounts: [] as UserRow[] };
  return { accounts: await query<UserRow[]>(context.get(staffContext), "admin_users", { p_query: q, p_limit: 8 }) };
}
