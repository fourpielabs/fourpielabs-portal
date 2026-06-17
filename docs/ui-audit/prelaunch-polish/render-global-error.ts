// Renders app/global-error.tsx to static HTML so we can screenshot it (it only
// activates on a real root-layout crash in prod, which we can't trigger without a
// source change). Static render also proves it never touches `error` — we pass one
// in and nothing leaks. Run: npx tsx docs/ui-audit/prelaunch-polish/render-global-error.ts
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { writeFileSync } from "node:fs";
import GlobalError from "../../../app/global-error";

const html =
  "<!doctype html>\n" +
  renderToStaticMarkup(
    createElement(GlobalError, {
      error: new Error("SECRET_STACK_SHOULD_NOT_APPEAR"),
      reset: () => {},
    }),
  );

writeFileSync("docs/ui-audit/prelaunch-polish/global-error.html", html);
// assert the error text never made it into the output
const leaked = html.includes("SECRET_STACK_SHOULD_NOT_APPEAR");
console.log("wrote global-error.html · error text leaked into markup:", leaked, leaked ? "❌" : "✓ (stack-safe)");
