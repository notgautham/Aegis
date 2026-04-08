import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronRight, Download, GitCompareArrows, Shield, AlertTriangle, Wrench, CheckCircle2, Info } from 'lucide-react';
import { scanHistory as demoScanHistory, assets as demoAssets, scanAssetMap, getStatusColor, getStatusLabel, getQScoreColor, type Asset, type ScanHistoryEntry } from '@/data/demoData';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import { api } from '@/lib/api';
import { adaptScanHistory, adaptScanResults } from '@/lib/adapters';

function isUUID(id: string | undefined): id is string {
  return !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function assetKey(asset: Asset): string {
  return `${asset.domain}|${asset.port}|${asset.type}`;
}

const COLORS = ['hsl(var(--brand-primary))', 'hsl(var(--accent-amber))', 'hsl(var(--status-safe))', 'hsl(var(--status-critical))', 'hsl(210,70%,50%)'];

const ScanReport = () => {
  const { scanId } = useParams();
  const navigate = useNavigate();
  const { setSelectedScanId } = useSelectedScan();

  const { data: liveHistoryResponse } = useQuery({
    queryKey: ['scan-history'],
    queryFn: () => api.getScanHistory(),
    staleTime: 30000,
  });

  const scanHistory = useMemo<ScanHistoryEntry[]>(
    () => liveHistoryResponse?.items?.length ? adaptScanHistory(liveHistoryResponse) : demoScanHistory,
    [liveHistoryResponse],
  );

  const scan = scanHistory.find((item) => item.id === scanId);

  const { data: currentResultsResponse, isLoading: currentResultsLoading } = useQuery({
    queryKey: ['scan-report-results', scanId],
    queryFn: () => api.getScanResults(scanId!),
    enabled: isUUID(scanId),
    staleTime: 30000,
  });

  const currentAssets = useMemo<Asset[]>(
    () => currentResultsResponse ? adaptScanResults(currentResultsResponse) : [],
    [currentResultsResponse],
  );

  const demoCurrentAssets = useMemo(() => {
    if (!scan) return [];
    const assetIds = scanAssetMap[scan.id] || [];
    return demoAssets.filter((asset) => assetIds.includes(asset.id));
  }, [scan]);

  const scanAssets = isUUID(scanId) ? currentAssets : demoCurrentAssets;

  const prevScan = useMemo(() => {
    if (!scan) return undefined;
    const currentIndex = scanHistory.findIndex((item) => item.id === scan.id);
    if (currentIndex < 0) return undefined;
    return scanHistory.find((item, index) => index > currentIndex && item.target === scan.target);
  }, [scan, scanHistory]);

  const { data: prevResultsResponse } = useQuery({
    queryKey: ['scan-report-results', prevScan?.id],
    queryFn: () => api.getScanResults(prevScan!.id),
    enabled: isUUID(prevScan?.id),
    staleTime: 30000,
  });

  const prevAssets = useMemo<Asset[]>(() => {
    if (!prevScan) return [];
    if (isUUID(prevScan.id)) {
      return prevResultsResponse ? adaptScanResults(prevResultsResponse) : [];
    }
    const assetIds = scanAssetMap[prevScan.id] || [];
    return demoAssets.filter((asset) => assetIds.includes(asset.id));
  }, [prevScan, prevResultsResponse]);

  if (isUUID(scanId) && currentResultsLoading && !scan) {
    return (
      <div className="p-10 text-center">
        <h1 className="font-display text-2xl italic text-brand-primary">Loading Scan Report</h1>
        <p className="text-muted-foreground mt-2 font-body text-sm">Fetching the selected scan and its artifacts.</p>
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="p-10 text-center">
        <h1 className="font-display text-2xl italic text-brand-primary">Scan Not Found</h1>
        <p className="text-muted-foreground mt-2 font-body text-sm">No scan matching "{scanId}"</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard/history')}>Back to History</Button>
      </div>
    );
  }

  const criticalFindings = scanAssets.flatMap((asset) => asset.remediation.filter((finding) => finding.priority === 'P1'));
  const allFindings = scanAssets.flatMap((asset) => asset.remediation.map((finding) => ({ ...finding, assetDomain: asset.domain, assetId: asset.id })));
  const pqcReady = scanAssets.filter((asset) => asset.status === 'elite-pqc' || asset.status === 'safe').length;
  const prevAssetKeys = new Set(prevAssets.map(assetKey));
  const newAssets = scanAssets.filter((asset) => !prevAssetKeys.has(assetKey(asset)));

  const statusColor = scan.status === 'Completed' ? 'bg-[hsl(var(--status-safe))]' : scan.status === 'Failed' ? 'bg-[hsl(var(--status-critical))]' : 'bg-[hsl(var(--accent-amber))]';

  const keyLengthData = scanAssets.reduce((acc, asset) => {
    const label = asset.certInfo.key_type === 'ML-DSA' ? 'ML-DSA-65' : asset.certInfo.key_type === 'ECDSA' ? `EC-${asset.certInfo.key_size}` : `RSA-${asset.certInfo.key_size}`;
    if (label !== 'RSA-0') acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const cipherData = scanAssets.reduce((acc, asset) => {
    if (asset.cipher !== '--') acc[asset.cipher] = (acc[asset.cipher] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const newP1Findings = allFindings.filter((finding) => finding.priority === 'P1').slice(0, 2);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center gap-1.5 text-xs font-body text-muted-foreground">
        <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to="/dashboard/history" className="hover:text-foreground">Scan History</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium">{scan.id} - Report</span>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg bg-[hsl(var(--bg-sunken))] border border-border text-xs font-body text-muted-foreground">
        <Info className="w-4 h-4 text-brand-primary flex-shrink-0" />
        <span>This is a formal scan report for download and regulatory reference. To interactively explore this scan, use the <button className="text-brand-primary underline cursor-pointer" onClick={() => { setSelectedScanId(scan.id); navigate('/dashboard', { state: { bypassPrompt: true } }); }}>Dashboard scan selector</button>.</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-mono text-sm">{scan.id}</Badge>
            <Badge className={`${statusColor} text-white text-[10px]`}>{scan.status}</Badge>
          </div>
          <h1 className="font-display text-2xl italic text-brand-primary mt-2">Scan Report - {scan.id}</h1>
          <p className="text-xs font-body text-muted-foreground mt-1">Formal scan report for download and regulatory reference - {scan.started} - Duration: {scan.duration}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => navigate('/dashboard/history')}>Back to Scan History</Button>
          <Button variant="outline" size="sm" className="text-xs gap-1.5"><Download className="w-3.5 h-3.5" /> Download Report</Button>
          <Button variant="outline" size="sm" className="text-xs gap-1.5"><GitCompareArrows className="w-3.5 h-3.5" /> Compare</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Assets Discovered', value: scanAssets.length, color: 'text-foreground' },
          { label: 'New Assets', value: newAssets.length, color: 'text-[hsl(var(--accent-amber))]' },
          { label: 'Critical Findings', value: criticalFindings.length, color: 'text-[hsl(var(--status-critical))]' },
          { label: 'Q-Score', value: scan.qScore, color: 'text-foreground' },
          { label: 'PQC-Ready', value: pqcReady, color: 'text-[hsl(var(--status-safe))]' },
        ].map((card) => (
          <Card key={card.label} className="bg-surface border-border">
            <CardContent className="pt-4 pb-3">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{card.label}</p>
              <p className={`font-body text-2xl font-bold ${card.color} mt-1`}>{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="assets" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="assets" className="text-xs">Assets ({scanAssets.length})</TabsTrigger>
          <TabsTrigger value="findings" className="text-xs">Findings ({allFindings.length})</TabsTrigger>
          <TabsTrigger value="cbom" className="text-xs">CBOM Snapshot</TabsTrigger>
          <TabsTrigger value="delta" className="text-xs">Delta vs Previous</TabsTrigger>
        </TabsList>

        <TabsContent value="assets">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="font-mono text-[10px]">ASSET</TableHead>
                    <TableHead className="font-mono text-[10px]">IP</TableHead>
                    <TableHead className="font-mono text-[10px]">TYPE</TableHead>
                    <TableHead className="font-mono text-[10px]">TLS</TableHead>
                    <TableHead className="font-mono text-[10px]">CIPHER</TableHead>
                    <TableHead className="font-mono text-[10px]">KEY</TableHead>
                    <TableHead className="font-mono text-[10px]">Q-SCORE</TableHead>
                    <TableHead className="font-mono text-[10px]">PQC</TableHead>
                    <TableHead className="font-mono text-[10px]">CERT EXPIRY</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scanAssets.map((asset) => (
                    <TableRow key={asset.id} className="border-border">
                      <TableCell className="font-mono text-xs text-brand-primary">{asset.domain}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{asset.ip}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{asset.type}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{asset.tls}</TableCell>
                      <TableCell className="font-mono text-[10px] max-w-[120px] truncate">{asset.cipher}</TableCell>
                      <TableCell className="font-mono text-xs">{asset.certificate}</TableCell>
                      <TableCell><span className="font-mono text-xs font-bold" style={{ color: getQScoreColor(asset.qScore) }}>{asset.qScore}</span></TableCell>
                      <TableCell><span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: getStatusColor(asset.status), backgroundColor: `${getStatusColor(asset.status)}15` }}>{getStatusLabel(asset.status)}</span></TableCell>
                      <TableCell className="font-mono text-xs">{asset.certInfo.days_remaining > 0 ? `${asset.certInfo.days_remaining}d` : 'Expired'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="findings">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="font-mono text-[10px]">SEVERITY</TableHead>
                    <TableHead className="font-mono text-[10px]">ASSET</TableHead>
                    <TableHead className="font-mono text-[10px]">FINDING</TableHead>
                    <TableHead className="font-mono text-[10px]">RECOMMENDATION</TableHead>
                    <TableHead className="font-mono text-[10px]">ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allFindings.sort((a, b) => a.priority.localeCompare(b.priority)).map((finding, index) => (
                    <TableRow key={index} className="border-border">
                      <TableCell>
                        <Badge className={`text-[10px] font-mono ${finding.priority === 'P1' ? 'bg-[hsl(var(--status-critical))] text-white animate-pulse' : finding.priority === 'P2' ? 'bg-[hsl(var(--status-vuln))] text-white' : 'bg-[hsl(var(--status-warn))] text-white'}`}>
                          {finding.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{finding.assetDomain}</TableCell>
                      <TableCell className="font-body text-xs max-w-[200px]">
                        <div className="flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-[hsl(var(--status-warn))] flex-shrink-0" />{finding.finding}</div>
                      </TableCell>
                      <TableCell className="font-body text-xs max-w-[250px]">{finding.action}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" className="text-[10px] h-6" onClick={() => navigate(`/dashboard/remediation/ai-patch?asset=${finding.assetDomain.replace(/\./g, '-')}`)}>
                          <Wrench className="w-3 h-3 mr-1" /> Fix This
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cbom">
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Key Length Distribution</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={Object.entries(keyLengthData).map(([key, value]) => ({ name: key, value }))} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {Object.keys(keyLengthData).map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Cipher Suite Usage</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={Object.entries(cipherData).map(([key, value]) => ({ cipher: key.length > 20 ? `${key.slice(0, 20)}...` : key, count: value }))}>
                      <XAxis dataKey="cipher" tick={{ fontSize: 8 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--accent-amber))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="border-[hsl(var(--status-safe)/0.3)]">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-5 h-5 text-[hsl(var(--status-safe))]" />
                  <span className="font-body text-sm font-semibold text-[hsl(var(--status-safe))]">CBOM Attestation</span>
                </div>
                <div className="space-y-2 text-xs font-mono text-muted-foreground">
                  <p>CBOM Hash (SHA-256): <span className="text-foreground">a7f3b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1</span></p>
                  <p>Signature: Ed25519 · Valid</p>
                  <p>Timestamp: {scan.started}</p>
                  <p className="text-[hsl(var(--status-safe))] font-semibold">AEGIS Scan {scan.id} · Attested ?</p>
                </div>
                <Button variant="outline" size="sm" className="mt-3 text-xs">Export CycloneDX JSON</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="delta">
          {prevScan ? (
            <div className="space-y-5">
              <Card>
                <CardContent className="p-5">
                  <p className="font-mono text-[10px] text-muted-foreground uppercase mb-3">Comparing {scan.id} vs {prevScan.id}</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg bg-[hsl(var(--bg-sunken))]">
                      <p className="text-muted-foreground text-xs font-body">Q-Score Change</p>
                      <p className={`font-mono text-xl font-bold ${scan.qScore >= prevScan.qScore ? 'text-[hsl(var(--status-safe))]' : 'text-[hsl(var(--status-critical))]'}`}>
                        {scan.qScore >= prevScan.qScore ? '+' : ''}{scan.qScore - prevScan.qScore}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-[hsl(var(--bg-sunken))]">
                      <p className="text-muted-foreground text-xs font-body">Assets Change</p>
                      <p className="font-mono text-xl font-bold">{scan.assetsFound >= prevScan.assetsFound ? '+' : ''}{scan.assetsFound - prevScan.assetsFound}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[hsl(var(--bg-sunken))]">
                      <p className="text-muted-foreground text-xs font-body">Critical Delta</p>
                      <p className={`font-mono text-xl font-bold ${scan.criticalFindings <= prevScan.criticalFindings ? 'text-[hsl(var(--status-safe))]' : 'text-[hsl(var(--status-critical))]'}`}>
                        {scan.criticalFindings - prevScan.criticalFindings > 0 ? '+' : ''}{scan.criticalFindings - prevScan.criticalFindings}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-body text-[hsl(var(--status-safe))]">Assets Added</CardTitle></CardHeader>
                  <CardContent>
                    {newAssets.length > 0 ? newAssets.map((asset) => (
                      <div key={asset.id} className="flex items-center gap-2 py-1.5 text-xs font-mono">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--status-safe))]" />
                        {asset.domain}
                      </div>
                    )) : <p className="text-xs text-muted-foreground font-body">No new assets</p>}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-body text-[hsl(var(--status-critical))]">New Findings</CardTitle></CardHeader>
                  <CardContent>
                    {newP1Findings.length > 0 ? newP1Findings.map((finding, index) => (
                      <div key={`${finding.assetId}-${index}`} className="flex items-center gap-2 py-1.5 text-xs font-body">
                        <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--status-critical))]" />
                        {finding.finding} on {finding.assetDomain}
                      </div>
                    )) : (
                      <div className="flex items-center gap-2 py-1.5 text-xs font-body">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--status-safe))]" />
                        No new P1 findings in this scan.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="p-10 text-center">
                <p className="text-sm text-muted-foreground font-body">No previous scan of {scan.target} to compare against.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default ScanReport;
