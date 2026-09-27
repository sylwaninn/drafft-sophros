// Pages render here, so an error in one of them keeps the navigation around it.
import { isRouteErrorResponse, Outlet } from "react-router";
import { Empty, Page } from "~/components/ui";
import type { Route } from "./+types/pane";

export default function Pane() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let details = "The error was logged. Try again, or tell whoever runs sophros.";
  if (isRouteErrorResponse(error)) {
    title = error.status === 403 ? "Not for your role" : error.status === 404 ? "Not found" : title;
    details = typeof error.data === "string" ? error.data : error.statusText;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
  }
  return (
    <Page title={title}>
      <Empty>{details}</Empty>
    </Page>
  );
}
