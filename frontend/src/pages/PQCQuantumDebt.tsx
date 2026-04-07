import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import { Slider } from '@/components/ui/slider';
import SectionTabBar from '@/components/dashboard/SectionTabBar';
import { FileText, Lock, BarChart3 } from 'lucide-react';
import { useSelectedScan } from '@/contexts/SelectedScanContext';

const pqcTabs = [
  { id: 'compliance', label: 'Compliance', icon: FileText, route: '/dashboard/pqc/compliance' },
  { id: 'hndl', label: 'HNDL Intel', icon: Lock, route: '/dashboard/pqc/hndl' },
  { id: 'quantum-debt', label: 'Quantum Debt', icon: BarChart3, route: '/dashboard/pqc/quantum-debt' },
];

const quantumDebtScore = 742;
const monthlyGrowth = 42;

const debtByType = [
  { type: 'Web Apps', current: 280, projected: 340 },
  { type: 'APIs', current: 220, projected: 290 },
  { type: 'VPNs', current: 180, projected: 240 },
  { type: 'Mail', current: 62, projected: 85 },
];

const PQCQuantumDebt = () => {
  const [migrationPercent, setMigrationPercent] = useState([30]);
  const { selectedAssets } = useSelectedScan();

  const reduction = Math.round(quantumDebtScore * (migrationPercent[0] / 100));
  const projectedDebt = quantumDebtScore - reduction;

  const projectionData = Array.from({ length: 13 }, (_, i) => ({
    month: `M${i}`,
    current: quantumDebtScore + (monthlyGrowth * i),
    migrated: Math.max(0, (quantumDebtScore + (monthlyGrowth * i)) - (reduction * (i / 12))),
  }));

  const migrated = selectedAssets.filter(a => a.status === 'elite-pqc').length;
  const total = selectedAssets.length;
  const migrationProgress = Math.round((migrated / total) * 100);

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
              Growing by ~{monthlyGrowth} units/month as adversaries archive traffic
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
              {['Critical', 'Legacy', 'Standard', 'Elite-PQC'].map((t, i) => (
                <div key={t} className="text-center">
                  <div className="h-2 rounded" style={{ backgroundColor: ['hsl(var(--status-critical))', 'hsl(var(--accent-amber))', 'hsl(210, 70%, 50%)', 'hsl(var(--status-safe))'][i] }} />
                  <span className="text-[9px] text-muted-foreground mt-0.5 block">{t}</span>
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
            Projected debt reduction: <span className="font-mono font-bold text-[hsl(var(--status-safe))]">-{Math.round((reduction / quantumDebtScore) * 100)}%</span> (from {quantumDebtScore} → {projectedDebt})
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
