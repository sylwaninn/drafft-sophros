import { data, isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, type ShouldRevalidateFunctionArgs } from "react-router";
import { staffContext } from "~/lib/context";
import { AuthError, identify } from "~/lib/.server/auth";
import { getConfig } from "~/lib/.server/config";
import { rpc } from "~/lib/.server/db";
import type { Overview } from "~/lib/types";
import type { Route } from "./+types/root";
import "./app.css";

// Every request, pages and actions alike: who is asking, and are they staff here. Changes must come
// from sophros's own pages: the Access cookie would otherwise ride along with a form posted from
// another site.
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      const origin = request.headers.get("origin");
      if (!origin || origin !== new URL(request.url).origin) throw data({ message: "Cross-site request refused." }, { status: 403 });
    }
    try {
      context.set(staffContext, await identify(request));
    } catch (error) {
      if (error instanceof AuthError) throw data({ message: error.message, email: error.email }, { status: error.status });
      throw error;
    }
  },
];

export async function loader({ context }: Route.LoaderArgs) {
  const staff = context.get(staffContext);
  const config = getConfig();
  const o = await rpc<Overview>(staff, "admin_overview");
  return {
    staff,
    env: config.env,
    mediaUrl: config.mediaUrl,
    demoMediaUrl: config.demoMediaUrl,
    counts: {
      verifications: o.holds.review ?? 0,
      selfies: o.selfiesToCheck,
      photos: o.mediaToReview,
      flags: o.openFlags,
      reports: o.openReports,
      support: o.openSupport + o.openDataRequests,
    },
  };
}

// Revalidate the counters after every change, not on each click between pages.
export function shouldRevalidate({ formMethod, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  return formMethod ? defaultShouldRevalidate : false;
}

export function meta({ loaderData }: Route.MetaArgs) {
  const env = loaderData?.env;
  return [{ title: env && env !== "production" ? `sophros ${env}` : "sophros" }, { name: "robots", content: "noindex, nofollow" }];
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="referrer" content="no-referrer" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let details = "An unexpected error occurred. It has been logged.";
  if (isRouteErrorResponse(error)) {
    const body = error.data as { message?: string; email?: string } | string | undefined;
    if (error.status === 401) title = "Sign in again";
    else if (error.status === 403) title = "No access";
    else if (error.status === 404) title = "Not found";
    details = typeof body === "string" ? body : body?.message ?? error.statusText;
    if (typeof body === "object" && body?.email) details += ` (signed in as ${body.email})`;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
  }
  return (
    <main className="mx-auto max-w-lg px-6 py-24">
      <p className="text-sm font-semibold">sophros</p>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-body">{details}</p>
    </main>
  );
}
