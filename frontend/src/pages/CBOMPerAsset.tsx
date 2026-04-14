import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import { cn } from '@/lib/utils';
import SectionTabBar from '@/components/dashboard/SectionTabBar';
import { FileText, Cpu, Package } from 'lucide-react';
import type { AssetResultResponse } from '@/lib/api';

const cbomTabs = [
  { id: 'overview', label: 'Overview', icon: FileText, route: '/dashboard/cbom' },
  { id: 'per-asset', label: 'Per-Asset', icon: Cpu, route: '/dashboard/cbom/per-asset' },
  { id: 'export', label: 'Export Center', icon: Package, route: '/dashboard/cbom/export' },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getCbomPayload = (assetResult: AssetResultResponse | undefined): Record<string, unknown> | null => {
  if (!assetResult || !isRecord(assetResult.cbom)) return null;
  return assetResult.cbom;
};

const getCbomJson = (assetResult: AssetResultResponse | undefined): Record<string, unknown> | null => {
  const payload = getCbomPayload(assetResult);
  const cbomJson = payload?.cbom_json;
  return isRecord(cbomJson) ? cbomJson : null;
};

const getCbomSummary = (assetResult: AssetResultResponse | undefined) => {
  const payload = getCbomPayload(assetResult);
  const cbomJson = getCbomJson(assetResult);
  const components = Array.isArray(cbomJson?.components) ? cbomJson.components : [];

  return {
    serialNumber: typeof payload?.serial_number === 'string' ? payload.serial_number : 'Unavailable',
    createdAt: typeof payload?.created_at === 'string' ? payload.created_at : null,
    bomFormat: typeof cbomJson?.bomFormat === 'string' ? cbomJson.bomFormat : 'Unavailable',
    specVersion: typeof cbomJson?.specVersion === 'string' ? cbomJson.specVersion : 'Unavailable',
    componentCount: components.length,
    cbomJson,
  };
};

const formatTimestamp = (value: string | null) => {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const CBOMPerAsset = () => {
  const { selectedAssets, selectedAssetResults } = useSelectedScan();
  const [expanded, setExpanded] = useState<string[]>([]);
  const [jsonModalAssetId, setJsonModalAssetId] = useState<string | null>(null);

  const assetResultsById = useMemo(
    () => new Map(selectedAssetResults.map((assetResult) => [assetResult.asset_id, assetResult])),
    [selectedAssetResults],
  );

  const assetsWithCbom = useMemo(
    () => selectedAssets.filter((asset) => getCbomPayload(assetResultsById.get(asset.id)) !== null),
    [selectedAssets, assetResultsById],
  );

  const displayAssets = assetsWithCbom.length > 0 ? assetsWithCbom : selectedAssets.filter((asset) => asset.cipher !== '--');
  const selectedCbomSummary = jsonModalAssetId ? getCbomSummary(assetResultsById.get(jsonModalAssetId)) : null;

  const toggle = (id: string) => setExpanded((prev) => prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]);

  return (
    <div className="space-y-5">
      <DataContextBadge />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl italic text-brand-primary">Per-Asset CBOM</h1>
          <p className="text-xs font-body text-muted-foreground mt-0.5">Deep component-level cryptographic bill of materials for each discovered asset.</p>
        </div>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => window.location.href = '/dashboard/cbom/export'}>Open Export Center</Button>
      </div>
      <SectionTabBar tabs={cbomTabs} />

      <div className="space-y-2">
        {displayAssets.map((asset) => {
          const isOpen = expanded.includes(asset.id);
          const vulnKex = asset.keyExchange === 'RSA' || asset.keyExchange === 'ECDHE';
          const vulnCert = asset.certInfo.key_type === 'RSA' || asset.certInfo.key_type === 'ECDSA';
          const isPqc = asset.status === 'elite-pqc';
          const cbomSummary = getCbomSummary(assetResultsById.get(asset.id));

          return (
            <Card key={asset.id} className={cn("shadow-sm transition-all", isOpen && "shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]")}>
              <button onClick={() => toggle(asset.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                <span className="font-mono text-sm font-medium flex-1">{asset.domain}</span>
                <Badge variant="outline" className="text-[10px]">{asset.tls}</Badge>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded" style={{ color: isPqc ? 'hsl(var(--status-safe))' : asset.qScore <= 40 ? 'hsl(var(--status-critical))' : 'hsl(var(--accent-amber))', backgroundColor: isPqc ? 'hsl(var(--status-safe)/0.1)' : asset.qScore <= 40 ? 'hsl(var(--status-critical)/0.1)' : 'hsl(var(--accent-amber)/0.1)' }}>
                  Q-{asset.qScore}
                </span>
              </button>

              {isOpen && (
                <CardContent className="pt-0 pb-4 px-4">
                  <div className="ml-7 font-mono text-xs space-y-1 border-l-2 border-[hsl(var(--border-default))] pl-4">
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">+- <span className="text-foreground font-medium">TLS Certificate</span></p>
                      <p className="ml-4">Algorithm: <span className="font-medium">{asset.certInfo.signature_algorithm}</span> {vulnCert && !isPqc && <span className="text-[hsl(var(--status-critical))] ml-1">(QUANTUM VULNERABLE)</span>}{isPqc && <span className="text-[hsl(var(--status-safe))] ml-1">(QUANTUM SAFE)</span>}</p>
                      <p className="ml-4">Key Size: <span className="font-medium">{asset.certInfo.key_size || 'PQC'} bits</span></p>
                      <p className="ml-4">Issuer: {asset.certInfo.issuer}</p>
                      <p className="ml-4">Valid Until: {asset.certInfo.valid_until} ({asset.certInfo.days_remaining}d remaining)</p>
                    </div>
                    <div className="space-y-0.5 mt-2">
                      <p className="text-muted-foreground">|- <span className="text-foreground font-medium">Key Exchange</span></p>
                      <p className="ml-4">Method: <span className="font-medium">{asset.keyExchange}</span> {vulnKex && !isPqc && <span className="text-[hsl(var(--status-critical))] ml-1">(QUANTUM VULNERABLE)</span>}{isPqc && <span className="text-[hsl(var(--status-safe))] ml-1">(QUANTUM SAFE - ML-KEM-768)</span>}</p>
                      <p className="ml-4">Forward Secrecy: {asset.forwardSecrecy ? <span className="text-[hsl(var(--status-safe))]">YES</span> : <span className="text-[hsl(var(--status-critical))]">NO</span>}</p>
                      {!isPqc && <p className="ml-4 text-muted-foreground">PQC Equivalent: ML-KEM-768</p>}
                    </div>
                    <div className="space-y-0.5 mt-2">
                      <p className="text-muted-foreground">|- <span className="text-foreground font-medium">Cipher Suite</span></p>
                      <p className="ml-4">Current: <span className="font-medium">{asset.cipher}</span></p>
                      <p className="ml-4">AES-256: <span className="text-[hsl(var(--status-safe))]">QUANTUM RESISTANT</span> (Grover: 128-bit effective)</p>
                      {!isPqc && <p className="ml-4 text-muted-foreground">Recommended: TLS_MLKEM768_AES256_GCM_SHA384</p>}
                    </div>
                    <div className="space-y-0.5 mt-2">
                      <p className="text-muted-foreground">`- <span className="text-foreground font-medium">TLS Protocol</span></p>
                      <p className="ml-4">Versions: {asset.tlsVersionsSupported.join(', ') || 'None detected'}</p>
                      {asset.tlsVersionsSupported.includes('TLS_1_0') && <p className="ml-4 text-[hsl(var(--status-critical))]">TLS 1.0 negotiable - CRITICAL</p>}
                      {asset.tlsVersionsSupported.includes('TLS_1_1') && <p className="ml-4 text-[hsl(var(--status-critical))]">TLS 1.1 negotiable - should be disabled</p>}
                    </div>
                  </div>

                  <div className="ml-7 mt-4 p-3 rounded-lg bg-[hsl(var(--bg-sunken))] border border-[hsl(var(--border-default))]">
                    <p className="font-body text-xs font-semibold text-foreground mb-2">Persisted CBOM Metadata</p>
                    <div className="space-y-1.5 text-[11px] font-body">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Serial Number:</span>
                        <code className="font-mono text-[10px] text-foreground bg-background px-1.5 py-0.5 rounded break-all">{cbomSummary.serialNumber}</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Format:</span>
                        <Badge variant="outline" className="text-[10px]">{cbomSummary.bomFormat}</Badge>
                        <Badge variant="outline" className="text-[10px]">Spec {cbomSummary.specVersion}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Components:</span>
                        <span className="font-mono text-[10px]">{cbomSummary.componentCount}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Generated:</span>
                        <span className="font-mono text-[10px]">{formatTimestamp(cbomSummary.createdAt)}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="mt-2 h-6 text-[10px]" onClick={() => setJsonModalAssetId(asset.id)} disabled={!cbomSummary.cbomJson}>View CBOM JSON</Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <Dialog open={!!jsonModalAssetId} onOpenChange={() => setJsonModalAssetId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle className="font-body text-sm">Persisted CBOM Document</DialogTitle></DialogHeader>
          {selectedCbomSummary?.cbomJson ? (
            <pre className="bg-[hsl(var(--brand-primary))] text-accent-amber-light font-mono text-[10px] p-4 rounded-lg overflow-x-auto leading-relaxed max-h-[70vh]">
{JSON.stringify(selectedCbomSummary.cbomJson, null, 2)}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground font-body">No persisted CBOM JSON is available for this asset in the current backend payload.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CBOMPerAsset;
