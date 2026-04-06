import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { assets } from '@/data/demoData';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import SectionTabBar from '@/components/dashboard/SectionTabBar';
import IntelligencePanel from '@/components/dashboard/IntelligencePanel';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import { FileText, Lock, BarChart3 } from 'lucide-react';

const pqcTabs = [
  { id: 'compliance', label: 'Compliance', icon: FileText, route: '/dashboard/pqc/compliance' },
  { id: 'hndl', label: 'HNDL Intel', icon: Lock, route: '/dashboard/pqc/hndl' },
  { id: 'quantum-debt', label: 'Quantum Debt', icon: BarChart3, route: '/dashboard/pqc/quantum-debt' },
];

const hndlAssets = assets.filter(a => a.hndlBreakYear !== null).sort((a, b) => (a.hndlBreakYear || 0) - (b.hndlBreakYear || 0));

const timelineData = Array.from({ length: 11 }, (_, i) => {
  const year = 2026 + i;
  return {
    year: year.toString(),
    decryptable: hndlAssets.filter(a => (a.hndlBreakYear || 9999) <= year).length,
  };
});

const riskColors: Record<string, string> = {
  critical: 'hsl(var(--status-critical))', high: 'hsl(var(--status-vuln))', medium: 'hsl(var(--accent-amber))', low: 'hsl(var(--status-safe))',
};

const heatmapData = [
  { label: 'PII/Auth', values: [0, 1, 2, 3] },
  { label: 'Financial', values: [0, 1, 3, 2] },
  { label: 'Internal', values: [2, 3, 1, 0] },
  { label: 'Public', values: [3, 2, 0, 0] },
];
const heatmapCols = ['Low Risk', 'Medium Risk', 'High Risk', 'Critical'];

const cellColor = (val: number) => {
  if (val === 0) return 'bg-[hsl(var(--bg-sunken))]';
  if (val === 1) return 'bg-[hsl(var(--status-critical)/0.15)]';
  if (val === 2) return 'bg-[hsl(var(--status-critical)/0.3)]';
  return 'bg-[hsl(var(--status-critical)/0.5)]';
};

const cellTooltip = (sensitivity: string, vulnerability: string, count: number) => {
  if (count === 0) return 'No assets at this intersection';
  return `${count} asset${count > 1 ? 's' : ''}: ${sensitivity} sensitivity + ${vulnerability} — ${vulnerability === 'Critical' ? 'Immediate PQC migration required' : 'Monitor and plan migration'}`;
};

const PQCHndl = () => {
  const { selectedAssets } = useSelectedScan();
  return (
  <div className="space-y-5">
    <DataContextBadge />
    <h1 className="font-display text-2xl italic text-brand-primary">HNDL Intelligence</h1>
    <SectionTabBar tabs={pqcTabs} />
    <p className="text-xs font-body text-muted-foreground italic">
      HNDL exposure analysis: {selectedAssets.filter(a => a.hndlBreakYear && a.hndlBreakYear <= 2033).length} assets estimated decryptable before 2033 based on IBM/Google quantum computing roadmaps.
    </p>
    <IntelligencePanel assets={selectedAssets} collapsed />

    <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)] border-l-4 border-l-[hsl(var(--status-critical))]">
      <CardContent className="p-5">
        <h2 className="text-sm font-body font-bold text-foreground">Harvest Now, Decrypt Later (HNDL)</h2>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed font-body">
          Adversaries are archiving your encrypted traffic <strong className="text-foreground">TODAY</strong>. When cryptographically-relevant quantum computers arrive, all intercepted data encrypted with classical algorithms becomes readable.
        </p>
        <div className="flex gap-6 mt-4 text-[10px] font-mono">
          <div><span className="text-muted-foreground">IBM Target:</span> <span className="text-foreground font-semibold">100K qubits by 2029</span></div>
          <div><span className="text-muted-foreground">Google Target:</span> <span className="text-foreground font-semibold">Fault-tolerant CRQC by 2030</span></div>
          <div><span className="text-muted-foreground">CRQC Threshold:</span> <span className="text-[hsl(var(--status-critical))] font-semibold">~1M qubits (2031-2035)</span></div>
        </div>
      </CardContent>
    </Card>

    <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-body">HNDL Timeline — Assets Becoming Decryptable</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={timelineData}>
            <defs><linearGradient id="decryptGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--status-critical))" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(var(--status-critical))" stopOpacity={0} /></linearGradient></defs>
            <XAxis dataKey="year" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <RechartsTooltip />
            <ReferenceLine x="2031" stroke="hsl(var(--status-critical))" strokeDasharray="3 3" label={{ value: 'RSA-2048 break', position: 'top', fontSize: 9, fill: 'hsl(var(--status-critical))' }} />
            <Area type="monotone" dataKey="decryptable" stroke="hsl(var(--status-critical))" fill="url(#decryptGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>

    <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-body">HNDL Risk by Asset</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-body">
            <thead><tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Asset</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Algorithm</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Key Size</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Break Year</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Sensitivity</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">HNDL Risk</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Days Until Risk</th>
            </tr></thead>
            <tbody>
              {hndlAssets.map((a, i) => {
                const daysUntil = a.hndlBreakYear ? Math.round((new Date(`${a.hndlBreakYear}-01-01`).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                return (
                  <tr key={a.id} className={cn("border-b border-border/50 hover:bg-[hsl(var(--bg-sunken))]", i % 2 === 0 && "bg-[hsl(var(--bg-sunken)/0.3)]")}>
                    <td className="px-3 py-2 font-mono font-medium">{a.domain}</td>
                    <td className="px-3 py-2 font-mono">{a.certInfo.key_type}</td>
                    <td className="px-3 py-2 font-mono">{a.certInfo.key_size || 'PQC'}</td>
                    <td className="px-3 py-2 font-mono font-semibold">~{a.hndlBreakYear}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{a.businessCriticality.replace('_', ' ')}</Badge></td>
                    <td className="px-3 py-2"><span className="font-mono font-semibold text-[10px] px-1.5 py-0.5 rounded" style={{ color: riskColors[a.hndlRiskLevel], backgroundColor: `${riskColors[a.hndlRiskLevel]}15` }}>{a.hndlRiskLevel.toUpperCase()}</span></td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{daysUntil !== null && daysUntil > 0 ? `${daysUntil.toLocaleString()}d` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-body">HNDL Exposure by Sensitivity × Vulnerability</CardTitle>
        <p className="text-xs text-muted-foreground font-body">Cell color intensity represents the number of assets at each intersection.</p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="text-xs font-body">
            <thead><tr>
              <th className="px-3 py-2 w-24"></th>
              {heatmapCols.map(c => <th key={c} className="px-3 py-2 text-center font-medium text-muted-foreground">{c}</th>)}
            </tr></thead>
            <tbody>
              {heatmapData.map((row) => (
                <tr key={row.label}>
                  <td className="px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{row.label}</td>
                  {row.values.map((val, ci) => (
                    <td key={ci} className="px-1.5 py-1.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={cn("w-16 h-12 rounded-lg flex items-center justify-center font-mono font-bold cursor-default", cellColor(val))}>
                            {val}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs font-body">{cellTooltip(row.label, heatmapCols[ci], val)}</TooltipContent>
                      </Tooltip>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <Card className="shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Qubit Roadmap Sources</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-3 rounded-lg bg-[hsl(var(--bg-sunken))]">
          <p className="text-xs font-body font-semibold">IBM Quantum</p>
          <p className="text-[10px] text-muted-foreground mt-1 font-body">Eagle (127q) → Heron (133q) → Condor (1121q) → Target: 100K qubits by 2029</p>
        </div>
        <div className="p-3 rounded-lg bg-[hsl(var(--bg-sunken))]">
          <p className="text-xs font-body font-semibold">Google Quantum AI</p>
          <p className="text-[10px] text-muted-foreground mt-1 font-body">Sycamore → Willow → Target: Fault-tolerant CRQC by 2030</p>
        </div>
      </CardContent>
    </Card>
  </div>
  );
};

export default PQCHndl;