export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-xl font-semibold tracking-tight">
          <span className="inline-block size-3 rounded-full bg-primary" />
          4Pie Labs
        </div>
        {children}
      </div>
    </main>
  );
}
