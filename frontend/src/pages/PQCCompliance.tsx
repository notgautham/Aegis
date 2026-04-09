import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import SectionTabBar from '@/components/dashboard/SectionTabBar';
import { FileText, Lock, BarChart3 } from 'lucide-react';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn } from '@/lib/utils';

const pqcTabs = [
  { id: 'compliance', label: 'Compliance', icon: FileText, route: '/dashboard/pqc/compliance' },
  { id: 'hndl', label: 'HNDL Intel', icon: Lock, route: '/dashboard/pqc/hndl' },
  { id: 'quantum-debt', label: 'Quantum Debt', icon: BarChart3, route: '/dashboard/pqc/quantum-debt' },
];

const strengthColumns = [
  { label: 'Weak', key: 'weak', color: 'hsl(var(--status-critical))' },
  { label: 'Standard', key: 'standard', color: 'hsl(var(--accent-amber))' },
  { label: 'Strong', key: 'strong', color: 'hsl(var(--status-safe))' },
] as const;

const criticalityRows = [
  { label: 'Compliance', key: 'compliance_critical' },
  { label: 'Customer', key: 'customer_facing' },
  { label: 'Internal', key: 'internal' },
] as const;

const tierCriteria = [
  { tier: 'Tier-1 (Elite-PQC)', criteria: 'TLS 1.3 only + ML-KEM-768 + ML-DSA-65 + HSTS', action: 'Maintain + Monitor', color: 'hsl(var(--status-safe))' },
  { tier: 'Tier-2 (Standard)', criteria: 'TLS 1.2/1.3 + ECDHE + >=2048-bit + strong ciphers', action: 'Gradual improvement', color: 'hsl(210, 70%, 50%)' },
  { tier: 'Tier-3 (Legacy)', criteria: 'TLS 1.0/1.1 enabled + CBC ciphers + <=1024-bit', action: 'Remediation required', color: 'hsl(var(--accent-amber))' },
  { tier: 'Critical', criteria: 'SSLv2/v3 + DES + <1024-bit + known CVEs', action: 'Immediate action', color: 'hsl(var(--status-critical))' },
];

function getStrengthBucket(tier: string): 'weak' | 'standard' | 'strong' {
  if (tier === 'elite_pqc') return 'strong';
  if (tier === 'standard') return 'standard';
  return 'weak';
}

function getRecommendationSeverity(text: string): {
  dot: string;
  text: string;
} {
  if (text.includes('TLS 1.3') || text.includes('ML-KEM-768')) {
    return {
      dot: 'hsl(var(--status-critical))',
      text: 'hsl(var(--status-critical))',
    };
  }

  if (text.includes('OQS-enabled')) {
    return {
      dot: 'hsl(var(--accent-amber))',
      text: 'hsl(var(--accent-amber))',
    };
  }

  return {
    dot: 'hsl(var(--status-safe))',
    text: 'hsl(var(--status-safe))',
  };
}

const PQCCompliance = () => {
  const { selectedAssets } = useSelectedScan();

  const tierCounts = {
    elite_pqc: selectedAssets.filter((asset) => asset.tier === 'elite_pqc').length,
    standard: selectedAssets.filter((asset) => asset.tier === 'standard').length,
    legacy: selectedAssets.filter((asset) => asset.tier === 'legacy').length,
    critical: selectedAssets.filter((asset) => asset.tier === 'critical').length,
  };

  const classData = [
    { name: 'Elite-PQC', count: tierCounts.elite_pqc, fill: 'hsl(var(--status-safe))' },
    { name: 'Standard', count: tierCounts.standard, fill: 'hsl(210, 70%, 50%)' },
    { name: 'Legacy', count: tierCounts.legacy, fill: 'hsl(var(--accent-amber))' },
    { name: 'Critical', count: tierCounts.critical, fill: 'hsl(var(--status-critical))' },
  ];

  const pieData = classData.filter((item) => item.count > 0);
  const eliteCount = selectedAssets.filter((asset) => asset.status === 'elite-pqc').length;
  const critCount = selectedAssets.filter((asset) => asset.tier === 'critical').length;

  const heatmapRows = criticalityRows.map((row) => ({
    label: row.label,
    values: strengthColumns.map((column) => selectedAssets.filter((asset) => (
      asset.businessCriticality === row.key && getStrengthBucket(asset.tier) === column.key
    )).length),
  }));

  const maxHeatmapValue = Math.max(0, ...heatmapRows.flatMap((row) => row.values));

  const recommendations = [
    {
      text: 'Upgrade to TLS 1.3 with PQC extensions',
      affected: selectedAssets.filter((asset) => !asset.tls.includes('1.3')).length,
    },
    {
      text: 'Implement ML-KEM-768 for key exchange',
      affected: selectedAssets.filter((asset) => !asset.keyExchange.toUpperCase().includes('ML')).length,
    },
    {
      text: 'Update cryptographic libraries to OQS-enabled versions',
      affected: selectedAssets.filter((asset) => !asset.software?.pqcNativeSupport).length,
    },
    {
      text: 'Develop PQC migration plan and assign asset owners',
      affected: selectedAssets.filter((asset) => asset.status !== 'elite-pqc' || asset.ownerTeam === 'Unassigned').length,
    },
  ].filter((item) => item.affected > 0);

  return (
    <div className="space-y-5">
      <DataContextBadge />
      <h1 className="font-display text-2xl italic text-brand-primary">PQC Compliance Dashboard</h1>
      <SectionTabBar tabs={pqcTabs} />
      <p className="text-xs font-body text-muted-foreground italic">
        PQC readiness across {selectedAssets.length} assets: {eliteCount} Elite-PQC, {critCount} Critical. {critCount > 0 ? `${critCount} assets require immediate remediation.` : 'No critical assets detected.'}
      </p>

      <div className="flex gap-3">
        {classData.map((item) => (
          <Card key={item.name} className="flex-1 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] font-body text-muted-foreground uppercase">{item.name}</p>
              <p className="text-xl font-mono font-bold mt-1" style={{ color: item.fill }}>
                {Math.round((item.count / Math.max(selectedAssets.length, 1)) * 100)}%
              </p>
              <p className="text-[10px] text-muted-foreground">{item.count} assets</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Assets by Classification</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={classData}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {classData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Application Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} label={({ name, count }) => `${name}: ${count}`}>
                  {pieData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Risk Overview Heatmap</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex gap-1 text-[9px] text-muted-foreground mb-1 pl-[calc(5.5rem+0.5rem)]">
                {strengthColumns.map((column) => (
                  <span key={column.key} className="w-16 text-center">{column.label}</span>
                ))}
              </div>
              {heatmapRows.map((row) => (
                <div key={row.label} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-20 text-right leading-tight">{row.label}</span>
                  {row.values.map((value, index) => (
                    <div
                      key={`${row.label}-${strengthColumns[index].key}`}
                      className="w-16 h-12 rounded flex items-center justify-center text-xs font-mono font-bold text-white"
                      style={{
                        backgroundColor: strengthColumns[index].color,
                        opacity: value > 0 && maxHeatmapValue > 0 ? 0.55 + ((value / maxHeatmapValue) * 0.35) : 0.18,
                        boxShadow: value > 0 ? `inset 0 0 0 1px ${strengthColumns[index].color}` : undefined,
                      }}
                    >
                      {value}
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
          {recommendations.length > 0 ? recommendations.map((recommendation, index) => (
            <div key={index} className="flex items-start gap-2 p-2 rounded-lg hover:bg-[hsl(var(--bg-sunken))] transition-colors cursor-pointer">
              <span
                className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: getRecommendationSeverity(recommendation.text).dot }}
              />
              <div className="flex-1">
                <p className="text-xs font-body font-medium">{recommendation.text}</p>
                <p className="text-[10px] text-muted-foreground">{recommendation.affected} assets affected</p>
              </div>
            </div>
          )) : (
            <p className="text-xs text-muted-foreground font-body">No immediate PQC remediation recommendations for the current scan.</p>
          )}
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
              {tierCriteria.map((item, index) => (
                <tr key={item.tier} className={cn('border-b border-border/50', index % 2 === 0 && 'bg-[hsl(var(--bg-sunken)/0.3)]')}>
                  <td className="px-3 py-2 font-semibold" style={{ color: item.color }}>{item.tier}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.criteria}</td>
                  <td className="px-3 py-2">{item.action}</td>
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
