import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronDown, ChevronRight, AlertTriangle, Shield, Check } from 'lucide-react';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import { cn } from '@/lib/utils';
import SectionTabBar from '@/components/dashboard/SectionTabBar';
import { FileText, Cpu, Package } from 'lucide-react';

const cbomTabs = [
  { id: 'overview', label: 'Overview', icon: FileText, route: '/dashboard/cbom' },
  { id: 'per-asset', label: 'Per-Asset', icon: Cpu, route: '/dashboard/cbom/per-asset' },
  { id: 'export', label: 'Export Center', icon: Package, route: '/dashboard/cbom/export' },
];

// Generate fake attestation hashes per asset
const attestationHashes: Record<string, string> = {};
const genHash = () => { const chars = '0123456789abcdef'; let hash = ''; for (let i = 0; i < 64; i++) hash += chars[Math.floor(Math.random() * 16)]; return hash; };

const CBOMPerAsset = () => {
  const { selectedAssets } = useSelectedScan();
  const [expanded, setExpanded] = useState<string[]>([]);
  const [verifyModal, setVerifyModal] = useState<string | null>(null);
  const toggle = (id: string) => setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // Ensure hashes exist for all assets
  selectedAssets.forEach(a => { if (!attestationHashes[a.id]) attestationHashes[a.id] = genHash(); });

  return (
    <div className="space-y-5">
      <DataContextBadge />
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl italic text-brand-primary">Per-Asset CBOM</h1>
        <Button variant="outline" size="sm" className="text-xs">Export All CycloneDX</Button>
      </div>
      <SectionTabBar tabs={cbomTabs} />

      <div className="space-y-2">
        {selectedAssets.filter(a => a.cipher !== '--').map(a => {
          const isOpen = expanded.includes(a.id);
          const vulnKex = a.keyExchange === 'RSA' || a.keyExchange === 'ECDHE';
          const vulnCert = a.certInfo.key_type === 'RSA' || a.certInfo.key_type === 'ECDSA';
          const isPqc = a.status === 'elite-pqc';

          return (
            <Card key={a.id} className={cn("shadow-sm transition-all", isOpen && "shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]")}>
              <button onClick={() => toggle(a.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <span className="font-mono text-sm font-medium flex-1">{a.domain}</span>
                <Badge variant="outline" className="text-[10px]">{a.tls}</Badge>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded" style={{ color: isPqc ? 'hsl(var(--status-safe))' : a.qScore <= 40 ? 'hsl(var(--status-critical))' : 'hsl(var(--accent-amber))', backgroundColor: isPqc ? 'hsl(var(--status-safe)/0.1)' : a.qScore <= 40 ? 'hsl(var(--status-critical)/0.1)' : 'hsl(var(--accent-amber)/0.1)' }}>
                  Q-{a.qScore}
                </span>
              </button>

              {isOpen && (
                <CardContent className="pt-0 pb-4 px-4">
                  <div className="ml-7 font-mono text-xs space-y-1 border-l-2 border-[hsl(var(--border-default))] pl-4">
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">┌─ <span className="text-foreground font-medium">TLS Certificate</span></p>
                      <p className="ml-4">Algorithm: <span className="font-medium">{a.certInfo.signature_algorithm}</span> {vulnCert && !isPqc && <span className="text-[hsl(var(--status-critical))] ml-1">(QUANTUM VULNERABLE)</span>}{isPqc && <span className="text-[hsl(var(--status-safe))] ml-1">(QUANTUM SAFE)</span>}</p>
                      <p className="ml-4">Key Size: <span className="font-medium">{a.certInfo.key_size || 'PQC'} bits</span></p>
                      <p className="ml-4">Issuer: {a.certInfo.issuer}</p>
                      <p className="ml-4">Valid Until: {a.certInfo.valid_until} ({a.certInfo.days_remaining}d remaining)</p>
                    </div>
                    <div className="space-y-0.5 mt-2">
                      <p className="text-muted-foreground">├─ <span className="text-foreground font-medium">Key Exchange</span></p>
                      <p className="ml-4">Method: <span className="font-medium">{a.keyExchange}</span> {vulnKex && !isPqc && <span className="text-[hsl(var(--status-critical))] ml-1">(QUANTUM VULNERABLE)</span>}{isPqc && <span className="text-[hsl(var(--status-safe))] ml-1">(QUANTUM SAFE — ML-KEM-768)</span>}</p>
                      <p className="ml-4">Forward Secrecy: {a.forwardSecrecy ? <span className="text-[hsl(var(--status-safe))]">YES</span> : <span className="text-[hsl(var(--status-critical))]">NO</span>}</p>
                      {!isPqc && <p className="ml-4 text-muted-foreground">PQC Equivalent: ML-KEM-768</p>}
                    </div>
                    <div className="space-y-0.5 mt-2">
                      <p className="text-muted-foreground">├─ <span className="text-foreground font-medium">Cipher Suite</span></p>
                      <p className="ml-4">Current: <span className="font-medium">{a.cipher}</span></p>
                      <p className="ml-4">AES-256: <span className="text-[hsl(var(--status-safe))]">QUANTUM RESISTANT</span> (Grover: 128-bit effective)</p>
                      {!isPqc && <p className="ml-4 text-muted-foreground">Recommended: TLS_MLKEM768_AES256_GCM_SHA384</p>}
                    </div>
                    <div className="space-y-0.5 mt-2">
                      <p className="text-muted-foreground">└─ <span className="text-foreground font-medium">TLS Protocol</span></p>
                      <p className="ml-4">Versions: {a.tlsVersionsSupported.join(', ') || 'None detected'}</p>
                      {a.tlsVersionsSupported.includes('TLS_1_0') && <p className="ml-4 text-[hsl(var(--status-critical))]">⚠ TLS 1.0 negotiable — CRITICAL</p>}
                      {a.tlsVersionsSupported.includes('TLS_1_1') && <p className="ml-4 text-[hsl(var(--status-critical))]">⚠ TLS 1.1 negotiable — should be disabled</p>}
                    </div>
                  </div>

                  {/* Attestation Section */}
                  <div className="ml-7 mt-4 p-3 rounded-lg bg-[hsl(var(--bg-sunken))] border border-[hsl(var(--border-default))]">
                    <p className="font-body text-xs font-semibold text-foreground mb-2">Cryptographic Attestation</p>
                    <div className="space-y-1.5 text-[11px] font-body">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">CBOM Hash:</span>
                        <code className="font-mono text-[10px] text-foreground bg-background px-1.5 py-0.5 rounded">{attestationHashes[a.id]?.substring(0, 32)}...</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Signed with:</span>
                        <Badge className="bg-cyan-500/10 text-cyan-600 text-[10px]">Ed25519</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Timestamp:</span>
                        <span className="font-mono text-[10px]">{a.lastScanned}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="mt-2 h-6 text-[10px]" onClick={() => setVerifyModal(a.id)}>Verify Attestation</Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Verify Modal */}
      <Dialog open={!!verifyModal} onOpenChange={() => setVerifyModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-body text-sm">Attestation Verification</DialogTitle></DialogHeader>
          {verifyModal && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-[hsl(var(--status-safe)/0.1)] border border-[hsl(var(--status-safe)/0.3)] flex items-center gap-2">
                <Check className="w-5 h-5 text-[hsl(var(--status-safe))]" />
                <span className="font-body text-sm font-semibold text-[hsl(var(--status-safe))]">SIGNATURE VALID</span>
              </div>
              <pre className="bg-[hsl(var(--brand-primary))] text-accent-amber-light font-mono text-[10px] p-4 rounded-lg overflow-x-auto leading-relaxed">
{`{
  "cbom_hash": "${attestationHashes[verifyModal]}",
  "timestamp": "${selectedAssets.find(a => a.id === verifyModal)?.lastScanned}",
  "signing_key_id": "aegis-signing-key-2026-v1",
  "algorithm": "Ed25519",
  "signature": "MEUCIQDk...base64...==",
  "status": "VALID"
}`}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CBOMPerAsset;