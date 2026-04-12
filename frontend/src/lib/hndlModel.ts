import type { AssetResultResponse } from '@/lib/api';

export interface HndlModelParameters {
  algorithm: string;
  logicalQubits: number;
  growthRate: number;
  breakYear: number | null;
}

const DEFAULT_ALGORITHM = 'ECDH P-256';
const DEFAULT_LOGICAL_QUBITS = 2330;
const DEFAULT_GROWTH_RATE = 400;

function normalizeAlgorithm(value: string | null | undefined): string {
  const normalized = (value ?? '').toUpperCase();
  if (normalized.includes('ECDH') && normalized.includes('P256')) {
    return DEFAULT_ALGORITHM;
  }
  return value?.trim() || DEFAULT_ALGORITHM;
}

function scoreEntry(entry: {
  algorithm: string;
  logicalQubits: number;
  projectedGrowthRate: number;
  breakYear: number;
}): number {
  const normalized = (entry.algorithm || '').toUpperCase();
  let score = 0;
  if (normalized.includes('ECDH') && normalized.includes('P256')) score += 10;
  if (entry.logicalQubits > 0) score += 3;
  if (entry.projectedGrowthRate > 0) score += 2;
  if (entry.breakYear > 0) score += 1;
  return score;
}

export function deriveHndlModelParameters(assetResults: AssetResultResponse[]): HndlModelParameters {
  const entries = assetResults.flatMap((result) => result.remediation?.hndl_timeline?.entries ?? []);

  if (entries.length === 0) {
    return {
      algorithm: DEFAULT_ALGORITHM,
      logicalQubits: DEFAULT_LOGICAL_QUBITS,
      growthRate: DEFAULT_GROWTH_RATE,
      breakYear: null,
    };
  }

  const bestEntry = [...entries]
    .sort((left, right) => scoreEntry(right) - scoreEntry(left) || left.breakYear - right.breakYear)[0];

  return {
    algorithm: normalizeAlgorithm(bestEntry.algorithm),
    logicalQubits: bestEntry.logicalQubits || DEFAULT_LOGICAL_QUBITS,
    growthRate: bestEntry.projectedGrowthRate || DEFAULT_GROWTH_RATE,
    breakYear: bestEntry.breakYear || null,
  };
}

export function buildHndlEstimateExplanation(
  params: Partial<HndlModelParameters> & { breakYear?: number | null },
): string {
  const algorithm = normalizeAlgorithm(params.algorithm);
  const logicalQubits = params.logicalQubits || DEFAULT_LOGICAL_QUBITS;
  const growthRate = params.growthRate || DEFAULT_GROWTH_RATE;
  const breakYearText = params.breakYear ? ` for this asset/group lands around ${params.breakYear}` : '';

  return (
    `Deterministic estimate only: using IBM roadmap growth (~${growthRate} logical qubits/year) and ` +
    `NIST IR 8547 complexity for ${algorithm} (~${logicalQubits} logical qubits), the modeled break-year` +
    `${breakYearText}. This is not a guaranteed date; it is a source-cited planning signal. ` +
    `NIST IR 8547 recommends completing migration by 2035 regardless of exact CRQC arrival.`
  );
}
