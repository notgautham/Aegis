import { Suspense, type ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";

type SidebarSection =
  | "scan-control"
  | "risk-heatmap"
  | "asset-workbench"
  | "reports";

interface MissionLayoutProps {
  activeSection: SidebarSection;
  header: ReactNode;
  children: ReactNode;
  contextScanId?: string | null;
}

export function MissionLayout({
  activeSection,
  header,
  children,
  contextScanId = null,
}: MissionLayoutProps) {
  return (
    <main className="min-h-screen bg-dashboard-bg text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1680px] flex-col gap-5 px-4 py-4 lg:flex-row lg:px-5 lg:py-5">
        <Suspense fallback={<MissionSidebarFallback />}>
          <AppSidebar activeSection={activeSection} contextScanId={contextScanId} />
        </Suspense>
        <section className="flex min-w-0 flex-1 flex-col gap-5">
          {header}
          {children}
        </section>
      </div>
    </main>
  );
}

function MissionSidebarFallback() {
  return (
    <aside className="telemetry-panel flex w-full max-w-full flex-col overflow-hidden rounded-[30px] border border-border/70 bg-sidebar-panel px-5 py-6 text-sidebar-foreground shadow-command lg:w-80">
      <div className="h-8 w-28 rounded-full bg-white/[0.05]" />
      <div className="mt-5 h-20 rounded-[24px] border border-white/6 bg-white/[0.03]" />
      <div className="mt-10 space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-[84px] rounded-2xl border border-white/6 bg-white/[0.03]"
          />
        ))}
      </div>
      <div className="mt-auto h-28 rounded-[24px] border border-white/6 bg-white/[0.03]" />
    </aside>
  );
}
