// ========== Backend → Frontend Adapters ==========

import type { Asset, ScanHistoryEntry, CertificateInfo, SoftwareInfo, RemediationAction, DimensionScores } from '@/data/demoData';
import type { AssetResultResponse, ScanResultsResponse, ScanHistoryResponse } from '@/lib/api';

// ========== Asset Adapter ==========

function mapStatus(raw: AssetResultResponse): Asset['status'] {
  const tier = raw.assessment?.compliance_tier;
  const risk = raw.assessment?.risk_score ?? 50;
  if (tier === 'FULLY_QUANTUM_SAFE') return 'elite-pqc';
  if (tier === 'PQC_TRANSITIONING') return 'safe';
  // QUANTUM_VULNERABLE or unknown
  if (risk > 70) return 'critical';
  if (risk >= 40) return 'vulnerable';
  return 'standard';
}

function mapTier(raw: AssetResultResponse): Asset['tier'] {
  const tier = raw.assessment?.compliance_tier;
  const risk = raw.assessment?.risk_score ?? 50;
  if (tier === 'FULLY_QUANTUM_SAFE') return 'elite_pqc';
  if (tier === 'PQC_TRANSITIONING') return 'standard';
  if (risk > 40) return 'critical';
  return 'legacy';
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
  const a = raw.assessment;
  const tier = a?.compliance_tier;
  return {
    tls_version: Math.round((1 - (a?.tls_vulnerability ?? 0.5)) * 100),
    key_exchange: Math.round((1 - (a?.kex_vulnerability ?? 0.5)) * 100),
    cipher_strength: Math.round((1 - (a?.sym_vulnerability ?? 0.5)) * 100),
    certificate_algo: Math.round((1 - (a?.sig_vulnerability ?? 0.5)) * 100),
    forward_secrecy: hasForwardSecrecy(a?.kex_algorithm) ? 100 : 0,
    pqc_readiness: tier === 'FULLY_QUANTUM_SAFE' ? 100 : tier === 'PQC_TRANSITIONING' ? 50 : 0,
  };
}

function buildCertInfo(raw: AssetResultResponse): CertificateInfo {
  const c = raw.certificate;
  const leaf = raw.leaf_certificate;
  const publicKeyAlgorithm = leaf?.public_key_algorithm?.toUpperCase() ?? '';
  let keyType: CertificateInfo['key_type'] = (c?.key_type as CertificateInfo['key_type']) ?? 'RSA';

  if (leaf?.public_key_algorithm) {
    if (publicKeyAlgorithm.includes('ML-DSA')) {
      keyType = 'ML-DSA';
    } else if (publicKeyAlgorithm.includes('SLH-DSA')) {
      keyType = 'SLH-DSA';
    } else if (publicKeyAlgorithm === 'ECDSA') {
      keyType = 'ECDSA';
    } else if (publicKeyAlgorithm === 'RSA') {
      keyType = 'RSA';
    } else {
      keyType = 'RSA';
    }
  }

  return {
    subject_cn: leaf?.subject_cn ?? c?.subject_cn ?? raw.hostname ?? 'unknown',
    subject_alt_names: c?.subject_alt_names ?? [],
    issuer: leaf?.issuer ?? c?.issuer ?? 'Unknown CA',
    certificate_authority: c?.certificate_authority ?? 'Unknown',
    signature_algorithm: leaf?.signature_algorithm ?? c?.signature_algorithm ?? 'sha256WithRSAEncryption',
    key_type: keyType,
    key_size: leaf?.key_size_bits ?? c?.key_size ?? 2048,
    valid_from: c?.valid_from ?? '',
    valid_until: leaf?.not_after ?? c?.valid_until ?? '',
    days_remaining: leaf?.days_remaining ?? c?.days_remaining ?? 0,
    sha256_fingerprint: c?.sha256_fingerprint ?? '',
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
  const qScore = Math.round(100 - (raw.assessment?.risk_score ?? 50));
  const hndl = raw.remediation?.hndl_timeline;
  const currentYear = new Date().getFullYear();
  const hndlBreakYear = hndl?.entries.length ? Math.min(...hndl.entries.map((entry) => entry.breakYear)) : null;
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
    tls: raw.assessment?.tls_version ?? 'TLS 1.2',
    tlsVersionsSupported: [raw.assessment?.tls_version ?? 'TLS 1.2'],
    cipher: raw.assessment?.cipher_suite ?? 'Unknown',
    keyExchange: raw.assessment?.kex_algorithm ?? 'Unknown',
    certificate: raw.certificate?.signature_algorithm ?? 'sha256WithRSAEncryption',
    certInfo: buildCertInfo(raw),
    qScore,
    status: mapStatus(raw),
    tier: mapTier(raw),
    ip: raw.ip_address ?? '',
    ipv6: '',
    hndlYears,
    hndlBreakYear,
    hndlRiskLevel,
    dimensionScores: buildDimensionScores(raw),
    forwardSecrecy: hasForwardSecrecy(raw.assessment?.kex_algorithm),
    hstsEnabled: false,
    ownerTeam: 'Unassigned',
    businessCriticality: 'internal',
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
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${month} ${day} ${year}, ${h}:${m}`;
}

function computeDuration(start: string, end: string | null): string {
  if (!end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const totalSec = Math.round(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

export function adaptScanHistory(response: ScanHistoryResponse): ScanHistoryEntry[] {
  return response.items.map((item) => {
    const s = item.summary;
    const total = (s.fully_quantum_safe_assets ?? 0) + (s.transitioning_assets ?? 0) + (s.vulnerable_assets ?? 0);
    const safeish = (s.fully_quantum_safe_assets ?? 0) + (s.transitioning_assets ?? 0);
    const qScore = total > 0 ? Math.round((safeish / total) * 1000) : 0;

    return {
      id: item.scan_id,
      target: item.target,
      started: formatDate(item.created_at),
      duration: computeDuration(item.created_at, item.completed_at),
      assetsFound: item.progress?.assets_discovered ?? 0,
      qScore,
      criticalFindings: s.vulnerable_assets ?? 0,
      status: item.status === 'completed' ? 'Completed' : item.status,
    };
  });
}
