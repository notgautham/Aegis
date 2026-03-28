import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function BackgroundGradient({
  className,
  containerClassName,
  children,
}: {
  className?: string;
  containerClassName?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-[30px] bg-[linear-gradient(135deg,rgba(120,167,255,0.35),rgba(71,211,170,0.2),rgba(255,255,255,0.04))] p-px",
        containerClassName
      )}
    >
      <div
        className={cn(
          "rounded-[29px] bg-[linear-gradient(180deg,rgba(18,22,37,0.97),rgba(10,14,24,0.98))]",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
