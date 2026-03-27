import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "warning" | "danger" | "success";
  className?: string;
}

const toneClasses = {
  default: "border-white/8 bg-white/[0.03]",
  warning: "border-status-running/25 bg-status-running/10",
  danger: "border-status-failed/25 bg-status-failed/10",
  success: "border-emerald-500/25 bg-emerald-500/10",
} as const;

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-[24px] border px-4 py-4 backdrop-blur-sm",
        toneClasses[tone],
        className
      )}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-3 text-2xl font-semibold text-foreground">{value}</div>
      {hint ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
