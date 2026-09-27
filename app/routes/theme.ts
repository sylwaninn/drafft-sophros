// Light or dark, kept in a cookie so the page renders in the right one from the server.
import { data } from "react-router";
import type { Route } from "./+types/theme";

export async function action({ request }: Route.ActionArgs) {
  const theme = (await request.formData()).get("theme") === "light" ? "light" : "dark";
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return data({ ok: true }, { headers: { "Set-Cookie": `theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly${secure}` } });
}
