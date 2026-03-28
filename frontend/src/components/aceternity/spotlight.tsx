import { cn } from "@/lib/utils";

export function Spotlight({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
    >
      <div className="absolute left-[-12%] top-[-24%] h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(126,165,255,0.22),_transparent_66%)] blur-3xl" />
      <div className="absolute right-[-8%] top-8 h-64 w-64 rounded-full bg-[radial-gradient(circle,_rgba(45,203,167,0.16),_transparent_68%)] blur-3xl" />
      <div className="absolute bottom-[-22%] left-[24%] h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(255,188,89,0.12),_transparent_70%)] blur-3xl" />
    </div>
  );
}
