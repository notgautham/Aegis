import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';

const data = [
  { level: 'Critical', count: 3, color: 'hsl(var(--status-critical))' },
  { level: 'High', count: 5, color: 'hsl(var(--status-vuln))' },
  { level: 'Medium', count: 8, color: 'hsl(var(--accent-amber))' },
  { level: 'Low', count: 5, color: 'hsl(var(--status-safe))' },
];

const AssetRiskDistribution = () => (
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

export default AssetRiskDistribution;
