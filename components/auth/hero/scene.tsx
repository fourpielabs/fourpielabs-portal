"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Float, PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";

/**
 * The GL contents — the ONLY module (besides the Canvas host) that imports three.
 * Concept: a calm field of small CHARCOAL forms drifting through CREAM light, with
 * AMBER as a warm key/rim light catching their edges + a sparse emissive subset.
 *
 * Restraint + perf: ~300 charcoal icosahedra (one draw call) + ~24 amber octahedra
 * glints (one draw call). Per-instance matrices set once; rotated each frame via
 * refs (no setState in the loop). Cream fog dissolves distant forms — depth without
 * postprocessing. DPR is capped [1,1.5] and lowered by PerformanceMonitor on weak GPUs.
 */

const CREAM = "#f4efe4";
const COUNT = 260;
const GLINTS = 20;

// reused scratch objects — allocated ONCE at module scope (never per frame)
const dummy = new THREE.Object3D();

type Instance = {
  pos: readonly [number, number, number];
  scale: number;
  speed: number;
  spin: number;
  phase: number;
};

function makeInstances(n: number, scaleRange: readonly [number, number]): Instance[] {
  return Array.from({ length: n }, () => ({
    pos: [
      THREE.MathUtils.randFloatSpread(21),
      THREE.MathUtils.randFloatSpread(14),
      THREE.MathUtils.randFloatSpread(12),
    ] as const,
    scale: THREE.MathUtils.randFloat(scaleRange[0], scaleRange[1]),
    speed: THREE.MathUtils.randFloat(0.08, 0.32),
    spin: THREE.MathUtils.randFloat(0.4, 1),
    phase: Math.random() * Math.PI * 2,
  }));
}

export function Scene() {
  const setDpr = useThree((s) => s.setDpr);

  return (
    <>
      <PerformanceMonitor
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr(Math.min(window.devicePixelRatio, 1.5))}
        flipflops={3}
        onFallback={() => setDpr(1)}
      />

      <color attach="background" args={[CREAM]} />
      {/* denser cream fog → distant forms dissolve into the light (calm depth, not a screensaver) */}
      <fogExp2 attach="fog" args={[CREAM, 0.105]} />

      {/* luminous warm space + amber key/rim catching the charcoal edges + a cool fill to model form */}
      <ambientLight intensity={0.85} color="#fff3e0" />
      <directionalLight position={[8, 6, 5]} intensity={2.4} color="#f59e0b" />
      <directionalLight position={[-7, -3, -4]} intensity={0.45} color="#c8d0d8" />

      <ParallaxGroup>
        <Float speed={1.2} rotationIntensity={0.5} floatIntensity={0.9} floatingRange={[-0.15, 0.15]}>
          <Shards />
          <Glints />
        </Float>
      </ParallaxGroup>
    </>
  );
}

/** Slow collective parallax toward the cursor — delta-damped (frame-rate independent), no setState. */
function ParallaxGroup({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null!);
  const pointer = useThree((s) => s.pointer);
  useFrame((_, delta) => {
    const g = group.current;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, pointer.x * 0.28, 3, delta);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -pointer.y * 0.18, 3, delta);
  });
  return <group ref={group}>{children}</group>;
}

/** The charcoal field — 300 icosahedra, one draw call. */
function Shards() {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const data = useMemo(() => makeInstances(COUNT, [0.16, 0.48]), []);

  useLayoutEffect(() => {
    for (let i = 0; i < COUNT; i++) {
      const d = data[i];
      dummy.position.set(...d.pos);
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [data]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      const d = data[i];
      dummy.position.set(d.pos[0], d.pos[1] + Math.sin(t * d.speed + d.phase) * 0.25, d.pos[2]);
      dummy.rotation.set(t * d.speed * d.spin, t * d.speed * 0.6 + d.phase, d.phase * 0.2);
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#24242b" roughness={0.45} metalness={0.28} />
    </instancedMesh>
  );
}

/** The sparse emissive subset — 24 amber octahedra glints, one draw call. */
function Glints() {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const data = useMemo(() => makeInstances(GLINTS, [0.1, 0.26]), []);

  useLayoutEffect(() => {
    for (let i = 0; i < GLINTS; i++) {
      const d = data[i];
      dummy.position.set(...d.pos);
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [data]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (let i = 0; i < GLINTS; i++) {
      const d = data[i];
      dummy.position.set(d.pos[0], d.pos[1] + Math.sin(t * d.speed + d.phase) * 0.3, d.pos[2]);
      dummy.rotation.set(t * d.speed * d.spin, t * d.speed + d.phase, 0);
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, GLINTS]}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color="#1a1a1d"
        emissive="#d97706"
        emissiveIntensity={1.15}
        toneMapped={false}
        roughness={0.3}
        metalness={0.2}
      />
    </instancedMesh>
  );
}
