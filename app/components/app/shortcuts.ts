// Single-letter shortcuts (the review queues' decisions) can be turned off, per browser: someone using
// speech input or prone to stray keys shouldn't decide by accident (WCAG 2.1.4).
import { useCallback, useSyncExternalStore } from "react";

const storageKey = "sophros.letter-shortcuts";
const listeners = new Set<() => void>();
/** The choice made in this page, which holds even where storage is refused. */
let chosen: boolean | null = null;

function read(): boolean {
  if (chosen !== null) return chosen;
  try {
    return localStorage.getItem(storageKey) !== "off";
  } catch {
    return true;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey) return;
    chosen = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Whether letters decide, and a way to change it. On until turned off. */
export function useLetterShortcuts(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => true);
  const set = useCallback((value: boolean) => {
    chosen = value;
    try {
      localStorage.setItem(storageKey, value ? "on" : "off");
    } catch {
      // Storage refused (private mode): the choice holds until the page is reloaded.
    }
    listeners.forEach((listener) => listener());
  }, []);
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
