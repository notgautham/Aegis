import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Timeline({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-4", className)}>{children}</div>;
}

export function TimelineItem({
  title,
  subtitle,
  badge,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="relative pl-8">
      <div className="absolute left-[11px] top-10 h-[calc(100%-2rem)] w-px bg-white/10" />
      <div className="absolute left-0 top-2 h-6 w-6 rounded-full border border-sidebar-accent/30 bg-sidebar-accent/15 shadow-[0_0_0_6px_rgba(120,167,255,0.04)]" />
      <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-foreground">{title}</p>
            {subtitle ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {badge}
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </div>
  );
}
