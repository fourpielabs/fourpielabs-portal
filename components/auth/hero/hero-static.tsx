import { cn } from "@/lib/utils";

/**
 * Static, zero-WebGL composition in the hero's visual language: faceted CHARCOAL
 * shards drifting through CREAM light, AMBER as the warm key/rim catching their
 * edges. Pure CSS gradients + one inline SVG — no canvas, no assets.
 *
 * Quadruple duty: the static branch (mobile / reduced-motion / no-WebGL), the
 * `dynamic()` loading state, the Suspense fallback, and the post-context-loss
 * fallback. It paints FIRST, then the live canvas crossfades in over it.
 *
 * Shards are biased to the margins — the auth card sits center, so the field
 * reads strongest where it isn't covered.
 */

type Shard = {
  x: number; // viewBox 1440 × 900
  y: number;
  s: number; // scale
  r: number; // rotation deg
  o: number; // charcoal opacity (depth)
  far?: boolean; // soft blur (distance)
  glint?: boolean; // amber emissive form (the lit subset)
  rim?: boolean; // amber rim light on the edge
  shape?: "ico" | "dia" | "tri";
};

// Hand-scattered toward edges/corners + the right (brand) margin. Centre-left
// (the form column) is kept sparse/low so it never competes with form text.
const SHARDS: Shard[] = [
  { x: 150, y: 165, s: 1.5, r: 16, o: 0.13, rim: true, shape: "ico" },
  { x: 95, y: 470, s: 0.9, r: -22, o: 0.09, far: true, shape: "dia" },
  { x: 250, y: 720, s: 1.2, r: 40, o: 0.11, shape: "tri" },
  { x: 60, y: 760, s: 0.6, r: 8, o: 0.07, far: true, shape: "ico" },
  { x: 430, y: 120, s: 0.7, r: -14, o: 0.08, far: true, shape: "dia" },
  { x: 560, y: 820, s: 0.85, r: 26, o: 0.07, far: true, shape: "ico" },
  { x: 1180, y: 140, s: 1.7, r: -18, o: 0.15, rim: true, shape: "ico" },
  { x: 1330, y: 360, s: 1.0, r: 30, o: 0.12, shape: "dia" },
  { x: 1080, y: 300, s: 0.5, r: 0, o: 0.9, glint: true, shape: "ico" },
  { x: 1260, y: 640, s: 1.35, r: -8, o: 0.13, rim: true, shape: "tri" },
  { x: 1390, y: 780, s: 0.95, r: 18, o: 0.1, far: true, shape: "dia" },
  { x: 950, y: 760, s: 1.1, r: -30, o: 0.1, shape: "ico" },
  { x: 1150, y: 820, s: 0.45, r: 12, o: 0.85, glint: true, shape: "dia" },
  { x: 720, y: 90, s: 0.55, r: 22, o: 0.06, far: true, shape: "tri" },
  { x: 350, y: 360, s: 0.42, r: -6, o: 0.8, glint: true, shape: "ico" },
  { x: 1010, y: 480, s: 0.8, r: 36, o: 0.09, far: true, shape: "dia" },
];

// Motifs centered at origin (faceted silhouettes ~ icosahedron / octahedron class).
const MOTIF: Record<NonNullable<Shard["shape"]>, { poly: string; facets?: string[] }> = {
  ico: {
    poly: "0,-32 28,-16 28,16 0,32 -28,16 -28,-16",
    facets: ["0,-32 0,32", "-28,-16 28,16", "28,-16 -28,16"],
  },
  dia: { poly: "0,-34 20,0 0,34 -20,0", facets: ["0,-34 0,34", "-20,0 20,0"] },
  tri: { poly: "0,-30 26,18 -26,18", facets: ["0,-30 0,18"] },
};

export function HeroStatic({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("absolute inset-0 overflow-hidden", className)}
      style={{
        background:
          // warm cream base, light source top-right
          "radial-gradient(125% 95% at 78% 12%, #fdf7ec 0%, #f6f1e6 42%, #ece5d6 100%)",
      }}
    >
      {/* amber key-light blooms */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(40% 38% at 80% 16%, rgba(217,119,6,0.20), transparent 60%), radial-gradient(34% 30% at 88% 70%, rgba(245,158,11,0.12), transparent 62%)",
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="hero-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <radialGradient id="hero-glint" cx="38%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="55%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#b45309" />
          </radialGradient>
        </defs>
        {SHARDS.map((sh, i) => {
          const m = MOTIF[sh.shape ?? "ico"];
          const fill = sh.glint ? "url(#hero-glint)" : "#1d1d22";
          return (
            <g
              key={i}
              transform={`translate(${sh.x} ${sh.y}) rotate(${sh.r}) scale(${sh.s})`}
              filter={sh.far ? "url(#hero-soft)" : undefined}
              opacity={sh.o}
            >
              <polygon points={m.poly} fill={fill} />
              {/* faceting lines (near forms only) */}
              {!sh.far &&
                !sh.glint &&
                m.facets?.map((f, j) => (
                  <polyline
                    key={j}
                    points={f}
                    fill="none"
                    stroke="#000"
                    strokeOpacity={0.18}
                    strokeWidth={0.6}
                  />
                ))}
              {/* amber rim light on the lit edge */}
              {sh.rim && (
                <polygon
                  points={m.poly}
                  fill="none"
                  stroke="#d97706"
                  strokeOpacity={0.55}
                  strokeWidth={1.4}
                />
              )}
              {/* glint glow halo */}
              {sh.glint && (
                <circle r="46" fill="#d97706" opacity={0.16} filter="url(#hero-soft)" />
              )}
            </g>
          );
        })}
      </svg>
      {/* gentle vignette to seat the card + lift contrast under it */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 60% at 50% 50%, rgba(28,24,18,0.12), transparent 70%)",
        }}
      />
    </div>
  );
}
