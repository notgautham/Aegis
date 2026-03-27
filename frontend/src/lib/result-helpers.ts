import type {
  AssetResultResponse,
  ComplianceTier,
  ScanResultsResponse,
} from "@/lib/api";

export function getAssetLabel(asset: AssetResultResponse): string {
  return asset.hostname || asset.ip_address || `asset:${asset.asset_id.slice(0, 8)}`;
}

export function getAssetLocation(asset: AssetResultResponse): string {
  return `${asset.protocol.toUpperCase()} ${asset.port}`;
}

export function getTierVariant(tier: ComplianceTier | null | undefined) {
  switch (tier) {
    case "FULLY_QUANTUM_SAFE":
      return "success" as const;
    case "PQC_TRANSITIONING":
      return "warning" as const;
    case "QUANTUM_VULNERABLE":
      return "danger" as const;
    default:
      return "outline" as const;
  }
}

export function getAssetTier(asset: AssetResultResponse): ComplianceTier | null {
  return asset.assessment?.compliance_tier ?? asset.certificate?.tier ?? null;
}

export function getRiskScore(asset: AssetResultResponse): number | null {
  return typeof asset.assessment?.risk_score === "number"
    ? asset.assessment.risk_score
    : null;
}

export function getRiskTone(score: number | null) {
  if (score === null) {
    return "from-white/6 via-white/[0.03] to-white/[0.02]";
  }

  if (score >= 80) {
    return "from-rose-500/18 via-rose-500/8 to-transparent";
  }

  if (score >= 40) {
    return "from-amber-500/18 via-amber-500/8 to-transparent";
  }

  return "from-emerald-500/18 via-emerald-500/8 to-transparent";
}

export function findAssetInResults(
  results: ScanResultsResponse | null,
  assetId: string
): AssetResultResponse | null {
  return results?.assets.find((asset) => asset.asset_id === assetId) ?? null;
}
