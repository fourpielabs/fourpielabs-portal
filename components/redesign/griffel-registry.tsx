"use client";

import * as React from "react";
import { useServerInsertedHTML } from "next/navigation";
import {
  createDOMRenderer,
  RendererProvider,
  SSRProvider,
  renderToStyleElements,
  type GriffelRenderer,
} from "@fluentui/react-components";

/**
 * Griffel SSR registry for the Next.js App Router.
 *
 * Fluent v9 styles with Griffel (atomic CSS injected at runtime). Without this,
 * styles would only appear after client hydration → FOUC + a server/client DOM
 * mismatch. The App Router contract:
 *
 *  - create ONE renderer per render (useState initialiser → stable across the
 *    request and across client re-renders),
 *  - wrap the tree in <RendererProvider> so every makeStyles() hook inserts into
 *    THIS renderer,
 *  - flush its accumulated rules into the streamed HTML via `useServerInsertedHTML`
 *    (the App Router replacement for the Pages-Router _document hook).
 *
 * `renderToStyleElements` emits <style data-make-styles-rehydration="true"> tags;
 * the client renderer reads those on mount and rehydrates instead of re-inserting,
 * so there is no duplication and no hydration warning.
 */
export function GriffelRegistry({ children }: { children: React.ReactNode }) {
  const [renderer] = React.useState<GriffelRenderer>(() => createDOMRenderer());

  useServerInsertedHTML(() => <>{renderToStyleElements(renderer)}</>);

  return (
    <RendererProvider renderer={renderer}>
      <SSRProvider>{children}</SSRProvider>
    </RendererProvider>
  );
}
