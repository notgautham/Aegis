import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { assets, enterpriseScore, maxScore, getTierLabel } from '@/data/demoData';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import SectionTabBar from '@/components/dashboard/SectionTabBar';
import { Star, FileText, HelpCircle, Shield, AlertTriangle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const ratingTabs = [
  { id: 'enterprise', label: 'Enterprise Score', icon: Star, route: '/dashboard/rating/enterprise' },
  { id: 'per-asset', label: 'Per-Asset', icon: FileText, route: '/dashboard/rating/per-asset' },
];

const avgDims = {
  'TLS Version': Math.round(assets.reduce((s, a) => s + a.dimensionScores.tls_version, 0) / assets.length),
  'Key Exchange': Math.round(assets.reduce((s, a) => s + a.dimensionScores.key_exchange, 0) / assets.length),
  'Cipher Strength': Math.round(assets.reduce((s, a) => s + a.dimensionScores.cipher_strength, 0) / assets.length),
  'Certificate': Math.round(assets.reduce((s, a) => s + a.dimensionScores.certificate_algo, 0) / assets.length),
  'Forward Secrecy': Math.round(assets.reduce((s, a) => s + a.dimensionScores.forward_secrecy, 0) / assets.length),
  'PQC Readiness': Math.round(assets.reduce((s, a) => s + a.dimensionScores.pqc_readiness, 0) / assets.length),
};

const radarData = Object.entries(avgDims).map(([k, v]) => ({ dimension: k, score: v, fullMark: 100 }));

const scoreHistory = [
  { week: 'W1', score: 280 }, { week: 'W2', score: 290 }, { week: 'W3', score: 305 },
  { week: 'W4', score: 310 }, { week: 'W5', score: 320 }, { week: 'W6', score: 325 },
  { week: 'W7', score: 330 }, { week: 'W8', score: 370 }, { week: 'W9', score: 365 },
  { week: 'W10', score: 368 }, { week: 'W11', score: 370 }, { week: 'W12', score: 370 },
];

const monthlyImprovement = 26;
const projectionData = [
  ...scoreHistory.map(s => ({ label: s.week, score: s.score, projected: null as number | null })),
  ...[1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
    const projected = Math.min(1000, 370 + m * monthlyImprovement);
    return { label: `M+${m}`, score: null as number | null, projected };
  }),
];

const tierThresholds = [
  { status: '⭕ Legacy', range: '0–399', desc: 'Immediate remediation required', color: 'hsl(var(--status-critical))' },
  { status: '⚡ Standard', range: '400–699', desc: 'Acceptable but improvement needed', color: 'hsl(var(--accent-amber))' },
  { status: '✅ Elite-PQC', range: '700–1000', desc: 'PQC-ready, maintain and monitor', color: 'hsl(var(--status-safe))' },
];

const tiers = [
  {
    id: 'elite_pqc', label: 'Tier 1 — Elite-PQC', icon: Shield, color: 'hsl(var(--status-safe))', bgColor: 'hsl(var(--status-safe)/0.08)',
    criteria: ['TLS 1.3 only + strong ciphers', 'ML-KEM-768 or ML-DSA-65 implemented', 'ECDHE/ML-KEM + cert ≥2048-bit', 'HSTS enabled + no weak protocols'],
    action: 'Maintain Configuration — Periodic Monitoring',
  },
  {
    id: 'standard', label: 'Tier 2 — Standard', icon: Shield, color: 'hsl(210, 70%, 50%)', bgColor: 'hsl(210, 70%, 50%/0.08)',
    criteria: ['TLS 1.2/1.3 supported', 'ECDHE key exchange + ≥2048-bit keys', 'Strong ciphers (AES-256-GCM)', 'Forward secrecy enabled'],
    action: 'Gradual Improvement — Disable legacy protocols',
  },
  {
    id: 'legacy', label: 'Tier 3 — Legacy', icon: AlertTriangle, color: 'hsl(var(--accent-amber))', bgColor: 'hsl(var(--accent-amber)/0.08)',
    criteria: ['TLS 1.0/1.1 enabled', 'CBC mode ciphers', 'No forward secrecy', 'Key possibly ≤1024-bit'],
    action: 'Remediation Required — Upgrade TLS stack',
  },
  {
    id: 'critical', label: 'Critical', icon: XCircle, color: 'hsl(var(--status-critical))', bgColor: 'hsl(var(--status-critical)/0.08)',
    criteria: ['SSLv2/SSLv3 enabled', 'DES or export-grade ciphers', 'Key <1024-bit', 'Known CVEs in TLS stack'],
    action: 'Immediate Action — Block or isolate service',
  },
];

const tierLabel = getTierLabel(enterpriseScore);
const tierColor = enterpriseScore >= 700 ? 'hsl(var(--status-safe))' : enterpriseScore >= 400 ? 'hsl(var(--accent-amber))' : 'hsl(var(--status-critical))';

const CyberRatingEnterprise = () => {
  const [tierSheetOpen, setTierSheetOpen] = useState(false);

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
              {tiers.map(t => {
                const TierIcon = t.icon;
                const tierAssets = assets.filter(a => a.tier === t.id);
                return (
                  <div key={t.id} className="p-4 rounded-lg border" style={{ borderLeftWidth: 4, borderLeftColor: t.color }}>
                    <div className="flex items-center gap-2 mb-2">
                      <TierIcon className="w-4 h-4" style={{ color: t.color }} />
                      <span className="font-body text-sm font-semibold" style={{ color: t.color }}>{t.label}</span>
                      <Badge style={{ backgroundColor: t.bgColor, color: t.color }} className="text-[10px] ml-auto">{tierAssets.length} assets</Badge>
                    </div>
                    <ul className="space-y-1 mb-2">
                      {t.criteria.map((c, i) => (
                        <li key={i} className="text-xs font-body text-foreground/80 flex items-start gap-2">
                          <span style={{ color: t.color }}>•</span>{c}
                        </li>
                      ))}
                    </ul>
                    <div className="p-2 rounded" style={{ backgroundColor: t.bgColor }}>
                      <p className="text-[10px] font-body">{t.action}</p>
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
        Enterprise score: {enterpriseScore}/{maxScore} ({tierLabel}). At current improvement rate of ~{monthlyImprovement} points/month, Standard tier projected by June 2026.
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
              Indicates a stronger security posture than 28% of Indian banking institutions
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
        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Score History (Last 12 Weeks)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={scoreHistory}>
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis domain={[200, 500]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="score" stroke="hsl(var(--accent-amber))" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--accent-amber))' }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-muted-foreground text-center mt-2 font-body">Week 8: Removed TLS 1.0 from 3 assets (+45 points)</p>
        </CardContent>
      </Card>

      <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Projected Trajectory (12-Month Forecast)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={projectionData}>
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={2} />
              <YAxis domain={[200, 800]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <ReferenceLine y={400} stroke="hsl(var(--accent-amber))" strokeDasharray="5 5" label={{ value: 'Standard', position: 'right', fontSize: 9, fill: 'hsl(var(--accent-amber))' }} />
              <ReferenceLine y={700} stroke="hsl(var(--status-safe))" strokeDasharray="5 5" label={{ value: 'Elite-PQC', position: 'right', fontSize: 9, fill: 'hsl(var(--status-safe))' }} />
              <Line type="monotone" dataKey="score" stroke="hsl(var(--accent-amber))" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
              <Line type="monotone" dataKey="projected" stroke="hsl(var(--accent-amber))" strokeWidth={2} strokeDasharray="6 4" dot={{ r: 3 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 p-4 rounded-lg bg-[hsl(var(--bg-sunken))] border border-[hsl(var(--border-default))]">
            <p className="text-xs font-body text-foreground leading-relaxed">
              At your current improvement rate of <span className="font-mono font-bold">~{monthlyImprovement} points/month</span>, AEGIS projects you will reach <span className="font-semibold text-[hsl(var(--accent-amber))]">Standard Tier by Jun 2026</span> and <span className="font-semibold text-[hsl(var(--status-safe))]">Elite-PQC status by Q3 2027</span>. Accelerate remediation to Phase 3 to reach it by Q1 2027.
            </p>
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
              {tierThresholds.map(t => (
                <tr key={t.status} className="border-b border-border/50">
                  <td className="px-3 py-2 font-semibold" style={{ color: t.color }}>{t.status}</td>
                  <td className="px-3 py-2 font-mono">{t.range}</td>
                  <td className="px-3 py-2 text-muted-foreground">{t.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Benchmark Comparison</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[{ label: 'Your Score', score: enterpriseScore, max: 1000 }, { label: 'Indian Banking Average', score: 420, max: 1000 }, { label: 'RBI Recommended Baseline', score: 550, max: 1000 }, { label: 'NIST Ideal Posture', score: 850, max: 1000 }].map(b => (
            <div key={b.label} className="space-y-1">
              <div className="flex justify-between text-xs font-body">
                <span className="text-muted-foreground">{b.label}</span>
                <span className="font-mono font-semibold">{b.score}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[hsl(var(--bg-sunken))]">
                <div className="h-full rounded-full" style={{ width: `${(b.score / b.max) * 100}%`, backgroundColor: b.score >= 700 ? 'hsl(var(--status-safe))' : b.score >= 400 ? 'hsl(var(--accent-amber))' : 'hsl(var(--status-critical))' }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default CyberRatingEnterprise;
