import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import { staffContext } from "~/lib/context";
import { AuthError, identify } from "~/lib/.server/auth";
import { getConfig } from "~/lib/.server/config";
import { rpc } from "~/lib/.server/db";
import { rootRevalidation } from "~/lib/revalidate";
import { letterShortcutsCookie, letterShortcutsOn } from "~/lib/preferences";
import { ShieldIcon } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "~/components/ui/empty";
import { Toaster } from "~/components/ui/sonner";
import { TooltipProvider } from "~/components/ui/tooltip";
import type { RootData } from "~/components/app/root-data";
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

function cookie(request: Request, name: string) {
  return request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))?.[1];
}

export async function loader({ request, context }: Route.LoaderArgs): Promise<RootData> {
  const staff = context.get(staffContext);
  const config = getConfig();
  const overview = await rpc<Pick<RootData, "queues" | "holds">>(staff, "admin_overview");
  return {
    staff,
    env: config.env,
    mediaUrl: config.mediaUrl,
    demoMediaUrl: config.demoMediaUrl,
    theme: cookie(request, "theme") === "light" ? "light" : "dark",
    sidebarOpen: cookie(request, "sidebar_state") !== "false",
    letterShortcuts: letterShortcutsOn(cookie(request, letterShortcutsCookie)),
    holds: overview.holds,
    queues: overview.queues,
    countedAt: new Date().toISOString(),
  };
}

// The counters are read again after every change, on an explicit re-read of the same page (the live
// queues socket, useLiveQueues), on the way to "/", and once they are a minute old; not on each click
// between pages.
export const shouldRevalidate: (args: ShouldRevalidateFunctionArgs) => boolean = rootRevalidation();

export function meta({ loaderData }: Route.MetaArgs) {
  const env = loaderData?.env;
  return [{ title: env && env !== "production" ? `sophros ${env}` : "sophros" }, { name: "robots", content: "noindex, nofollow" }];
}

export function Layout({ children }: { children: React.ReactNode }) {
  const root = useRouteLoaderData("root") as RootData | undefined;
  const theme = root?.theme ?? "dark";
  return (
    <html lang="en" className={theme === "dark" ? "dark" : undefined} style={{ colorScheme: theme }}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="referrer" content="no-referrer" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <Meta />
        <Links />
      </head>
      <body>
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster theme={theme} position="bottom-right" richColors={false} />
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
    details = typeof body === "string" ? body : (body?.message ?? error.statusText);
    if (typeof body === "object" && body?.email) details += ` Signed in as ${body.email}.`;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
  }
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Empty className="max-w-md border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldIcon />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{details}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </main>
  );
}
