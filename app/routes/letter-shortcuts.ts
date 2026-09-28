// Whether single-letter shortcuts decide, kept in a cookie like the theme. Posted from sophros's own
// pages only: the root middleware refuses another origin.
import { data } from "react-router";
import { letterShortcutsCookie, preferenceCookie } from "~/lib/preferences";
import type { Route } from "./+types/letter-shortcuts";

export async function action({ request }: Route.ActionArgs) {
  const value = (await request.formData()).get("letters") === "off" ? "off" : "on";
  return data({ ok: true }, { headers: { "Set-Cookie": preferenceCookie(letterShortcutsCookie, value, request.url) } });
}
