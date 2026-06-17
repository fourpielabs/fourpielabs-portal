"use client";

import { usePathname } from "next/navigation";

import { PageContainer, type PageWidth } from "@/components/layout/page-container";

// Per-tab width for the staff per-client workspace. The Metrics tab is data-dense
// (definitions + monthly entry grid + the month-by-month table) → `wide` (1440);
// every other tab stays `standard` (1200). Add a tab here only if it's genuinely
// data-dense — see docs/ui-audit/layout-spec.md.
const WIDE_TAB = /\/clients\/[^/]+\/metrics(\/|$)/;

export function WorkspaceContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const width: PageWidth = WIDE_TAB.test(pathname) ? "wide" : "standard";
  return (
    <PageContainer width={width} stack>
      {children}
    </PageContainer>
  );
}
