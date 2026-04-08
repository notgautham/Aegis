import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import type { Asset } from '@/data/demoData';

interface CertExpiryTimelineProps {
  selectedAssets: Asset[];
}

const CertExpiryTimeline = ({ selectedAssets }: CertExpiryTimelineProps) => {
  const navigate = useNavigate();
  const data = [
    { range: '0-30 days', count: selectedAssets.filter((asset) => asset.certInfo.days_remaining <= 30).length, color: 'hsl(var(--status-critical))' },
    { range: '30-60 days', count: selectedAssets.filter((asset) => asset.certInfo.days_remaining > 30 && asset.certInfo.days_remaining <= 60).length, color: 'hsl(var(--accent-amber))' },
    { range: '60-90 days', count: selectedAssets.filter((asset) => asset.certInfo.days_remaining > 60 && asset.certInfo.days_remaining <= 90).length, color: 'hsl(35, 90%, 55%)' },
    { range: '>90 days', count: selectedAssets.filter((asset) => asset.certInfo.days_remaining > 90).length, color: 'hsl(var(--status-safe))' },
  ];

  return (
    <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Certificate Expiry Timeline</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} layout="vertical" onClick={() => navigate('/dashboard/discovery?tab=ssl')}>
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="range" type="category" tick={{ fontSize: 10 }} width={80} />
            <Tooltip />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} cursor="pointer">
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default CertExpiryTimeline;
