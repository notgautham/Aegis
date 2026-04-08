import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import type { Asset } from '@/data/demoData';

interface AssetRiskDistributionProps {
  selectedAssets: Asset[];
}

const AssetRiskDistribution = ({ selectedAssets }: AssetRiskDistributionProps) => {
  const data = [
    { level: 'Critical', count: selectedAssets.filter((asset) => asset.status === 'critical').length, color: 'hsl(var(--status-critical))' },
    { level: 'High', count: selectedAssets.filter((asset) => asset.status === 'vulnerable').length, color: 'hsl(var(--status-vuln))' },
    { level: 'Medium', count: selectedAssets.filter((asset) => asset.status === 'standard' || asset.status === 'safe').length, color: 'hsl(var(--accent-amber))' },
    { level: 'Low', count: selectedAssets.filter((asset) => asset.status === 'elite-pqc').length, color: 'hsl(var(--status-safe))' },
  ];

  return (
  <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
    <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Asset Risk Distribution</CardTitle></CardHeader>
    <CardContent>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data}>
          <XAxis dataKey="level" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </CardContent>
  </Card>
  );
};

export default AssetRiskDistribution;
