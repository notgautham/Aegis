import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { assetTrends, getStatusColor, getStatusLabel, getQScoreColor, getTierFromAsset } from '@/data/demoData';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Star, FileText, Shield, TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react';
import SectionTabBar from '@/components/dashboard/SectionTabBar';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import type { Asset } from '@/data/demoData';

const ratingTabs = [
  { id: 'enterprise', label: 'Enterprise Score', icon: Star, route: '/dashboard/rating/enterprise' },
  { id: 'per-asset', label: 'Per-Asset', icon: FileText, route: '/dashboard/rating/per-asset' },
];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function buildWeaknessSummary(asset: Asset): string {
  const weakest = [
    { label: 'TLS', value: asset.dimensionScores.tls_version },
    { label: 'Key Ex', value: asset.dimensionScores.key_exchange },
    { label: 'Cipher', value: asset.dimensionScores.cipher_strength },
    { label: 'Certificate', value: asset.dimensionScores.certificate_algo },
    { label: 'PQC', value: asset.dimensionScores.pqc_readiness },
  ]
    .sort((left, right) => left.value - right.value)
    .slice(0, 2)
    .map((dimension) => dimension.label);

  return `Lowest dimensions: ${weakest.join(' + ')}`;
}

const CyberRatingPerAsset = () => {
  const navigate = useNavigate();
  const { selectedAssets, selectedAssetResults } = useSelectedScan();
  const useDemoTrendFallback = selectedAssetResults.length === 0;

  const resolvedTrendMap = useMemo<Record<string, { delta: number; direction: 'up' | 'down' | 'flat' }>>(() => {
    return Object.fromEntries(
      selectedAssetResults.map((rawAsset) => {
        const history = (rawAsset.asset_fingerprint?.q_score_history ?? [])
          .filter((entry) => entry.q_score !== null && entry.scanned_at)
          .map((entry) => ({
            qScore: entry.q_score ?? 0,
            scannedAt: new Date(entry.scanned_at ?? '').getTime(),
          }))
          .filter((entry) => !Number.isNaN(entry.scannedAt))
          .sort((left, right) => left.scannedAt - right.scannedAt);

        if (history.length < 2) {
          return [rawAsset.asset_id, { delta: 0, direction: 'flat' as const }];
        }

        const latest = history[history.length - 1];
        const previous = [...history]
          .slice(0, -1)
          .reverse()
          .find((entry) => latest.scannedAt - entry.scannedAt <= SEVEN_DAYS_MS);

        if (!previous) {
          return [rawAsset.asset_id, { delta: 0, direction: 'flat' as const }];
        }

        const delta = latest.qScore - previous.qScore;
        return [
          rawAsset.asset_id,
          {
            delta,
            direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
          },
        ];
      }),
    );
  }, [selectedAssetResults]);

  return (
  <div className="space-y-5">
    <DataContextBadge />
    <div className="flex items-center gap-3">
      <h1 className="font-display text-2xl italic text-brand-primary">Per-Asset Ratings</h1>
      <Tooltip>
        <TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
        <TooltipContent className="max-w-sm text-xs font-mono">
          Q-Score = (TLS × 0.20) + (Cert × 0.20) + (KeyEx × 0.25) + (Cipher × 0.20) + (PQC × 0.15)
        </TooltipContent>
      </Tooltip>
    </div>
    <SectionTabBar tabs={ratingTabs} />

    <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-body">
            <thead><tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Asset</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Q-Score</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">7d Trend</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">TLS</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Cert</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Key Ex.</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Cipher</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">PQC</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Tier</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Label</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Open</th>
            </tr></thead>
            <tbody>
              {selectedAssets.map((a, i) => {
                const dimColor = (v: number) => v >= 80 ? 'hsl(var(--status-safe))' : v >= 50 ? 'hsl(var(--accent-amber))' : 'hsl(var(--status-critical))';
                const chip = (v: number) => (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ color: dimColor(v), backgroundColor: `${dimColor(v)}15` }}>{v}</span>
                );
                const trend = resolvedTrendMap[a.id] || (useDemoTrendFallback ? assetTrends[a.domain] : undefined) || { delta: 0, direction: 'flat' as const };
                return (
                  <tr key={a.id} className={cn("border-b border-border/50 hover:bg-[hsl(var(--bg-sunken))]", i % 2 === 0 && "bg-[hsl(var(--bg-sunken)/0.3)]")}>
                    <td className="px-3 py-2 cursor-pointer hover:text-brand-primary" onClick={() => navigate(`/dashboard/assets/${a.domain.replace(/\./g, '-')}?port=${a.port}`)}>
                      <div className="font-mono font-medium">{a.domain}</div>
                      <p className="mt-0.5 text-[10px] font-body text-muted-foreground">{buildWeaknessSummary(a)}</p>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 rounded-full bg-[hsl(var(--bg-sunken))]">
                          <div className="h-full rounded-full" style={{ width: `${a.qScore}%`, backgroundColor: getQScoreColor(a.qScore) }} />
                        </div>
                        <span className="font-mono font-bold" style={{ color: getQScoreColor(a.qScore) }}>{a.qScore}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("font-mono text-[10px] flex items-center gap-0.5",
                        trend.direction === 'up' ? 'text-[hsl(var(--status-safe))]' :
                        trend.direction === 'down' ? 'text-[hsl(var(--status-critical))]' :
                        'text-muted-foreground'
                      )}>
                        {trend.direction === 'up' && <TrendingUp className="w-3 h-3" />}
                        {trend.direction === 'down' && <TrendingDown className="w-3 h-3" />}
                        {trend.direction === 'flat' && <Minus className="w-3 h-3" />}
                        {trend.delta > 0 ? `+${trend.delta}` : trend.delta === 0 ? '0' : trend.delta}
                      </span>
                    </td>
                    <td className="px-3 py-2">{chip(a.dimensionScores.tls_version)}</td>
                    <td className="px-3 py-2">{chip(a.dimensionScores.certificate_algo)}</td>
                    <td className="px-3 py-2">{chip(a.dimensionScores.key_exchange)}</td>
                    <td className="px-3 py-2">{chip(a.dimensionScores.cipher_strength)}</td>
                    <td className="px-3 py-2">{chip(a.dimensionScores.pqc_readiness)}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{getTierFromAsset(a.tier)}</Badge></td>
                    <td className="px-3 py-2"><span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded" style={{ color: getStatusColor(a.status), backgroundColor: `${getStatusColor(a.status)}15` }}>{getStatusLabel(a.status)}</span></td>
                    <td className="px-3 py-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-[10px] font-mono"
                        onClick={() => navigate(`/dashboard/assets/${a.domain.replace(/\./g, '-')}?port=${a.port}`)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        View
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  </div>
  );
};
export default CyberRatingPerAsset;
