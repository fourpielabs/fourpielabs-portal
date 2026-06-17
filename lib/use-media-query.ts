"use client";

import { useSyncExternalStore } from "react";

/**
 * SSR-safe media-query hook (no hydration flash, no setState-in-effect). Server
 * snapshot is `false`, so the desktop/default branch renders during SSR and the
 * client syncs on mount. Presentation-only branching (e.g. a shorter composer
 * placeholder on touch devices).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
