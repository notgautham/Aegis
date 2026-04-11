import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getStatusColor, getStatusLabel } from '@/data/demoData';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import { isPqcReadyAsset } from '@/lib/status';
import SectionTabBar from '@/components/dashboard/SectionTabBar';
import IntelligencePanel from '@/components/dashboard/IntelligencePanel';
import { FileText, Cpu, Package } from 'lucide-react';

const cbomTabs = [
  { id: 'overview', label: 'Overview', icon: FileText, route: '/dashboard/cbom' },
  { id: 'per-asset', label: 'Per-Asset', icon: Cpu, route: '/dashboard/cbom/per-asset' },
  { id: 'export', label: 'Export Center', icon: Package, route: '/dashboard/cbom/export' },
];

const CBOMOverview = () => {
  const { selectedAssets, selectedAssetResults } = useSelectedScan();
  const cbomAssetIds = new Set(
    selectedAssetResults
      .filter((assetResult) => assetResult.cbom)
      .map((assetResult) => assetResult.asset_id),
  );
  const assetsWithCbom = selectedAssets.filter((asset) => cbomAssetIds.has(asset.id));
  const displayAssets = assetsWithCbom.length > 0 ? assetsWithCbom : selectedAssets;

  const keyLengthCounts = displayAssets.reduce((acc, asset) => {
    const label = String(asset.certInfo.key_size);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const keyLengthData = Object.entries(keyLengthCounts).map(([name, count]) => ({
    name,
    count,
    fill: Number(name) >= 3072 ? 'hsl(var(--status-safe))' : Number(name) >= 2048 ? 'hsl(var(--accent-amber))' : 'hsl(var(--status-critical))',
  }));

  const caCounts = displayAssets.reduce((acc, asset) => {
    const authority = asset.certInfo.certificate_authority || 'Unknown';
    acc[authority] = (acc[authority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const caData = Object.entries(caCounts).map(([name, count]) => ({ name, count }));

  const tlsCounts = displayAssets.reduce((acc, asset) => {
    const version = asset.tls || 'Unknown';
    acc[version] = (acc[version] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const tlsData = Object.entries(tlsCounts).map(([name, count]) => ({
    name,
    count,
    fill: name.includes('1.3') ? 'hsl(var(--status-safe))' : name.includes('1.2') ? 'hsl(var(--accent-amber))' : 'hsl(var(--status-critical))',
  }));

  const cipherData = Object.entries(
    displayAssets.reduce((acc, asset) => {
      if (asset.cipher !== '--') acc[asset.cipher] = (acc[asset.cipher] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  )
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name: name.length > 28 ? `${name.substring(0, 28)}...` : name,
      count,
    }));

  const kpiCards = [
    { label: 'CBOM Documents', value: cbomAssetIds.size, color: 'var(--brand-primary)' },
    { label: 'Applications Covered', value: displayAssets.length, color: 'var(--brand-primary)' },
    { label: 'Sites Surveyed', value: displayAssets.filter((asset) => asset.type === 'web').length, color: 'var(--brand-primary)' },
    { label: 'Active Certificates', value: displayAssets.filter((asset) => asset.certInfo.days_remaining > 0).length, color: 'var(--status-safe)' },
    { label: 'Weak Crypto Instances', value: displayAssets.filter((asset) => asset.qScore <= 40).length, color: 'var(--status-critical)' },
    { label: 'PQC-Ready (%)', value: `${displayAssets.length > 0 ? Math.round((displayAssets.filter(isPqcReadyAsset).length / displayAssets.length) * 100) : 0}%`, color: 'var(--status-safe)' },
  ];

  const weakCount = displayAssets.filter((asset) => asset.qScore <= 40).length;

  return (
    <div className="space-y-5">
      <DataContextBadge />
      <h1 className="font-display text-2xl italic text-brand-primary">Cryptographic Bill of Materials</h1>
      <SectionTabBar tabs={cbomTabs} />
      <p className="text-xs font-body text-muted-foreground italic">
        Showing cryptographic inventory for {displayAssets.length} asset{displayAssets.length !== 1 ? 's' : ''} with {cbomAssetIds.size} persisted CBOM document{cbomAssetIds.size !== 1 ? 's' : ''}. {weakCount} asset{weakCount !== 1 ? 's' : ''} use weak cryptography requiring immediate attention.
      </p>

      <IntelligencePanel assets={displayAssets} collapsed />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} className="shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] font-body text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
              <p className="text-2xl font-mono font-bold mt-1" style={{ color: `hsl(${kpi.color})` }}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Key Length Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={keyLengthData}><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" radius={[4, 4, 0, 0]}>{keyLengthData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}</Bar></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Encryption Protocols</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart><Pie data={tlsData} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={({ name, count }) => `${name}: ${count}`}>{tlsData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}</Pie><Tooltip /></PieChart>
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
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cipherData} layout="vertical"><XAxis type="number" tick={{ fontSize: 10 }} /><YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={160} /><Tooltip /><Bar dataKey="count" fill="hsl(var(--accent-amber))" radius={[0, 4, 4, 0]} /></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

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
                {displayAssets.map((asset, index) => (
                  <tr key={asset.id} className={cn("border-b border-border/50 hover:bg-[hsl(var(--bg-sunken))]", index % 2 === 0 && "bg-[hsl(var(--bg-sunken)/0.3)]")}>
                    <td className="px-3 py-2 font-mono font-medium">{asset.domain}</td>
                    <td className="px-3 py-2 font-mono">{asset.certificate}</td>
                    <td className="px-3 py-2 font-mono text-[10px] max-w-[150px] truncate">{asset.cipher}</td>
                    <td className="px-3 py-2 font-mono">{asset.tls}</td>
                    <td className="px-3 py-2 text-muted-foreground">{asset.certInfo.certificate_authority}</td>
                    <td className="px-3 py-2 font-mono font-semibold">{asset.qScore}</td>
                    <td className="px-3 py-2"><span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded" style={{ color: getStatusColor(asset.status), backgroundColor: `${getStatusColor(asset.status)}15` }}>{getStatusLabel(asset.status)}</span></td>
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
