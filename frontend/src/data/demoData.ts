// ========== Core Asset Interface (matches spec AssetScanResult) ==========

export interface DimensionScores {
  tls_version: number;
  key_exchange: number;
  cipher_strength: number;
  certificate_algo: number;
  forward_secrecy: number;
  pqc_readiness: number;
}

export interface CertificateInfo {
  subject_cn: string;
  subject_alt_names: string[];
  issuer: string;
  certificate_authority: string;
  signature_algorithm: string;
  key_type: 'RSA' | 'ECDSA' | 'ML-DSA' | 'SLH-DSA';
  key_size: number;
  valid_from: string;
  valid_until: string;
  days_remaining: number;
  sha256_fingerprint: string;
}

export interface SoftwareInfo {
  product: string;
  version: string;
  type: string;
  eolDate: string | null;
  cveCount: number;
  pqcNativeSupport: boolean;
}

export interface RemediationAction {
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  finding: string;
  action: string;
  effort: 'low' | 'medium' | 'high';
  status: 'not_started' | 'in_progress' | 'done' | 'verified';
}

export interface Asset {
  id: string;
  domain: string;
  url: string;
  port: number;
  type: 'vpn' | 'web' | 'api' | 'mail' | 'iot' | 'server' | 'load_balancer';
  tls: string;
  tlsVersionsSupported: string[];
  cipher: string;
  keyExchange: string;
  certificate: string;
  certInfo: CertificateInfo;
  qScore: number;
  status: 'critical' | 'vulnerable' | 'standard' | 'safe' | 'elite-pqc' | 'unknown';
  tier: 'elite_pqc' | 'standard' | 'legacy' | 'critical';
  ip: string;
  ipv6: string;
  hndlYears: number | null;
  hndlBreakYear: number | null;
  hndlRiskLevel: 'critical' | 'high' | 'medium' | 'low';
  dimensionScores: DimensionScores;
  forwardSecrecy: boolean;
  hstsEnabled: boolean;
  ownerTeam: string;
  businessCriticality: 'customer_facing' | 'internal' | 'compliance_critical';
  lastScanned: string;
  software: SoftwareInfo | null;
  remediation: RemediationAction[];
  cryptoAgilityScore: number;
}

// ========== Domain Discovery Data ==========
export interface DomainRecord {
  detectionDate: string;
  domain: string;
  registrationDate: string;
  expiryDate: string;
  registrar: string;
  company: string;
  status: 'new' | 'confirmed' | 'false_positive';
  riskScore: number;
  nameservers: string[];
}

export const domainRecords: DomainRecord[] = [
  { detectionDate: '2026-03-28', domain: 'pnb.co.in', registrationDate: '2001-03-15', expiryDate: '2027-03-15', registrar: 'NIXI', company: 'Punjab National Bank', status: 'confirmed', riskScore: 22, nameservers: ['ns1.pnb.co.in', 'ns2.pnb.co.in'] },
  { detectionDate: '2026-03-28', domain: 'netbanking.pnb.co.in', registrationDate: '2005-06-10', expiryDate: '2027-06-10', registrar: 'NIXI', company: 'Punjab National Bank', status: 'confirmed', riskScore: 45, nameservers: ['ns1.pnb.co.in', 'ns2.pnb.co.in'] },
  { detectionDate: '2026-03-28', domain: 'vpn.pnb.co.in', registrationDate: '2008-01-20', expiryDate: '2027-01-20', registrar: 'NIXI', company: 'Punjab National Bank', status: 'confirmed', riskScore: 92, nameservers: ['ns1.pnb.co.in', 'ns2.pnb.co.in'] },
  { detectionDate: '2026-03-30', domain: 'dev-api.pnb.co.in', registrationDate: '2024-11-05', expiryDate: '2026-11-05', registrar: 'GoDaddy', company: 'Unknown', status: 'new', riskScore: 88, nameservers: ['ns1.godaddy.com'] },
  { detectionDate: '2026-03-28', domain: 'auth.pnb.co.in', registrationDate: '2018-09-01', expiryDate: '2028-09-01', registrar: 'NIXI', company: 'Punjab National Bank', status: 'confirmed', riskScore: 8, nameservers: ['ns1.pnb.co.in', 'ns2.pnb.co.in'] },
  { detectionDate: '2026-03-28', domain: 'swift.pnb.co.in', registrationDate: '2010-04-22', expiryDate: '2027-04-22', registrar: 'NIXI', company: 'Punjab National Bank', status: 'confirmed', riskScore: 41, nameservers: ['ns1.pnb.co.in', 'ns2.pnb.co.in'] },
  { detectionDate: '2026-03-28', domain: 'mail.pnb.co.in', registrationDate: '2003-07-14', expiryDate: '2027-07-14', registrar: 'NIXI', company: 'Punjab National Bank', status: 'confirmed', riskScore: 38, nameservers: ['ns1.pnb.co.in', 'ns2.pnb.co.in'] },
  { detectionDate: '2026-03-29', domain: 'staging.pnb.co.in', registrationDate: '2023-08-20', expiryDate: '2026-08-20', registrar: 'NIXI', company: 'Punjab National Bank', status: 'new', riskScore: 78, nameservers: ['ns1.pnb.co.in'] },
  { detectionDate: '2026-03-28', domain: 'pqc-api.pnb.co.in', registrationDate: '2025-12-01', expiryDate: '2028-12-01', registrar: 'NIXI', company: 'Punjab National Bank', status: 'confirmed', riskScore: 2, nameservers: ['ns1.pnb.co.in', 'ns2.pnb.co.in'] },
  { detectionDate: '2026-03-28', domain: 'upi.pnb.co.in', registrationDate: '2016-04-11', expiryDate: '2027-04-11', registrar: 'NIXI', company: 'Punjab National Bank', status: 'confirmed', riskScore: 44, nameservers: ['ns1.pnb.co.in', 'ns2.pnb.co.in'] },
  { detectionDate: '2026-03-30', domain: 'test-portal.pnb.co.in', registrationDate: '2025-01-15', expiryDate: '2026-07-15', registrar: 'GoDaddy', company: 'Unknown', status: 'new', riskScore: 85, nameservers: ['ns1.godaddy.com'] },
  { detectionDate: '2026-03-28', domain: 'treasury.pnb.co.in', registrationDate: '2012-02-28', expiryDate: '2027-02-28', registrar: 'NIXI', company: 'Punjab National Bank', status: 'confirmed', riskScore: 39, nameservers: ['ns1.pnb.co.in', 'ns2.pnb.co.in'] },
];

// ========== IP / Subnet Data ==========
export interface IPRecord {
  detectionDate: string;
  ip: string;
  portsOpen: number[];
  subnet: string;
  asn: string;
  netname: string;
  city: string;
  isp: string;
  reverseDns: string;
  risk: 'critical' | 'high' | 'medium' | 'low';
}

export const ipRecords: IPRecord[] = [
  { detectionDate: '2026-03-28', ip: '14.140.82.10', portsOpen: [443, 22, 500], subnet: '14.140.82.0/24', asn: 'AS9829', netname: 'BSNL-NIB', city: 'New Delhi', isp: 'BSNL', reverseDns: 'vpn.pnb.co.in', risk: 'critical' },
  { detectionDate: '2026-03-28', ip: '14.140.82.11', portsOpen: [443, 80], subnet: '14.140.82.0/24', asn: 'AS9829', netname: 'BSNL-NIB', city: 'New Delhi', isp: 'BSNL', reverseDns: 'reporting.pnb.co.in', risk: 'high' },
  { detectionDate: '2026-03-28', ip: '14.140.82.25', portsOpen: [443, 80, 8443], subnet: '14.140.82.0/24', asn: 'AS9829', netname: 'BSNL-NIB', city: 'New Delhi', isp: 'BSNL', reverseDns: 'netbanking.pnb.co.in', risk: 'medium' },
  { detectionDate: '2026-03-28', ip: '14.140.82.40', portsOpen: [443], subnet: '14.140.82.0/24', asn: 'AS9829', netname: 'BSNL-NIB', city: 'New Delhi', isp: 'BSNL', reverseDns: 'auth.pnb.co.in', risk: 'low' },
  { detectionDate: '2026-03-28', ip: '14.140.82.50', portsOpen: [443], subnet: '14.140.82.0/24', asn: 'AS9829', netname: 'BSNL-NIB', city: 'New Delhi', isp: 'BSNL', reverseDns: 'pqc-api.pnb.co.in', risk: 'low' },
  { detectionDate: '2026-03-28', ip: '14.140.82.20', portsOpen: [443, 8443], subnet: '14.140.82.0/24', asn: 'AS9829', netname: 'BSNL-NIB', city: 'New Delhi', isp: 'BSNL', reverseDns: 'swift.pnb.co.in', risk: 'medium' },
  { detectionDate: '2026-03-29', ip: '14.140.82.13', portsOpen: [443, 80, 22, 3389], subnet: '14.140.82.0/24', asn: 'AS9829', netname: 'BSNL-NIB', city: 'New Delhi', isp: 'BSNL', reverseDns: 'staging.pnb.co.in', risk: 'critical' },
  { detectionDate: '2026-03-28', ip: '14.140.82.32', portsOpen: [443, 25, 587, 993], subnet: '14.140.82.0/24', asn: 'AS9829', netname: 'BSNL-NIB', city: 'New Delhi', isp: 'BSNL', reverseDns: 'mail.pnb.co.in', risk: 'medium' },
];

// ========== Shadow IT Data ==========
export interface ShadowITAlert {
  discoveryDate: string;
  asset: string;
  assetType: string;
  howDiscovered: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  registeredOwner: string;
  recommendedAction: string;
}

export const shadowITAlerts: ShadowITAlert[] = [
  { discoveryDate: '2026-03-30', asset: 'dev-api.pnb.co.in', assetType: 'API', howDiscovered: 'Certificate Transparency Logs', riskLevel: 'critical', registeredOwner: 'Unknown', recommendedAction: 'Investigate and add to inventory or block' },
  { discoveryDate: '2026-03-30', asset: 'test-portal.pnb.co.in', assetType: 'Web App', howDiscovered: 'Subdomain Enumeration', riskLevel: 'high', registeredOwner: 'Unknown', recommendedAction: 'Assign owner and scan immediately' },
  { discoveryDate: '2026-03-29', asset: 'staging.pnb.co.in', assetType: 'Web App', howDiscovered: 'DNS Zone Transfer', riskLevel: 'high', registeredOwner: 'DevOps Team (unconfirmed)', recommendedAction: 'Expired certificate — renew or decommission' },
  { discoveryDate: '2026-03-28', asset: '14.140.82.99', assetType: 'Server', howDiscovered: 'Shodan/Censys OSINT', riskLevel: 'medium', registeredOwner: 'Unknown', recommendedAction: 'Identify service and register' },
];

// ========== Software Data ==========
export interface SoftwareRecord {
  detectionDate: string;
  product: string;
  version: string;
  type: string;
  port: number;
  hostIp: string;
  hostname: string;
  eolStatus: 'supported' | 'eol_soon' | 'end_of_life';
  eolDate: string | null;
  cveCount: number;
  pqcSupport: 'native' | 'plugin' | 'none';
}

export const softwareRecords: SoftwareRecord[] = [
  { detectionDate: '2026-03-28', product: 'Apache HTTP Server', version: '2.4.52', type: 'Web Server', port: 443, hostIp: '14.140.82.25', hostname: 'netbanking.pnb.co.in', eolStatus: 'supported', eolDate: null, cveCount: 3, pqcSupport: 'plugin' },
  { detectionDate: '2026-03-28', product: 'OpenSSL', version: '1.1.1w', type: 'Crypto Library', port: 443, hostIp: '14.140.82.10', hostname: 'vpn.pnb.co.in', eolStatus: 'end_of_life', eolDate: '2023-09-11', cveCount: 12, pqcSupport: 'none' },
  { detectionDate: '2026-03-28', product: 'nginx', version: '1.24.0', type: 'Web Server / Reverse Proxy', port: 443, hostIp: '14.140.82.40', hostname: 'auth.pnb.co.in', eolStatus: 'supported', eolDate: null, cveCount: 1, pqcSupport: 'plugin' },
  { detectionDate: '2026-03-28', product: 'OQS-OpenSSL', version: '3.2.0-oqs', type: 'PQC Crypto Library', port: 443, hostIp: '14.140.82.50', hostname: 'pqc-api.pnb.co.in', eolStatus: 'supported', eolDate: null, cveCount: 0, pqcSupport: 'native' },
  { detectionDate: '2026-03-28', product: 'Microsoft IIS', version: '10.0', type: 'Web Server', port: 443, hostIp: '14.140.82.11', hostname: 'reporting.pnb.co.in', eolStatus: 'supported', eolDate: null, cveCount: 5, pqcSupport: 'none' },
  { detectionDate: '2026-03-28', product: 'Postfix', version: '3.5.6', type: 'Mail Server', port: 25, hostIp: '14.140.82.32', hostname: 'mail.pnb.co.in', eolStatus: 'supported', eolDate: null, cveCount: 2, pqcSupport: 'none' },
  { detectionDate: '2026-03-28', product: 'Cisco ASA', version: '9.16.3', type: 'VPN Gateway', port: 443, hostIp: '14.140.82.10', hostname: 'vpn.pnb.co.in', eolStatus: 'eol_soon', eolDate: '2026-12-31', cveCount: 8, pqcSupport: 'none' },
  { detectionDate: '2026-03-28', product: 'HAProxy', version: '2.8.3', type: 'Load Balancer', port: 443, hostIp: '14.140.82.20', hostname: 'swift.pnb.co.in', eolStatus: 'supported', eolDate: null, cveCount: 0, pqcSupport: 'plugin' },
];

// ========== Full Assets (expanded) ==========
export const assets: Asset[] = [
  {
    id: 'a1', domain: 'vpn.pnb.co.in', url: 'https://vpn.pnb.co.in', port: 443, type: 'vpn',
    tls: 'TLS 1.2', tlsVersionsSupported: ['TLS_1_0', 'TLS_1_1', 'TLS_1_2'],
    cipher: 'TLS_RSA_WITH_AES_128_CBC_SHA', keyExchange: 'RSA', certificate: 'RSA-2048',
    certInfo: { subject_cn: 'vpn.pnb.co.in', subject_alt_names: ['vpn.pnb.co.in'], issuer: 'DigiCert SHA2 Secure Server CA', certificate_authority: 'DigiCert', signature_algorithm: 'SHA256WithRSAEncryption', key_type: 'RSA', key_size: 2048, valid_from: '2025-09-14', valid_until: '2026-09-14', days_remaining: 167, sha256_fingerprint: 'A1:B2:C3:D4:E5:F6:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23' },
    qScore: 24, status: 'critical', tier: 'critical', ip: '14.140.82.10', ipv6: '', hndlYears: 5, hndlBreakYear: 2031, hndlRiskLevel: 'critical',
    dimensionScores: { tls_version: 20, key_exchange: 10, cipher_strength: 30, certificate_algo: 25, forward_secrecy: 0, pqc_readiness: 0 },
    forwardSecrecy: false, hstsEnabled: false, ownerTeam: 'Network Security', businessCriticality: 'customer_facing',
    lastScanned: '2026-03-31T09:14:22Z', software: { product: 'Cisco ASA', version: '9.16.3', type: 'VPN Gateway', eolDate: '2026-12-31', cveCount: 8, pqcNativeSupport: false },
    remediation: [
      { priority: 'P1', finding: 'TLS 1.0/1.1 enabled', action: 'Disable TLS 1.0 and 1.1 in VPN configuration', effort: 'low', status: 'not_started' },
      { priority: 'P1', finding: 'RSA key exchange (no forward secrecy)', action: 'Enable ECDHE key exchange', effort: 'medium', status: 'not_started' },
      { priority: 'P2', finding: 'No PQC key exchange', action: 'Implement ML-KEM-768 hybrid key exchange', effort: 'high', status: 'not_started' },
    ],
    cryptoAgilityScore: 3,
  },
  {
    id: 'a2', domain: 'reporting.pnb.co.in', url: 'https://reporting.pnb.co.in', port: 443, type: 'web',
    tls: 'TLS 1.2', tlsVersionsSupported: ['TLS_1_0', 'TLS_1_1', 'TLS_1_2'],
    cipher: 'TLS_RSA_WITH_AES_128_CBC_SHA', keyExchange: 'RSA', certificate: 'RSA-2048',
    certInfo: { subject_cn: 'reporting.pnb.co.in', subject_alt_names: ['reporting.pnb.co.in'], issuer: 'Thawte RSA CA 2018', certificate_authority: 'Thawte', signature_algorithm: 'SHA256WithRSAEncryption', key_type: 'RSA', key_size: 2048, valid_from: '2025-11-01', valid_until: '2026-05-01', days_remaining: 31, sha256_fingerprint: 'B2:C3:D4:E5:F6:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45' },
    qScore: 24, status: 'critical', tier: 'critical', ip: '14.140.82.11', ipv6: '', hndlYears: 5, hndlBreakYear: 2031, hndlRiskLevel: 'critical',
    dimensionScores: { tls_version: 20, key_exchange: 10, cipher_strength: 30, certificate_algo: 25, forward_secrecy: 0, pqc_readiness: 0 },
    forwardSecrecy: false, hstsEnabled: false, ownerTeam: 'IT Operations', businessCriticality: 'internal',
    lastScanned: '2026-03-31T09:15:00Z', software: { product: 'Microsoft IIS', version: '10.0', type: 'Web Server', eolDate: null, cveCount: 5, pqcNativeSupport: false },
    remediation: [
      { priority: 'P1', finding: 'Certificate expiring in 31 days', action: 'Renew SSL certificate immediately', effort: 'low', status: 'not_started' },
      { priority: 'P1', finding: 'TLS 1.0/1.1 enabled', action: 'Disable legacy TLS versions', effort: 'low', status: 'not_started' },
    ],
    cryptoAgilityScore: 4,
  },
  {
    id: 'a3', domain: 'legacy.pnb.co.in', url: 'https://legacy.pnb.co.in', port: 443, type: 'web',
    tls: 'TLS 1.2', tlsVersionsSupported: ['TLS_1_0', 'TLS_1_1', 'TLS_1_2'],
    cipher: 'TLS_RSA_WITH_AES_128_CBC_SHA', keyExchange: 'RSA', certificate: 'RSA-2048',
    certInfo: { subject_cn: 'legacy.pnb.co.in', subject_alt_names: ['legacy.pnb.co.in'], issuer: 'COMODO RSA Domain Validation', certificate_authority: 'COMODO', signature_algorithm: 'SHA256WithRSAEncryption', key_type: 'RSA', key_size: 2048, valid_from: '2025-06-01', valid_until: '2026-06-01', days_remaining: 62, sha256_fingerprint: 'C3:D4:E5:F6:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67' },
    qScore: 24, status: 'critical', tier: 'critical', ip: '14.140.82.12', ipv6: '', hndlYears: 5, hndlBreakYear: 2031, hndlRiskLevel: 'critical',
    dimensionScores: { tls_version: 20, key_exchange: 10, cipher_strength: 30, certificate_algo: 25, forward_secrecy: 0, pqc_readiness: 0 },
    forwardSecrecy: false, hstsEnabled: false, ownerTeam: 'IT Operations', businessCriticality: 'internal',
    lastScanned: '2026-03-31T09:15:30Z', software: null,
    remediation: [{ priority: 'P1', finding: 'Legacy system with weak crypto', action: 'Plan decommission or full TLS upgrade', effort: 'high', status: 'not_started' }],
    cryptoAgilityScore: 2,
  },
  {
    id: 'a4', domain: 'staging.pnb.co.in', url: 'https://staging.pnb.co.in', port: 443, type: 'web',
    tls: '--', tlsVersionsSupported: [],
    cipher: '--', keyExchange: '--', certificate: '--',
    certInfo: { subject_cn: 'staging.pnb.co.in', subject_alt_names: [], issuer: 'Unknown', certificate_authority: 'Unknown', signature_algorithm: '--', key_type: 'RSA', key_size: 0, valid_from: '--', valid_until: '--', days_remaining: -1, sha256_fingerprint: '--' },
    qScore: 0, status: 'unknown', tier: 'critical', ip: '14.140.82.13', ipv6: '', hndlYears: null, hndlBreakYear: null, hndlRiskLevel: 'critical',
    dimensionScores: { tls_version: 0, key_exchange: 0, cipher_strength: 0, certificate_algo: 0, forward_secrecy: 0, pqc_readiness: 0 },
    forwardSecrecy: false, hstsEnabled: false, ownerTeam: 'Unassigned', businessCriticality: 'internal',
    lastScanned: '2026-03-31T09:16:00Z', software: null,
    remediation: [{ priority: 'P1', finding: 'No TLS detected — possible Shadow IT', action: 'Investigate and secure or decommission', effort: 'medium', status: 'not_started' }],
    cryptoAgilityScore: 0,
  },
  {
    id: 'a5', domain: 'swift.pnb.co.in', url: 'https://swift.pnb.co.in', port: 443, type: 'api',
    tls: 'TLS 1.2', tlsVersionsSupported: ['TLS_1_2'],
    cipher: 'TLS_ECDHE_RSA_WITH_AES_256_GCM', keyExchange: 'ECDHE', certificate: 'RSA-2048',
    certInfo: { subject_cn: 'swift.pnb.co.in', subject_alt_names: ['swift.pnb.co.in'], issuer: 'DigiCert Global Root CA', certificate_authority: 'DigiCert', signature_algorithm: 'SHA256WithRSAEncryption', key_type: 'RSA', key_size: 2048, valid_from: '2025-04-01', valid_until: '2027-04-01', days_remaining: 366, sha256_fingerprint: 'D4:E5:F6:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89' },
    qScore: 71, status: 'standard', tier: 'standard', ip: '14.140.82.20', ipv6: '2001:db8::20', hndlYears: 8, hndlBreakYear: 2034, hndlRiskLevel: 'medium',
    dimensionScores: { tls_version: 60, key_exchange: 65, cipher_strength: 85, certificate_algo: 50, forward_secrecy: 100, pqc_readiness: 10 },
    forwardSecrecy: true, hstsEnabled: true, ownerTeam: 'Treasury & Payments', businessCriticality: 'compliance_critical',
    lastScanned: '2026-03-31T09:17:00Z', software: { product: 'HAProxy', version: '2.8.3', type: 'Load Balancer', eolDate: null, cveCount: 0, pqcNativeSupport: false },
    remediation: [
      { priority: 'P2', finding: 'No PQC key exchange', action: 'Implement ML-KEM-768 hybrid', effort: 'high', status: 'not_started' },
      { priority: 'P3', finding: 'RSA-2048 certificate', action: 'Upgrade to ECDSA P-384 or ML-DSA-65', effort: 'medium', status: 'not_started' },
    ],
    cryptoAgilityScore: 8,
  },
  {
    id: 'a6', domain: 'netbanking.pnb.co.in', url: 'https://netbanking.pnb.co.in', port: 443, type: 'web',
    tls: 'TLS 1.2', tlsVersionsSupported: ['TLS_1_2'],
    cipher: 'TLS_ECDHE_RSA_WITH_AES_256_GCM', keyExchange: 'ECDHE', certificate: 'RSA-2048',
    certInfo: { subject_cn: 'netbanking.pnb.co.in', subject_alt_names: ['netbanking.pnb.co.in', 'www.netbanking.pnb.co.in'], issuer: 'DigiCert SHA2 Extended Validation', certificate_authority: 'DigiCert', signature_algorithm: 'SHA256WithRSAEncryption', key_type: 'RSA', key_size: 2048, valid_from: '2025-08-01', valid_until: '2027-08-01', days_remaining: 488, sha256_fingerprint: 'E5:F6:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB' },
    qScore: 71, status: 'standard', tier: 'standard', ip: '14.140.82.25', ipv6: '2001:db8::25', hndlYears: 8, hndlBreakYear: 2034, hndlRiskLevel: 'medium',
    dimensionScores: { tls_version: 60, key_exchange: 65, cipher_strength: 85, certificate_algo: 50, forward_secrecy: 100, pqc_readiness: 10 },
    forwardSecrecy: true, hstsEnabled: true, ownerTeam: 'Digital Banking', businessCriticality: 'customer_facing',
    lastScanned: '2026-03-31T09:18:00Z', software: { product: 'Apache HTTP Server', version: '2.4.52', type: 'Web Server', eolDate: null, cveCount: 3, pqcNativeSupport: false },
    remediation: [
      { priority: 'P2', finding: 'No PQC key exchange', action: 'Enable X25519+ML-KEM-768 hybrid', effort: 'high', status: 'not_started' },
    ],
    cryptoAgilityScore: 9,
  },
  {
    id: 'a7', domain: 'imps.pnb.co.in', url: 'https://imps.pnb.co.in', port: 443, type: 'api',
    tls: 'TLS 1.2', tlsVersionsSupported: ['TLS_1_2'],
    cipher: 'TLS_ECDHE_RSA_WITH_AES_256_GCM', keyExchange: 'ECDHE', certificate: 'RSA-2048',
    certInfo: { subject_cn: 'imps.pnb.co.in', subject_alt_names: ['imps.pnb.co.in'], issuer: 'GlobalSign RSA OV SSL CA 2018', certificate_authority: 'GlobalSign', signature_algorithm: 'SHA256WithRSAEncryption', key_type: 'RSA', key_size: 2048, valid_from: '2025-07-15', valid_until: '2027-07-15', days_remaining: 471, sha256_fingerprint: 'F6:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD' },
    qScore: 71, status: 'standard', tier: 'standard', ip: '14.140.82.21', ipv6: '', hndlYears: 8, hndlBreakYear: 2034, hndlRiskLevel: 'medium',
    dimensionScores: { tls_version: 60, key_exchange: 65, cipher_strength: 85, certificate_algo: 50, forward_secrecy: 100, pqc_readiness: 10 },
    forwardSecrecy: true, hstsEnabled: true, ownerTeam: 'Payments', businessCriticality: 'customer_facing',
    lastScanned: '2026-03-31T09:18:30Z', software: null,
    remediation: [{ priority: 'P2', finding: 'No PQC key exchange', action: 'Implement ML-KEM-768 hybrid', effort: 'high', status: 'not_started' }],
    cryptoAgilityScore: 8,
  },
  {
    id: 'a8', domain: 'upi.pnb.co.in', url: 'https://upi.pnb.co.in', port: 443, type: 'api',
    tls: 'TLS 1.2', tlsVersionsSupported: ['TLS_1_2'],
    cipher: 'TLS_ECDHE_RSA_WITH_AES_256_GCM', keyExchange: 'ECDHE', certificate: 'RSA-2048',
    certInfo: { subject_cn: 'upi.pnb.co.in', subject_alt_names: ['upi.pnb.co.in'], issuer: 'DigiCert Global Root CA', certificate_authority: 'DigiCert', signature_algorithm: 'SHA256WithRSAEncryption', key_type: 'RSA', key_size: 2048, valid_from: '2025-10-01', valid_until: '2027-10-01', days_remaining: 549, sha256_fingerprint: '01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF' },
    qScore: 71, status: 'standard', tier: 'standard', ip: '14.140.82.27', ipv6: '2001:db8::27', hndlYears: 8, hndlBreakYear: 2034, hndlRiskLevel: 'medium',
    dimensionScores: { tls_version: 60, key_exchange: 65, cipher_strength: 85, certificate_algo: 50, forward_secrecy: 100, pqc_readiness: 10 },
    forwardSecrecy: true, hstsEnabled: true, ownerTeam: 'Payments', businessCriticality: 'customer_facing',
    lastScanned: '2026-03-31T09:19:00Z', software: null,
    remediation: [{ priority: 'P2', finding: 'No PQC key exchange', action: 'Implement ML-KEM-768 hybrid', effort: 'high', status: 'not_started' }],
    cryptoAgilityScore: 8,
  },
  {
    id: 'a9', domain: 'neft.pnb.co.in', url: 'https://neft.pnb.co.in', port: 443, type: 'api',
    tls: 'TLS 1.2', tlsVersionsSupported: ['TLS_1_2'],
    cipher: 'TLS_ECDHE_RSA_WITH_AES_256_GCM', keyExchange: 'ECDHE', certificate: 'RSA-2048',
    certInfo: { subject_cn: 'neft.pnb.co.in', subject_alt_names: ['neft.pnb.co.in'], issuer: 'DigiCert Global Root CA', certificate_authority: 'DigiCert', signature_algorithm: 'SHA256WithRSAEncryption', key_type: 'RSA', key_size: 2048, valid_from: '2025-05-15', valid_until: '2027-05-15', days_remaining: 410, sha256_fingerprint: '23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01' },
    qScore: 71, status: 'standard', tier: 'standard', ip: '14.140.82.22', ipv6: '', hndlYears: 8, hndlBreakYear: 2034, hndlRiskLevel: 'medium',
    dimensionScores: { tls_version: 60, key_exchange: 65, cipher_strength: 85, certificate_algo: 50, forward_secrecy: 100, pqc_readiness: 10 },
    forwardSecrecy: true, hstsEnabled: true, ownerTeam: 'Payments', businessCriticality: 'customer_facing',
    lastScanned: '2026-03-31T09:19:30Z', software: null,
    remediation: [{ priority: 'P3', finding: 'No PQC key exchange', action: 'Plan ML-KEM-768 migration', effort: 'high', status: 'not_started' }],
    cryptoAgilityScore: 8,
  },
  {
    id: 'a10', domain: 'mail.pnb.co.in', url: 'https://mail.pnb.co.in', port: 443, type: 'mail',
    tls: 'TLS 1.2', tlsVersionsSupported: ['TLS_1_2'],
    cipher: 'TLS_ECDHE_RSA_WITH_AES_256_GCM', keyExchange: 'ECDHE', certificate: 'RSA-2048',
    certInfo: { subject_cn: 'mail.pnb.co.in', subject_alt_names: ['mail.pnb.co.in', 'webmail.pnb.co.in'], issuer: 'Let\'s Encrypt R3', certificate_authority: 'Let\'s Encrypt', signature_algorithm: 'SHA256WithRSAEncryption', key_type: 'RSA', key_size: 2048, valid_from: '2026-01-01', valid_until: '2026-04-01', days_remaining: 1, sha256_fingerprint: '45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23' },
    qScore: 71, status: 'standard', tier: 'standard', ip: '14.140.82.32', ipv6: '', hndlYears: 8, hndlBreakYear: 2034, hndlRiskLevel: 'medium',
    dimensionScores: { tls_version: 60, key_exchange: 65, cipher_strength: 85, certificate_algo: 50, forward_secrecy: 100, pqc_readiness: 10 },
    forwardSecrecy: true, hstsEnabled: false, ownerTeam: 'IT Operations', businessCriticality: 'internal',
    lastScanned: '2026-03-31T09:20:00Z', software: { product: 'Postfix', version: '3.5.6', type: 'Mail Server', eolDate: null, cveCount: 2, pqcNativeSupport: false },
    remediation: [
      { priority: 'P1', finding: 'Certificate expiring in 1 day', action: 'Renew certificate immediately', effort: 'low', status: 'not_started' },
      { priority: 'P3', finding: 'HSTS not enabled', action: 'Enable HSTS with includeSubDomains', effort: 'low', status: 'not_started' },
    ],
    cryptoAgilityScore: 7,
  },
  {
    id: 'a11', domain: 'treasury.pnb.co.in', url: 'https://treasury.pnb.co.in', port: 443, type: 'web',
    tls: 'TLS 1.2', tlsVersionsSupported: ['TLS_1_2'],
    cipher: 'TLS_ECDHE_RSA_WITH_AES_256_GCM', keyExchange: 'ECDHE', certificate: 'RSA-2048',
    certInfo: { subject_cn: 'treasury.pnb.co.in', subject_alt_names: ['treasury.pnb.co.in'], issuer: 'DigiCert Global Root CA', certificate_authority: 'DigiCert', signature_algorithm: 'SHA256WithRSAEncryption', key_type: 'RSA', key_size: 2048, valid_from: '2025-12-01', valid_until: '2027-12-01', days_remaining: 610, sha256_fingerprint: '67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45' },
    qScore: 71, status: 'standard', tier: 'standard', ip: '14.140.82.28', ipv6: '', hndlYears: 8, hndlBreakYear: 2034, hndlRiskLevel: 'medium',
    dimensionScores: { tls_version: 60, key_exchange: 65, cipher_strength: 85, certificate_algo: 50, forward_secrecy: 100, pqc_readiness: 10 },
    forwardSecrecy: true, hstsEnabled: true, ownerTeam: 'Treasury & Payments', businessCriticality: 'compliance_critical',
    lastScanned: '2026-03-31T09:20:30Z', software: null,
    remediation: [{ priority: 'P3', finding: 'No PQC key exchange', action: 'Plan ML-KEM-768 migration', effort: 'high', status: 'not_started' }],
    cryptoAgilityScore: 8,
  },
  {
    id: 'a12', domain: 'cards.pnb.co.in', url: 'https://cards.pnb.co.in', port: 443, type: 'web',
    tls: 'TLS 1.2', tlsVersionsSupported: ['TLS_1_2'],
    cipher: 'TLS_ECDHE_RSA_WITH_AES_256_GCM', keyExchange: 'ECDHE', certificate: 'RSA-2048',
    certInfo: { subject_cn: 'cards.pnb.co.in', subject_alt_names: ['cards.pnb.co.in'], issuer: 'Thawte RSA CA 2018', certificate_authority: 'Thawte', signature_algorithm: 'SHA256WithRSAEncryption', key_type: 'RSA', key_size: 2048, valid_from: '2025-11-15', valid_until: '2027-11-15', days_remaining: 594, sha256_fingerprint: '89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67' },
    qScore: 71, status: 'standard', tier: 'standard', ip: '14.140.82.29', ipv6: '', hndlYears: 8, hndlBreakYear: 2034, hndlRiskLevel: 'medium',
    dimensionScores: { tls_version: 60, key_exchange: 65, cipher_strength: 85, certificate_algo: 50, forward_secrecy: 100, pqc_readiness: 10 },
    forwardSecrecy: true, hstsEnabled: true, ownerTeam: 'Cards & Payments', businessCriticality: 'customer_facing',
    lastScanned: '2026-03-31T09:21:00Z', software: null,
    remediation: [{ priority: 'P3', finding: 'No PQC key exchange', action: 'Plan ML-KEM-768 migration', effort: 'high', status: 'not_started' }],
    cryptoAgilityScore: 8,
  },
  {
    id: 'a13', domain: 'mobileapi.pnb.co.in', url: 'https://mobileapi.pnb.co.in', port: 443, type: 'api',
    tls: 'TLS 1.2', tlsVersionsSupported: ['TLS_1_2'],
    cipher: 'TLS_ECDHE_RSA_WITH_AES_256_GCM', keyExchange: 'ECDHE', certificate: 'RSA-2048',
    certInfo: { subject_cn: 'mobileapi.pnb.co.in', subject_alt_names: ['mobileapi.pnb.co.in'], issuer: 'DigiCert Global Root CA', certificate_authority: 'DigiCert', signature_algorithm: 'SHA256WithRSAEncryption', key_type: 'RSA', key_size: 2048, valid_from: '2025-09-01', valid_until: '2027-09-01', days_remaining: 519, sha256_fingerprint: 'AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89' },
    qScore: 71, status: 'standard', tier: 'standard', ip: '14.140.82.26', ipv6: '2001:db8::26', hndlYears: 8, hndlBreakYear: 2034, hndlRiskLevel: 'medium',
    dimensionScores: { tls_version: 60, key_exchange: 65, cipher_strength: 85, certificate_algo: 50, forward_secrecy: 100, pqc_readiness: 10 },
    forwardSecrecy: true, hstsEnabled: true, ownerTeam: 'Digital Banking', businessCriticality: 'customer_facing',
    lastScanned: '2026-03-31T09:21:30Z', software: null,
    remediation: [{ priority: 'P2', finding: 'No PQC key exchange', action: 'Implement ML-KEM-768 hybrid', effort: 'high', status: 'not_started' }],
    cryptoAgilityScore: 9,
  },
  {
    id: 'a14', domain: 'auth.pnb.co.in', url: 'https://auth.pnb.co.in', port: 443, type: 'web',
    tls: 'TLS 1.3', tlsVersionsSupported: ['TLS_1_2', 'TLS_1_3'],
    cipher: 'TLS_AES_256_GCM_SHA384', keyExchange: 'X25519', certificate: 'ECDSA-P256',
    certInfo: { subject_cn: 'auth.pnb.co.in', subject_alt_names: ['auth.pnb.co.in', 'login.pnb.co.in'], issuer: 'DigiCert ECC Extended Validation', certificate_authority: 'DigiCert', signature_algorithm: 'ECDSAWithSHA384', key_type: 'ECDSA', key_size: 256, valid_from: '2025-06-01', valid_until: '2027-06-01', days_remaining: 427, sha256_fingerprint: 'CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB' },
    qScore: 82, status: 'safe', tier: 'standard', ip: '14.140.82.40', ipv6: '2001:db8::40', hndlYears: 15, hndlBreakYear: 2041, hndlRiskLevel: 'low',
    dimensionScores: { tls_version: 100, key_exchange: 80, cipher_strength: 95, certificate_algo: 75, forward_secrecy: 100, pqc_readiness: 20 },
    forwardSecrecy: true, hstsEnabled: true, ownerTeam: 'Identity & Access', businessCriticality: 'customer_facing',
    lastScanned: '2026-03-31T09:22:00Z', software: { product: 'nginx', version: '1.24.0', type: 'Web Server / Reverse Proxy', eolDate: null, cveCount: 1, pqcNativeSupport: false },
    remediation: [{ priority: 'P3', finding: 'No PQC key exchange yet', action: 'Implement X25519+ML-KEM-768 hybrid', effort: 'medium', status: 'in_progress' }],
    cryptoAgilityScore: 12,
  },
  {
    id: 'a15', domain: 'pqc-api.pnb.co.in', url: 'https://pqc-api.pnb.co.in', port: 443, type: 'api',
    tls: 'TLS 1.3+', tlsVersionsSupported: ['TLS_1_3'],
    cipher: 'TLS_AES_256_GCM_SHA384+MLKEM', keyExchange: 'ML-KEM-768', certificate: 'ML-DSA-65',
    certInfo: { subject_cn: 'pqc-api.pnb.co.in', subject_alt_names: ['pqc-api.pnb.co.in'], issuer: 'PNB Internal PQC CA', certificate_authority: 'PNB Internal CA', signature_algorithm: 'ML-DSA-65', key_type: 'ML-DSA', key_size: 0, valid_from: '2026-01-01', valid_until: '2028-01-01', days_remaining: 641, sha256_fingerprint: 'EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD' },
    qScore: 100, status: 'elite-pqc', tier: 'elite_pqc', ip: '14.140.82.50', ipv6: '2001:db8::50', hndlYears: null, hndlBreakYear: null, hndlRiskLevel: 'low',
    dimensionScores: { tls_version: 100, key_exchange: 100, cipher_strength: 100, certificate_algo: 100, forward_secrecy: 100, pqc_readiness: 100 },
    forwardSecrecy: true, hstsEnabled: true, ownerTeam: 'PQC R&D', businessCriticality: 'compliance_critical',
    lastScanned: '2026-03-31T09:23:00Z', software: { product: 'OQS-OpenSSL', version: '3.2.0-oqs', type: 'PQC Crypto Library', eolDate: null, cveCount: 0, pqcNativeSupport: true },
    remediation: [],
    cryptoAgilityScore: 15,
  },
  {
    id: 'a16', domain: 'pqc-gateway.pnb.co.in', url: 'https://pqc-gateway.pnb.co.in', port: 443, type: 'api',
    tls: 'TLS 1.3+', tlsVersionsSupported: ['TLS_1_3'],
    cipher: 'TLS_AES_256_GCM_SHA384+MLKEM', keyExchange: 'ML-KEM-768', certificate: 'ML-DSA-65',
    certInfo: { subject_cn: 'pqc-gateway.pnb.co.in', subject_alt_names: ['pqc-gateway.pnb.co.in'], issuer: 'PNB Internal PQC CA', certificate_authority: 'PNB Internal CA', signature_algorithm: 'ML-DSA-65', key_type: 'ML-DSA', key_size: 0, valid_from: '2026-01-01', valid_until: '2028-01-01', days_remaining: 641, sha256_fingerprint: '01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF' },
    qScore: 100, status: 'elite-pqc', tier: 'elite_pqc', ip: '14.140.82.51', ipv6: '2001:db8::51', hndlYears: null, hndlBreakYear: null, hndlRiskLevel: 'low',
    dimensionScores: { tls_version: 100, key_exchange: 100, cipher_strength: 100, certificate_algo: 100, forward_secrecy: 100, pqc_readiness: 100 },
    forwardSecrecy: true, hstsEnabled: true, ownerTeam: 'PQC R&D', businessCriticality: 'compliance_critical',
    lastScanned: '2026-03-31T09:23:30Z', software: { product: 'OQS-OpenSSL', version: '3.2.0-oqs', type: 'PQC Crypto Library', eolDate: null, cveCount: 0, pqcNativeSupport: true },
    remediation: [],
    cryptoAgilityScore: 15,
  },
  {
    id: 'a17', domain: 'fx.pnb.co.in', url: 'https://fx.pnb.co.in', port: 443, type: 'web',
    tls: 'TLS 1.2', tlsVersionsSupported: ['TLS_1_2'],
    cipher: 'TLS_ECDHE_RSA_WITH_AES_256_GCM', keyExchange: 'ECDHE', certificate: 'RSA-2048',
    certInfo: { subject_cn: 'fx.pnb.co.in', subject_alt_names: ['fx.pnb.co.in'], issuer: 'GlobalSign RSA OV SSL CA 2018', certificate_authority: 'GlobalSign', signature_algorithm: 'SHA256WithRSAEncryption', key_type: 'RSA', key_size: 2048, valid_from: '2025-10-15', valid_until: '2027-10-15', days_remaining: 563, sha256_fingerprint: 'FE:DC:BA:98:76:54:32:10:FE:DC:BA:98:76:54:32:10:FE:DC:BA:98:76:54:32:10:FE:DC:BA:98:76:54:32:10' },
    qScore: 71, status: 'standard', tier: 'standard', ip: '14.140.82.23', ipv6: '', hndlYears: 8, hndlBreakYear: 2034, hndlRiskLevel: 'medium',
    dimensionScores: { tls_version: 60, key_exchange: 65, cipher_strength: 85, certificate_algo: 50, forward_secrecy: 100, pqc_readiness: 10 },
    forwardSecrecy: true, hstsEnabled: true, ownerTeam: 'Treasury & Payments', businessCriticality: 'internal',
    lastScanned: '2026-03-31T09:24:00Z', software: null,
    remediation: [{ priority: 'P3', finding: 'No PQC key exchange', action: 'Plan migration', effort: 'high', status: 'not_started' }],
    cryptoAgilityScore: 8,
  },
  {
    id: 'a18', domain: 'trade.pnb.co.in', url: 'https://trade.pnb.co.in', port: 443, type: 'web',
    tls: 'TLS 1.2', tlsVersionsSupported: ['TLS_1_2'],
    cipher: 'TLS_ECDHE_RSA_WITH_AES_256_GCM', keyExchange: 'ECDHE', certificate: 'RSA-2048',
    certInfo: { subject_cn: 'trade.pnb.co.in', subject_alt_names: ['trade.pnb.co.in'], issuer: 'DigiCert Global Root CA', certificate_authority: 'DigiCert', signature_algorithm: 'SHA256WithRSAEncryption', key_type: 'RSA', key_size: 2048, valid_from: '2025-08-15', valid_until: '2027-08-15', days_remaining: 502, sha256_fingerprint: 'DC:BA:98:76:54:32:10:FE:DC:BA:98:76:54:32:10:FE:DC:BA:98:76:54:32:10:FE:DC:BA:98:76:54:32:10:FE' },
    qScore: 71, status: 'standard', tier: 'standard', ip: '14.140.82.24', ipv6: '', hndlYears: 8, hndlBreakYear: 2034, hndlRiskLevel: 'medium',
    dimensionScores: { tls_version: 60, key_exchange: 65, cipher_strength: 85, certificate_algo: 50, forward_secrecy: 100, pqc_readiness: 10 },
    forwardSecrecy: true, hstsEnabled: true, ownerTeam: 'Trade Finance', businessCriticality: 'customer_facing',
    lastScanned: '2026-03-31T09:24:30Z', software: null,
    remediation: [{ priority: 'P3', finding: 'No PQC key exchange', action: 'Plan migration', effort: 'high', status: 'not_started' }],
    cryptoAgilityScore: 8,
  },
  {
    id: 'a19', domain: 'loans.pnb.co.in', url: 'https://loans.pnb.co.in', port: 443, type: 'web',
    tls: 'TLS 1.2', tlsVersionsSupported: ['TLS_1_2'],
    cipher: 'TLS_ECDHE_RSA_WITH_AES_256_GCM', keyExchange: 'ECDHE', certificate: 'RSA-2048',
    certInfo: { subject_cn: 'loans.pnb.co.in', subject_alt_names: ['loans.pnb.co.in'], issuer: 'DigiCert Global Root CA', certificate_authority: 'DigiCert', signature_algorithm: 'SHA256WithRSAEncryption', key_type: 'RSA', key_size: 2048, valid_from: '2025-07-01', valid_until: '2027-07-01', days_remaining: 457, sha256_fingerprint: 'BA:98:76:54:32:10:FE:DC:BA:98:76:54:32:10:FE:DC:BA:98:76:54:32:10:FE:DC:BA:98:76:54:32:10:FE:DC' },
    qScore: 71, status: 'standard', tier: 'standard', ip: '14.140.82.30', ipv6: '', hndlYears: 8, hndlBreakYear: 2034, hndlRiskLevel: 'medium',
    dimensionScores: { tls_version: 60, key_exchange: 65, cipher_strength: 85, certificate_algo: 50, forward_secrecy: 100, pqc_readiness: 10 },
    forwardSecrecy: true, hstsEnabled: true, ownerTeam: 'Retail Banking', businessCriticality: 'customer_facing',
    lastScanned: '2026-03-31T09:25:00Z', software: null,
    remediation: [{ priority: 'P3', finding: 'No PQC key exchange', action: 'Plan migration', effort: 'high', status: 'not_started' }],
    cryptoAgilityScore: 8,
  },
  {
    id: 'a20', domain: 'hr.pnb.co.in', url: 'https://hr.pnb.co.in', port: 443, type: 'web',
    tls: 'TLS 1.2', tlsVersionsSupported: ['TLS_1_2'],
    cipher: 'TLS_ECDHE_RSA_WITH_AES_256_GCM', keyExchange: 'ECDHE', certificate: 'RSA-2048',
    certInfo: { subject_cn: 'hr.pnb.co.in', subject_alt_names: ['hr.pnb.co.in'], issuer: 'COMODO RSA Domain Validation', certificate_authority: 'COMODO', signature_algorithm: 'SHA256WithRSAEncryption', key_type: 'RSA', key_size: 2048, valid_from: '2025-09-01', valid_until: '2026-09-01', days_remaining: 154, sha256_fingerprint: '98:76:54:32:10:FE:DC:BA:98:76:54:32:10:FE:DC:BA:98:76:54:32:10:FE:DC:BA:98:76:54:32:10:FE:DC:BA' },
    qScore: 71, status: 'standard', tier: 'standard', ip: '14.140.82.31', ipv6: '', hndlYears: 8, hndlBreakYear: 2034, hndlRiskLevel: 'medium',
    dimensionScores: { tls_version: 60, key_exchange: 65, cipher_strength: 85, certificate_algo: 50, forward_secrecy: 100, pqc_readiness: 10 },
    forwardSecrecy: true, hstsEnabled: false, ownerTeam: 'HR', businessCriticality: 'internal',
    lastScanned: '2026-03-31T09:25:30Z', software: null,
    remediation: [{ priority: 'P4', finding: 'HSTS not enabled', action: 'Enable HSTS', effort: 'low', status: 'not_started' }],
    cryptoAgilityScore: 7,
  },
  {
    id: 'a21', domain: 'cdn.pnb.co.in', url: 'https://cdn.pnb.co.in', port: 443, type: 'web',
    tls: 'TLS 1.2', tlsVersionsSupported: ['TLS_1_2', 'TLS_1_3'],
    cipher: 'TLS_ECDHE_RSA_WITH_AES_256_GCM', keyExchange: 'ECDHE', certificate: 'RSA-2048',
    certInfo: { subject_cn: 'cdn.pnb.co.in', subject_alt_names: ['cdn.pnb.co.in', 'static.pnb.co.in'], issuer: 'Let\'s Encrypt R3', certificate_authority: 'Let\'s Encrypt', signature_algorithm: 'SHA256WithRSAEncryption', key_type: 'RSA', key_size: 2048, valid_from: '2026-02-01', valid_until: '2026-05-01', days_remaining: 31, sha256_fingerprint: '76:54:32:10:FE:DC:BA:98:76:54:32:10:FE:DC:BA:98:76:54:32:10:FE:DC:BA:98:76:54:32:10:FE:DC:BA:98' },
    qScore: 75, status: 'standard', tier: 'standard', ip: '14.140.82.33', ipv6: '', hndlYears: 8, hndlBreakYear: 2034, hndlRiskLevel: 'medium',
    dimensionScores: { tls_version: 80, key_exchange: 65, cipher_strength: 85, certificate_algo: 50, forward_secrecy: 100, pqc_readiness: 10 },
    forwardSecrecy: true, hstsEnabled: true, ownerTeam: 'IT Operations', businessCriticality: 'internal',
    lastScanned: '2026-03-31T09:26:00Z', software: null,
    remediation: [{ priority: 'P3', finding: 'Certificate expiring soon', action: 'Renew Let\'s Encrypt certificate', effort: 'low', status: 'not_started' }],
    cryptoAgilityScore: 9,
  },
];

// ========== Scan History ==========
export interface ScanHistoryEntry {
  id: string;
  target: string;
  started: string;
  duration: string;
  assetsFound: number;
  qScore: number;
  criticalFindings: number;
  status: string;
}

export const scanHistory: ScanHistoryEntry[] = [
  { id: 'SCN-007', target: 'pnb.co.in', started: 'Apr 1 2026, 09:14', duration: '4m 22s', assetsFound: 21, qScore: 370, criticalFindings: 3, status: 'Completed' },
  { id: 'SCN-006', target: 'pnb.co.in', started: 'Mar 25 2026, 11:30', duration: '3m 58s', assetsFound: 19, qScore: 325, criticalFindings: 4, status: 'Completed' },
  { id: 'SCN-005', target: 'netbanking.pnb.co.in', started: 'Mar 18 2026, 08:45', duration: '1m 12s', assetsFound: 6, qScore: 410, criticalFindings: 1, status: 'Completed' },
  { id: 'SCN-004', target: 'pnb.co.in', started: 'Mar 10 2026, 14:20', duration: '5m 01s', assetsFound: 21, qScore: 295, criticalFindings: 5, status: 'Completed' },
  { id: 'SCN-003', target: 'vpn.pnb.co.in', started: 'Mar 3 2026, 10:00', duration: '0m 48s', assetsFound: 3, qScore: 24, criticalFindings: 2, status: 'Completed' },
  { id: 'SCN-002', target: 'pnb.co.in', started: 'Feb 24 2026, 16:15', duration: '4m 33s', assetsFound: 18, qScore: 260, criticalFindings: 6, status: 'Completed' },
  { id: 'SCN-001', target: 'pnb.co.in', started: 'Feb 14 2026, 09:00', duration: '4m 10s', assetsFound: 17, qScore: 210, criticalFindings: 7, status: 'Completed' },
];

// ========== CVE Data for Discovery Detail Panels ==========
export interface CVEEntry {
  id: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  cvss: number;
  description: string;
}

export const cveData: Record<string, CVEEntry[]> = {
  'OpenSSL 1.1.1w': [
    { id: 'CVE-2023-0286', severity: 'High', cvss: 7.4, description: 'X.400 address type confusion in X.509 certificate verification' },
    { id: 'CVE-2023-0215', severity: 'High', cvss: 7.5, description: 'Use-after-free following BIO_new_NDEF' },
    { id: 'CVE-2022-4304', severity: 'Medium', cvss: 5.9, description: 'Timing Oracle in RSA Decryption' },
  ],
  'Apache HTTP Server 2.4.52': [
    { id: 'CVE-2023-25690', severity: 'Critical', cvss: 9.8, description: 'HTTP request smuggling via mod_proxy' },
    { id: 'CVE-2023-31122', severity: 'High', cvss: 7.5, description: 'mod_macro out-of-bounds read' },
  ],
  'Microsoft IIS 10.0': [
    { id: 'CVE-2023-36899', severity: 'High', cvss: 7.5, description: 'ASP.NET elevation of privilege' },
    { id: 'CVE-2022-21907', severity: 'Critical', cvss: 9.8, description: 'HTTP Protocol Stack RCE' },
  ],
  'Cisco ASA 9.16.3': [
    { id: 'CVE-2023-20269', severity: 'Critical', cvss: 9.1, description: 'Unauthorized access via VPN' },
    { id: 'CVE-2023-20095', severity: 'High', cvss: 8.6, description: 'Remote access VPN DoS' },
  ],
  'nginx 1.24.0': [
    { id: 'CVE-2023-44487', severity: 'High', cvss: 7.5, description: 'HTTP/2 Rapid Reset attack' },
  ],
  'Postfix 3.5.6': [
    { id: 'CVE-2023-51764', severity: 'Medium', cvss: 5.3, description: 'SMTP smuggling vulnerability' },
  ],
};

// ========== DNS Records for Discovery Detail ==========
export interface DNSRecord {
  type: string;
  name: string;
  value: string;
  ttl: number;
}

export const dnsRecords: Record<string, DNSRecord[]> = {
  'pnb.co.in': [
    { type: 'A', name: 'pnb.co.in', value: '14.140.82.10', ttl: 3600 },
    { type: 'AAAA', name: 'pnb.co.in', value: '2001:db8::10', ttl: 3600 },
    { type: 'MX', name: 'pnb.co.in', value: 'mail.pnb.co.in', ttl: 3600 },
    { type: 'TXT', name: 'pnb.co.in', value: 'v=spf1 include:pnb.co.in ~all', ttl: 3600 },
    { type: 'NS', name: 'pnb.co.in', value: 'ns1.pnb.co.in', ttl: 86400 },
  ],
  'vpn.pnb.co.in': [
    { type: 'A', name: 'vpn.pnb.co.in', value: '14.140.82.10', ttl: 3600 },
    { type: 'TXT', name: 'vpn.pnb.co.in', value: 'v=spf1 -all', ttl: 3600 },
    { type: 'NS', name: 'pnb.co.in', value: 'ns1.pnb.co.in', ttl: 86400 },
  ],
};

// ========== Asset Trend Data for Per-Asset Ratings ==========
export const assetTrends: Record<string, { delta: number; direction: 'up' | 'down' | 'flat' }> = {
  'vpn.pnb.co.in': { delta: -3, direction: 'down' },
  'auth.pnb.co.in': { delta: 8, direction: 'up' },
  'pqc-api.pnb.co.in': { delta: 0, direction: 'flat' },
  'netbanking.pnb.co.in': { delta: 12, direction: 'up' },
  'reporting.pnb.co.in': { delta: 3, direction: 'up' },
  'legacy.pnb.co.in': { delta: -5, direction: 'down' },
  'staging.pnb.co.in': { delta: 0, direction: 'flat' },
  'swift.pnb.co.in': { delta: 4, direction: 'up' },
  'imps.pnb.co.in': { delta: 6, direction: 'up' },
  'upi.pnb.co.in': { delta: 5, direction: 'up' },
  'neft.pnb.co.in': { delta: 3, direction: 'up' },
  'mail.pnb.co.in': { delta: -2, direction: 'down' },
  'treasury.pnb.co.in': { delta: 4, direction: 'up' },
  'cards.pnb.co.in': { delta: 7, direction: 'up' },
  'mobileapi.pnb.co.in': { delta: 5, direction: 'up' },
  'pqc-gateway.pnb.co.in': { delta: 0, direction: 'flat' },
  'fx.pnb.co.in': { delta: 2, direction: 'up' },
  'trade.pnb.co.in': { delta: 3, direction: 'up' },
  'loans.pnb.co.in': { delta: 4, direction: 'up' },
  'hr.pnb.co.in': { delta: -2, direction: 'down' },
  'cdn.pnb.co.in': { delta: 6, direction: 'up' },
};

// ========== Scan-to-Asset Mapping ==========
export const scanAssetMap: Record<string, string[]> = {
  'SCN-007': ['a1','a2','a3','a4','a5','a6','a7','a8','a9','a10','a11','a12','a13','a14','a15','a16','a17','a18','a19','a20','a21'],
  'SCN-006': ['a1','a2','a3','a4','a5','a6','a7','a8','a9','a10','a11','a12','a13','a14','a15','a16','a17','a18','a19','a20','a21'],
  'SCN-005': ['a1','a2','a5','a6','a7','a8','a10','a14','a15'],
  'SCN-004': ['a1','a2','a3','a4','a5','a6','a7','a8','a9','a10','a11','a12','a13','a14','a15','a16','a17','a18','a19','a20','a21'],
  'SCN-003': ['a1','a5','a6'],
  'SCN-002': ['a1','a2','a3','a5','a6','a7','a8','a9','a10','a11','a12','a13','a14','a15','a16','a17','a18','a19'],
  'SCN-001': ['a1','a2','a3','a5','a6','a7','a8','a9','a10','a11','a12','a13','a14','a15','a16','a17'],
};

// ========== Aggregate Metrics ==========
export const enterpriseScore = 370;
export const maxScore = 1000;
export const avgQScore = Math.round(assets.reduce((sum, a) => sum + a.qScore, 0) / assets.length);

export const statusCounts = {
  total: assets.length,
  critical: assets.filter(a => a.status === 'critical').length,
  vulnerable: assets.filter(a => a.status === 'standard').length,
  safe: assets.filter(a => a.status === 'safe').length,
  elitePqc: assets.filter(a => a.status === 'elite-pqc').length,
  unknown: assets.filter(a => a.status === 'unknown').length,
  pqcTransition: assets.filter(a => a.tier === 'standard').length,
  quantumVulnerable: assets.filter(a => a.tier === 'legacy' || a.tier === 'standard').length,
  fullySafe: assets.filter(a => a.tier === 'elite_pqc').length,
  criticallVulnerable: assets.filter(a => a.tier === 'critical').length,
};

export const expiringCerts = assets.filter(a => a.certInfo.days_remaining > 0 && a.certInfo.days_remaining <= 30).length;
export const highRiskAssets = assets.filter(a => a.qScore <= 40 && a.qScore > 0).length;
export const pqcReadyAssets = assets.filter(a => a.status === 'elite-pqc' || a.status === 'safe').length;

// ========== Utility Functions ==========
export function getStatusColor(status: string): string {
  switch (status) {
    case 'critical': return 'hsl(var(--status-critical))';
    case 'vulnerable': return 'hsl(var(--status-vuln))';
    case 'standard': return 'hsl(var(--status-warn))';
    case 'safe': return 'hsl(var(--status-safe))';
    case 'elite-pqc': return 'hsl(var(--status-safe))';
    case 'unknown': return 'hsl(var(--status-unknown))';
    default: return 'hsl(var(--status-unknown))';
  }
}

export function getQScoreColor(score: number): string {
  if (score <= 40) return 'hsl(var(--status-critical))';
  if (score <= 70) return 'hsl(var(--accent-amber))';
  if (score <= 89) return 'hsl(210, 70%, 50%)';
  return 'hsl(var(--status-safe))';
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'critical': return 'CRITICAL';
    case 'vulnerable': return 'VULNERABLE';
    case 'standard': return 'STANDARD';
    case 'safe': return 'QUANTUM SAFE';
    case 'elite-pqc': return 'ELITE-PQC';
    case 'unknown': return 'UNKNOWN';
    default: return 'UNKNOWN';
  }
}

export function getTierLabel(score: number): string {
  if (score < 400) return 'Legacy';
  if (score <= 700) return 'Standard';
  return 'Elite-PQC';
}

export function getTierFromAsset(tier: string): string {
  switch (tier) {
    case 'elite_pqc': return 'Elite-PQC';
    case 'standard': return 'Standard';
    case 'legacy': return 'Legacy';
    case 'critical': return 'Critical';
    default: return 'Unknown';
  }
}

// CA distribution
export const caDistribution = assets.reduce((acc, a) => {
  const ca = a.certInfo.certificate_authority;
  if (ca && ca !== 'Unknown') acc[ca] = (acc[ca] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

// Key length distribution
export const keyLengthDistribution = assets.reduce((acc, a) => {
  const label = a.certInfo.key_type === 'ML-DSA' ? 'ML-DSA-65' : a.certInfo.key_type === 'ECDSA' ? `EC-${a.certInfo.key_size}` : `RSA-${a.certInfo.key_size}`;
  if (label !== 'RSA-0') acc[label] = (acc[label] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

// TLS version distribution
export const tlsVersionDistribution = assets.reduce((acc, a) => {
  a.tlsVersionsSupported.forEach(v => { acc[v] = (acc[v] || 0) + 1; });
  return acc;
}, {} as Record<string, number>);
