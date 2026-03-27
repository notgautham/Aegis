"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function previewValue(value: JsonValue): string {
  if (Array.isArray(value)) {
    return `[${value.length} item${value.length === 1 ? "" : "s"}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value).length} key${Object.keys(value).length === 1 ? "" : "s"}}`;
  }

  if (typeof value === "string") {
    return `"${value}"`;
  }

  return String(value);
}

function shouldStartExpanded(path: string, depth: number) {
  if (depth === 0) {
    return true;
  }

  return path.includes("cryptoProperties") || path.includes("quantumRiskSummary");
}

function JsonNode({
  name,
  value,
  depth,
  path,
}: {
  name: string;
  value: JsonValue;
  depth: number;
  path: string;
}) {
  const expandable = Boolean(value) && typeof value === "object";
  const [isExpanded, setIsExpanded] = useState(shouldStartExpanded(path, depth));

  if (!expandable) {
    return (
      <div className="flex flex-wrap items-baseline gap-2 py-1">
        <span className="font-mono text-xs text-sidebar-accent">{name}</span>
        <span className="text-xs text-muted-foreground">{previewValue(value)}</span>
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((entry, index) => [String(index), entry] as const)
    : Object.entries(value as { [key: string]: JsonValue });

  return (
    <div className="py-1">
      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        className="flex w-full items-center gap-2 rounded-xl px-2 py-1 text-left transition-colors hover:bg-white/[0.04]"
      >
        <ChevronRight
          className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-90")}
        />
        <span className="font-mono text-xs text-sidebar-accent">{name}</span>
        <span className="text-xs text-muted-foreground">{previewValue(value)}</span>
      </button>
      {isExpanded ? (
        <div className="ml-4 mt-1 border-l border-white/8 pl-3">
          {entries.map(([key, child]) => (
            <JsonNode
              key={`${path}.${key}`}
              name={key}
              value={child as JsonValue}
              depth={depth + 1}
              path={`${path}.${key}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function JsonTreeViewer({ value }: { value: Record<string, unknown> }) {
  const normalized = useMemo(() => value as JsonValue, [value]);

  return (
    <div className="rounded-[24px] border border-white/8 bg-black/20 p-4 backdrop-blur-sm">
      <JsonNode name="root" value={normalized} depth={0} path="root" />
    </div>
  );
}
