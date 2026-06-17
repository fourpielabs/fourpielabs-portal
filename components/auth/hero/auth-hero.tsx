"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { useReducedMotion } from "@/lib/motion";
import { canUse3D } from "@/lib/webgl/decide";
import { HeroStatic } from "./hero-static";

// The ssr:false boundary — legal only inside a client component. The 3D chunk is
// requested ONLY when the gate passes, so non-3D visitors never download three.js.
const Backdrop3D = dynamic(() => import("./backdrop-3d"), {
  ssr: false,
  loading: () => <HeroStatic />,
});

/**
 * Decorative auth backdrop island. Decides static-vs-live once on mount:
 * reduced-motion via the centralized phase-3 hook (reused, not reinvented) +
 * capability/device class via `canUse3D()`. Static renders first; the live
 * canvas only mounts when the gate passes.
 */
export function AuthHero() {
  const reduced = useReducedMotion(); // null on SSR/first paint → boolean after mount
  const [capable, setCapable] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- canUse3D() reads window/navigator; must run client-side after mount (SSR shows the static fallback, then upgrades)
    setCapable(canUse3D());
  }, []);

  const use3D = capable && reduced === false;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {use3D ? <Backdrop3D /> : <HeroStatic />}
    </div>
  );
}
