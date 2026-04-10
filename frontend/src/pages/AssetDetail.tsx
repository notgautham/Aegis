import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip as ShadcnTooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getStatusColor, getStatusLabel, getTierFromAsset, getQScoreColor } from '@/data/demoData';
import { ChevronRight, Scan, Check, X, Shield, AlertTriangle, Download } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RechartTooltip, ReferenceLine, CartesianGrid } from 'recharts';
import PQCCertificateModal from '@/components/dashboard/PQCCertificateModal';
import { useSelectedScan } from '@/contexts/SelectedScanContext';

function buildAssetScoreReason(asset: ReturnType<typeof useSelectedScan>['selectedAssets'][number]): string {
  const weakestDimensions = [
    { label: 'TLS version', value: asset.dimensionScores.tls_version },
    { label: 'key exchange', value: asset.dimensionScores.key_exchange },
    { label: 'certificate algorithm', value: asset.dimensionScores.certificate_algo },
    { label: 'cipher strength', value: asset.dimensionScores.cipher_strength },
    { label: 'PQC readiness', value: asset.dimensionScores.pqc_readiness },
  ]
    .sort((left, right) => left.value - right.value)
    .slice(0, 2)
    .map((dimension) => dimension.label);

  if (asset.status === 'elite-pqc') {
    return 'AEGIS rates this asset highly because its TLS, certificate, and PQC-readiness dimensions are all strong with no meaningful remediation backlog.';
  }

  if (asset.status === 'critical') {
    return `AEGIS rates this asset as critical mainly because ${weakestDimensions.join(' and ')} remain weak, which keeps the quantum-readiness score depressed.`;
  }

  if (asset.status === 'safe') {
    return `AEGIS rates this asset as transition-ready because its baseline crypto is solid, but ${weakestDimensions.join(' and ')} still need improvement before it reaches elite PQC posture.`;
  }

  return `AEGIS rates this asset at ${asset.qScore}/100 because ${weakestDimensions.join(' and ')} are the weakest scoring dimensions in the current scan.`;
}

function formatHistoryPointLabel(iso: string | null, index: number): string {
  if (!iso) {
    return `Point ${index + 1}`;
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return `Point ${index + 1}`;
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const AssetDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [certModalOpen, setCertModalOpen] = useState(false);
  const { selectedAssets, selectedAssetResults } = useSelectedScan();
  const asset = selectedAssets.find(a => a.domain.replace(/\./g, '-') === id);
  const rawAsset = selectedAssetResults.find((candidate) => candidate.asset_id === asset?.id);
  const history = useMemo(() => {
    if (!asset) {
      return [];
    }

    const fingerprintHistory = (rawAsset?.asset_fingerprint?.q_score_history ?? [])
      .filter((entry) => entry.q_score !== null)
      .map((entry, index) => ({
        scan: formatHistoryPointLabel(entry.scanned_at, index),
        score: entry.q_score ?? asset.qScore,
        event:
          entry.scan_id === rawAsset?.asset_fingerprint?.last_seen_scan_id
            ? 'Current selected scan'
            : undefined,
        scannedAt: entry.scanned_at ?? '',
      }))
      .sort((left, right) => new Date(left.scannedAt).getTime() - new Date(right.scannedAt).getTime());

    if (fingerprintHistory.length > 0) {
      return fingerprintHistory.map(({ scan, score, event }) => ({ scan, score, event }));
    }

    return [
      {
        scan: 'Current',
        score: asset.qScore,
        event: 'Current selected scan',
      },
    ];
  }, [asset, rawAsset]);
  const scoreReason = asset ? buildAssetScoreReason(asset) : '';

  if (selectedAssets.length === 0 || !asset) {
    return <div className="p-10 text-center"><h1 className="font-display text-2xl italic text-brand-primary">Asset Not Found</h1><p className="text-muted-foreground mt-2 font-body text-sm">No asset matching "{id}"</p><Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard/inventory')}>Back to Inventory</Button></div>;
  }

  const radarData = [
    { axis: 'TLS Version', value: asset.dimensionScores.tls_version },
    { axis: 'Key Exchange', value: asset.dimensionScores.key_exchange },
    { axis: 'Cipher', value: asset.dimensionScores.cipher_strength },
    { axis: 'Certificate', value: asset.dimensionScores.certificate_algo },
    { axis: 'Fwd Secrecy', value: asset.dimensionScores.forward_secrecy },
    { axis: 'PQC Ready', value: asset.dimensionScores.pqc_readiness },
  ];

  const tlsVersions = ['TLS 1.0', 'TLS 1.1', 'TLS 1.2', 'TLS 1.3'];
  const supportedMap: Record<string, boolean> = {};
  asset.tlsVersionsSupported.forEach(v => {
    if (v === 'TLS_1_0') supportedMap['TLS 1.0'] = true;
    if (v === 'TLS_1_1') supportedMap['TLS 1.1'] = true;
    if (v === 'TLS_1_2') supportedMap['TLS 1.2'] = true;
    if (v === 'TLS_1_3') supportedMap['TLS 1.3'] = true;
  });

  const isPqc = asset.status === 'elite-pqc';
  const isQuantumVuln = asset.certInfo.key_type === 'RSA' || asset.certInfo.key_type === 'ECDSA';

  const certChain = [
    { label: 'Leaf', cn: asset.certInfo.subject_cn, issuer: asset.certInfo.issuer, algo: asset.certInfo.signature_algorithm, keySize: asset.certInfo.key_type === 'ML-DSA' ? 'ML-DSA-65' : `${asset.certInfo.key_type}-${asset.certInfo.key_size}`, vuln: isQuantumVuln && !isPqc },
    { label: 'Intermediate', cn: asset.certInfo.issuer, issuer: asset.certInfo.certificate_authority, algo: isQuantumVuln ? 'SHA256WithRSA' : 'ML-DSA-65', keySize: isQuantumVuln ? 'RSA-2048' : 'ML-DSA-65', vuln: isQuantumVuln && !isPqc },
    { label: 'Root', cn: asset.certInfo.certificate_authority, issuer: 'Self-signed', algo: isQuantumVuln ? 'SHA256WithRSA' : 'ML-DSA-65', keySize: isQuantumVuln ? 'RSA-4096' : 'ML-DSA-87', vuln: false },
  ];

  return (
    <>
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* Breadcrumb + Header */}
      <div className="flex items-center gap-1.5 text-xs font-body text-muted-foreground">
        <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to="/dashboard/inventory" className="hover:text-foreground">Assets</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium">{asset.domain}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <svg viewBox="0 0 120 120" className="w-20 h-20">
              <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--bg-sunken))" strokeWidth="8" />
              <circle cx="60" cy="60" r="52" fill="none" stroke={getQScoreColor(asset.qScore)} strokeWidth="8" strokeDasharray={`${(asset.qScore / 100) * 327} 327`} strokeLinecap="round" transform="rotate(-90 60 60)" />
              <text x="60" y="58" textAnchor="middle" className="font-mono text-xl font-bold" fill="currentColor">{asset.qScore}</text>
              <text x="60" y="72" textAnchor="middle" className="text-[8px]" fill="hsl(var(--text-muted))">Q-Score</text>
            </svg>
          </div>
          <div>
            <h1 className="font-display text-2xl italic text-brand-primary">{asset.domain}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px]">{getTierFromAsset(asset.tier)}</Badge>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded" style={{ color: getStatusColor(asset.status), backgroundColor: `${getStatusColor(asset.status)}15` }}>{getStatusLabel(asset.status)}</span>
              <Badge variant="secondary" className="text-[10px]">{asset.type}</Badge>
            </div>
            <p className="mt-2 max-w-2xl text-xs font-body leading-relaxed text-muted-foreground">{scoreReason}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(asset.status === 'elite-pqc' || asset.status === 'safe') ? (
            <Button variant="outline" className="gap-1.5 text-xs" onClick={() => setCertModalOpen(true)}>
              <Download className="w-3.5 h-3.5" /> Download Certificate
            </Button>
          ) : (
            <ShadcnTooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" className="gap-1.5 text-xs opacity-50 cursor-not-allowed" disabled>
                  <Download className="w-3.5 h-3.5" /> Download Certificate
                </Button>
              </TooltipTrigger>
              <TooltipContent><p className="text-xs">Not yet eligible — Q-Score must reach 80+</p></TooltipContent>
            </ShadcnTooltip>
          )}
          <Button className="gap-1.5 text-xs"><Scan className="w-3.5 h-3.5" /> Scan Now</Button>
        </div>
      </div>

      {/* Section 1: Identity */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Identity</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-xs font-body">
            {[
              ['Asset Name', asset.domain], ['URL', asset.url], ['IPv4', asset.ip], ['IPv6', asset.ipv6 || '—'],
              ['Type', asset.type], ['Owner', asset.ownerTeam], ['Criticality', asset.businessCriticality.replace('_', ' ')], ['Tags', asset.type],
              ['First Seen', '2025-06-01'], ['Last Scanned', new Date(asset.lastScanned).toLocaleDateString()],
            ].map(([label, value]) => (
              <div key={label as string}><span className="text-muted-foreground">{label}</span><p className="font-mono font-medium mt-0.5 truncate">{value}</p></div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 2: TLS Profile */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">TLS Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {tlsVersions.map(v => {
              const supported = supportedMap[v];
              return (
                <div key={v} className={`p-3 rounded-lg border text-center ${supported ? 'border-[hsl(var(--status-safe)/0.3)] bg-[hsl(var(--status-safe)/0.05)]' : 'border-[hsl(var(--status-critical)/0.3)] bg-[hsl(var(--status-critical)/0.05)]'}`}>
                  <p className="font-mono text-xs font-semibold">{v}</p>
                  {supported ? <Check className="w-4 h-4 text-[hsl(var(--status-safe))] mx-auto mt-1" /> : <X className="w-4 h-4 text-[hsl(var(--status-critical))] mx-auto mt-1" />}
                </div>
              );
            })}
          </div>
          <div className="space-y-2 text-xs font-body">
            <div className="flex items-center gap-2"><span className="text-muted-foreground w-32">Cipher Suite</span>
              <Badge className={`text-[10px] ${isPqc ? 'bg-[hsl(var(--status-safe))] text-white' : asset.cipher.includes('CBC') ? 'bg-[hsl(var(--status-critical))] text-white' : 'bg-[hsl(var(--accent-amber))] text-white'}`}>{asset.cipher}</Badge>
            </div>
            <div className="flex items-center gap-2"><span className="text-muted-foreground w-32">Forward Secrecy</span><span className={asset.forwardSecrecy ? 'text-[hsl(var(--status-safe))]' : 'text-[hsl(var(--status-critical))]'}>{asset.forwardSecrecy ? 'Enabled' : 'Disabled'}</span></div>
            <div className="flex items-center gap-2"><span className="text-muted-foreground w-32">HSTS</span><span className={asset.hstsEnabled ? 'text-[hsl(var(--status-safe))]' : 'text-[hsl(var(--status-critical))]'}>{asset.hstsEnabled ? 'Enabled (max-age=31536000)' : 'Not enabled'}</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Certificate Chain */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Certificate Chain</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-0">
            {certChain.map((node, i) => (
              <div key={node.label}>
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${node.vuln ? 'bg-[hsl(var(--status-critical)/0.15)] text-[hsl(var(--status-critical))]' : 'bg-[hsl(var(--status-safe)/0.15)] text-[hsl(var(--status-safe))]'}`}>
                      {i + 1}
                    </div>
                    {i < certChain.length - 1 && <div className="w-px h-8 bg-border" />}
                  </div>
                  <div className="flex-1 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold">{node.label}</span>
                      {node.vuln ? <Badge variant="destructive" className="text-[9px]">Quantum Vulnerable</Badge> : <Badge className="bg-[hsl(var(--status-safe))] text-white text-[9px]">Quantum Safe</Badge>}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1.5 text-[11px] font-body">
                      <div><span className="text-muted-foreground">CN</span><p className="font-mono truncate">{node.cn}</p></div>
                      <div><span className="text-muted-foreground">Issuer</span><p className="font-mono truncate">{node.issuer}</p></div>
                      <div><span className="text-muted-foreground">Algorithm</span><p className="font-mono">{node.algo}</p></div>
                      <div><span className="text-muted-foreground">Key</span><p className="font-mono">{node.keySize}</p></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section 4: PQC Assessment */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">PQC Assessment</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border-default))" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8 }} />
                <Radar dataKey="value" stroke="hsl(var(--brand-primary))" fill="hsl(var(--brand-primary))" fillOpacity={0.15} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
            <div className="space-y-4">
              {asset.hndlBreakYear && (
                <div className="p-3 rounded-lg bg-[hsl(var(--status-critical)/0.05)] border border-[hsl(var(--status-critical)/0.15)]">
                  <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-[hsl(var(--status-critical))]" /><span className="font-body text-xs font-semibold text-[hsl(var(--status-critical))]">HNDL Risk</span></div>
                  <p className="text-xs font-body text-foreground">Estimated break year: <span className="font-mono font-bold">~{asset.hndlBreakYear}</span></p>
                  <p className="text-xs font-body text-muted-foreground mt-0.5">
                    {Math.round((new Date(`${asset.hndlBreakYear}-01-01`).getTime() - Date.now()) / (1000 * 60 * 60 * 24)).toLocaleString()} days remaining
                  </p>
                </div>
              )}
              {isPqc && (
                <div className="p-3 rounded-lg bg-[hsl(var(--status-safe)/0.05)] border border-[hsl(var(--status-safe)/0.15)]">
                  <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-[hsl(var(--status-safe))]" /><span className="font-body text-xs font-semibold text-[hsl(var(--status-safe))]">Quantum Safe</span></div>
                  <p className="text-xs font-body text-muted-foreground mt-1">This asset uses ML-KEM-768 key exchange and ML-DSA-65 signatures. No HNDL risk.</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Score History */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Score History</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-default))" />
              <XAxis dataKey="scan" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <RechartTooltip content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return <div className="bg-popover border border-border rounded-lg p-2 text-xs font-body shadow-lg"><p className="font-mono font-bold">{d.score}</p>{d.event && <p className="text-muted-foreground mt-0.5">{d.event}</p>}</div>;
              }} />
              {history.filter(h => h.event).map((h, i) => (
                <ReferenceLine key={i} x={h.scan} stroke="hsl(var(--accent-amber))" strokeDasharray="3 3" />
              ))}
              <Line type="monotone" dataKey="score" stroke={getQScoreColor(asset.qScore)} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-2 text-center text-[10px] font-body text-muted-foreground">
            {rawAsset?.asset_fingerprint?.q_score_history?.length
              ? 'Trend is based on persisted asset fingerprint history across previous scans of the same logical asset.'
              : 'Only the current scan is available for this asset so far.'}
          </p>
        </CardContent>
      </Card>

      {/* Section 6: Remediation */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-body">Remediation Actions</CardTitle>
            <Button size="sm" className="text-xs h-7 gap-1" onClick={() => navigate(`/dashboard/remediation/ai-patch?asset=${asset.domain.replace(/\./g, '-')}`)}>Generate Patch</Button>
          </div>
        </CardHeader>
        <CardContent>
          {asset.remediation.length === 0 ? (
            <div className="text-center py-6"><Shield className="w-8 h-8 text-[hsl(var(--status-safe))] mx-auto mb-2" /><p className="text-xs font-body text-muted-foreground">No remediation actions needed. This asset is fully quantum safe.</p></div>
          ) : (
            <div className="space-y-2">
              {asset.remediation.map((r, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-[hsl(var(--bg-sunken))]">
                  <Badge className={`text-[10px] font-mono ${r.priority === 'P1' ? 'bg-[hsl(var(--status-critical))] text-white' : r.priority === 'P2' ? 'bg-[hsl(var(--status-vuln))] text-white' : 'bg-[hsl(var(--status-warn))] text-white'}`}>{r.priority}</Badge>
                  <div className="flex-1 text-xs font-body">
                    <p className="font-medium">{r.finding}</p>
                    <p className="text-muted-foreground">{r.action}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">{r.status.replace('_', ' ')}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
      {asset && <PQCCertificateModal open={certModalOpen} onOpenChange={setCertModalOpen} asset={asset} />}
    </>
  );
};

export default AssetDetail;
