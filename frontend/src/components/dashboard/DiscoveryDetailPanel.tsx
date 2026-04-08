import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import type { DomainRecord, IPRecord, SoftwareRecord, Asset } from '@/data/demoData';
import type { AssetResultResponse, DNSRecordResponse } from '@/lib/api';

type PanelType = 'domain' | 'ssl' | 'ip' | 'software';

interface DiscoveryDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: PanelType;
  domainRecord?: DomainRecord;
  asset?: Asset;
  ipRecord?: IPRecord;
  softwareRecord?: SoftwareRecord;
  dnsEntries?: DNSRecordResponse[];
  relatedAssetResults?: AssetResultResponse[];
}

const portRisk = (port: number) => {
  if (port === 3389) return { label: 'Critical — RDP Exposed', color: 'bg-[hsl(var(--status-critical))] text-white' };
  if (port === 22) return { label: 'SSH Exposed', color: 'bg-[hsl(var(--accent-amber))] text-white' };
  if (port === 443) return { label: 'HTTPS', color: 'bg-[hsl(var(--status-safe))] text-white' };
  if (port === 80) return { label: 'HTTP', color: 'bg-[hsl(var(--accent-amber))] text-white' };
  return { label: 'Open', color: 'bg-muted text-muted-foreground' };
};

const pqcMigrationPaths: Record<string, string> = {
  'OpenSSL': 'Upgrade to OpenSSL 3.3+ with OQS provider. Enables ML-KEM-768 and ML-DSA-65.',
  'nginx': 'Upgrade to nginx 1.27+ and link against OQS-enabled OpenSSL. Directive: ssl_ecdh_curve X25519MLKEM768.',
  'Apache': 'Upgrade to Apache 2.4.60+ with mod_ssl linked to OQS-OpenSSL.',
  'Cisco ASA': 'Cisco ASA requires firmware 10.x for PQC hybrid support. Contact Cisco TAC for migration plan.',
  'Microsoft IIS': 'IIS requires Windows Server 2025 with CNG provider update for PQC support.',
  'Postfix': 'Upgrade to Postfix 3.9+ with OpenSSL 3.3+ backend for PQC TLS support.',
  'HAProxy': 'HAProxy 3.0+ supports PQC when compiled with OQS-OpenSSL 3.2+.',
  'OQS-OpenSSL': 'Already PQC-native. Ensure ML-KEM-768 and ML-DSA-65 are enabled in ssl.conf.',
};

const fallbackServiceName = (port: number) => {
  if (port === 443) return 'HTTPS';
  if (port === 80) return 'HTTP';
  if (port === 22) return 'SSH';
  if (port === 3389) return 'RDP';
  if (port === 25) return 'SMTP';
  if (port === 587) return 'SMTP/TLS';
  if (port === 993) return 'IMAPS';
  return `Port ${port}`;
};

const buildDnsRows = (entries: DNSRecordResponse[] = []) => {
  const rows = entries.flatMap((entry) => [
    ...entry.resolved_ips.map((value) => ({ type: 'A', value, ttl: '—' })),
    ...entry.cnames.map((value) => ({ type: 'CNAME', value, ttl: '—' })),
  ]);

  return rows.length > 0 ? rows : [];
};

const buildPortRows = (relatedAssetResults: AssetResultResponse[] = [], ipRecord?: IPRecord) => {
  const rows = relatedAssetResults.flatMap((assetResult) => {
    if (!Array.isArray(assetResult.open_ports)) return [];

    return assetResult.open_ports.flatMap((entry) => {
      if (typeof entry !== 'object' || entry === null) return [];
      const port = typeof entry.port === 'number' ? entry.port : Number(entry.port);
      if (!Number.isFinite(port)) return [];
      return [{
        port,
        serviceName: typeof entry.service_name === 'string' && entry.service_name ? entry.service_name : fallbackServiceName(port),
        protocol: typeof entry.protocol === 'string' && entry.protocol ? entry.protocol : 'tcp',
        state: typeof entry.state === 'string' && entry.state ? entry.state : 'open',
      }];
    });
  });

  if (rows.length > 0) {
    const deduped = new Map<string, (typeof rows)[number]>();
    rows.forEach((row) => {
      deduped.set(`${row.port}/${row.protocol}`, row);
    });
    return [...deduped.values()].sort((a, b) => a.port - b.port);
  }

  return (ipRecord?.portsOpen ?? []).map((port) => ({
    port,
    serviceName: fallbackServiceName(port),
    protocol: 'tcp',
    state: 'open',
  }));
};

const DiscoveryDetailPanel = ({
  open,
  onOpenChange,
  type,
  domainRecord,
  asset,
  ipRecord,
  softwareRecord,
  dnsEntries = [],
  relatedAssetResults = [],
}: DiscoveryDetailPanelProps) => {
  const [verifyOpen, setVerifyOpen] = useState(false);
  const dnsRows = buildDnsRows(dnsEntries);
  const portRows = buildPortRows(relatedAssetResults, ipRecord);
  const discoverySources = [...new Set(relatedAssetResults.map((item) => item.discovery_source).filter((value): value is string => Boolean(value)))];
  const anyShadowIT = relatedAssetResults.some((item) => item.is_shadow_it);

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[460px] overflow-y-auto">
        {type === 'domain' && domainRecord && (
          <>
            <SheetHeader><SheetTitle className="font-mono text-sm">{domainRecord.domain}</SheetTitle></SheetHeader>
            <div className="space-y-5 mt-4">
              <div>
                <h4 className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider mb-2">WHOIS</h4>
                <div className="space-y-1.5 text-xs font-body">
                  {[['Registrar', domainRecord.registrar], ['Registration', domainRecord.registrationDate], ['Expiry', domainRecord.expiryDate], ['Organization', domainRecord.company]].map(([k, v]) => (
                    <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-mono">{v}</span></div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider mb-2">DNS Records</h4>
                <Table>
                  <TableHeader><TableRow><TableHead className="text-[10px]">Type</TableHead><TableHead className="text-[10px]">Value</TableHead><TableHead className="text-[10px]">TTL</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {dnsRows.length > 0 ? dnsRows.map((r, i) => (
                      <TableRow key={`${r.type}-${r.value}-${i}`}><TableCell className="font-mono text-xs">{r.type}</TableCell><TableCell className="font-mono text-xs">{r.value}</TableCell><TableCell className="font-mono text-xs">{r.ttl}</TableCell></TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-xs text-muted-foreground font-body">No DNS records are available from the current backend payload for this domain.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div>
                <h4 className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider mb-2">Risk Assessment</h4>
                <div className="flex items-center gap-2">
                  <Badge variant={domainRecord.riskScore >= 75 ? 'destructive' : 'secondary'} className="text-[10px]">Risk: {domainRecord.riskScore}</Badge>
                  <span className="text-xs text-muted-foreground font-body">{domainRecord.status === 'new' ? 'Newly discovered — needs verification' : 'Confirmed asset'}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="text-xs" onClick={() => { toast.success('Added to inventory'); onOpenChange(false); }}>Add to Inventory</Button>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => toast.info('Marked as false positive')}>Mark as False Positive</Button>
              </div>
            </div>
          </>
        )}

        {type === 'ssl' && asset && (
          <>
            <SheetHeader><SheetTitle className="font-mono text-sm">{asset.certInfo.subject_cn}</SheetTitle></SheetHeader>
            <div className="space-y-5 mt-4">
              <div>
                <h4 className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider mb-2">Certificate Details</h4>
                <div className="space-y-1.5 text-xs font-body">
                  {[['Subject', asset.certInfo.subject_cn], ['Issuer', asset.certInfo.issuer], ['Valid From', asset.certInfo.valid_from], ['Valid Until', asset.certInfo.valid_until],
                    ['Days Remaining', `${asset.certInfo.days_remaining}d`]].map(([k, v]) => (
                    <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className={`font-mono ${k === 'Days Remaining' && asset.certInfo.days_remaining <= 30 ? 'text-[hsl(var(--status-critical))]' : ''}`}>{v}</span></div>
                  ))}
                  <div><span className="text-muted-foreground text-[10px]">SHA-256</span><p className="font-mono text-[10px] text-foreground/70 break-all mt-0.5">{asset.certInfo.sha256_fingerprint}</p></div>
                </div>
              </div>
              <div>
                <h4 className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider mb-2">Certificate Chain</h4>
                <div className="space-y-2">
                  {['Leaf', 'Intermediate', 'Root'].map((label, i) => {
                    const isVuln = asset.certInfo.key_type === 'RSA' || asset.certInfo.key_type === 'ECDSA';
                    return (
                      <div key={label} className="flex items-center gap-2 p-2 rounded bg-[hsl(var(--bg-sunken))]">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-mono ${isVuln && i < 2 ? 'bg-[hsl(var(--status-critical)/0.15)] text-[hsl(var(--status-critical))]' : 'bg-[hsl(var(--status-safe)/0.15)] text-[hsl(var(--status-safe))]'}`}>{i + 1}</div>
                        <div className="flex-1">
                          <span className="font-mono text-[10px] font-semibold">{label}</span>
                          <span className="text-[10px] text-muted-foreground ml-2">{asset.certInfo.signature_algorithm.substring(0, 20)}</span>
                        </div>
                        {isVuln && i < 2 ? <Badge variant="destructive" className="text-[9px]">Quantum Vulnerable</Badge> : <Badge className="bg-[hsl(var(--status-safe))] text-white text-[9px]">Safe</Badge>}
                      </div>
                    );
                  })}
                </div>
              </div>
              {(asset.certInfo.key_type === 'RSA' || asset.certInfo.key_type === 'ECDSA') && (
                <Card className="border-[hsl(var(--status-critical)/0.2)] bg-[hsl(var(--status-critical)/0.03)]">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--status-critical))]" /><span className="font-body text-xs font-semibold text-[hsl(var(--status-critical))]">Quantum Assessment</span></div>
                    <p className="text-[11px] font-body text-foreground/80 leading-relaxed">
                      {asset.certInfo.key_type}-{asset.certInfo.key_size} Signature: <strong>QUANTUM VULNERABLE</strong>. Shor's algorithm solves {asset.certInfo.key_type === 'RSA' ? 'RSA factoring' : 'ECDLP'} in polynomial time. Recommended replacement: ML-DSA-65 (NIST FIPS 204).
                    </p>
                  </CardContent>
                </Card>
              )}
              <Button size="sm" variant="outline" className="text-xs" onClick={() => toast.success('Expiry alert configured')}>Set Expiry Alert</Button>
            </div>
          </>
        )}

        {type === 'ip' && ipRecord && (
          <>
            <SheetHeader><SheetTitle className="font-mono text-sm">{ipRecord.ip}</SheetTitle></SheetHeader>
            <div className="space-y-5 mt-4">
              <div>
                <h4 className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider mb-2">Network Info</h4>
                <div className="space-y-1.5 text-xs font-body">
                  {[['ASN', ipRecord.asn], ['Netname', ipRecord.netname], ['Subnet', ipRecord.subnet], ['Location', ipRecord.city], ['ISP', ipRecord.isp], ['rDNS', ipRecord.reverseDns], ['Discovery Source', discoverySources.join(', ') || '—'], ['Shadow IT', anyShadowIT ? 'Yes' : 'No']].map(([k, v]) => (
                    <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-mono">{v}</span></div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider mb-2">Open Ports</h4>
                <Table>
                  <TableHeader><TableRow><TableHead className="text-[10px]">Port</TableHead><TableHead className="text-[10px]">Service</TableHead><TableHead className="text-[10px]">Risk</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {portRows.map((portRow) => {
                      const risk = portRisk(portRow.port);
                      return (
                        <TableRow key={`${portRow.port}/${portRow.protocol}`}>
                          <TableCell className="font-mono text-xs">{portRow.port}</TableCell>
                          <TableCell className="text-xs">{portRow.serviceName}</TableCell>
                          <TableCell><Badge className={`text-[9px] ${risk.color}`}>{risk.label}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <Button size="sm" className="text-xs" onClick={() => { toast.success('Added to inventory'); onOpenChange(false); }}>Add to Inventory</Button>
            </div>
          </>
        )}

        {type === 'software' && softwareRecord && (
          <>
            <SheetHeader><SheetTitle className="font-mono text-sm">{softwareRecord.product} {softwareRecord.version}</SheetTitle></SheetHeader>
            <div className="space-y-5 mt-4">
              <div>
                <h4 className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider mb-2">Software Info</h4>
                <div className="space-y-1.5 text-xs font-body">
                  {[['Type', softwareRecord.type], ['Host', softwareRecord.hostname], ['Port', String(softwareRecord.port)], ['EOL Status', softwareRecord.eolStatus === 'end_of_life' ? `End of Life (${softwareRecord.eolDate})` : softwareRecord.eolStatus === 'eol_soon' ? `EOL Soon (${softwareRecord.eolDate})` : 'Supported']].map(([k, v]) => (
                    <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-mono">{v}</span></div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider mb-2">Known CVEs</h4>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-body">
                    {softwareRecord.cveCount > 0
                      ? `${softwareRecord.cveCount} known CVE(s) are indicated for this software fingerprint.`
                      : 'No known CVEs are indicated for this software fingerprint.'}
                  </p>
                  <p className="text-xs text-muted-foreground font-body">
                    Detailed CVE entries are not available from the current backend payload yet.
                  </p>
                </div>
              </div>
              <div>
                <h4 className="font-mono text-[10px] uppercase text-muted-foreground tracking-wider mb-2">PQC Migration Path</h4>
                <p className="text-xs font-body text-foreground/80 leading-relaxed">
                  {Object.entries(pqcMigrationPaths).find(([k]) => softwareRecord.product.includes(k))?.[1] || 'Contact vendor for PQC migration guidance.'}
                </p>
              </div>
              <Button size="sm" className="text-xs" onClick={() => { toast.success('Added to remediation plan'); onOpenChange(false); }}>Add to Remediation Plan</Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
    </>
  );
};

export default DiscoveryDetailPanel;
