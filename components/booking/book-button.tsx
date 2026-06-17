"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { isCalLink } from "@/lib/cal";

// @calcom/embed-react is heavy + browser-only. Load it ONLY when a Cal calLink
// button actually renders, via a client-only dynamic import — so the embed lives in
// its own async chunk on the Calls & Notes route, never in the main/app bundle (the
// phase-4 auth-hero isolation discipline). A client with only legacy URLs never
// fetches it at all.
const CalBookingButton = dynamic(
  () => import("./cal-booking-button").then((m) => m.CalBookingButton),
  {
    ssr: false,
    loading: () => (
      <Button className="w-full" disabled>
        Book
      </Button>
    ),
  },
);

/**
 * The single Book entry point on Calls & Notes. A Cal.com calLink
 * (username/event-slug) opens the in-portal popup; a legacy full URL falls back to
 * an external link (so old Calendly data keeps working).
 */
export function BookButton({
  bookingUrl,
  name,
  email,
  clientId,
  callTypeId,
  className,
}: {
  bookingUrl: string | null;
  name: string | null;
  email: string | null;
  clientId: string;
  callTypeId: string;
  className?: string;
}) {
  if (isCalLink(bookingUrl)) {
    return (
      <CalBookingButton
        calLink={bookingUrl}
        name={name}
        email={email}
        clientId={clientId}
        callTypeId={callTypeId}
        className={className}
      />
    );
  }
  if (bookingUrl) {
    return (
      <Button asChild className={className ?? "w-full"}>
        <a href={bookingUrl} target="_blank" rel="noreferrer">
          Book
        </a>
      </Button>
    );
  }
  return null;
}
