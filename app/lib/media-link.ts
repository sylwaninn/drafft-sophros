// Media links in the drafft format, checked by the media Worker (drafft-backend, cloudflare/media-worker):
//   <MEDIA_PUBLIC_URL>/<key>?exp=<unix seconds>&sig=<base64url(HMAC-SHA256(MEDIA_SIGNING_KEY, key + "\n" + exp))>
// The same as the backend's (private.sign_media_key, _shared/media_url.ts): the shared test vector is in
// tests/media-link.test.ts. The bucket is private, so sophros signs a link for each media a page shows.

/** The keys drafft issues: u/<user>/<folder>/<name>.<ext>. */
export const MEDIA_KEY =
  /^u\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(photos|videos|posters|voice|chat)\/[A-Za-z0-9_-]{1,64}\.(jpg|heic|png|mp4|mov|m4a|aac|pdf|bin)$/;

/** The widths the Worker resizes to; anything else is left out. */
export const MEDIA_WIDTHS = new Set([160, 320, 640, 1080]);

const encoder = new TextEncoder();

/** At least an hour ahead, rounded up to the quarter hour, like the backend. */
export function mediaExpiry(now = Date.now()): number {
  return Math.ceil((now / 1000 + 3600) / 900) * 900;
}

export async function mediaSignature(secret: string, key: string, exp: number): Promise<string> {
  const hmac = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", hmac, encoder.encode(`${key}\n${exp}`)));
  return btoa(String.fromCharCode(...mac))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** A link to one object: signed when a signing key is set, the plain URL otherwise (bucket still public). */
export async function mediaLink(base: string, secret: string | null, key: string, width?: number, now = Date.now()): Promise<string> {
  const url = new URL(`${base}/${key}`);
  if (secret) {
    const exp = mediaExpiry(now);
    url.searchParams.set("exp", String(exp));
    url.searchParams.set("sig", await mediaSignature(secret, key, exp));
  }
  if (width && MEDIA_WIDTHS.has(width)) url.searchParams.set("w", String(width));
  return url.href;
}
