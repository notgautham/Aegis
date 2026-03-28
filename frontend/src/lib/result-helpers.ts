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

export function getUrgencyLabel(
  tier: ComplianceTier | null | undefined
): "Urgent" | "Planned" | "Monitor" | "Unavailable" {
  switch (tier) {
    case "QUANTUM_VULNERABLE":
      return "Urgent";
    case "PQC_TRANSITIONING":
      return "Planned";
    case "FULLY_QUANTUM_SAFE":
      return "Monitor";
    default:
      return "Unavailable";
  }
}

export function getActionPriorityLabel(
  tier: ComplianceTier | null | undefined
): "Fix First" | "Plan Upgrade" | "Watch" | "Unavailable" {
  switch (tier) {
    case "QUANTUM_VULNERABLE":
      return "Fix First";
    case "PQC_TRANSITIONING":
      return "Plan Upgrade";
    case "FULLY_QUANTUM_SAFE":
      return "Watch";
    default:
      return "Unavailable";
  }
}

export function getRecommendedNextAction(
  tier: ComplianceTier | null | undefined
): string {
  switch (tier) {
    case "QUANTUM_VULNERABLE":
      return "Open remediation and prioritize post-quantum migration for this endpoint.";
    case "PQC_TRANSITIONING":
      return "Review the migration roadmap and schedule the final cryptographic cutover.";
    case "FULLY_QUANTUM_SAFE":
      return "Monitor certificate posture and keep this endpoint under routine reassessment.";
    default:
      return "Review the raw findings and confirm whether deeper evidence is available.";
  }
}

export function getRiskReason(asset: AssetResultResponse): string {
  const assessment = asset.assessment;
  if (!assessment) {
    return "No deterministic crypto assessment was persisted for this asset.";
  }

  if (assessment.compliance_tier === "QUANTUM_VULNERABLE") {
    return `${assessment.kex_algorithm ?? "Key exchange"} and ${
      assessment.auth_algorithm ?? "signature"
    } are still exposing this endpoint to harvest-now, decrypt-later risk.`;
  }

  if (assessment.compliance_tier === "PQC_TRANSITIONING") {
    return "The asset shows partial post-quantum readiness, but at least one cryptographic dimension still needs remediation.";
  }

  if (assessment.compliance_tier === "FULLY_QUANTUM_SAFE") {
    return "The asset is currently classified as fully quantum safe under the deterministic rules engine.";
  }

  return "Assessment evidence is incomplete, so the workbench is presenting only backend-confirmed facts.";
}

export function findAssetInResults(
  results: ScanResultsResponse | null,
  assetId: string
): AssetResultResponse | null {
  return results?.assets.find((asset) => asset.asset_id === assetId) ?? null;
}
