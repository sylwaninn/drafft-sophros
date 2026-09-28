// Single-letter shortcuts (the review queues' decisions) can be turned off, per browser (a cookie): someone using
// speech input or prone to stray keys shouldn't decide by accident (WCAG 2.1.4).
import { useCallback } from "react";
import { useFetcher } from "react-router";
import { useRoot } from "./root-data";

/**
 * Whether letters decide, and a way to change it. On until turned off. The choice lives in a cookie
 * the root loader reads, so the page renders with it; while it is being saved, the pending value shows.
 */
export function useLetterShortcuts(): [boolean, (on: boolean) => void] {
  const { letterShortcuts } = useRoot();
  const fetcher = useFetcher({ key: "letter-shortcuts" });
  const pending = fetcher.formData?.get("letters");
  const on = typeof pending === "string" ? pending === "on" : letterShortcuts;
  const { submit } = fetcher;
  const set = useCallback(
    (value: boolean) => void submit({ letters: value ? "on" : "off" }, { method: "post", action: "/letter-shortcuts" }),
    [submit],
  );
  return [on, set];
}

/** True when a key press is meant for a field (typing), not for a page shortcut. */
export function typingIn(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : null;
  const active = typeof document === "undefined" ? null : document.activeElement;
  return [element, active].some(
    (el) =>
      el instanceof HTMLElement &&
      (el.isContentEditable ||
        !!el.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]')),
  );
}
