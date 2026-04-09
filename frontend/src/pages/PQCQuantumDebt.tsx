import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Slider } from '@/components/ui/slider';
import SectionTabBar from '@/components/dashboard/SectionTabBar';
import { FileText, Lock, BarChart3 } from 'lucide-react';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import { api } from '@/lib/api';
import { adaptScanResults } from '@/lib/adapters';
import type { Asset } from '@/data/demoData';

const pqcTabs = [
  { id: 'compliance', label: 'Compliance', icon: FileText, route: '/dashboard/pqc/compliance' },
  { id: 'hndl', label: 'HNDL Intel', icon: Lock, route: '/dashboard/pqc/hndl' },
  { id: 'quantum-debt', label: 'Quantum Debt', icon: BarChart3, route: '/dashboard/pqc/quantum-debt' },
];

const typeLabels: Record<Asset['type'], string> = {
  web: 'Web Apps',
  api: 'APIs',
  vpn: 'VPNs',
  mail: 'Mail',
  iot: 'IoT',
  server: 'Servers',
  load_balancer: 'Load Balancers',
};

function isUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function assetDebtUnits(asset: Asset): number {
  return Math.max(0, 100 - asset.qScore);
}

function deriveDebtScore(assets: Asset[]): number {
  if (assets.length === 0) return 0;
  const totalDebt = assets.reduce((sum, asset) => sum + assetDebtUnits(asset), 0);
  return Math.round((totalDebt / assets.length) * 10);
}

const PQCQuantumDebt = () => {
  const [migrationPercent, setMigrationPercent] = useState([30]);
  const { selectedAssets, selectedScanId, selectedScanResults } = useSelectedScan();

  const historyQuery = useQuery({
    queryKey: ['scan-history-for-quantum-debt'],
    queryFn: () => api.getScanHistory(),
  });

  const historyItems = [...(historyQuery.data?.items ?? [])].sort((a, b) => (
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ));

  const currentScanIndex = historyItems.findIndex((item) => item.scan_id === selectedScanId);
  const previousScanId = isUUID(selectedScanId) && currentScanIndex >= 0 ? historyItems[currentScanIndex + 1]?.scan_id ?? null : null;

  const previousScanQuery = useQuery({
    queryKey: ['scan-results-for-quantum-debt', previousScanId],
    queryFn: () => api.getScanResults(previousScanId!),
    enabled: Boolean(previousScanId),
  });

  const quantumDebtScore = deriveDebtScore(selectedAssets);
  const previousAssets = previousScanQuery.data ? adaptScanResults(previousScanQuery.data) : [];
  const previousDebtScore = previousAssets.length > 0 ? deriveDebtScore(previousAssets) : quantumDebtScore;

  const monthsBetween = selectedScanResults && previousScanQuery.data
    ? Math.max(1 / 30, (new Date(selectedScanResults.created_at).getTime() - new Date(previousScanQuery.data.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30.4375))
    : 1;
  const monthlyGrowth = previousScanQuery.data ? Math.max(0, Math.round((quantumDebtScore - previousDebtScore) / monthsBetween)) : 0;

  const debtByType = Object.entries(selectedAssets.reduce((acc, asset) => {
    const key = asset.type;
    const current = assetDebtUnits(asset) * 10;
    acc[key] = (acc[key] || 0) + current;
    return acc;
  }, {} as Record<Asset['type'], number>)).map(([type, current]) => ({
    type: typeLabels[type as Asset['type']] ?? type,
    current: Math.round(current),
    projected: Math.max(0, Math.round(current * (1 - (migrationPercent[0] / 100)))),
  })).sort((a, b) => b.current - a.current);

  const reduction = Math.round(quantumDebtScore * (migrationPercent[0] / 100));
  const projectedDebt = Math.max(0, quantumDebtScore - reduction);

  const projectionData = Array.from({ length: 13 }, (_, index) => ({
    month: `M${index}`,
    current: quantumDebtScore + (monthlyGrowth * index),
    migrated: Math.max(0, (quantumDebtScore + (monthlyGrowth * index)) - (reduction * (index / 12))),
  }));

  const migrated = selectedAssets.filter((asset) => asset.status === 'elite-pqc').length;
  const total = selectedAssets.length;
  const migrationProgress = total > 0 ? Math.round((migrated / total) * 100) : 0;

  return (
    <div className="space-y-5">
      <DataContextBadge />
      <h1 className="font-display text-2xl italic text-brand-primary">Quantum Debt Tracker</h1>
      <SectionTabBar tabs={pqcTabs} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)] col-span-1">
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <div className="relative w-36 h-36">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--bg-sunken))" strokeWidth="10" />
                <circle cx="60" cy="60" r="52" fill="none" stroke={quantumDebtScore > 600 ? 'hsl(var(--status-critical))' : quantumDebtScore > 400 ? 'hsl(var(--accent-amber))' : 'hsl(var(--status-safe))'} strokeWidth="10" strokeDasharray={`${(quantumDebtScore / 1000) * 327} 327`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-mono font-bold text-foreground">{quantumDebtScore}</span>
                <span className="text-[10px] text-muted-foreground font-body">/ 1000</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center font-body">
              Growing by ~{monthlyGrowth} units/month based on recent scan-to-scan debt movement
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)] col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Debt by Asset Type</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={debtByType}>
                <XAxis dataKey="type" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="current" name="Current" fill="hsl(var(--status-critical))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="projected" name="12m Projected" fill="hsl(var(--status-critical))" opacity={0.4} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)] col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Migration Progress</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <span className="text-2xl font-mono font-bold text-foreground">{migrated}</span>
              <span className="text-sm text-muted-foreground font-body"> / {total} assets migrated</span>
            </div>
            <div className="w-full h-3 rounded-full bg-[hsl(var(--bg-sunken))] overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${migrationProgress}%`,
                background: 'linear-gradient(90deg, hsl(var(--status-critical)), hsl(var(--accent-amber)), hsl(var(--status-safe)))',
              }} />
            </div>
            <div className="flex justify-between text-[10px] font-body text-muted-foreground">
              <span>0% PQC</span><span>{migrationProgress}% migrated</span><span>100% PQC</span>
            </div>
            <div className="grid grid-cols-4 gap-1 mt-2">
              {['Critical', 'Legacy', 'Standard', 'Elite-PQC'].map((tier, index) => (
                <div key={tier} className="text-center">
                  <div className="h-2 rounded" style={{ backgroundColor: ['hsl(var(--status-critical))', 'hsl(var(--accent-amber))', 'hsl(210, 70%, 50%)', 'hsl(var(--status-safe))'][index] }} />
                  <span className="text-[9px] text-muted-foreground mt-0.5 block">{tier}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Debt Reduction Simulator</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-xs font-body text-muted-foreground whitespace-nowrap">Migrate</span>
            <Slider value={migrationPercent} onValueChange={setMigrationPercent} min={0} max={100} step={5} className="flex-1" />
            <span className="text-sm font-mono font-semibold w-12 text-right">{migrationPercent[0]}%</span>
            <span className="text-xs font-body text-muted-foreground">of assets to PQC</span>
          </div>
          <p className="text-xs font-body">
            Projected debt reduction: <span className="font-mono font-bold text-[hsl(var(--status-safe))]">-{quantumDebtScore > 0 ? Math.round((reduction / quantumDebtScore) * 100) : 0}%</span> (from {quantumDebtScore} to {projectedDebt})
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={projectionData}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="current" name="No Migration" stroke="hsl(var(--status-critical))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="migrated" name="With Migration" stroke="hsl(var(--status-safe))" strokeWidth={2} dot={false} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default PQCQuantumDebt;
