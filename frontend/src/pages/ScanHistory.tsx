import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GitCompareArrows, Plus, LayoutDashboard } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import * as demoData from '@/data/demoData';
import { useScanContext } from '@/contexts/ScanContext';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import { api } from '@/lib/api';
import { adaptScanHistory } from '@/lib/adapters';

const ScanHistory = () => {
  const navigate = useNavigate();
  const { rootDomain } = useScanContext();
  const { setSelectedScanId } = useSelectedScan();
  const [scanA, setScanA] = useState('');
  const [scanB, setScanB] = useState('');
  const [showCompare, setShowCompare] = useState(false);

  const { data: liveScanHistory, isLoading } = useQuery({
    queryKey: ['scan-history'],
    queryFn: async () => adaptScanHistory(await api.getScanHistory()),
  });

  const scanHistory = useMemo(() => {
    if (liveScanHistory && liveScanHistory.length > 0) return liveScanHistory;
    return demoData.scanHistory;
  }, [liveScanHistory]);

  useEffect(() => {
    if (scanHistory.length === 0) {
      setScanA('');
      setScanB('');
      return;
    }

    if (!scanHistory.some((scan) => scan.id === scanA)) {
      setScanA(scanHistory[0]?.id ?? '');
    }

    if (!scanHistory.some((scan) => scan.id === scanB)) {
      setScanB(scanHistory[1]?.id ?? scanHistory[0]?.id ?? '');
    }
  }, [scanA, scanB, scanHistory]);

  const trendData = [...scanHistory].reverse().map(s => ({
    date: s.started.split(',')[0],
    score: s.qScore,
  }));

  const a = scanHistory.find(s => s.id === scanA);
  const b = scanHistory.find(s => s.id === scanB);

  const openInDashboard = (scanId: string) => {
    setSelectedScanId(scanId);
    navigate('/dashboard', { state: { bypassPrompt: true } });
  };

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="font-display text-2xl italic text-brand-primary">Scan History</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">Loading scan history...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl italic text-brand-primary">Scan History</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">All past scans for {rootDomain || 'target'} infrastructure. Click any row to view in Dashboard.</p>
        </div>
        <Button onClick={() => navigate('/dashboard/scan-console')} className="gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" /> Run New Scan
        </Button>
      </div>

      {/* Scan Table */}
      <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
        <CardContent className="p-0">
          <div className="max-h-[34rem] overflow-y-auto overflow-x-auto">
            <table className="w-full text-xs font-body">
              <thead><tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Scan ID</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Target Domain</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Started</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Duration</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Assets</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Q-Score</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Critical</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {scanHistory.map((s, i) => (
                  <tr
                    key={s.id}
                    className={`border-b border-border/50 hover:bg-[hsl(var(--bg-sunken))] cursor-pointer ${i % 2 === 0 ? 'bg-[hsl(var(--bg-sunken)/0.3)]' : ''}`}
                    onClick={() => openInDashboard(s.id)}
                  >
                    <td className="px-3 py-2 font-mono font-semibold text-brand-primary">{s.id}</td>
                    <td className="px-3 py-2 font-mono">{s.target}</td>
                    <td className="px-3 py-2 text-muted-foreground">{s.started}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{s.duration}</td>
                    <td className="px-3 py-2 font-mono">{s.assetsFound}</td>
                    <td className="px-3 py-2 font-mono font-bold">{s.qScore}</td>
                    <td className="px-3 py-2"><Badge variant="destructive" className="text-[10px]">{s.criticalFindings}</Badge></td>
                    <td className="px-3 py-2"><Badge className="bg-[hsl(var(--status-safe))] text-white text-[10px]">{s.status}</Badge></td>
                    <td className="px-3 py-2 flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Open in Dashboard" onClick={() => openInDashboard(s.id)}><LayoutDashboard className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setScanA(s.id); setShowCompare(true); }}><GitCompareArrows className="w-3.5 h-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Score Trend */}
      <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Enterprise Q-Score Trend</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border-default))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 1000]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <ReferenceLine y={400} stroke="hsl(var(--accent-amber))" strokeDasharray="5 5" label={{ value: 'Standard Tier', position: 'right', fontSize: 9, fill: 'hsl(var(--accent-amber))' }} />
              <ReferenceLine y={700} stroke="hsl(var(--status-safe))" strokeDasharray="5 5" label={{ value: 'Elite-PQC', position: 'right', fontSize: 9, fill: 'hsl(var(--status-safe))' }} />
              <Line type="monotone" dataKey="score" stroke="hsl(var(--brand-primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--brand-primary))', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Compare Two Scans */}
      <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Compare Two Scans</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <Select value={scanA} onValueChange={setScanA}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{scanHistory.map(s => <SelectItem key={s.id} value={s.id}>{s.id}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-muted-foreground text-xs">vs</span>
            <Select value={scanB} onValueChange={setScanB}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{scanHistory.map(s => <SelectItem key={s.id} value={s.id}>{s.id}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" className="h-8 text-xs" onClick={() => setShowCompare(true)}>Compare</Button>
          </div>

          {showCompare && a && b && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-mono text-[10px] text-muted-foreground uppercase">{a.id} ({a.started})</h4>
                <div className="space-y-2 text-xs font-body">
                  <div className="flex justify-between"><span className="text-muted-foreground">Q-Score</span><span className="font-mono font-bold">{a.qScore}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Assets</span><span className="font-mono">{a.assetsFound}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Critical Findings</span><span className="font-mono">{a.criticalFindings}</span></div>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-mono text-[10px] text-muted-foreground uppercase">{b.id} ({b.started})</h4>
                <div className="space-y-2 text-xs font-body">
                  <div className="flex justify-between"><span className="text-muted-foreground">Q-Score</span><span className="font-mono font-bold">{b.qScore}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Assets</span><span className="font-mono">{b.assetsFound}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Critical Findings</span><span className="font-mono">{b.criticalFindings}</span></div>
                </div>
              </div>
              <div className="md:col-span-2 border-t border-border pt-3 space-y-2">
                <h4 className="font-mono text-[10px] text-muted-foreground uppercase">DELTA</h4>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {(() => {
                    const scoreDiff = a.qScore - b.qScore;
                    const assetDiff = a.assetsFound - b.assetsFound;
                    const critDiff = a.criticalFindings - b.criticalFindings;
                    return (
                      <>
                        <div className="p-2 rounded-lg bg-[hsl(var(--bg-sunken))]">
                          <p className="text-muted-foreground font-body">Q-Score</p>
                          <p className={`font-mono font-bold ${scoreDiff > 0 ? 'text-[hsl(var(--status-safe))]' : 'text-[hsl(var(--status-critical))]'}`}>{scoreDiff > 0 ? '+' : ''}{scoreDiff}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-[hsl(var(--bg-sunken))]">
                          <p className="text-muted-foreground font-body">Assets</p>
                          <p className="font-mono font-bold">{assetDiff > 0 ? '+' : ''}{assetDiff}</p>
                        </div>
                        <div className="p-2 rounded-lg bg-[hsl(var(--bg-sunken))]">
                          <p className="text-muted-foreground font-body">Critical</p>
                          <p className={`font-mono font-bold ${critDiff < 0 ? 'text-[hsl(var(--status-safe))]' : 'text-[hsl(var(--status-critical))]'}`}>{critDiff > 0 ? '+' : ''}{critDiff}</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div className="p-2.5 rounded-lg bg-[hsl(var(--status-critical)/0.05)] border border-[hsl(var(--status-critical)/0.15)]">
                    <p className="font-mono text-[10px] text-[hsl(var(--status-critical))] uppercase mb-1">New Vulnerabilities</p>
                    <p className="text-xs font-body text-foreground">TLS 1.0 re-enabled on staging.pnb.co.in (regression)</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[hsl(var(--status-safe)/0.05)] border border-[hsl(var(--status-safe)/0.15)]">
                    <p className="font-mono text-[10px] text-[hsl(var(--status-safe))] uppercase mb-1">Resolved</p>
                    <p className="text-xs font-body text-foreground">Certificate renewed on auth.pnb.co.in</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ScanHistory;
