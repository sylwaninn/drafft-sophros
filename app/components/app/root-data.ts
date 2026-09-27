import { useRouteLoaderData } from "react-router";
import type { Staff } from "~/lib/roles";

export type Theme = "dark" | "light";

export interface QueueCount {
  count: number;
  oldest: string | null;
}

export interface RootData {
  staff: Staff;
  env: "local" | "staging" | "production";
  mediaUrl: string;
  demoMediaUrl: string | null;
  theme: Theme;
  sidebarOpen: boolean;
  holds: Record<"review" | "selfie" | "banned", number>;
  queues: Record<"selfies" | "reviews" | "selfieOwed" | "reports" | "support" | "exports" | "photos" | "flags", QueueCount>;
}

export function useRoot(): RootData {
  const data = useRouteLoaderData("root") as RootData | undefined;
  if (!data) throw new Error("root data missing");
  return data;
}

/** A media key's public URL (demo keys from the local Storage). */
export function useMediaUrl() {
  const { mediaUrl, demoMediaUrl } = useRoot();
  return (key: string | null | undefined) =>
    key ? `${demoMediaUrl && key.includes("/demo/") ? demoMediaUrl : mediaUrl}/${key}` : undefined;
}
