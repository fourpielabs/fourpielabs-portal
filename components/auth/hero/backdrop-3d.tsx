"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState } from "react";

import { HeroStatic } from "./hero-static";
import { Scene } from "./scene";

/**
 * Lazy-chunk entry (default export → consumed via `dynamic(ssr:false)`). This file
 * + scene.tsx are the ONLY modules that pull in three/R3F/drei, so they ship as a
 * separate async chunk loaded only on the auth route — the app bundle stays clean.
 *
 * The static composition paints first (underneath); the canvas crossfades in on its
 * first committed frame. The rAF loop is paused entirely while the tab is hidden,
 * and a lost GL context degrades permanently to the static layer.
 */
export default function Backdrop3D() {
  const [ready, setReady] = useState(false); // first frame committed → crossfade in
  const [failed, setFailed] = useState(false); // context lost → static, permanently
  const [loop, setLoop] = useState<"always" | "never">("always");

  useEffect(() => {
    const onVis = () => setLoop(document.hidden ? "never" : "always");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (failed) return <HeroStatic />;

  return (
    <div className="absolute inset-0">
      <HeroStatic
        className={`transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`}
      />
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
      >
        <Canvas
          camera={{ position: [0, 0, 9], fov: 50 }}
          dpr={[1, 1.5]}
          frameloop={loop}
          gl={{ antialias: true, powerPreference: "high-performance", failIfMajorPerformanceCaveat: true }}
          fallback={<HeroStatic />}
          onCreated={({ gl }) => {
            setReady(true);
            gl.domElement.addEventListener("webglcontextlost", (e) => {
              e.preventDefault(); // mark handled; decorative → we do not chase restoration
              setFailed(true);
            });
          }}
        >
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
