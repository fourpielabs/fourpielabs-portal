import { getWebGLTier } from "./detect";

/**
 * Decide whether to mount the live 3D backdrop — the NON-reduced-motion signals
 * only (capability + device class). Reduced-motion is handled separately by the
 * centralized `useReducedMotion()` hook (phase-3) in the island, so it is NOT
 * re-checked here. Returns false on the server.
 *
 * Concept gate: desktop + WebGL only. Touch-primary (coarse pointer), Data-Saver,
 * and low-core devices fall back to the crafted static composition (battery,
 * thermals, and "screensaver on a phone" all argue against live 3D there).
 */
export function canUse3D(): boolean {
  if (typeof window === "undefined") return false;
  if (getWebGLTier() === "none") return false;

  const saveData =
    (navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData === true;
  if (saveData) return false;

  const coarse = window.matchMedia("(pointer: coarse)").matches; // touch-primary
  if (coarse) return false;

  const lowCore = (navigator.hardwareConcurrency ?? 8) <= 4;
  if (lowCore) return false;

  return true;
}
