import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { assets, getStatusColor, getTierFromAsset } from '@/data/demoData';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import SectionTabBar from '@/components/dashboard/SectionTabBar';
import { FileText, Lock, BarChart3 } from 'lucide-react';

const pqcTabs = [
  { id: 'compliance', label: 'Compliance', icon: FileText, route: '/dashboard/pqc/compliance' },
  { id: 'hndl', label: 'HNDL Intel', icon: Lock, route: '/dashboard/pqc/hndl' },
  { id: 'quantum-debt', label: 'Quantum Debt', icon: BarChart3, route: '/dashboard/pqc/quantum-debt' },
];
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn } from '@/lib/utils';

const tierCounts = {
  elite_pqc: assets.filter(a => a.tier === 'elite_pqc').length,
  standard: assets.filter(a => a.tier === 'standard').length,
  legacy: assets.filter(a => a.tier === 'legacy').length,
  critical: assets.filter(a => a.tier === 'critical').length,
};

const classData = [
  { name: 'Elite-PQC', count: tierCounts.elite_pqc, fill: 'hsl(var(--status-safe))' },
  { name: 'Standard', count: tierCounts.standard, fill: 'hsl(210, 70%, 50%)' },
  { name: 'Legacy', count: tierCounts.legacy, fill: 'hsl(var(--accent-amber))' },
  { name: 'Critical', count: tierCounts.critical, fill: 'hsl(var(--status-critical))' },
];

const pieData = classData.filter(d => d.count > 0);

const heatmapCells = [
  ['hsl(var(--status-safe))', 'hsl(var(--status-safe))', 'hsl(210, 70%, 50%)'],
  ['hsl(210, 70%, 50%)', 'hsl(var(--accent-amber))', 'hsl(var(--accent-amber))'],
  ['hsl(var(--status-critical))', 'hsl(var(--status-critical))', 'hsl(var(--accent-amber))'],
];
const heatmapValues = [[2, 0, 0], [0, 11, 3], [0, 1, 4]];

const recommendations = [
  { icon: '🔴', text: 'Upgrade to TLS 1.3 with PQC extensions', affected: 4 },
  { icon: '🟠', text: 'Implement ML-KEM-768 for Key Exchange', affected: 14 },
  { icon: '🟡', text: 'Update Cryptographic Libraries to OQS-enabled versions', affected: 18 },
  { icon: '🟢', text: 'Develop PQC Migration Plan and assign asset owners', affected: 21 },
];

const tierCriteria = [
  { tier: 'Tier-1 (Elite-PQC)', criteria: 'TLS 1.3 only + ML-KEM-768 + ML-DSA-65 + HSTS', action: 'Maintain + Monitor', color: 'hsl(var(--status-safe))' },
  { tier: 'Tier-2 (Standard)', criteria: 'TLS 1.2/1.3 + ECDHE + ≥2048-bit + strong ciphers', action: 'Gradual improvement', color: 'hsl(210, 70%, 50%)' },
  { tier: 'Tier-3 (Legacy)', criteria: 'TLS 1.0/1.1 enabled + CBC ciphers + ≤1024-bit', action: 'Remediation required', color: 'hsl(var(--accent-amber))' },
  { tier: 'Critical', criteria: 'SSLv2/v3 + DES + <1024-bit + known CVEs', action: 'Immediate action', color: 'hsl(var(--status-critical))' },
];

const PQCCompliance = () => {
  const eliteCount = assets.filter(a => a.status === 'elite-pqc').length;
  const critCount = assets.filter(a => a.tier === 'critical').length;
  return (
  <div className="space-y-5">
    <DataContextBadge />
    <h1 className="font-display text-2xl italic text-brand-primary">PQC Compliance Dashboard</h1>
    <SectionTabBar tabs={pqcTabs} />
    <p className="text-xs font-body text-muted-foreground italic">
      PQC readiness across {assets.length} assets: {eliteCount} Elite-PQC, {critCount} Critical. {critCount > 0 ? `${critCount} assets require immediate remediation.` : 'No critical assets detected.'}
    </p>

    {/* Top bar */}
    <div className="flex gap-3">
      {classData.map(d => (
        <Card key={d.name} className="flex-1 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] font-body text-muted-foreground uppercase">{d.name}</p>
            <p className="text-xl font-mono font-bold mt-1" style={{ color: d.fill }}>{Math.round((d.count / assets.length) * 100)}%</p>
            <p className="text-[10px] text-muted-foreground">{d.count} assets</p>
          </CardContent>
        </Card>
      ))}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Assets by Classification</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={classData}><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" radius={[4, 4, 0, 0]}>{classData.map((e, i) => <Cell key={i} fill={e.fill} />)}</Bar></BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Application Status</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart><Pie data={pieData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} label={({ name, count }) => `${name}: ${count}`}>{pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}</Pie><Tooltip /></PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Risk Overview Heatmap</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex gap-1 text-[9px] text-muted-foreground mb-1 pl-[calc(2.5rem+0.25rem)]">
              <span className="w-16 text-center">Weak</span>
              <span className="w-16 text-center">Standard</span>
              <span className="w-16 text-center">Strong</span>
            </div>
            {['High', 'Medium', 'Low'].map((label, y) => (
              <div key={label} className="flex items-center gap-1">
                <span className="text-[9px] text-muted-foreground w-10 text-right">{label}</span>
                {[0, 1, 2].map(x => (
                  <div key={x} className="w-16 h-12 rounded flex items-center justify-center text-xs font-mono font-bold text-white" style={{ backgroundColor: heatmapCells[y][x], opacity: heatmapValues[y][x] > 0 ? 0.9 : 0.3 }}>
                    {heatmapValues[y][x]}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>

    <Card className="shadow-sm">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Improvement Recommendations</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {recommendations.map((r, i) => (
          <div key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-[hsl(var(--bg-sunken))] transition-colors cursor-pointer">
            <span className="text-sm">{r.icon}</span>
            <div className="flex-1">
              <p className="text-xs font-body font-medium">{r.text}</p>
              <p className="text-[10px] text-muted-foreground">{r.affected} assets affected</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>

    <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Tier Compliance Criteria</CardTitle></CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-xs font-body">
          <thead><tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Tier</th>
            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Compliance Criteria</th>
            <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Required Action</th>
          </tr></thead>
          <tbody>
            {tierCriteria.map((t, i) => (
              <tr key={t.tier} className={cn("border-b border-border/50", i % 2 === 0 && "bg-[hsl(var(--bg-sunken)/0.3)]")}>
                <td className="px-3 py-2 font-semibold" style={{ color: t.color }}>{t.tier}</td>
                <td className="px-3 py-2 text-muted-foreground">{t.criteria}</td>
                <td className="px-3 py-2">{t.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  </div>
  );
};

export default PQCCompliance;