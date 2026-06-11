export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-1 bg-[#101012]">
      {/* brand panel — dark with amber glow (desktop) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden p-12 text-[#F5F5F3] md:flex md:w-1/2 lg:w-[55%]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "var(--dark-glow)" }}
        />
        <div className="relative font-display text-lg font-bold tracking-tight">
          4Pie Labs<span className="text-amber-400">.</span>
        </div>
        <div className="relative flex flex-col gap-3">
          <h1 className="max-w-md font-display text-4xl font-semibold leading-[1.1] tracking-[-0.015em] text-balance">
            Every number, deliverable, and win — in one place.
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-[#A8A8A3]">
            Your numbers, live. No pitch deck — just proof.
          </p>
        </div>
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(217,119,6,0.35)] bg-[rgba(217,119,6,0.12)] px-3 py-1.5 text-xs font-semibold text-amber-400">
            <span className="size-1.5 rounded-full bg-amber-400" />
            Live · updated monthly
          </span>
        </div>
      </aside>

      {/* form panel */}
      <section className="flex flex-1 flex-col bg-bg">
        {/* mobile compact glowing header */}
        <div className="relative overflow-hidden bg-[#101012] px-6 py-7 text-[#F5F5F3] md:hidden">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "var(--dark-glow)" }}
          />
          <div className="relative font-display text-base font-bold tracking-tight">
            4Pie Labs<span className="text-amber-400">.</span>
          </div>
          <p className="relative mt-1 text-xs text-[#A8A8A3]">
            Every number, deliverable, and win — in one place.
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </section>
    </main>
  );
}
