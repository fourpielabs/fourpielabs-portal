import "./redesign.css";
import { GriffelRegistry } from "@/components/redesign/griffel-registry";
import { ThemedFluent } from "@/components/redesign/themed-fluent";

/**
 * REDESIGN R0 route-group layout.
 *
 * This is a DEDICATED group ((redesign)) — a deliberate App-Router decision. The
 * brief mounts the new Fluent + glass system "alongside" the live UI without
 * replacing it, so FluentProvider lives HERE, not in the literal root layout
 * (root would leak Fluent's CSS baseline + Griffel SSR into every shipping screen).
 * Existing (auth)/(portal) groups are untouched; only the shared <html>/<body> +
 * MotionProvider from the root layout are inherited (so Motion composes for free).
 *
 * Order matters: GriffelRegistry (renderer + SSR flush) must wrap ThemedFluent
 * (FluentProvider) so every Fluent style insertion lands in the SSR'd renderer.
 */
export default function RedesignLayout({ children }: { children: React.ReactNode }) {
  return (
    <GriffelRegistry>
      <ThemedFluent defaultMode="light">{children}</ThemedFluent>
    </GriffelRegistry>
  );
}
