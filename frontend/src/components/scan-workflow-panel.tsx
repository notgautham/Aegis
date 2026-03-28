"use client";

import { Loader2, Radar, ShieldCheck, Sparkles, Wrench } from "lucide-react";

import type {
  EnvironmentTag,
  PriorityTag,
  SavedTarget,
  ScanProfile,
} from "@/lib/mission-control-storage";

import { BackgroundGradient } from "@/components/aceternity/background-gradient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const profiles: Array<{
  id: ScanProfile;
  label: string;
  description: string;
  icon: typeof Radar;
}> = [
  {
    id: "quick_tls_check",
    label: "Quick TLS Check",
    description: "Fast surface validation for one internet-facing endpoint.",
    icon: Radar,
  },
  {
    id: "full_quantum_readiness",
    label: "Full Quantum Readiness Scan",
    description: "Discovery, posture, remediation, and certificate issuance.",
    icon: ShieldCheck,
  },
  {
    id: "certificate_remediation_pass",
    label: "Certificate + Remediation Pass",
    description: "Prioritize certificate posture and migration guidance.",
    icon: Wrench,
  },
  {
    id: "executive_reporting_run",
    label: "Executive Reporting Run",
    description: "Optimized for posture visibility and leadership output.",
    icon: Sparkles,
  },
];

interface ScanWorkflowPanelProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string | null;
  profile: ScanProfile;
  onProfileChange: (profile: ScanProfile) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  environmentTag: EnvironmentTag | null;
  onEnvironmentTagChange: (tag: EnvironmentTag | null) => void;
  priorityTag: PriorityTag | null;
  onPriorityTagChange: (tag: PriorityTag | null) => void;
  savedTargets: SavedTarget[];
  onSavedTargetSelect: (targetId: string) => void;
}

export function ScanWorkflowPanel({
  value,
  onValueChange,
  onSubmit,
  isSubmitting,
  error,
  profile,
  onProfileChange,
  notes,
  onNotesChange,
  environmentTag,
  onEnvironmentTagChange,
  priorityTag,
  onPriorityTagChange,
  savedTargets,
  onSavedTargetSelect,
}: ScanWorkflowPanelProps) {
  return (
    <BackgroundGradient className="h-full p-5">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Scan workflow
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-foreground">
              Run quantum readiness assessment
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Replace the toy textbox flow with a structured launch sequence designed for repeatable compliance scans.
            </p>
          </div>
          <Badge variant="outline" className="gap-2">
            UI-only workflow profiles
          </Badge>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-2">
            <label
              htmlFor="scan-target"
              className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
            >
              Target input
            </label>
            <Input
              id="scan-target"
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              placeholder="example.com, 203.0.113.0/24, or 198.51.100.14"
              disabled={isSubmitting}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="saved-target"
              className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
            >
              Saved target
            </label>
            <select
              id="saved-target"
              className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm text-foreground outline-none transition-colors focus-visible:border-sidebar-accent"
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) {
                  onSavedTargetSelect(event.target.value);
                }
              }}
            >
              <option value="">Select a saved target</option>
              {savedTargets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label} | {target.target}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          {profiles.map((item) => {
            const Icon = item.icon;
            const active = item.id === profile;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onProfileChange(item.id)}
                className={cn(
                  "rounded-[22px] border px-4 py-4 text-left transition-colors",
                  active
                    ? "border-sidebar-accent/30 bg-sidebar-accent/10"
                    : "border-white/8 bg-white/[0.03] hover:border-white/15"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sidebar-accent/20 bg-sidebar-accent/10 text-sidebar-accent">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <SelectField
            label="Environment"
            value={environmentTag ?? ""}
            onChange={(value) =>
              onEnvironmentTagChange((value || null) as EnvironmentTag | null)
            }
            options={[
              ["", "Not tagged"],
              ["prod", "Production"],
              ["staging", "Staging"],
              ["external", "External"],
            ]}
          />
          <SelectField
            label="Priority"
            value={priorityTag ?? ""}
            onChange={(value) =>
              onPriorityTagChange((value || null) as PriorityTag | null)
            }
            options={[
              ["", "Not tagged"],
              ["urgent", "Urgent"],
              ["standard", "Standard"],
              ["watch", "Watch"],
            ]}
          />
          <div className="space-y-2">
            <label
              htmlFor="scan-notes"
              className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
            >
              Scan notes
            </label>
            <Input
              id="scan-notes"
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="Optional label for the operator session"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {error ? (
          <p className="text-sm text-status-failed">{error}</p>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            The workflow fields sharpen operator intent, but the backend scan engine remains scan-centric and still accepts only the target.
          </p>
        )}

        <Button type="submit" className="w-full rounded-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating scan
            </>
          ) : (
            <>
              <Radar className="h-4 w-4" />
              Run Quantum Readiness Assessment
            </>
          )}
        </Button>
      </form>
    </BackgroundGradient>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div className="space-y-2">
      <label className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm text-foreground outline-none transition-colors focus-visible:border-sidebar-accent"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={`${label}-${optionValue}`} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
