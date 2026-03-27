"use client";

import { AlertTriangle, ArrowLeft, RefreshCcw, Radar } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface RouteStateProps {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onRetry?: () => void | Promise<void>;
}

export function EmptyRouteState({
  eyebrow,
  title,
  description,
  actionHref = "/",
  actionLabel = "Return to scan control",
}: RouteStateProps) {
  return (
    <Card className="telemetry-panel relative overflow-hidden">
      <CardHeader>
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {eyebrow}
        </p>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription className="max-w-2xl leading-6">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild className="rounded-full px-5">
          <Link href={actionHref}>
            <ArrowLeft className="h-4 w-4" />
            {actionLabel}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function ErrorRouteState({
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel,
  onRetry,
}: RouteStateProps) {
  return (
    <Card className="telemetry-panel relative overflow-hidden border-status-failed/25">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-status-failed/25 bg-status-failed/10 text-status-failed">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              {eyebrow}
            </p>
            <CardTitle className="mt-2 text-2xl">{title}</CardTitle>
          </div>
        </div>
        <CardDescription className="max-w-2xl leading-6">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {onRetry ? (
          <Button onClick={() => void onRetry()} className="rounded-full px-5">
            <RefreshCcw className="h-4 w-4" />
            Retry
          </Button>
        ) : null}
        {actionHref && actionLabel ? (
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href={actionHref}>
              <ArrowLeft className="h-4 w-4" />
              {actionLabel}
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function LoadingRouteState({
  eyebrow,
  title,
  description,
}: Pick<RouteStateProps, "eyebrow" | "title" | "description">) {
  return (
    <Card className="telemetry-panel relative overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sidebar-accent/25 bg-sidebar-accent/10 text-sidebar-accent">
            <Radar className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              {eyebrow}
            </p>
            <CardTitle className="mt-2 text-2xl">{title}</CardTitle>
          </div>
        </div>
        <CardDescription className="max-w-2xl leading-6">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-24 w-full rounded-[24px]" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-32 w-full rounded-[24px]" />
          <Skeleton className="h-32 w-full rounded-[24px]" />
          <Skeleton className="h-32 w-full rounded-[24px]" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ArtifactStateCard({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry?: () => void | Promise<void>;
}) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-black/15 p-5">
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 rounded-full px-4"
          onClick={() => void onRetry()}
        >
          <RefreshCcw className="h-4 w-4" />
          Retry artifact
        </Button>
      ) : null}
    </div>
  );
}
