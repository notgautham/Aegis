import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import KPIStrip from '@/components/dashboard/KPIStrip';
import NetworkGraph from '@/components/dashboard/NetworkGraph';
import CyberRating from '@/components/dashboard/CyberRating';
import AssetTable from '@/components/dashboard/AssetTable';
import QScoreOverview from '@/components/dashboard/QScoreOverview';
import IntelligencePanel from '@/components/dashboard/IntelligencePanel';
import CertExpiryTimeline from '@/components/dashboard/CertExpiryTimeline';
import AssetRiskDistribution from '@/components/dashboard/AssetRiskDistribution';
import CryptoSecurityOverview from '@/components/dashboard/CryptoSecurityOverview';
import RecentActivityFeed from '@/components/dashboard/RecentActivityFeed';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import SinceLastScanStrip from '@/components/dashboard/SinceLastScanStrip';
import ViewRoleToggle from '@/components/dashboard/ViewRoleToggle';
import CompliancePackageModal from '@/components/dashboard/CompliancePackageModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, FileText, AlertTriangle, Wrench, CheckCircle2, FileBarChart } from 'lucide-react';
import { assets, scanHistory, scanAssetMap, getStatusColor, getStatusLabel, getQScoreColor } from '@/data/demoData';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

type ViewRole = 'executive' | 'analyst' | 'compliance';

const COLORS = ['hsl(var(--brand-primary))', 'hsl(var(--accent-amber))', 'hsl(var(--status-safe))', 'hsl(var(--status-critical))', 'hsl(210,70%,50%)'];

const DashboardHome = () => {
  const navigate = useNavigate();
  const [activeRole, setActiveRole] = useState<ViewRole>('analyst');
  const [complianceModalOpen, setComplianceModalOpen] = useState(false);
  const isExec = activeRole === 'executive';
  const { selectedScanId, selectedScan, selectedAssets } = useSelectedScan();

  // Scan detail data
  const scanAssets = selectedAssets;
  const prevScan = scanHistory.find(s => s.target === selectedScan?.target && scanHistory.indexOf(s) > scanHistory.indexOf(selectedScan!));
  const prevAssetIds = prevScan ? (scanAssetMap[prevScan.id] || []) : [];
  const allFindings = scanAssets.flatMap(a => a.remediation.map(r => ({ ...r, assetDomain: a.domain, assetId: a.id })));
  const newAssets = scanAssets.filter(a => !prevAssetIds.includes(a.id));

  const keyLengthData = scanAssets.reduce((acc, a) => {
    const label = a.certInfo.key_type === 'ML-DSA' ? 'ML-DSA-65' : a.certInfo.key_type === 'ECDSA' ? `EC-${a.certInfo.key_size}` : `RSA-${a.certInfo.key_size}`;
    if (label !== 'RSA-0') acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const cipherData = scanAssets.reduce((acc, a) => {
    if (a.cipher !== '--') acc[a.cipher] = (acc[a.cipher] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <DataContextBadge />
        <ViewRoleToggle activeRole={activeRole} onRoleChange={setActiveRole} />
      </div>

      <KPIStrip execMode={isExec} />
      <SinceLastScanStrip />

      {activeRole === 'analyst' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-5 mb-5">
            <NetworkGraph />
            <CyberRating />
          </div>
          <div className="mb-5">
            <AssetTable />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <QScoreOverview />
            <IntelligencePanel assets={selectedAssets} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <CertExpiryTimeline />
            <AssetRiskDistribution />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
            <CryptoSecurityOverview />
            <RecentActivityFeed />
          </div>

          {/* Scan Detail Section */}
          <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-body">Scan Detail — {selectedScanId}</CardTitle>
              <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => navigate(`/dashboard/scans/${selectedScanId}`)}>
                <FileBarChart className="w-3.5 h-3.5" /> Full Report →
              </Button>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="assets" className="w-full">
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="assets" className="text-xs">Assets ({scanAssets.length})</TabsTrigger>
                  <TabsTrigger value="findings" className="text-xs">Findings ({allFindings.length})</TabsTrigger>
                  <TabsTrigger value="cbom" className="text-xs">CBOM Snapshot</TabsTrigger>
                  <TabsTrigger value="delta" className="text-xs">Delta vs Previous</TabsTrigger>
                </TabsList>

                <TabsContent value="assets">
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
                      {scanAssets.map(a => (
                        <TableRow key={a.id} className="border-border hover:bg-[hsl(var(--bg-sunken))] cursor-pointer" onClick={() => navigate(`/dashboard/assets/${a.domain.replace(/\./g, '-')}`)}>
                          <TableCell className="font-mono text-xs text-brand-primary">{a.domain}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{a.ip}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-[10px]">{a.type}</Badge></TableCell>
                          <TableCell className="font-mono text-xs">{a.tls}</TableCell>
                          <TableCell className="font-mono text-[10px] max-w-[120px] truncate">{a.cipher}</TableCell>
                          <TableCell className="font-mono text-xs">{a.certificate}</TableCell>
                          <TableCell><span className="font-mono text-xs font-bold" style={{ color: getQScoreColor(a.qScore) }}>{a.qScore}</span></TableCell>
                          <TableCell><span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: getStatusColor(a.status), backgroundColor: `${getStatusColor(a.status)}15` }}>{getStatusLabel(a.status)}</span></TableCell>
                          <TableCell className="font-mono text-xs">{a.certInfo.days_remaining > 0 ? `${a.certInfo.days_remaining}d` : 'Expired'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="findings">
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
                      {allFindings.sort((a, b) => a.priority.localeCompare(b.priority)).map((f, i) => (
                        <TableRow key={i} className="border-border">
                          <TableCell>
                            <Badge className={`text-[10px] font-mono ${f.priority === 'P1' ? 'bg-[hsl(var(--status-critical))] text-white animate-pulse' : f.priority === 'P2' ? 'bg-[hsl(var(--status-vuln))] text-white' : 'bg-[hsl(var(--status-warn))] text-white'}`}>
                              {f.priority}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{f.assetDomain}</TableCell>
                          <TableCell className="font-body text-xs max-w-[200px]">
                            <div className="flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-[hsl(var(--status-warn))] flex-shrink-0" />{f.finding}</div>
                          </TableCell>
                          <TableCell className="font-body text-xs max-w-[250px]">{f.action}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" className="text-[10px] h-6" onClick={() => navigate(`/dashboard/remediation/ai-patch?asset=${f.assetDomain.replace(/\./g, '-')}`)}>
                              <Wrench className="w-3 h-3 mr-1" /> Fix This
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="cbom">
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Key Length Distribution</CardTitle></CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                              <Pie data={Object.entries(keyLengthData).map(([k, v]) => ({ name: k, value: v }))} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                                {Object.keys(keyLengthData).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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
                            <BarChart data={Object.entries(cipherData).map(([k, v]) => ({ cipher: k.length > 20 ? k.slice(0, 20) + '…' : k, count: v }))}>
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
                          <p>Timestamp: {selectedScan?.started}</p>
                          <p className="text-[hsl(var(--status-safe))] font-semibold">AEGIS Scan {selectedScanId} · Attested ✓</p>
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
                          <p className="font-mono text-[10px] text-muted-foreground uppercase mb-3">Comparing {selectedScanId} vs {prevScan.id}</p>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="p-3 rounded-lg bg-[hsl(var(--bg-sunken))]">
                              <p className="text-muted-foreground text-xs font-body">Q-Score Change</p>
                              <p className={`font-mono text-xl font-bold ${(selectedScan?.qScore || 0) >= prevScan.qScore ? 'text-[hsl(var(--status-safe))]' : 'text-[hsl(var(--status-critical))]'}`}>
                                {(selectedScan?.qScore || 0) >= prevScan.qScore ? '+' : ''}{(selectedScan?.qScore || 0) - prevScan.qScore}
                              </p>
                            </div>
                            <div className="p-3 rounded-lg bg-[hsl(var(--bg-sunken))]">
                              <p className="text-muted-foreground text-xs font-body">Assets Change</p>
                              <p className="font-mono text-xl font-bold">{(selectedScan?.assetsFound || 0) >= prevScan.assetsFound ? '+' : ''}{(selectedScan?.assetsFound || 0) - prevScan.assetsFound}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-[hsl(var(--bg-sunken))]">
                              <p className="text-muted-foreground text-xs font-body">Critical Δ</p>
                              <p className={`font-mono text-xl font-bold ${(selectedScan?.criticalFindings || 0) <= prevScan.criticalFindings ? 'text-[hsl(var(--status-safe))]' : 'text-[hsl(var(--status-critical))]'}`}>
                                {(selectedScan?.criticalFindings || 0) - prevScan.criticalFindings > 0 ? '+' : ''}{(selectedScan?.criticalFindings || 0) - prevScan.criticalFindings}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <Card>
                          <CardHeader className="pb-2"><CardTitle className="text-sm font-body text-[hsl(var(--status-safe))]">Assets Added</CardTitle></CardHeader>
                          <CardContent>
                            {newAssets.length > 0 ? newAssets.map(a => (
                              <div key={a.id} className="flex items-center gap-2 py-1.5 text-xs font-mono">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--status-safe))]" />
                                {a.domain}
                              </div>
                            )) : <p className="text-xs text-muted-foreground font-body">No new assets</p>}
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2"><CardTitle className="text-sm font-body text-[hsl(var(--status-critical))]">New Findings</CardTitle></CardHeader>
                          <CardContent>
                            <div className="flex items-center gap-2 py-1.5 text-xs font-body">
                              <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--status-critical))]" />
                              TLS 1.0 re-enabled on staging.pnb.co.in
                            </div>
                            <div className="flex items-center gap-2 py-1.5 text-xs font-body">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--status-safe))]" />
                              Certificate renewed on auth.pnb.co.in (resolved)
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="p-10 text-center">
                        <p className="text-sm text-muted-foreground font-body">No previous scan of {selectedScan?.target} to compare against.</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}

      {activeRole === 'executive' && (
        <div data-role="executive">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5 mb-5">
            <CyberRating execMode />
            <CertExpiryTimeline />
          </div>
          <RecentActivityFeed execMode />
        </div>
      )}

      {activeRole === 'compliance' && (
        <>
          <Card className="mb-5">
            <CardContent className="p-0">
              <table className="w-full text-xs font-body">
                <thead>
                  <tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Asset</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">PQC Status</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Certificate Validity</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">TLS Version</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map(a => (
                    <tr key={a.id} className="border-b border-border/50">
                      <td className="px-3 py-2 font-mono">{a.domain}</td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: getStatusColor(a.status), backgroundColor: `${getStatusColor(a.status)}15` }}>
                          {getStatusLabel(a.status)}
                        </span>
                        {(a.status === 'elite-pqc') && <Shield className="w-3 h-3 text-[hsl(var(--status-safe))] inline ml-1" />}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        <span className={a.certInfo.days_remaining <= 30 ? 'text-[hsl(var(--status-critical))]' : 'text-muted-foreground'}>
                          {a.certInfo.days_remaining > 0 ? `${a.certInfo.days_remaining}d remaining` : 'Expired'}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono">{a.tls}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="flex justify-center mb-5">
            <Button onClick={() => setComplianceModalOpen(true)} className="gap-1.5 text-sm px-8 py-3">
              <FileText className="w-4 h-4" /> Generate Compliance Evidence Package
            </Button>
          </div>

          <RecentActivityFeed />
          <CompliancePackageModal open={complianceModalOpen} onOpenChange={setComplianceModalOpen} />
        </>
      )}
    </>
  );
};

export default DashboardHome;
