// The default web entry, plus a strict Content-Security-Policy with a per-response nonce for React
// Router's inline scripts. Images and videos come from the media CDN, Stream's CDN (chat attachments)
// and signed Supabase Storage URLs (selfies): any https source, never scripts.
import type { EntryContext, RouterContextProvider } from "react-router";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";

export const streamTimeout = 5_000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: RouterContextProvider,
) {
  if (request.method.toUpperCase() === "HEAD") {
    return new Response(null, { status: responseStatusCode, headers: responseHeaders });
  }

  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  let shellRendered = false;
  const userAgent = request.headers.get("user-agent");

  const body = await renderToReadableStream(<ServerRouter context={routerContext} url={request.url} nonce={nonce} />, {
    nonce,
    signal: AbortSignal.timeout(streamTimeout + 1000),
    onError(error: unknown) {
      responseStatusCode = 500;
      if (shellRendered) console.error(error);
    },
  });
  shellRendered = true;

  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  const dev = import.meta.env.DEV;
  responseHeaders.set("Content-Type", "text/html");
  responseHeaders.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      // Vite's dev server injects its client and HMR over a websocket.
      `script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-inline'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' https:",
      `connect-src 'self'${dev ? " ws: wss:" : ""}`,
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  return new Response(body, { headers: responseHeaders, status: responseStatusCode });
}
