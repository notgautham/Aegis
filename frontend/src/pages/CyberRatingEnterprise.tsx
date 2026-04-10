import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import SectionTabBar from '@/components/dashboard/SectionTabBar';
import { Star, FileText, HelpCircle, Shield, AlertTriangle, XCircle } from 'lucide-react';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import { api } from '@/lib/api';
import type { Asset } from '@/data/demoData';

const ratingTabs = [
  { id: 'enterprise', label: 'Enterprise Score', icon: Star, route: '/dashboard/rating/enterprise' },
  { id: 'per-asset', label: 'Per-Asset', icon: FileText, route: '/dashboard/rating/per-asset' },
];

const tierThresholds = [
  { status: 'Critical', range: '0-39', desc: 'Immediate remediation required', color: 'hsl(var(--status-critical))' },
  { status: 'Legacy', range: '40-59', desc: 'Basic modernization required', color: 'hsl(var(--accent-amber))' },
  { status: 'Standard', range: '60-79', desc: 'Stable but still transitioning to stronger PQC posture', color: 'hsl(210, 70%, 50%)' },
  { status: 'Elite-PQC', range: '80-100', desc: 'PQC-ready, maintain and monitor', color: 'hsl(var(--status-safe))' },
];

const tiers = [
  {
    id: 'elite_pqc', label: 'Tier 1 - Elite-PQC', icon: Shield, color: 'hsl(var(--status-safe))', bgColor: 'hsl(var(--status-safe)/0.08)',
    criteria: ['TLS 1.3 only + strong ciphers', 'ML-KEM-768 or ML-DSA-65 implemented', 'ECDHE/ML-KEM + cert >=2048-bit', 'HSTS enabled + no weak protocols'],
    action: 'Maintain configuration and periodically monitor',
  },
  {
    id: 'standard', label: 'Tier 2 - Standard', icon: Shield, color: 'hsl(210, 70%, 50%)', bgColor: 'hsl(210, 70%, 50%/0.08)',
    criteria: ['TLS 1.2/1.3 supported', 'ECDHE key exchange + >=2048-bit keys', 'Strong ciphers (AES-256-GCM)', 'Forward secrecy enabled'],
    action: 'Gradually harden configuration and remove older fallbacks',
  },
  {
    id: 'legacy', label: 'Tier 3 - Legacy', icon: AlertTriangle, color: 'hsl(var(--accent-amber))', bgColor: 'hsl(var(--accent-amber)/0.08)',
    criteria: ['Legacy TLS still present', 'Classical-only key exchange', 'Weak certificate posture', 'Limited PQC readiness'],
    action: 'Prioritize remediation and TLS stack upgrades',
  },
  {
    id: 'critical', label: 'Critical', icon: XCircle, color: 'hsl(var(--status-critical))', bgColor: 'hsl(var(--status-critical)/0.08)',
    criteria: ['Severely weak or unknown crypto posture', 'High-impact remediation backlog', 'No meaningful PQC transition posture', 'Potentially exploitable legacy configuration'],
    action: 'Immediate action required',
  },
];

function isUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function computeEnterpriseScore(assets: Asset[]): number {
  return Math.round(assets.reduce((sum, asset) => sum + asset.qScore, 0) / Math.max(assets.length, 1));
}

function getTierLabel(score: number): string {
  if (score >= 80) return 'Elite-PQC';
  if (score >= 60) return 'Standard';
  if (score >= 40) return 'Legacy';
  return 'Critical';
}

function getTierColor(score: number): string {
  if (score >= 80) return 'hsl(var(--status-safe))';
  if (score >= 60) return 'hsl(210, 70%, 50%)';
  if (score >= 40) return 'hsl(var(--accent-amber))';
  return 'hsl(var(--status-critical))';
}

function formatHistoryLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getNextTier(score: number): { label: string; threshold: number } | null {
  if (score < 40) return { label: 'Legacy', threshold: 40 };
  if (score < 60) return { label: 'Standard', threshold: 60 };
  if (score < 80) return { label: 'Elite-PQC', threshold: 80 };
  return null;
}

const CyberRatingEnterprise = () => {
  const [tierSheetOpen, setTierSheetOpen] = useState(false);
  const { selectedAssets, selectedScanId, selectedScan, selectedScanResults } = useSelectedScan();

  const currentTarget = selectedScanResults?.target ?? selectedScan?.target ?? null;

  const historyQuery = useQuery({
    queryKey: ['enterprise-rating-history', selectedScanId, currentTarget],
    queryFn: async () => {
      if (!isUUID(selectedScanId) || !currentTarget) return [] as Array<{ label: string; score: number; createdAt: string }>;

      const history = await api.getScanHistory({ target: currentTarget });
      return history.items
        .filter((item) => item.status === 'completed')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .slice(-12)
        .map((item) => ({
          label: formatHistoryLabel(item.created_at),
          score: Math.round(item.summary.average_q_score ?? 0),
          createdAt: item.created_at,
        }));
    },
    staleTime: 30000,
  });

  const enterpriseScore = computeEnterpriseScore(selectedAssets);
  const maxScore = 100;
  const tierLabel = getTierLabel(enterpriseScore);
  const tierColor = getTierColor(enterpriseScore);

  const avgDims = {
    'TLS Version': Math.round(selectedAssets.reduce((sum, asset) => sum + asset.dimensionScores.tls_version, 0) / Math.max(selectedAssets.length, 1)),
    'Key Exchange': Math.round(selectedAssets.reduce((sum, asset) => sum + asset.dimensionScores.key_exchange, 0) / Math.max(selectedAssets.length, 1)),
    'Cipher Strength': Math.round(selectedAssets.reduce((sum, asset) => sum + asset.dimensionScores.cipher_strength, 0) / Math.max(selectedAssets.length, 1)),
    'Certificate': Math.round(selectedAssets.reduce((sum, asset) => sum + asset.dimensionScores.certificate_algo, 0) / Math.max(selectedAssets.length, 1)),
    'Forward Secrecy': Math.round(selectedAssets.reduce((sum, asset) => sum + asset.dimensionScores.forward_secrecy, 0) / Math.max(selectedAssets.length, 1)),
    'PQC Readiness': Math.round(selectedAssets.reduce((sum, asset) => sum + asset.dimensionScores.pqc_readiness, 0) / Math.max(selectedAssets.length, 1)),
  };

  const radarData = Object.entries(avgDims).map(([dimension, score]) => ({ dimension, score, fullMark: 100 }));
  const weakestDimensions = [...radarData].sort((a, b) => a.score - b.score).slice(0, 2);

  const scoreHistory = useMemo(() => {
    if (historyQuery.data && historyQuery.data.length > 0) {
      return historyQuery.data.map((item) => ({ label: item.label, score: item.score }));
    }

    return [{ label: 'Now', score: enterpriseScore }];
  }, [enterpriseScore, historyQuery.data]);

  const previousComparableScore = scoreHistory.length > 1 ? scoreHistory[scoreHistory.length - 2]?.score ?? enterpriseScore : enterpriseScore;
  const scoreDelta = enterpriseScore - previousComparableScore;

  const timeSpanMonths = historyQuery.data && historyQuery.data.length > 1
    ? Math.max(1 / 30, (new Date(historyQuery.data[historyQuery.data.length - 1].createdAt).getTime() - new Date(historyQuery.data[0].createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30.4375))
    : 0;
  const monthlyImprovement = scoreHistory.length > 1 && timeSpanMonths > 0
    ? Math.round((enterpriseScore - scoreHistory[0].score) / timeSpanMonths)
    : 0;

  const projectionData = [
    ...scoreHistory.map((entry) => ({ label: entry.label, score: entry.score, projected: null as number | null })),
    ...Array.from({ length: 12 }, (_, index) => ({
      label: `M+${index + 1}`,
      score: null as number | null,
      projected: Math.max(0, Math.min(100, enterpriseScore + (monthlyImprovement * (index + 1)))),
    })),
  ];

  const nextTier = getNextTier(enterpriseScore);
  const monthsToNextTier = nextTier && monthlyImprovement > 0
    ? Math.ceil((nextTier.threshold - enterpriseScore) / monthlyImprovement)
    : null;

  const projectedInsight = (() => {
    const weakest = weakestDimensions.map((item) => `${item.dimension} (${item.score})`).join(' and ');

    if (scoreHistory.length <= 1) {
      return `AEGIS has one completed comparable scan for this target so far, so this page is showing a baseline posture only. The current enterprise score is ${enterpriseScore}/100, and the weakest dimensions are ${weakest}. Add another scan of the same target to unlock a real historical trajectory.`;
    }

    if (monthlyImprovement > 0 && nextTier && monthsToNextTier !== null) {
      return `AEGIS sees an improving posture for ${currentTarget ?? 'this target'}: the score moved ${scoreDelta >= 0 ? '+' : ''}${scoreDelta} points versus the previous comparable scan, with the weakest dimensions still concentrated in ${weakest}. If that same improvement pace holds, this target can reach ${nextTier.label} in about ${monthsToNextTier} month${monthsToNextTier === 1 ? '' : 's'}.`;
    }

    if (monthlyImprovement < 0) {
      return `AEGIS sees regression for ${currentTarget ?? 'this target'}: the score dropped ${Math.abs(scoreDelta)} points versus the previous comparable scan. The main drag remains ${weakest}, so remediation should focus there first before the score can recover into the next tier.`;
    }

    return `AEGIS sees a flat trajectory for ${currentTarget ?? 'this target'} across recent comparable scans. The current score remains ${enterpriseScore}/100, and the most constrained dimensions are ${weakest}. Without additional remediation work, the target is unlikely to cross into the next tier soon.`;
  })();

  const benchmarkRows = [
    { label: 'Current Target Score', score: enterpriseScore, max: 100 },
    { label: 'Previous Same-Target Scan', score: previousComparableScore, max: 100 },
    { label: 'Strongest Asset In Scan', score: selectedAssets.reduce((max, asset) => Math.max(max, asset.qScore), 0), max: 100 },
    { label: 'Weakest Asset In Scan', score: selectedAssets.reduce((min, asset) => Math.min(min, asset.qScore), 100), max: 100 },
  ];

  return (
    <div className="space-y-5">
      <DataContextBadge />
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl italic text-brand-primary">Enterprise Cyber Rating</h1>
        <Sheet open={tierSheetOpen} onOpenChange={setTierSheetOpen}>
          <SheetTrigger asChild>
            <button className="flex items-center gap-1 text-xs font-body text-brand-primary hover:underline">
              <HelpCircle className="w-3.5 h-3.5" /> About these tiers?
            </button>
          </SheetTrigger>
          <SheetContent className="w-[420px] overflow-y-auto">
            <SheetHeader><SheetTitle className="font-body">PQC Tier Criteria</SheetTitle></SheetHeader>
            <div className="space-y-4 mt-4">
              {tiers.map((tier) => {
                const TierIcon = tier.icon;
                const tierAssets = selectedAssets.filter((asset) => asset.tier === tier.id);
                return (
                  <div key={tier.id} className="p-4 rounded-lg border" style={{ borderLeftWidth: 4, borderLeftColor: tier.color }}>
                    <div className="flex items-center gap-2 mb-2">
                      <TierIcon className="w-4 h-4" style={{ color: tier.color }} />
                      <span className="font-body text-sm font-semibold" style={{ color: tier.color }}>{tier.label}</span>
                      <Badge style={{ backgroundColor: tier.bgColor, color: tier.color }} className="text-[10px] ml-auto">{tierAssets.length} assets</Badge>
                    </div>
                    <ul className="space-y-1 mb-2">
                      {tier.criteria.map((criterion, index) => (
                        <li key={index} className="text-xs font-body text-foreground/80 flex items-start gap-2">
                          <span style={{ color: tier.color }}>-</span>{criterion}
                        </li>
                      ))}
                    </ul>
                    <div className="p-2 rounded" style={{ backgroundColor: tier.bgColor }}>
                      <p className="text-[10px] font-body">{tier.action}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <SectionTabBar tabs={ratingTabs} />
      <p className="text-xs font-body text-muted-foreground italic">
        Enterprise score: {enterpriseScore}/{maxScore} ({tierLabel}). {scoreHistory.length > 1 ? `Compared with the previous comparable scan, the score moved ${scoreDelta >= 0 ? '+' : ''}${scoreDelta} points.` : 'Run more scans of the same target to unlock a true score trend.'}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-5">
        <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
          <CardContent className="p-8 flex flex-col items-center justify-center">
            <div className="relative w-44 h-44">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--bg-sunken))" strokeWidth="8" />
                <circle cx="60" cy="60" r="52" fill="none" stroke={tierColor} strokeWidth="8" strokeDasharray={`${(enterpriseScore / maxScore) * 327} 327`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-mono font-bold text-foreground">{enterpriseScore}</span>
                <span className="text-xs text-muted-foreground font-body">/ {maxScore}</span>
              </div>
            </div>
            <Badge className="mt-4 text-sm px-4 py-1" style={{ backgroundColor: tierColor, color: 'white' }}>{tierLabel}</Badge>
            <p className="text-[11px] text-muted-foreground mt-3 text-center font-body max-w-xs">
              {selectedAssets.filter((asset) => asset.tier === 'critical').length} critical assets and {selectedAssets.filter((asset) => asset.tier === 'elite_pqc').length} elite assets are shaping this score right now.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Score Breakdown (6 Dimensions)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} outerRadius={90}>
                <PolarGrid stroke="hsl(var(--border-default))" />
                <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 9, fill: 'hsl(var(--text-secondary))' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8 }} />
                <Radar name="Score" dataKey="score" stroke="hsl(var(--accent-amber))" fill="hsl(var(--accent-amber))" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Score History (Same Target Across Previous Scans)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={scoreHistory}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="hsl(var(--accent-amber))" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--accent-amber))' }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-muted-foreground text-center mt-2 font-body">
            {scoreHistory.length > 1 ? `Same-target score history is based on completed scans for ${currentTarget ?? 'this target'}.` : 'Only one comparable scan is available for this target right now.'}
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Projected Trajectory (12-Month Forecast)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={projectionData}>
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={2} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <ReferenceLine y={40} stroke="hsl(var(--status-critical))" strokeDasharray="5 5" label={{ value: 'Critical', position: 'right', fontSize: 9, fill: 'hsl(var(--status-critical))' }} />
              <ReferenceLine y={60} stroke="hsl(var(--accent-amber))" strokeDasharray="5 5" label={{ value: 'Standard', position: 'right', fontSize: 9, fill: 'hsl(var(--accent-amber))' }} />
              <ReferenceLine y={80} stroke="hsl(var(--status-safe))" strokeDasharray="5 5" label={{ value: 'Elite-PQC', position: 'right', fontSize: 9, fill: 'hsl(var(--status-safe))' }} />
              <Line type="monotone" dataKey="score" stroke="hsl(var(--accent-amber))" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
              <Line type="monotone" dataKey="projected" stroke="hsl(var(--accent-amber))" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 p-4 rounded-lg bg-[hsl(var(--bg-sunken))] border border-[hsl(var(--border-default))]">
            <p className="text-xs font-body text-foreground leading-relaxed">{projectedInsight}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Tier Thresholds</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-xs font-body">
            <thead><tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Score Range</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Description</th>
            </tr></thead>
            <tbody>
              {tierThresholds.map((threshold) => (
                <tr key={threshold.status} className="border-b border-border/50">
                  <td className="px-3 py-2 font-semibold" style={{ color: threshold.color }}>{threshold.status}</td>
                  <td className="px-3 py-2 font-mono">{threshold.range}</td>
                  <td className="px-3 py-2 text-muted-foreground">{threshold.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Comparative Context</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {benchmarkRows.map((row) => (
            <div key={row.label} className="space-y-1">
              <div className="flex justify-between text-xs font-body">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-mono font-semibold">{row.score}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[hsl(var(--bg-sunken))]">
                <div className="h-full rounded-full" style={{ width: `${(row.score / row.max) * 100}%`, backgroundColor: getTierColor(row.score) }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default CyberRatingEnterprise;
