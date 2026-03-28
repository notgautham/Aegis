"use client";

import { Loader2, Radar, ShieldCheck, Sparkles, Wrench } from "lucide-react";

import type {
  EnvironmentTag,
  PriorityTag,
  SavedTarget,
  ScanProfile,
} from "@/lib/mission-control-storage";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="overflow-hidden rounded-xl border border-white/5 bg-[#1a1c20]/70 backdrop-blur-2xl">
      <div className="flex items-center justify-between border-b border-white/5 bg-[#282a2e] px-6 py-3">
        <span className="font-[var(--font-display)] text-xs font-bold uppercase tracking-[0.2em] text-[#e2e2e8]">
          Scan Workflow // Engine_v4
        </span>
        <span className="font-mono text-sm text-slate-500">...</span>
      </div>
      <form
        className="space-y-4 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="scan-target"
              className="ml-1 font-[var(--font-display)] text-[10px] uppercase tracking-[0.2em] text-slate-500"
            >
              Target Assets (FQDN/IP)
            </label>
            <textarea
              id="scan-target"
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              placeholder="example.com, 203.0.113.0/24, or 198.51.100.14"
              disabled={isSubmitting}
              autoComplete="off"
              className="min-h-[112px] w-full rounded-lg border border-[#3b4b37]/30 bg-[#0c0e12] p-3 text-sm text-[#e2e2e8] placeholder:text-slate-600 outline-none focus:border-[#00FF41] focus:ring-1 focus:ring-[#00FF41]"
            />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="scan-profile"
                className="ml-1 font-[var(--font-display)] text-[10px] uppercase tracking-[0.2em] text-slate-500"
              >
                Scan Profile
              </label>
              <select
                id="scan-profile"
                value={profile}
                onChange={(event) => onProfileChange(event.target.value as ScanProfile)}
                className="w-full appearance-none rounded-lg border border-[#3b4b37]/30 bg-[#0c0e12] p-3 text-sm text-[#e2e2e8] outline-none focus:border-[#00FF41] focus:ring-1 focus:ring-[#00FF41]"
              >
                {profiles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="submit"
              className="w-full rounded-lg bg-[#00FF41] py-4 font-[var(--font-display)] font-bold uppercase tracking-[0.16em] text-[#003907] shadow-lg shadow-[#00FF41]/20 hover:bg-[#2aff63]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Initiating
                </>
              ) : (
                <>
                  <Radar className="h-4 w-4" />
                  Initiate Scan
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-4">
          <div className="space-y-2">
            <label
              htmlFor="saved-target"
              className="ml-1 font-[var(--font-display)] text-[10px] uppercase tracking-[0.2em] text-slate-500"
            >
              Saved Target
            </label>
            <select
              id="saved-target"
              className="flex h-11 w-full rounded-lg border border-[#3b4b37]/30 bg-[#0c0e12] px-4 text-sm text-[#e2e2e8] outline-none transition-colors focus:border-[#00FF41] focus:ring-1 focus:ring-[#00FF41]"
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) {
                  onSavedTargetSelect(event.target.value);
                }
              }}
            >
              <option value="">Select target</option>
              {savedTargets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label} | {target.target}
                </option>
              ))}
            </select>
          </div>
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

        {error ? <p className="text-sm text-status-failed">{error}</p> : null}
        <p className="text-sm leading-6 text-slate-500">
          Workflow presets sharpen operator intent. The scan engine remains scan-centric and still submits only the target to the backend.
        </p>
      </form>
    </div>
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
      <label className="ml-1 font-[var(--font-display)] text-[10px] uppercase tracking-[0.2em] text-slate-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="flex h-11 w-full rounded-lg border border-[#3b4b37]/30 bg-[#0c0e12] px-4 text-sm text-[#e2e2e8] outline-none transition-colors focus:border-[#00FF41] focus:ring-1 focus:ring-[#00FF41]"
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
