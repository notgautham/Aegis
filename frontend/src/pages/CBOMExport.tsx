import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileJson, FileText, Table, FileCode, Globe, Shield } from 'lucide-react';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import SectionTabBar from '@/components/dashboard/SectionTabBar';
import { FileText as FileTextIcon, Cpu, Package } from 'lucide-react';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import type { AssetResultResponse } from '@/lib/api';

const cbomTabs = [
  { id: 'overview', label: 'Overview', icon: FileTextIcon, route: '/dashboard/cbom' },
  { id: 'per-asset', label: 'Per-Asset', icon: Cpu, route: '/dashboard/cbom/per-asset' },
  { id: 'export', label: 'Export Center', icon: Package, route: '/dashboard/cbom/export' },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const extractCbomDocument = (assetResult: AssetResultResponse) => {
  if (!isRecord(assetResult.cbom)) return null;
  const cbomJson = isRecord(assetResult.cbom.cbom_json) ? assetResult.cbom.cbom_json : null;
  if (!cbomJson) return null;

  return {
    assetId: assetResult.asset_id,
    hostname: assetResult.hostname ?? assetResult.ip_address ?? assetResult.asset_id,
    serialNumber: typeof assetResult.cbom.serial_number === 'string' ? assetResult.cbom.serial_number : null,
    createdAt: typeof assetResult.cbom.created_at === 'string' ? assetResult.cbom.created_at : null,
    cbomJson,
  };
};

const downloadText = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const toCsv = (rows: Array<Record<string, string | number>>) => {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escapeCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header] ?? '')).join(',')),
  ].join('\n');
};

const formats = [
  { key: 'json', icon: FileJson, title: 'CycloneDX 1.6 JSON', desc: 'Export the current scan CBOM payloads exactly as persisted by the backend.', ext: '.json' },
  { key: 'xml', icon: FileCode, title: 'CycloneDX XML', desc: 'XML export needs a backend transformer so the output stays schema-accurate.', ext: '.xml' },
  { key: 'csv', icon: Table, title: 'CSV Export', desc: 'Flat current-scan inventory export for spreadsheet analysis.', ext: '.csv' },
  { key: 'pdf', icon: FileText, title: 'PDF Report', desc: 'Executive PDF generation needs a backend report/export pipeline.', ext: '.pdf' },
  { key: 'html', icon: Globe, title: 'HTML Report', desc: 'Shareable HTML export needs a backend renderer or packaging flow.', ext: '.html' },
  { key: 'cdxa', icon: Shield, title: 'CDXA Attestation Document', desc: 'Attestation export needs signed hash metadata and a backend packaging step.', ext: '.cdxa' },
] as const;

const CBOMExport = () => {
  const { selectedAssets, selectedAssetResults, selectedScanId, selectedScanResults } = useSelectedScan();

  const cbomDocuments = useMemo(
    () => selectedAssetResults.map(extractCbomDocument).filter((document): document is NonNullable<ReturnType<typeof extractCbomDocument>> => document !== null),
    [selectedAssetResults],
  );

  const canExportJson = cbomDocuments.length > 0;
  const canExportCsv = selectedAssets.length > 0;

  const handleExportJson = () => {
    if (!canExportJson) return;

    if (cbomDocuments.length === 1) {
      downloadText(
        `aegis-cbom-${cbomDocuments[0].hostname.replace(/[^a-z0-9.-]+/gi, '-')}.json`,
        JSON.stringify(cbomDocuments[0].cbomJson, null, 2),
        'application/json',
      );
      return;
    }

    downloadText(
      `aegis-cbom-bundle-${selectedScanId}.json`,
      JSON.stringify({
        scan_id: selectedScanId,
        target: selectedScanResults?.target ?? null,
        exported_at: new Date().toISOString(),
        documents: cbomDocuments.map((document) => ({
          asset_id: document.assetId,
          hostname: document.hostname,
          serial_number: document.serialNumber,
          created_at: document.createdAt,
          cbom_json: document.cbomJson,
        })),
      }, null, 2),
      'application/json',
    );
  };

  const handleExportCsv = () => {
    if (!canExportCsv) return;

    const rows = selectedAssets.map((asset) => ({
      asset: asset.domain,
      ip_address: asset.ip,
      tls: asset.tls,
      cipher_suite: asset.cipher,
      key_exchange: asset.keyExchange,
      certificate_algorithm: asset.certInfo.signature_algorithm,
      certificate_authority: asset.certInfo.certificate_authority,
      q_score: asset.qScore,
      status: asset.status,
    }));

    downloadText(
      `aegis-cbom-inventory-${selectedScanId}.csv`,
      toCsv(rows),
      'text/csv;charset=utf-8',
    );
  };

  return (
    <div className="space-y-5">
      <DataContextBadge />
      <h1 className="font-display text-2xl italic text-brand-primary">CBOM Export Center</h1>
      <SectionTabBar tabs={cbomTabs} />

      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-sm font-body">Current Export Scope</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground font-body">
            Current selection contains {cbomDocuments.length} persisted CBOM document{cbomDocuments.length !== 1 ? 's' : ''} across {selectedAssets.length} asset{selectedAssets.length !== 1 ? 's' : ''}.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {formats.map((format) => {
          const isEnabled = format.key === 'json' ? canExportJson : format.key === 'csv' ? canExportCsv : false;
          const action = format.key === 'json' ? handleExportJson : format.key === 'csv' ? handleExportCsv : undefined;

          return (
            <Card key={format.title} className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)] hover:shadow-lg transition-shadow group">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-[hsl(var(--bg-sunken))] group-hover:bg-brand-primary/10 transition-colors">
                    <format.icon className="w-5 h-5 text-brand-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-body font-semibold">{format.title}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{format.desc}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">{isEnabled ? 'Available from current data' : 'Requires backend export support'}</p>
                    <Button size="sm" className="mt-3 h-7 text-xs" disabled={!isEnabled} onClick={action}>
                      {isEnabled ? `Generate ${format.ext}` : 'Not Available Yet'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="shadow-sm">
        <CardHeader><CardTitle className="text-sm font-body">Scheduled Exports</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground font-body">Configure recurring CBOM exports to email or storage. <a href="/dashboard/reporting/scheduled" className="text-brand-primary hover:underline">No scheduled exports configured yet - set one up -&gt;</a></p>
          <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => window.location.href = '/dashboard/reporting/scheduled'}>Configure Schedule</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CBOMExport;
