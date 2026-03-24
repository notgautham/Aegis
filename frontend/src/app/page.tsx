import { Shield } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 text-center">
        {/* Logo */}
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary">
          <Shield className="h-10 w-10 text-primary-foreground" />
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Aegis
        </h1>

        {/* Subtitle */}
        <p className="max-w-lg text-lg text-muted-foreground">
          Quantum Cryptographic Intelligence Platform — Discover, inventory,
          evaluate, and certify quantum-safe cryptographic posture.
        </p>

        {/* Status badge */}
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          System Initializing — Phase 1 Scaffolding Complete
        </div>
      </div>
    </main>
  );
}
