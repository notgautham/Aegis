import {
  ActivitySquare,
  BarChart3,
  FileCog,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Scan Control",
    description: "Active now",
    icon: ActivitySquare,
    active: true,
  },
  {
    label: "Risk Heatmap",
    description: "Phase 10",
    icon: BarChart3,
    active: false,
  },
  {
    label: "Certificates",
    description: "Phase 10",
    icon: ShieldCheck,
    active: false,
  },
  {
    label: "Reports",
    description: "Phase 10",
    icon: FileCog,
    active: false,
  },
];

export function AppSidebar() {
  return (
    <aside className="telemetry-panel relative flex w-full max-w-full flex-col overflow-hidden rounded-[30px] border border-border/70 bg-sidebar-panel px-5 py-6 text-sidebar-foreground shadow-command lg:w-80">
      <div className="telemetry-grid pointer-events-none absolute inset-0 opacity-35" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,_rgba(84,117,255,0.26),_transparent_62%)]" />
      <div className="pointer-events-none absolute -left-8 top-28 h-36 w-36 rounded-full border border-sidebar-accent/15" />
      <div className="pointer-events-none absolute -left-2 top-34 h-24 w-24 rounded-full border border-sidebar-accent/10" />
      <div className="pointer-events-none absolute bottom-24 right-[-32px] h-28 w-28 rounded-full bg-[radial-gradient(circle,_rgba(39,216,154,0.16),_transparent_68%)] blur-xl" />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-sidebar-muted">
            Aegis
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Quantum Command
          </h1>
          <p className="mt-2 max-w-[18rem] text-sm leading-6 text-sidebar-muted">
            A focused operations deck for external cryptographic discovery,
            compliance posture, and post-quantum migration readiness.
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-sidebar-accent/25 bg-sidebar-accent/10 text-sidebar-accent"
        >
          Phase 9
        </Badge>
      </div>

      <div className="relative mt-8 rounded-[24px] border border-white/8 bg-black/20 p-4 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-sidebar-muted">
              Interface posture
            </p>
            <h2 className="mt-3 text-lg font-semibold text-sidebar-foreground">
              Ground-truth telemetry
            </h2>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-sidebar-accent/25 bg-sidebar-accent/10 text-sidebar-accent">
            <Sparkles className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-sidebar-muted">
          One remembered scan, honest backend counters, stage timing, and
          degraded-mode notices before the richer investigation surfaces land.
        </p>
      </div>

      <div className="relative mt-10 space-y-3">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className={cn(
                "flex items-center gap-4 rounded-2xl border px-4 py-4 transition-colors",
                item.active
                  ? "border-sidebar-accent/30 bg-sidebar-accent/10 text-sidebar-foreground"
                  : "border-white/5 bg-white/[0.02] text-sidebar-muted"
              )}
            >
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-2xl border",
                  item.active
                    ? "border-sidebar-accent/35 bg-sidebar-accent/15 text-sidebar-accent"
                    : "border-white/8 bg-black/10 text-sidebar-muted"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-sidebar-muted">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative mt-auto rounded-[24px] border border-white/8 bg-black/20 p-4 backdrop-blur-sm">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-sidebar-muted">
          Mission note
        </p>
        <p className="mt-3 text-sm leading-6 text-sidebar-muted">
          Phase 9 is about trust, not noise. This layer proves discovery and
          issuance are behaving correctly before Phase 10 expands into deeper
          asset and report views.
        </p>
      </div>
    </aside>
  );
}
