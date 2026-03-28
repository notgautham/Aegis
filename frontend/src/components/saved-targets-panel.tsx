"use client";

import { useMemo, useState } from "react";
import { Edit3, Plus, Rocket, Save, Trash2 } from "lucide-react";

import type { MissionControlRecentScanResponse } from "@/lib/api";
import type {
  BusinessCriticality,
  EnvironmentTag,
  RecentLaunchContext,
  SavedTarget,
} from "@/lib/mission-control-storage";

import { BentoCard } from "@/components/aceternity/bento-grid";
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
    resetForm();
  };

  return (
    <BentoCard className="xl:col-span-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Saved targets
          </p>
          <h3 className="mt-3 text-2xl font-semibold text-foreground">
            Repeatable launch context
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Saved targets live only in the browser and exist to remove the single-textbox-tool feeling from Mission Control.
          </p>
        </div>
        <Badge variant="outline">{savedTargets.length} saved</Badge>
      </div>

      <div className="mt-5 rounded-[22px] border border-white/8 bg-black/15 p-4">
        <div className="grid gap-3">
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Target label"
          />
          <Input
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="example.com or 203.0.113.10"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={environmentTag}
              onChange={(event) => setEnvironmentTag(event.target.value as EnvironmentTag | "")}
              className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm text-foreground outline-none transition-colors focus-visible:border-sidebar-accent"
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
              className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 text-sm text-foreground outline-none transition-colors focus-visible:border-sidebar-accent"
            >
              <option value="">Criticality</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="rounded-full px-4" onClick={handleSave}>
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

      <div className="mt-5 space-y-3">
        {savedTargets.length ? (
          savedTargets.map((item) => {
            const lastScan = lastStatusByTarget.get(item.target);
            return (
              <div
                key={item.id}
                className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-foreground">{item.label}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.target}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.environment_tag ? (
                      <Badge variant="outline">{item.environment_tag}</Badge>
                    ) : null}
                    {item.business_criticality ? (
                      <Badge variant="warning">{item.business_criticality}</Badge>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {lastScan ? (
                    <>
                      <Badge variant="outline">Last status {lastScan.status}</Badge>
                      <Badge variant="danger">
                        Vulnerable {lastScan.summary.vulnerable_assets}
                      </Badge>
                    </>
                  ) : (
                    <Badge variant="outline">No matching recent scan</Badge>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full px-4"
                    onClick={() => onSelectTarget(item)}
                  >
                    <Rocket className="h-4 w-4" />
                    Select
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full px-4"
                    onClick={() => onRelaunchTarget(item.target)}
                  >
                    Relaunch
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full px-4"
                    onClick={() => handleEdit(item)}
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full px-4 text-status-failed hover:text-status-failed"
                    onClick={() => onDeleteTarget(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-[22px] border border-dashed border-white/10 bg-black/15 px-4 py-4 text-sm leading-6 text-muted-foreground">
            No saved targets yet. Save one production or external endpoint to make repeat assessments feel like a real operator workflow.
          </div>
        )}
      </div>

      <div className="mt-5 rounded-[22px] border border-white/8 bg-black/15 p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Recent launches
        </p>
        {recentLaunches.length ? (
          <div className="mt-4 space-y-3">
            {recentLaunches.map((launch) => (
              <div
                key={launch.scan_id}
                className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3"
              >
                <p className="text-sm font-semibold text-foreground">
                  {launch.target_label ?? launch.target}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {launch.scan_profile.replaceAll("_", " ")}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Recent launches appear here after the first successful scan submission.
          </p>
        )}
      </div>
    </BentoCard>
  );
}
