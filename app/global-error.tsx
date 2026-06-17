"use client";

/**
 * Root error boundary — replaces the ROOT layout when the layout itself crashes, so
 * it renders its OWN <html>/<body> and CANNOT depend on globals.css (Tailwind) or any
 * of the root layout's providers/fonts. All styling is inline on the brand tokens
 * (cream / charcoal / amber). Like error.tsx, it NEVER renders error.message or any
 * stack to the user. Only shows in a production build (dev shows Next's overlay).
 * Visual language mirrors app/error.tsx so the two read as siblings.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          textAlign: "center",
          background: "#f7f6f2",
          color: "#18181b",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "#fef3c7",
            color: "#b45309",
          }}
        >
          {/* lucide triangle-alert, inlined so there is zero import dependency */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        </span>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-0.01em" }}>
          Something went wrong
        </h1>
        <p style={{ margin: 0, maxWidth: 360, fontSize: 14, lineHeight: 1.55, color: "#57534e" }}>
          An unexpected error occurred. Try again, or head back to your dashboard.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              cursor: "pointer",
              borderRadius: 9999,
              border: "none",
              background: "#18181b",
              color: "#ffffff",
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Try again
          </button>
          <a
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 9999,
              border: "1px solid #d6d3cd",
              background: "#ffffff",
              color: "#18181b",
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Back to dashboard
          </a>
        </div>
      </body>
    </html>
  );
}
