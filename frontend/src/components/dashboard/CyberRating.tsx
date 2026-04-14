import { getQScoreColor, type Asset } from '@/data/demoData';

const execLabelMap: Record<string, string> = {
  'Elite-PQC': 'Fully Quantum-Safe',
  'Q-Score Overview': 'Security Rating',
  'Asset Scores': 'Asset Security Ratings',
  'Critical': 'Immediate Action',
  'Legacy': 'Needs Upgrade',
  'Standard': 'Acceptable',
};

interface CyberRatingProps {
  execMode?: boolean;
  selectedAssets: Asset[];
}

const CyberRating = ({ execMode = false, selectedAssets }: CyberRatingProps) => {
  const score = Math.round(selectedAssets.reduce((sum, asset) => sum + asset.qScore, 0) / Math.max(selectedAssets.length, 1));
  const maxScore = 100;
  const tier = score >= 80 ? 'Elite-PQC' : score >= 60 ? 'Standard' : score >= 40 ? 'Legacy' : 'Critical';
  const tierColor = score >= 80
    ? 'hsl(var(--status-safe))'
    : score >= 60
      ? 'hsl(var(--accent-amber))'
      : score >= 40
        ? 'hsl(var(--status-vuln))'
        : 'hsl(var(--status-critical))';
  const tierSummary = score >= 80
    ? 'Maintain posture'
    : score >= 60
      ? 'Hardening recommended'
      : score >= 40
        ? 'Upgrade path required'
        : 'Immediate remediation required';
  const pct = (score / maxScore) * 100;
  const circumference = 2 * Math.PI * 60;
  const offset = circumference - (pct / 100) * circumference;

  const el = (text: string) => execMode && execLabelMap[text] ? execLabelMap[text] : text;

  const assetScores = [...selectedAssets]
    .sort((a, b) => b.qScore - a.qScore)
    .slice(0, 5)
    .map((asset) => ({ name: asset.domain, score: asset.qScore, color: getQScoreColor(asset.qScore) }));

  return (
    <div className="bg-surface rounded-xl border border-[hsl(var(--border-default))] p-5 shadow-[0_18px_42px_-28px_hsl(var(--brand-primary)/0.45)]">
      <h3 className="font-body font-bold text-sm text-foreground mb-4">{el('Q-Score Overview')}</h3>

      <div className="flex flex-col items-center mb-6">
        <svg width="150" height="150" viewBox="0 0 150 150">
          <circle cx="75" cy="75" r="60" fill="none" stroke="hsl(var(--border-default))" strokeWidth="8" />
          <circle
            cx="75" cy="75" r="60" fill="none"
            stroke={tierColor}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 75 75)"
          />
          <text x="75" y="70" textAnchor="middle" className="font-mono text-3xl font-bold" fill={tierColor}>
            {score}
          </text>
          <text x="75" y="88" textAnchor="middle" className="font-mono text-xs" fill="hsl(var(--text-muted))">
            / {maxScore}
          </text>
        </svg>
        <span className="font-body font-bold text-lg mt-2" style={{ color: tierColor }}>{tier}</span>
        <span className="font-body text-xs text-muted-foreground">{tierSummary}</span>
      </div>

      <div className="space-y-2">
        <span className="font-mono text-[10px] text-muted-foreground uppercase">{el('Asset Scores')}</span>
        {assetScores.map(a => (
          <div key={a.name} className="flex items-center justify-between">
            <span className="font-mono text-xs text-foreground">{a.name}</span>
            <span className="font-mono text-xs font-bold" style={{ color: a.color }}>{a.score}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-[hsl(var(--border-default))]">
        <span className="font-mono text-[10px] text-muted-foreground uppercase block mb-2">Tier Reference</span>
        <div className="grid grid-cols-2 gap-1">
          {[
            { label: 'Critical', range: '< 40', color: 'bg-status-critical' },
            { label: 'Legacy', range: '40-59', color: 'bg-status-vuln' },
            { label: 'Standard', range: '60-79', color: 'bg-accent-amber' },
            { label: 'Elite-PQC', range: '>= 80', color: 'bg-status-safe' },
          ].map(t => (
            <div key={t.label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${t.color}`} />
              <span className="font-mono text-[10px] text-muted-foreground">{el(t.label)} ({t.range})</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CyberRating;
