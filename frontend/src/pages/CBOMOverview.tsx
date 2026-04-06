import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { assets, caDistribution, keyLengthDistribution, tlsVersionDistribution, getStatusColor, getStatusLabel } from '@/data/demoData';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn } from '@/lib/utils';

import SectionTabBar from '@/components/dashboard/SectionTabBar';
import IntelligencePanel from '@/components/dashboard/IntelligencePanel';
import { FileText, Cpu, Package } from 'lucide-react';

const cbomTabs = [
  { id: 'overview', label: 'Overview', icon: FileText, route: '/dashboard/cbom' },
  { id: 'per-asset', label: 'Per-Asset', icon: Cpu, route: '/dashboard/cbom/per-asset' },
  { id: 'export', label: 'Export Center', icon: Package, route: '/dashboard/cbom/export' },
];

const keyLengthData = Object.entries(keyLengthDistribution).map(([k, v]) => ({ name: k, count: v, fill: k.startsWith('RSA-2048') ? 'hsl(var(--accent-amber))' : k.includes('ML-') ? 'hsl(var(--status-safe))' : k.startsWith('EC') ? 'hsl(210, 70%, 50%)' : 'hsl(var(--status-critical))' }));
const caData = Object.entries(caDistribution).map(([k, v]) => ({ name: k, count: v }));
const tlsData = Object.entries(tlsVersionDistribution).map(([k, v]) => ({ name: k.replace('TLS_', 'TLS ').replace('_', '.'), count: v, fill: k === 'TLS_1_3' ? 'hsl(var(--status-safe))' : k === 'TLS_1_2' ? 'hsl(var(--accent-amber))' : 'hsl(var(--status-critical))' }));

const COLORS = ['hsl(var(--status-safe))', 'hsl(var(--accent-amber))', 'hsl(var(--status-critical))', 'hsl(210, 70%, 50%)'];

const CBOMOverview = () => {
  const { selectedAssets } = useSelectedScan();

  const kpiCards = [
    { label: 'Applications Covered', value: selectedAssets.length, color: 'var(--brand-primary)' },
    { label: 'Sites Surveyed', value: selectedAssets.filter(a => a.type === 'web').length, color: 'var(--brand-primary)' },
    { label: 'Active Certificates', value: selectedAssets.filter(a => a.certInfo.days_remaining > 0).length, color: 'var(--status-safe)' },
    { label: 'Weak Crypto Instances', value: selectedAssets.filter(a => a.qScore <= 40).length, color: 'var(--status-critical)' },
    { label: 'Certificate Issues', value: selectedAssets.filter(a => a.certInfo.days_remaining <= 30 && a.certInfo.days_remaining > 0).length, color: 'var(--status-warn)' },
    { label: 'PQC-Ready (%)', value: `${selectedAssets.length > 0 ? Math.round((selectedAssets.filter(a => a.status === 'elite-pqc' || a.status === 'safe').length / selectedAssets.length) * 100) : 0}%`, color: 'var(--status-safe)' },
  ];

  const weakCount = selectedAssets.filter(a => a.qScore <= 40).length;

  return (
    <div className="space-y-5">
      <DataContextBadge />
      <h1 className="font-display text-2xl italic text-brand-primary">Cryptographic Bill of Materials</h1>
      <SectionTabBar tabs={cbomTabs} />
      <p className="text-xs font-body text-muted-foreground italic">
        Showing cryptographic inventory for {selectedAssets.length} assets. {weakCount} asset{weakCount !== 1 ? 's' : ''} use weak cryptography requiring immediate attention.
      </p>

      <IntelligencePanel assets={selectedAssets} collapsed />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map(k => (
          <Card key={k.label} className="shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] font-body text-muted-foreground uppercase tracking-wider">{k.label}</p>
              <p className="text-2xl font-mono font-bold mt-1" style={{ color: `hsl(${k.color})` }}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Key Length Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={keyLengthData}><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" radius={[4, 4, 0, 0]}>{keyLengthData.map((e, i) => <Cell key={i} fill={e.fill} />)}</Bar></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Encryption Protocols</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart><Pie data={tlsData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={({ name, count }) => `${name}: ${count}`}>{tlsData.map((e, i) => <Cell key={i} fill={e.fill} />)}</Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Top Certificate Authorities</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={caData} layout="vertical"><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} /><Tooltip /><Bar dataKey="count" fill="hsl(var(--brand-accent))" radius={[0, 4, 4, 0]} /></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Cipher Usage</CardTitle></CardHeader>
          <CardContent>
            {(() => {
              const ciphers = assets.reduce((acc, a) => { if (a.cipher !== '--') acc[a.cipher] = (acc[a.cipher] || 0) + 1; return acc; }, {} as Record<string, number>);
              const data = Object.entries(ciphers).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: k.length > 28 ? k.substring(0, 28) + '…' : k, count: v }));
              return (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data} layout="vertical"><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={160} /><Tooltip /><Bar dataKey="count" fill="hsl(var(--accent-amber))" radius={[0, 4, 4, 0]} /></BarChart>
                </ResponsiveContainer>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Per-application CBOM table */}
      <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Per-Application CBOM</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-body">
              <thead><tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Asset</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Key Length</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Cipher Suite</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">TLS</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">CA</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Q-Score</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Status</th>
              </tr></thead>
              <tbody>
                {selectedAssets.map((a, i) => (
                  <tr key={a.id} className={cn("border-b border-border/50 hover:bg-[hsl(var(--bg-sunken))]", i % 2 === 0 && "bg-[hsl(var(--bg-sunken)/0.3)]")}>
                    <td className="px-3 py-2 font-mono font-medium">{a.domain}</td>
                    <td className="px-3 py-2 font-mono">{a.certificate}</td>
                    <td className="px-3 py-2 font-mono text-[10px] max-w-[150px] truncate">{a.cipher}</td>
                    <td className="px-3 py-2 font-mono">{a.tls}</td>
                    <td className="px-3 py-2 text-muted-foreground">{a.certInfo.certificate_authority}</td>
                    <td className="px-3 py-2 font-mono font-semibold">{a.qScore}</td>
                    <td className="px-3 py-2"><span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded" style={{ color: getStatusColor(a.status), backgroundColor: `${getStatusColor(a.status)}15` }}>{getStatusLabel(a.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CBOMOverview;