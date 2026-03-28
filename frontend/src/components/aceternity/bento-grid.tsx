import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function BentoGrid({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-5 xl:grid-cols-12", className)}>{children}</div>
  );
}

export function BentoCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(19,24,41,0.96),rgba(9,13,23,0.98))] p-5 shadow-command transition-transform duration-200 hover:-translate-y-0.5",
        className
      )}
    >
      {children}
    </div>
  );
}
