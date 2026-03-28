"use client";

import {
  ActivitySquare,
  BarChart3,
  FileCog,
  FolderKanban,
  HardDrive,
  HelpCircle,
  History,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  buildScanHref,
  loadPersistedScanState,
  normalizeScanId,
  type PersistedScanState,
} from "@/lib/scan-storage";
import { cn } from "@/lib/utils";

type SidebarSection =
  | "mission-control"
  | "risk-heatmap"
  | "assets"
  | "reports"
  | "history";

interface AppSidebarProps {
  activeSection?: SidebarSection;
  contextScanId?: string | null;
}

export function AppSidebar({
  activeSection = "mission-control",
  contextScanId = null,
}: AppSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rememberedScan, setRememberedScan] = useState<PersistedScanState | null>(null);

  useEffect(() => {
    setRememberedScan(loadPersistedScanState());
  }, []);

  const queryScanId = normalizeScanId(searchParams.get("scan"));
  const rememberedScanId = rememberedScan?.scanId ?? null;
  const resolvedScanId = contextScanId ?? queryScanId ?? rememberedScanId;
  const assetWorkbenchHref =
    pathname.startsWith("/assets/") || pathname === "/assets"
      ? resolvedScanId
        ? `${pathname}?scan=${resolvedScanId}`
        : pathname
      : buildScanHref("/assets", resolvedScanId);
  const navItems = [
    {
      label: "Mission Control",
      icon: ActivitySquare,
      href: "/",
      active: activeSection === "mission-control",
      disabled: false,
    },
    {
      label: "Risk Heatmap",
      icon: BarChart3,
      href: buildScanHref("/risk-heatmap", resolvedScanId),
      active: activeSection === "risk-heatmap",
      disabled: !resolvedScanId,
    },
    {
      label: "Assets",
      icon: FolderKanban,
      href: assetWorkbenchHref,
      active: activeSection === "assets",
      disabled: !resolvedScanId,
    },
    {
      label: "Reports",
      icon: FileCog,
      href: buildScanHref("/reports", resolvedScanId),
      active: activeSection === "reports",
      disabled: !resolvedScanId,
    },
    {
      label: "History",
      icon: History,
      href: buildScanHref("/history", resolvedScanId),
      active: activeSection === "history",
      disabled: false,
    },
  ] as const;

  return (
    <aside className="fixed bottom-4 left-4 top-20 z-40 hidden w-64 flex-col rounded-xl border border-white/5 bg-[#1a1c20]/70 p-4 shadow-2xl shadow-black/50 backdrop-blur-2xl lg:flex">
      <div className="mb-4 flex items-center gap-3 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded bg-[#111318] border border-[#00FF41]/20 text-[#00FF41]">
          <UserRound className="h-5 w-5" />
        </div>
        <div>
          <p className="font-[var(--font-display)] text-sm font-bold tracking-tight text-[#00FF41]">
            OPERATOR_01
          </p>
          <p className="font-[var(--font-display)] text-[10px] uppercase tracking-[0.18em] text-slate-500">
            Level 5 Clearance
          </p>
        </div>
      </div>

      <nav className="flex flex-col space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const content = (
            <div className="flex w-full items-center gap-3">
              <Icon className="h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="font-[var(--font-display)] text-sm font-medium tracking-tight">
                  {item.label}
                </p>
              </div>
            </div>
          );

          return (
            <Button
              key={item.label}
              asChild={!item.disabled}
              variant="ghost"
              disabled={item.disabled}
              className={cn(
                "h-auto w-full justify-start px-4 py-2.5 text-sm",
                item.active
                  ? "border-l-2 border-[#00FF41] bg-[#00FF41]/10 text-[#00FF41] [clip-path:polygon(0%_0%,90%_0%,100%_20%,100%_100%,0%_100%)]"
                  : "text-slate-400 hover:bg-white/5"
              )}
            >
              {item.disabled ? (
                <div className="font-[var(--font-display)] tracking-tight text-slate-500">
                  {content}
                </div>
              ) : (
                <Link
                  href={item.href}
                  className="font-[var(--font-display)] tracking-tight transition-all duration-200 hover:translate-x-1"
                >
                  {content}
                </Link>
              )}
            </Button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 border-t border-white/5 pt-4">
        <Button
          asChild
          className="w-full rounded border border-[#00FF41]/20 bg-[#00FF41]/10 py-2 font-[var(--font-display)] text-[10px] uppercase tracking-[0.22em] text-[#00FF41] hover:bg-[#00FF41]/20"
        >
          <Link href="/">Relaunch Scan</Link>
        </Button>
        <button
          type="button"
          className="flex items-center gap-3 px-4 py-2 text-sm font-[var(--font-display)] tracking-tight text-slate-400 transition-all duration-200 hover:translate-x-1 hover:bg-white/5"
        >
          <HelpCircle className="h-4 w-4" />
          Support
        </button>
        <button
          type="button"
          className="flex items-center gap-3 px-4 py-2 text-sm font-[var(--font-display)] tracking-tight text-slate-400 transition-all duration-200 hover:translate-x-1 hover:bg-white/5"
        >
          <HardDrive className="h-4 w-4" />
          System
        </button>
      </div>
    </aside>
  );
}
