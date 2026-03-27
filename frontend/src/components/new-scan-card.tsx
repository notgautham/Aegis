"use client";

import { Loader2, Radar } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface NewScanCardProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  error: string | null;
}

export function NewScanCard({
  value,
  onValueChange,
  onSubmit,
  isSubmitting,
  error,
}: NewScanCardProps) {
  return (
    <Card className="telemetry-panel relative h-full overflow-hidden">
      <div className="telemetry-grid pointer-events-none absolute inset-0 opacity-30" />
      <div className="pointer-events-none absolute right-[-48px] top-[-32px] h-36 w-36 rounded-full bg-[radial-gradient(circle,_rgba(255,184,77,0.18),_transparent_68%)] blur-xl" />
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-status-running/25 bg-status-running/10 text-status-running">
            <Radar className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>New scan</CardTitle>
            <CardDescription>
              Submit one domain, IP, or CIDR target to the backend pipeline.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
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

          <div className="grid gap-3 sm:grid-cols-3">
            {["Domain", "IP", "CIDR"].map((label) => (
              <div
                key={label}
                className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3"
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Accepted
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {label}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-[24px] border border-white/6 bg-black/20 px-4 py-4 text-sm leading-6 text-muted-foreground backdrop-blur-sm">
            Phase 9 keeps the flow narrow on purpose: one active scan, honest
            backend state, no fabricated progress, and clear observability when
            discovery takes time or a fallback mode is used.
          </div>

          {error ? (
            <p className="text-sm text-status-failed">{error}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Frontend validation is intentionally light. The backend remains
              the final authority on target validity.
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating scan
              </>
            ) : (
              <>
                <Radar className="h-4 w-4" />
                Launch scan
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
