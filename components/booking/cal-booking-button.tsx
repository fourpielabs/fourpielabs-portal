"use client";

import * as React from "react";
import { useEffect } from "react";
import { getCalApi } from "@calcom/embed-react";
import { Button } from "@/components/ui/button";

/**
 * The Cal.com popup trigger. This is the ONLY module that imports
 * @calcom/embed-react, and it is reached exclusively through a
 * `dynamic(() => …, { ssr:false })` edge (see book-button.tsx) so the embed lands
 * in its own async chunk on the Calls & Notes route — never the main/app bundle.
 *
 * Clicking opens the Cal.com modal via `cal("modal", …)` (getCalApi). The popup IS
 * the date → time → confirm flow — we don't rebuild it. (We open it programmatically
 * rather than via the data-cal-link element-click binding, which didn't reliably
 * attach in testing; same API, same config, just an explicit trigger.)
 */
export function CalBookingButton({
  calLink,
  name,
  email,
  clientId,
  callTypeId,
  className,
  children,
}: {
  calLink: string;
  name: string | null;
  email: string | null;
  clientId: string;
  callTypeId: string;
  className?: string;
  children?: React.ReactNode;
}) {
  // Preload embed.js on mount so the first click opens instantly. We DON'T call
  // cal("ui") here — applying UI before any modal/iframe exists throws Cal's
  // "createIframe must be called before doInIframe". Theming happens on open.
  useEffect(() => {
    getCalApi().catch(() => {});
  }, []);

  // PREFILL the client's name/email + the LOAD-BEARING metadata the webhook maps a
  // booking back to a portal client on (payload.metadata.clientId). Cal metadata
  // values are strings; clientId/callTypeId are UUID strings.
  const config = {
    layout: "month_view" as const,
    theme: "light" as const,
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    metadata: { clientId, callTypeId },
  };

  async function openBooking() {
    const cal = await getCalApi();
    // modal opens the popup (light theme via config); ui applies the amber brand.
    // NOTE: the Cal embed logs its own benign "createIframe before doInIframe" on
    // modal open (internal iframe-load race) regardless of these calls — the popup
    // works; it's a library log, not ours.
    cal("modal", { calLink, config });
    cal("ui", {
      theme: "light",
      cssVarsPerTheme: {
        light: { "cal-brand": "#d97706" },
        dark: { "cal-brand": "#d97706" },
      },
      layout: "month_view",
    });
  }

  return (
    <Button
      type="button"
      className={className ?? "w-full"}
      onClick={openBooking}
      // exposed for verification (the metadata that maps the booking → client)
      data-cal-link={calLink}
      data-cal-config={JSON.stringify(config)}
    >
      {children ?? "Book"}
    </Button>
  );
}

export default CalBookingButton;
