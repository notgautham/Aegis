import { avgQScore } from '@/data/demoData';

const QScoreOverview = () => {
  const circumference = 2 * Math.PI * 50;
  const offset = circumference - (avgQScore / 100) * circumference;

  const breakdown = [
    { label: 'Quantum Safe', count: 2, color: 'bg-status-safe' },
    { label: 'PQC Transition', count: 4, color: 'bg-blue-500' },
    { label: 'Vulnerable', count: 11, color: 'bg-accent-amber' },
    { label: 'Critical', count: 3, color: 'bg-status-critical' },
    { label: 'Unknown', count: 1, color: 'bg-status-unknown' },
  ];

  const maxCount = Math.max(...breakdown.map(b => b.count));

  return (
    <div className="bg-surface rounded-xl border border-[hsl(var(--border-default))] p-5 shadow-[0_18px_42px_-28px_hsl(var(--brand-primary)/0.45)]">
      <h3 className="font-body font-bold text-sm text-foreground mb-4">Q-Score Overview</h3>

      <div className="flex items-center gap-6 mb-6">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--border-default))" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="50" fill="none"
            stroke="hsl(var(--status-critical))"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
          />
          <text x="60" y="56" textAnchor="middle" className="font-mono text-2xl font-bold" fill="hsl(var(--status-critical))">
            {avgQScore}
          </text>
          <text x="60" y="72" textAnchor="middle" className="font-mono text-[10px]" fill="hsl(var(--text-muted))">
            / 100
          </text>
        </svg>

        <div className="flex-1 space-y-2">
          {breakdown.map(b => (
            <div key={b.label} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${b.color} flex-shrink-0`} />
              <span className="font-body text-xs text-muted-foreground flex-1">{b.label}</span>
              <div className="w-20 h-2 bg-sunken rounded-full overflow-hidden">
                <div
                  className={`h-full ${b.color} rounded-full transition-all`}
                  style={{ width: `${(b.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="font-mono text-xs text-foreground w-4 text-right">{b.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QScoreOverview;
