"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  Edit3,
  Globe2,
  Network,
  Plus,
  Rocket,
  Save,
  Trash2,
} from "lucide-react";

import type { MissionControlRecentScanResponse } from "@/lib/api";
import type {
  BusinessCriticality,
  EnvironmentTag,
  RecentLaunchContext,
  SavedTarget,
} from "@/lib/mission-control-storage";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SavedTargetsPanelProps {
  savedTargets: SavedTarget[];
  recentLaunches: RecentLaunchContext[];
  recentScans: MissionControlRecentScanResponse[];
  onSelectTarget: (target: SavedTarget) => void;
  onSaveTarget: (target: Omit<SavedTarget, "id" | "last_used_at"> & { id?: string }) => void;
  onDeleteTarget: (targetId: string) => void;
  onRelaunchTarget: (target: string) => void;
}

export function SavedTargetsPanel({
  savedTargets,
  recentLaunches,
  recentScans,
  onSelectTarget,
  onSaveTarget,
  onDeleteTarget,
  onRelaunchTarget,
}: SavedTargetsPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [environmentTag, setEnvironmentTag] = useState<EnvironmentTag | "">("");
  const [businessCriticality, setBusinessCriticality] = useState<
    BusinessCriticality | ""
  >("");
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  const lastStatusByTarget = useMemo(() => {
    const map = new Map<string, MissionControlRecentScanResponse>();
    for (const scan of recentScans) {
      if (!map.has(scan.target)) {
        map.set(scan.target, scan);
      }
    }
    return map;
  }, [recentScans]);

  const resetForm = () => {
    setEditingId(null);
    setLabel("");
    setTarget("");
    setEnvironmentTag("");
    setBusinessCriticality("");
  };

  const handleEdit = (savedTarget: SavedTarget) => {
    setSelectedTargetId(savedTarget.id);
    setEditingId(savedTarget.id);
    setLabel(savedTarget.label);
    setTarget(savedTarget.target);
    setEnvironmentTag(savedTarget.environment_tag ?? "");
    setBusinessCriticality(savedTarget.business_criticality ?? "");
  };

  const handleSave = () => {
    if (!label.trim() || !target.trim()) {
      return;
    }

    onSaveTarget({
      id: editingId ?? undefined,
      label: label.trim(),
      target: target.trim(),
      environment_tag: environmentTag || null,
      business_criticality: businessCriticality || null,
    });
    setSelectedTargetId(editingId ?? null);
    resetForm();
  };

  const selectedTarget =
    savedTargets.find((item) => item.id === selectedTargetId) ?? savedTargets[0] ?? null;

  return (
    <div className="rounded-xl border border-white/5 bg-[#1a1c20]/70 p-6 backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-[var(--font-display)] text-xs font-bold uppercase tracking-[0.2em] text-[#e2e2e8]">
            Saved Target Groups
          </p>
        </div>
        <Badge variant="outline">{savedTargets.length} saved</Badge>
      </div>

      <div className="mt-4 space-y-2">
        {savedTargets.map((item) => {
          const lastScan = lastStatusByTarget.get(item.target);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelectedTargetId(item.id);
                onSelectTarget(item);
              }}
              className="group flex w-full items-center justify-between rounded-lg border border-white/5 bg-[#0c0e12] p-3 text-left transition-all hover:bg-white/5"
            >
              <div className="flex items-center gap-3">
                <div className="text-slate-500 transition-colors group-hover:text-[#00FF41]">
                  {item.business_criticality === "critical" ? (
                    <Building2 className="h-4 w-4" />
                  ) : item.environment_tag === "external" ? (
                    <Globe2 className="h-4 w-4" />
                  ) : (
                    <Network className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <span className="text-xs text-[#e2e2e8]">{item.label}</span>
                  <p className="text-[9px] uppercase tracking-[0.16em] text-slate-600">
                    {lastScan
                      ? `${lastScan.summary.vulnerable_assets} vulnerable`
                      : item.target}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedTargetId === item.id ? (
                  <span className="h-2 w-2 rounded-full bg-[#00FF41]" />
                ) : null}
                <span className="font-[var(--font-display)] text-[9px] text-slate-600">
                  {item.environment_tag ?? "untagged"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg border border-white/5 bg-[#111318] p-4">
        <div className="grid gap-3">
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Target label"
            className="rounded-lg border-[#3b4b37]/30 bg-[#0c0e12] text-[#e2e2e8] placeholder:text-slate-600"
          />
          <Input
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="example.com or 203.0.113.10"
            className="rounded-lg border-[#3b4b37]/30 bg-[#0c0e12] text-[#e2e2e8] placeholder:text-slate-600"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={environmentTag}
              onChange={(event) => setEnvironmentTag(event.target.value as EnvironmentTag | "")}
              className="flex h-11 w-full rounded-lg border border-[#3b4b37]/30 bg-[#0c0e12] px-4 text-sm text-[#e2e2e8] outline-none transition-colors focus:border-[#00FF41] focus:ring-1 focus:ring-[#00FF41]"
            >
              <option value="">Environment</option>
              <option value="prod">Production</option>
              <option value="staging">Staging</option>
              <option value="external">External</option>
            </select>
            <select
              value={businessCriticality}
              onChange={(event) =>
                setBusinessCriticality(event.target.value as BusinessCriticality | "")
              }
              className="flex h-11 w-full rounded-lg border border-[#3b4b37]/30 bg-[#0c0e12] px-4 text-sm text-[#e2e2e8] outline-none transition-colors focus:border-[#00FF41] focus:ring-1 focus:ring-[#00FF41]"
            >
              <option value="">Criticality</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="rounded-lg bg-[#00FF41]/10 px-4 text-[#00FF41] hover:bg-[#00FF41]/20"
              onClick={handleSave}
            >
              {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingId ? "Update target" : "Save target"}
            </Button>
            {editingId ? (
              <Button type="button" variant="outline" className="rounded-full px-4" onClick={resetForm}>
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-lg border border-white/5 bg-[#111318] p-4">
        <p className="font-[var(--font-display)] text-[10px] uppercase tracking-[0.2em] text-slate-500">
          Recent launches
        </p>
        {recentLaunches.length ? (
          <div className="mt-4 space-y-3">
            {recentLaunches.map((launch) => (
              <div
                key={launch.scan_id}
                className="rounded-lg border border-white/5 bg-[#0c0e12] px-4 py-3"
              >
                <p className="text-sm font-semibold text-[#e2e2e8]">
                  {launch.target_label ?? launch.target}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                  {launch.scan_profile.replaceAll("_", " ")}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Recent launches appear here after the first successful scan submission.
          </p>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {selectedTarget ? (
          <Button
            type="button"
            variant="ghost"
            className="px-0 text-[10px] uppercase tracking-[0.16em] text-slate-500 hover:bg-transparent hover:text-[#00FF41]"
            onClick={() => onRelaunchTarget(selectedTarget.target)}
          >
            <Rocket className="h-3.5 w-3.5" />
            Relaunch selected
          </Button>
        ) : null}
        {selectedTarget ? (
          <Button
            type="button"
            variant="ghost"
            className="px-0 text-[10px] uppercase tracking-[0.16em] text-slate-500 hover:bg-transparent hover:text-[#e2e2e8]"
            onClick={() => handleEdit(selectedTarget)}
          >
            <Edit3 className="h-3.5 w-3.5" />
            Edit selected
          </Button>
        ) : null}
        {selectedTarget ? (
          <Button
            type="button"
            variant="ghost"
            className="px-0 text-[10px] uppercase tracking-[0.16em] text-slate-500 hover:bg-transparent hover:text-[#ffb4a5]"
            onClick={() => {
              onDeleteTarget(selectedTarget.id);
              if (selectedTargetId === selectedTarget.id) {
                setSelectedTargetId(null);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove selected
          </Button>
        ) : null}
      </div>
    </div>
  );
}
