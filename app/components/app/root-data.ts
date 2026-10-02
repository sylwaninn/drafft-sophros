import { useRouteLoaderData } from "react-router";
import type { ReasonCategory } from "~/lib/reasons";
import type { Staff } from "~/lib/roles";

export type Theme = "dark" | "light";

export interface QueueCount {
  count: number;
  oldest: string | null;
}

export interface RootData {
  staff: Staff;
  env: "dev" | "staging" | "production";
  mediaUrl: string;
  theme: Theme;
  sidebarOpen: boolean;
  /** Whether single-letter shortcuts decide in the review queues. */
  letterShortcuts: boolean;
  holds: Record<"review" | "selfie" | "banned", number>;
  queues: Record<"selfies" | "reviews" | "selfieOwed" | "reports" | "support" | "exports" | "photos" | "flags", QueueCount>;
  /** When the server read `holds` and `queues`. */
  countedAt: string;
  /** The reason categories a decision is told with (admin_reason_categories); empty if they couldn't be read. */
  reasonCategories: ReasonCategory[];
}

export function useRoot(): RootData {
  const data = useRouteLoaderData("root") as RootData | undefined;
  if (!data) throw new Error("root data missing");
  return data;
}

/**
 * A media key's link in sophros: `/media/<key>`, which redirects to a freshly signed URL (the bucket is
 * private).
 */
export function useMediaUrl() {
  return (key: string | null | undefined) => (key ? `/media/${key}` : undefined);
}
