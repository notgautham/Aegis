// ========== Backend -> Frontend Adapters ==========

import type {
  Asset,
  CertificateInfo,
  DimensionScores,
  RemediationAction,
  ScanHistoryEntry,
  SoftwareInfo,
} from '@/data/demoData';
import type {
  AssetResultResponse,
  ScanHistoryResponse,
  ScanResultsResponse,
} from '@/lib/api';

// ========== Asset Adapter ==========

function mapStatus(raw: AssetResultResponse): Asset['status'] {
  if (!raw.assessment) return 'unknown';

  const tier = raw.assessment?.compliance_tier;
  const risk = raw.assessment?.risk_score;
  if (tier === 'FULLY_QUANTUM_SAFE') return 'elite-pqc';
  if (tier === 'PQC_TRANSITIONING') return 'transitioning';
  if (tier === 'QUANTUM_VULNERABLE') return typeof risk === 'number' && risk > 70 ? 'critical' : 'vulnerable';
  if (typeof risk === 'number' && risk > 70) return 'critical';
  if (typeof risk === 'number' && risk >= 40) return 'vulnerable';
  return 'standard';
}

function mapTier(raw: AssetResultResponse): Asset['tier'] {
  if (!raw.assessment) return 'critical';

  const tier = raw.assessment?.compliance_tier;
  const risk = raw.assessment?.risk_score;
  if (tier === 'FULLY_QUANTUM_SAFE') return 'elite_pqc';
  if (tier === 'PQC_TRANSITIONING') return 'transitioning';
  if (tier === 'QUANTUM_VULNERABLE') return typeof risk === 'number' && risk > 70 ? 'critical' : 'legacy';
  if (typeof risk === 'number' && risk > 70) return 'critical';
  if (typeof risk === 'number' && risk >= 40) return 'legacy';
  return 'standard';
}

function mapBusinessCriticality(raw: AssetResultResponse): Asset['businessCriticality'] {
  const metadata = raw.asset_metadata;
  if (!metadata || typeof metadata !== 'object') return 'internal';
  const candidate = metadata['business_criticality'];
  if (candidate === 'customer_facing' || candidate === 'internal' || candidate === 'compliance_critical') {
    return candidate;
  }
  return 'internal';
}

function mapOwnerTeam(raw: AssetResultResponse): string {
  const metadata = raw.asset_metadata;
  if (!metadata || typeof metadata !== 'object') return 'Unassigned';
  const candidate = metadata['owner_team'];
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : 'Unassigned';
}

function mapType(serviceType: string): Asset['type'] {
  if (serviceType === 'vpn') return 'vpn';
  if (serviceType === 'api') return 'api';
  if (serviceType === 'tls') return 'web';
  return 'server';
}

function hasForwardSecrecy(kex: string | undefined): boolean {
  if (!kex) return false;
  const upper = kex.toUpperCase();
  return upper.includes('ECDHE') || upper.includes('DHE') || upper.includes('X25519');
}

function buildDimensionScores(raw: AssetResultResponse): DimensionScores {
  const assessment = raw.assessment;
  const tier = assessment?.compliance_tier;
  const dimensionFromVulnerability = (value: number | undefined): number => {
    const vulnerability = typeof value === 'number' ? value : 1;
    return Math.round((1 - vulnerability) * 100);
  };

  return {
    tls_version: dimensionFromVulnerability(assessment?.tls_vulnerability),
    key_exchange: dimensionFromVulnerability(assessment?.kex_vulnerability),
    cipher_strength: dimensionFromVulnerability(assessment?.sym_vulnerability),
    certificate_algo: dimensionFromVulnerability(assessment?.sig_vulnerability),
    forward_secrecy: hasForwardSecrecy(assessment?.kex_algorithm) ? 100 : 0,
    pqc_readiness:
      tier === 'FULLY_QUANTUM_SAFE'
        ? 100
        : tier === 'PQC_TRANSITIONING'
          ? 50
          : 0,
  };
}

function buildCertInfo(raw: AssetResultResponse): CertificateInfo {
  const certificate = raw.certificate;
  const leaf = raw.leaf_certificate;
  const publicKeyAlgorithm = leaf?.public_key_algorithm?.toUpperCase() ?? '';
  let keyType: CertificateInfo['key_type'] =
    (certificate?.key_type as CertificateInfo['key_type']) ?? 'RSA';

  if (leaf?.public_key_algorithm) {
    if (publicKeyAlgorithm.includes('ML-DSA')) {
      keyType = 'ML-DSA';
    } else if (publicKeyAlgorithm.includes('SLH-DSA')) {
      keyType = 'SLH-DSA';
    } else if (publicKeyAlgorithm === 'ECDSA') {
      keyType = 'ECDSA';
    } else {
      keyType = 'RSA';
    }
  }

  return {
    subject_cn: leaf?.subject_cn ?? certificate?.subject_cn ?? raw.hostname ?? 'unknown',
    subject_alt_names: certificate?.subject_alt_names ?? [],
    issuer: leaf?.issuer ?? certificate?.issuer ?? 'Unknown CA',
    certificate_authority: certificate?.certificate_authority ?? 'Unknown',
    signature_algorithm:
      leaf?.signature_algorithm ??
      certificate?.signature_algorithm ??
      'Unavailable',
    key_type: keyType,
    key_size: leaf?.key_size_bits ?? certificate?.key_size ?? 0,
    valid_from: certificate?.valid_from ?? '--',
    valid_until: leaf?.not_after ?? certificate?.valid_until ?? '--',
    days_remaining: leaf?.days_remaining ?? certificate?.days_remaining ?? -1,
    sha256_fingerprint: certificate?.sha256_fingerprint ?? '--',
  };
}

function buildSoftware(raw: AssetResultResponse): SoftwareInfo | null {
  if (!raw.server_software) return null;
  return {
    product: raw.server_software,
    version: '',
    type: 'server',
    eolDate: null,
    cveCount: 0,
    pqcNativeSupport: false,
  };
}

export function adaptAsset(raw: AssetResultResponse): Asset {
  const domain = raw.hostname ?? raw.ip_address ?? 'unknown';
  const riskScore = raw.assessment?.risk_score;
  const qScore = typeof riskScore === 'number' ? Math.round(100 - riskScore) : 0;
  const hndl = raw.remediation?.hndl_timeline;
  const currentYear = new Date().getFullYear();
  const hndlBreakYear = hndl?.entries.length
    ? Math.min(...hndl.entries.map((entry) => entry.breakYear))
    : null;
  const hndlYears = hndlBreakYear === null ? null : hndlBreakYear - currentYear;
  const hndlRiskLevel = (() => {
    switch (hndl?.urgency?.toUpperCase()) {
      case 'CRITICAL':
        return 'critical';
      case 'HIGH':
        return 'high';
      case 'LOW':
        return 'low';
      case 'MEDIUM':
      default:
        return 'medium';
    }
  })();

  return {
    id: raw.asset_id,
    domain,
    url: `https://${domain}:${raw.port}`,
    port: raw.port,
    type: mapType(raw.service_type),
    tls: raw.assessment?.tls_version ?? 'Unavailable',
    tlsVersionsSupported: raw.assessment?.tls_version ? [raw.assessment.tls_version] : [],
    cipher: raw.assessment?.cipher_suite ?? 'Unavailable',
    keyExchange: raw.assessment?.kex_algorithm ?? 'Unavailable',
    certificate:
      raw.certificate?.signature_algorithm ??
      raw.leaf_certificate?.signature_algorithm ??
      'Unavailable',
    certInfo: buildCertInfo(raw),
    qScore,
    status: mapStatus(raw),
    complianceTier: raw.assessment?.compliance_tier ?? null,
    tier: mapTier(raw),
    ip: raw.ip_address ?? '',
    ipv6: '',
    hndlYears,
    hndlBreakYear,
    hndlRiskLevel,
    dimensionScores: buildDimensionScores(raw),
    forwardSecrecy: hasForwardSecrecy(raw.assessment?.kex_algorithm),
    hstsEnabled: false,
    ownerTeam: mapOwnerTeam(raw),
    businessCriticality: mapBusinessCriticality(raw),
    lastScanned: new Date().toISOString(),
    software: buildSoftware(raw),
    remediation: (raw.remediation_actions ?? []).map((item) => ({
      priority: item.priority as RemediationAction['priority'],
      finding: item.finding,
      action: item.action,
      effort: (item.effort as RemediationAction['effort']) ?? 'medium',
      status: (item.status as RemediationAction['status']) ?? 'not_started',
    })),
    cryptoAgilityScore: qScore,
  };
}

// ========== Scan Results Adapter ==========

export function adaptScanResults(response: ScanResultsResponse): Asset[] {
  return response.assets.map(adaptAsset);
}

// ========== Scan History Adapter ==========

function formatDate(iso: string): string {
  const date = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month} ${day} ${year}, ${hours}:${minutes}`;
}

function computeDuration(start: string, end: string | null): string {
  if (!end) return '--';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const totalSec = Math.round(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

function formatScanStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function computeFallbackScanQScore(summary: ScanHistoryResponse['items'][number]['summary']): number {
  const total = (
    (summary.fully_quantum_safe_assets ?? 0) +
    (summary.transitioning_assets ?? 0) +
    (summary.vulnerable_assets ?? 0)
  );
  const safeish = (
    (summary.fully_quantum_safe_assets ?? 0) +
    (summary.transitioning_assets ?? 0)
  );
  return total > 0 ? Math.round((safeish / total) * 100) : 0;
}

function buildScanScoreReason(summary: ScanHistoryResponse['items'][number]['summary']): string {
  const criticalAssets = summary.critical_assets ?? 0;
  const vulnerableAssets = summary.vulnerable_assets ?? 0;
  const transitioningAssets = summary.transitioning_assets ?? 0;
  const fullyQuantumSafeAssets = summary.fully_quantum_safe_assets ?? 0;
  const unknownAssets = summary.unknown_assets ?? 0;

  if (criticalAssets > 0) {
    return `${criticalAssets} critical asset${criticalAssets === 1 ? '' : 's'} are pulling the score down.`;
  }
  if (vulnerableAssets > 0) {
    return `${vulnerableAssets} asset${vulnerableAssets === 1 ? '' : 's'} still use quantum-vulnerable crypto.`;
  }
  if (transitioningAssets > 0) {
    return `${transitioningAssets} asset${transitioningAssets === 1 ? '' : 's'} are in active PQC transition.`;
  }
  if (fullyQuantumSafeAssets > 0) {
    return `${fullyQuantumSafeAssets} asset${fullyQuantumSafeAssets === 1 ? '' : 's'} are fully quantum safe.`;
  }
  if (unknownAssets > 0) {
    return `${unknownAssets} asset${unknownAssets === 1 ? '' : 's'} lacked a full cryptographic assessment.`;
  }
  return 'No assessed assets were available in this scan summary.';
}

export function adaptScanHistory(response: ScanHistoryResponse): ScanHistoryEntry[] {
  return response.items.map((item) => {
    const summary = item.summary;
    const qScore = Math.round(summary.average_q_score ?? computeFallbackScanQScore(summary));

    return {
      id: item.scan_id,
      target: item.target,
      started: formatDate(item.created_at),
      duration: computeDuration(item.created_at, item.completed_at),
      assetsFound: summary.total_assets ?? item.progress?.assets_discovered ?? 0,
      qScore,
      criticalFindings: summary.critical_assets ?? summary.vulnerable_assets ?? 0,
      status: formatScanStatus(item.status),
      fullyQuantumSafeAssets: summary.fully_quantum_safe_assets ?? 0,
      transitioningAssets: summary.transitioning_assets ?? 0,
      vulnerableAssets: summary.vulnerable_assets ?? 0,
      criticalAssets: summary.critical_assets ?? 0,
      unknownAssets: summary.unknown_assets ?? 0,
      highestRiskScore: summary.highest_risk_score ?? null,
      tlsAssets: summary.tls_assets ?? 0,
      nonTlsAssets: summary.non_tls_assets ?? 0,
      degradedModeCount: item.degraded_mode_count ?? 0,
      scanProfile: item.scan_profile ?? null,
      initiatedBy: item.initiated_by ?? null,
      scoreReason: buildScanScoreReason(summary),
    };
  });
}
