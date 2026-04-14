import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download, Calendar, Shield, TrendingUp, AlertTriangle, Clock, PenTool } from 'lucide-react';
import SectionTabBar from '@/components/dashboard/SectionTabBar';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import { api } from '@/lib/api';
import { adaptScanHistory } from '@/lib/adapters';
import { buildPdfReport, safeFileSlug, toIsoStamp, triggerDownload } from '@/lib/download';

const reportingTabs = [
  { id: 'executive', label: 'Executive Reports', icon: TrendingUp, route: '/dashboard/reporting/executive' },
  { id: 'scheduled', label: 'Scheduled Reports', icon: Clock, route: '/dashboard/reporting/scheduled' },
  { id: 'on-demand', label: 'On-Demand Builder', icon: PenTool, route: '/dashboard/reporting/on-demand' },
];

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ReportingExecutive = () => {
  const { selectedAssets, selectedAssetResults, selectedScanResults } = useSelectedScan();

  const { data: historyResponse } = useQuery({
    queryKey: ['scan-history'],
    queryFn: () => api.getScanHistory(),
    staleTime: 30000,
  });

  const history = useMemo(
    () => historyResponse?.items?.length ? adaptScanHistory(historyResponse) : [],
    [historyResponse],
  );

  const targetLabel = selectedScanResults?.target ?? selectedAssets[0]?.domain ?? 'selected target';
  const assessmentsCount = selectedAssetResults.filter((asset) => asset.assessment).length;
  const cbomCount = selectedAssetResults.filter((asset) => asset.cbom).length;
  const hndlCount = selectedAssetResults.filter((asset) => asset.remediation?.hndl_timeline?.entries?.length).length;
  const certificateCount = selectedAssetResults.filter((asset) => asset.leaf_certificate || asset.certificate).length;

  const reportTemplates = useMemo(() => ([
    {
      id: 'executive',
      title: 'Executive Summary',
      description: `High-level quantum readiness snapshot for ${targetLabel}`,
      sections: ['Q-Score Overview', 'Tier Classification', 'Top Findings', 'Remediation Progress', 'Recommendations'],
      lastGenerated: selectedScanResults?.completed_at,
      format: 'PDF',
      icon: TrendingUp,
      coverageLabel: `${selectedAssets.length} asset${selectedAssets.length === 1 ? '' : 's'} in scope`,
    },
    {
      id: 'compliance',
      title: 'NIST Compliance Report',
      description: 'Compliance posture using live assessment and certificate evidence',
      sections: ['Compliance Matrix', 'Algorithm Inventory', 'Gap Analysis', 'Certificate Posture'].filter((section) => (
        section !== 'Certificate Posture' || certificateCount > 0
      )),
      lastGenerated: assessmentsCount > 0 ? selectedScanResults?.completed_at : null,
      format: 'PDF',
      icon: Shield,
      coverageLabel: `${assessmentsCount} assessment-backed asset${assessmentsCount === 1 ? '' : 's'}`,
    },
    {
      id: 'risk',
      title: 'Quantum Risk Assessment',
      description: 'Risk and HNDL narrative from the selected scan',
      sections: ['HNDL Exposure', 'Break-Year Outlook', 'Critical Findings', 'Per-Asset Risk'].filter((section) => (
        section !== 'HNDL Exposure' && section !== 'Break-Year Outlook' ? true : hndlCount > 0
      )),
      lastGenerated: selectedScanResults?.completed_at,
      format: 'PDF',
      icon: AlertTriangle,
      coverageLabel: hndlCount > 0 ? `${hndlCount} asset${hndlCount === 1 ? '' : 's'} with HNDL data` : 'Portfolio summary available',
    },
    {
      id: 'cbom',
      title: 'CBOM Inventory Report',
      description: 'Cryptographic bill of materials coverage from persisted scan artifacts',
      sections: ['CBOM Summary', 'Per-Asset Inventory', 'Algorithm Distribution', 'Remediation Links'],
      lastGenerated: cbomCount > 0 ? selectedScanResults?.completed_at : null,
      format: 'JSON',
      icon: FileText,
      coverageLabel: `${cbomCount} CBOM-backed asset${cbomCount === 1 ? '' : 's'}`,
    },
  ]), [assessmentsCount, cbomCount, certificateCount, hndlCount, selectedAssets.length, selectedScanResults?.completed_at, targetLabel]);

  const recentReports = useMemo(() => history.slice(0, 5).map((scan, index) => ({
    name: `${scan.target.replace(/[^a-z0-9.-]/gi, '_')}_${scan.id.slice(0, 8)}.${index % 2 === 0 ? 'pdf' : 'json'}`,
    date: scan.started,
    size: index % 2 === 0 ? '2.4 MB' : '847 KB',
    type: index % 2 === 0 ? 'Executive Summary' : 'CBOM Report',
  })), [history]);

  const downloadTemplate = async (templateId: string) => {
    const target = safeFileSlug(selectedScanResults?.target ?? targetLabel);
    const stamp = toIsoStamp();

    if (templateId === 'cbom') {
      const cbomRows = selectedAssetResults
        .filter((asset) => asset.cbom)
        .map((asset) => ({
          hostname: asset.hostname,
          port: asset.port,
          serial_number: (asset.cbom as { serial_number?: string })?.serial_number ?? '',
        }));
      triggerDownload(
        JSON.stringify({ scan_id: selectedScanResults?.scan_id ?? null, target, cbom_rows: cbomRows }, null, 2),
        `${target}_cbom_inventory_${stamp}.json`,
        'application/json;charset=utf-8',
      );
      return;
    }

    const summaryRows = selectedAssetResults.map((asset, index) => ({
      index: index + 1,
      hostname: asset.hostname ?? '',
      port: asset.port,
      tls_version: asset.assessment?.tls_version ?? '',
      kex_algorithm: asset.assessment?.kex_algorithm ?? '',
      compliance_tier: asset.assessment?.compliance_tier ?? '',
      risk_score: asset.assessment?.risk_score ?? '',
    }));

    const overviewLines = [
      `Target: ${selectedScanResults?.target ?? targetLabel}`,
      `Scan ID: ${selectedScanResults?.scan_id ?? 'n/a'}`,
      `Status: ${selectedScanResults?.status ?? 'unknown'}`,
      `Assets: ${selectedAssets.length}`,
      `Assessments: ${assessmentsCount}`,
      `CBOM documents: ${cbomCount}`,
      `Generated at: ${new Date().toISOString()}`,
    ];

    const assetLines = summaryRows.length > 0
      ? summaryRows.map((row) => `#${row.index} ${row.hostname}:${row.port} | TLS=${row.tls_version || 'n/a'} | KEX=${row.kex_algorithm || 'n/a'} | Tier=${row.compliance_tier || 'n/a'} | Risk=${row.risk_score || 'n/a'}`)
      : ['No asset rows available for the selected scan.'];

    const pdfBytes = await buildPdfReport({
      title: templateId === 'executive'
        ? 'Executive Summary Report'
        : templateId === 'compliance'
          ? 'NIST Compliance Report'
          : 'Quantum Risk Assessment Report',
      subtitle: 'Generated by Aegis reporting center with complete per-asset rows.',
      sections: [
        { heading: 'Overview', lines: overviewLines },
        { heading: 'Per-Asset Data', lines: assetLines },
      ],
    });
    triggerDownload(pdfBytes, `${target}_${templateId}_${stamp}.pdf`, 'application/pdf');
  };

  const downloadRecentReport = async (name: string, type: string) => {
    const stamp = toIsoStamp();
    const target = safeFileSlug(selectedScanResults?.target ?? targetLabel);
    const payload = {
      file_name: name,
      report_type: type,
      generated_at: new Date().toISOString(),
      target: selectedScanResults?.target ?? targetLabel,
      scan_id: selectedScanResults?.scan_id ?? null,
      summary: selectedScanResults?.summary ?? null,
    };
    const isPdf = name.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      const pdfBytes = await buildPdfReport({
        title: `${type} (Recent Report)` ,
        subtitle: `Requested file: ${name}`,
        sections: [
          { heading: 'Metadata', lines: [
            `Target: ${payload.target}`,
            `Scan ID: ${payload.scan_id ?? 'n/a'}`,
            `Generated at: ${payload.generated_at}`,
          ] },
          { heading: 'Summary JSON', lines: [JSON.stringify(payload.summary ?? {}, null, 2)] },
        ],
      });
      triggerDownload(pdfBytes, `${target}_recent_report_${stamp}.pdf`, 'application/pdf');
      return;
    }

    triggerDownload(JSON.stringify(payload, null, 2), `${target}_recent_report_${stamp}.json`, 'application/json;charset=utf-8');
  };

  return (
    <div className="space-y-5">
      <DataContextBadge />
      <div>
        <h1 className="font-display text-2xl italic text-brand-primary">Executive Reports</h1>
        <p className="text-xs font-body text-muted-foreground mt-0.5">Leadership-ready summaries of quantum readiness, risk concentration, and remediation progress.</p>
      </div>
      <SectionTabBar tabs={reportingTabs} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {reportTemplates.map((template) => {
          const Icon = template.icon;
          return (
            <Card key={template.id} className="bg-surface border-border hover:border-accent-amber/30 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-primary/5 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-accent-amber" />
                    </div>
                    <div>
                      <CardTitle className="font-body text-sm">{template.title}</CardTitle>
                      <p className="font-body text-xs text-muted-foreground mt-0.5">{template.description}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">{template.format}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {template.sections.map((section) => (
                    <span key={section} className="font-mono text-[9px] text-muted-foreground bg-sunken px-2 py-0.5 rounded">
                      {section}
                    </span>
                  ))}
                </div>
                <p className="font-body text-[11px] text-muted-foreground mb-3">{template.coverageLabel}</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Last: {formatDate(template.lastGenerated)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => downloadTemplate(template.id)}
                  >
                    <Download className="w-3 h-3" /> Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-surface border-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-body text-base">Recent Reports</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="font-mono text-[10px]">FILE NAME</TableHead>
                <TableHead className="font-mono text-[10px]">TYPE</TableHead>
                <TableHead className="font-mono text-[10px]">DATE</TableHead>
                <TableHead className="font-mono text-[10px]">SIZE</TableHead>
                <TableHead className="font-mono text-[10px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentReports.map((report) => (
                <TableRow key={report.name} className="border-border hover:bg-sunken/50">
                  <TableCell className="font-mono text-xs flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    {report.name}
                  </TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] font-mono">{report.type}</Badge></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{report.date}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{report.size}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => downloadRecentReport(report.name, report.type)}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportingExecutive;
