import { Suspense, type ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";

type SidebarSection =
  | "mission-control"
  | "risk-heatmap"
  | "assets"
  | "reports"
  | "history";

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
    <main className="min-h-screen bg-[#111318] text-[#e2e2e8]">
      <Suspense fallback={<MissionSidebarFallback />}>
        <AppSidebar activeSection={activeSection} contextScanId={contextScanId} />
      </Suspense>
      <div className="lg:pl-[18.5rem]">
        {header}
        <section className="min-w-0 px-4 pb-6 pt-20 lg:px-6">{children}</section>
      </div>
      <div className="pointer-events-none fixed right-[-8rem] top-[-6rem] h-96 w-96 rounded-full bg-[#00ff41]/[0.05] blur-[120px]" />
      <div className="pointer-events-none fixed bottom-[-6rem] left-[-4rem] h-72 w-72 rounded-full bg-[#c31e00]/[0.05] blur-[100px]" />
    </main>
  );
}

function MissionSidebarFallback() {
  return (
    <aside className="fixed bottom-4 left-4 top-20 hidden w-64 rounded-xl border border-white/5 bg-[#1a1c20]/70 p-4 backdrop-blur-2xl lg:flex" />
  );
}
