/**
 * Portal shell. Role-aware navigation (team/admin sidebar vs. client top-nav)
 * and the auth guard / role redirect are added in their phases (P1 step 4 for
 * the guard; P2+ for the full navigation). For now this is a minimal frame so
 * the route tree renders.
 */
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <span className="inline-block size-3 rounded-full bg-primary" />
          <span className="font-semibold tracking-tight">4Pie Labs</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
