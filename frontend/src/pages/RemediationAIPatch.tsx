import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Check, Terminal, Server, Globe, Shield, ClipboardList, Sparkles, Map as MapIcon, CheckCircle2 } from 'lucide-react';
import { useScanContext } from '@/contexts/ScanContext';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import { assets } from '@/data/demoData';
import SectionTabBar from '@/components/dashboard/SectionTabBar';

const remediationTabs = [
  { id: 'action-plan', label: 'Action Plan', icon: ClipboardList, route: '/dashboard/remediation/action-plan' },
  { id: 'ai-patch', label: 'AI Patch Generator', icon: Sparkles, route: '/dashboard/remediation/ai-patch' },
  { id: 'roadmap', label: 'Migration Roadmap', icon: MapIcon, route: '/dashboard/remediation/roadmap' },
];

const serverTypes = ['nginx', 'Apache', 'IIS', 'HAProxy'];

const patchTemplates: Record<string, { finding: string; label: string; code: string; impact: number; nistRef: string }[]> = {
  'TLS 1.0/1.1 enabled': [
    { finding: 'TLS 1.0/1.1 enabled', label: 'Disable Legacy TLS', code: `# Disable TLS 1.0/1.1\nssl_protocols TLSv1.2 TLSv1.3;\nssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';\nssl_prefer_server_ciphers on;`, impact: 15, nistRef: 'NIST SP 800-52 Rev 2, Section 3.3.1' },
  ],
  'RSA key exchange (no forward secrecy)': [
    { finding: 'RSA key exchange', label: 'Enable ECDHE Key Exchange', code: `# Enable forward secrecy\nssl_ecdh_curve secp384r1:X25519;\n# Remove RSA key exchange ciphers`, impact: 12, nistRef: 'NIST SP 800-52 Rev 2, Section 3.3.2' },
  ],
  'No PQC key exchange': [
    { finding: 'No PQC key exchange', label: 'Enable ML-KEM-768 Hybrid', code: `# PQC Hybrid Key Exchange\nssl_ecdh_curve X25519MLKEM768:X25519:secp384r1;\n# Requires: OQS-OpenSSL 3.2+`, impact: 20, nistRef: 'NIST FIPS 203 (ML-KEM)' },
  ],
  'Certificate expiring': [
    { finding: 'Certificate expiring', label: 'Renew Certificate', code: `# Renew certificate\ncertbot renew --force-renewal\n# Or generate new ECDSA cert:\nopenssl ecparam -genkey -name secp384r1 -out key.pem`, impact: 5, nistRef: 'NIST SP 800-57 Part 1' },
  ],
  'HSTS not enabled': [
    { finding: 'HSTS not enabled', label: 'Enable HSTS', code: `# Enable HSTS\nadd_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;`, impact: 3, nistRef: 'NIST SP 800-52 Rev 2' },
  ],
  'RSA-2048 certificate': [
    { finding: 'RSA-2048 certificate', label: 'Upgrade to ECDSA/ML-DSA', code: `# Generate ECDSA P-384 key\nopenssl ecparam -genkey -name secp384r1 -out ecdsa.key\nopenssl req -new -key ecdsa.key -out ecdsa.csr`, impact: 8, nistRef: 'NIST SP 800-186' },
  ],
};

const RemediationAIPatch = () => {
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string>(assets[0].id);
  const [selectedFinding, setSelectedFinding] = useState<string>('all');
  const [selectedServer, setSelectedServer] = useState<string>('nginx');

  const asset = assets.find(a => a.id === selectedAsset)!;
  const isPqcSafe = asset.status === 'elite-pqc';

  const assetFindings = useMemo(() => {
    return asset.remediation.map(r => r.finding);
  }, [asset]);

  const detectedServer = useMemo(() => {
    if (!asset.software) return 'nginx';
    const p = asset.software.product.toLowerCase();
    if (p.includes('nginx')) return 'nginx';
    if (p.includes('apache')) return 'Apache';
    if (p.includes('iis')) return 'IIS';
    if (p.includes('haproxy')) return 'HAProxy';
    return 'nginx';
  }, [asset]);

  const relevantPatches = useMemo(() => {
    const patches: { finding: string; label: string; code: string; impact: number; nistRef: string }[] = [];
    const findings = selectedFinding === 'all' ? assetFindings : [selectedFinding];
    findings.forEach(f => {
      Object.entries(patchTemplates).forEach(([key, templates]) => {
        const fLower = f.toLowerCase();
        const kLower = key.toLowerCase();
        if (fLower.includes(kLower.split(' ')[0]) || kLower.includes(fLower.split(' ')[0])) {
          patches.push(...templates);
        }
      });
    });
    return [...new Map(patches.map(p => [p.label, p])).values()];
  }, [assetFindings, selectedFinding]);

  const totalImpact = relevantPatches.reduce((sum, p) => sum + p.impact, 0);

  const handleCopy = (code: string, key: string) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(key);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-5">
      <DataContextBadge />
      <div>
        <h1 className="font-display text-2xl italic text-brand-primary">AI Patch Generator</h1>
        <p className="font-body text-sm text-muted-foreground mt-1">Auto-generated configuration patches for PQC migration</p>
      </div>
      <SectionTabBar tabs={remediationTabs} />

      <Card className="bg-surface border-border">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="font-body text-[10px] text-muted-foreground uppercase">Asset</label>
              <Select value={selectedAsset} onValueChange={(v) => { setSelectedAsset(v); setSelectedFinding('all'); }}>
                <SelectTrigger className="w-52 h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{assets.map(a => <SelectItem key={a.id} value={a.id}>{a.domain}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-body text-[10px] text-muted-foreground uppercase">Finding</label>
              <Select value={selectedFinding} onValueChange={setSelectedFinding}>
                <SelectTrigger className="w-52 h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Findings</SelectItem>
                  {assetFindings.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-body text-[10px] text-muted-foreground uppercase">Server Type</label>
              <Select value={selectedServer} onValueChange={setSelectedServer}>
                <SelectTrigger className="w-32 h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{serverTypes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isPqcSafe ? (
        <Card className="bg-surface border-border">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-[hsl(var(--status-safe))] mx-auto mb-4" />
            <h2 className="font-body text-lg font-bold text-[hsl(var(--status-safe))]">This asset is already Fully Quantum Safe</h2>
            <p className="font-body text-sm text-muted-foreground mt-2">No patches required. {asset.domain} uses ML-KEM-768 key exchange and ML-DSA-65 signatures.</p>
            <Button variant="outline" className="mt-4 text-xs">Download PQC Certificate</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {relevantPatches.length === 0 ? (
            <Card className="bg-surface border-border">
              <CardContent className="py-8 text-center">
                <p className="font-body text-sm text-muted-foreground">No patches match the selected finding for this asset.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {relevantPatches.map((patch, i) => {
                const copyKey = `patch-${i}`;
                return (
                  <Card key={i} className="bg-surface border-border overflow-hidden">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="font-body text-sm">{patch.label}</CardTitle>
                          <p className="font-body text-xs text-muted-foreground mt-0.5">{patch.finding}</p>
                          <p className="font-mono text-[10px] text-muted-foreground mt-1">{patch.nistRef}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-[hsl(var(--status-safe))] text-white text-[10px]">+{patch.impact} pts</Badge>
                          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => handleCopy(patch.code, copyKey)}>
                            {copiedIndex === copyKey ? <><Check className="w-3 h-3 text-status-safe" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <pre className="bg-brand-primary text-accent-amber-light font-mono text-xs p-4 overflow-x-auto leading-relaxed"><code>{patch.code}</code></pre>
                      <div className="px-4 py-2 bg-[hsl(var(--bg-sunken))] border-t border-border">
                        <p className="font-mono text-[10px] text-muted-foreground">Testing: <code className="text-foreground">openssl s_client -connect {asset.domain}:443 -tls1_3</code></p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {relevantPatches.length > 0 && (
            <Card className="bg-[hsl(var(--status-safe)/0.05)] border-[hsl(var(--status-safe)/0.2)]">
              <CardContent className="py-3 flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-[hsl(var(--status-safe))]" />
                <p className="font-body text-sm">
                  Applying all patches to <strong className="font-mono">{asset.domain}</strong>: projected Q-Score <span className="font-mono font-bold text-[hsl(var(--status-safe))]">+{totalImpact} points</span>
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default RemediationAIPatch;
