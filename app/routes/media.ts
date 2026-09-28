// /media/<key>: the page's link to a media, answered with a redirect to a freshly signed one. Pages
// only ever hold this stable path; the signature (about an hour) is made here, for signed-in staff
// only (the root middleware), so a copied page or a stale tab never carries a lasting link.
import { data, redirect } from "react-router";
import { staffContext } from "~/lib/context";
import { getConfig } from "~/lib/.server/config";
import { MEDIA_KEY, mediaLink } from "~/lib/media-link";
import type { Route } from "./+types/media";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  context.get(staffContext);
  const key = params["*"] ?? "";
  if (!MEDIA_KEY.test(key)) throw data("Not found.", { status: 404 });
  const config = getConfig();
  const width = Number(new URL(request.url).searchParams.get("w")) || undefined;
  const target =
    config.demoMediaUrl && key.includes("/demo/")
      ? `${config.demoMediaUrl}/${key}`
      : await mediaLink(config.mediaUrl, config.mediaSigningKey, key, width);
  // Kept by this browser only, well within the link's life.
  return redirect(target, { status: 302, headers: { "Cache-Control": "private, max-age=600", "Referrer-Policy": "no-referrer" } });
}
