import { useState } from 'react';

const nodes = [
  { id: 'pnb.co.in', x: 300, y: 180, r: 22, status: 'standard', label: 'pnb.co.in' },
  { id: 'vpn', x: 80, y: 80, r: 14, status: 'critical', label: 'vpn' },
  { id: 'reporting', x: 140, y: 50, r: 12, status: 'critical', label: 'reporting' },
  { id: 'legacy', x: 100, y: 150, r: 12, status: 'critical', label: 'legacy' },
  { id: 'staging', x: 60, y: 220, r: 10, status: 'unknown', label: 'staging' },
  { id: 'swift', x: 200, y: 100, r: 13, status: 'standard', label: 'swift' },
  { id: 'imps', x: 250, y: 60, r: 12, status: 'standard', label: 'imps' },
  { id: 'neft', x: 180, y: 250, r: 12, status: 'standard', label: 'neft' },
  { id: 'netbanking', x: 380, y: 80, r: 14, status: 'standard', label: 'netbanking' },
  { id: 'trade', x: 420, y: 150, r: 12, status: 'standard', label: 'trade' },
  { id: 'fx', x: 450, y: 250, r: 11, status: 'standard', label: 'fx' },
  { id: 'mail', x: 350, y: 290, r: 11, status: 'standard', label: 'mail' },
  { id: 'auth', x: 500, y: 120, r: 15, status: 'safe', label: 'auth' },
  { id: 'pqc-api', x: 520, y: 200, r: 16, status: 'elite-pqc', label: 'pqc-api' },
  { id: 'mobileapi', x: 240, y: 300, r: 11, status: 'standard', label: 'mobileapi' },
];

const edges = [
  ['pnb.co.in', 'vpn'], ['pnb.co.in', 'reporting'], ['pnb.co.in', 'legacy'],
  ['pnb.co.in', 'staging'], ['pnb.co.in', 'swift'], ['pnb.co.in', 'imps'],
  ['pnb.co.in', 'neft'], ['pnb.co.in', 'netbanking'], ['pnb.co.in', 'trade'],
  ['pnb.co.in', 'fx'], ['pnb.co.in', 'mail'], ['pnb.co.in', 'auth'],
  ['pnb.co.in', 'pqc-api'], ['pnb.co.in', 'mobileapi'],
  ['swift', 'imps'], ['neft', 'mobileapi'], ['auth', 'pqc-api'],
];

function getColor(status: string) {
  switch (status) {
    case 'critical': return 'hsl(var(--status-critical))';
    case 'standard': return 'hsl(var(--accent-amber))';
    case 'safe': return 'hsl(var(--status-safe))';
    case 'elite-pqc': return 'hsl(var(--status-safe))';
    case 'unknown': return 'hsl(var(--status-unknown))';
    default: return 'hsl(var(--status-unknown))';
  }
}

const NetworkGraph = () => {
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'Elite-PQC', 'Standard', 'Vulnerable'];

  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));

  const filteredNodes = filter === 'All'
    ? nodes
    : nodes.filter(n => {
        if (filter === 'Elite-PQC') return n.status === 'elite-pqc' || n.status === 'safe';
        if (filter === 'Vulnerable') return n.status === 'critical' || n.status === 'unknown';
        return n.status === 'standard';
      });

  const filteredIds = new Set(filteredNodes.map(n => n.id));

  return (
    <div className="bg-surface rounded-xl border border-[hsl(var(--border-default))] p-5 shadow-[0_18px_42px_-28px_hsl(var(--brand-primary)/0.45)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-body font-bold text-sm text-foreground">Asset Discovery Network Graph</h3>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber border border-accent-amber/20 mt-1 inline-block">
            <span className="animate-pulse-dot">●</span> SIMULATED DATA
          </span>
        </div>
        <div className="flex gap-1">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`font-mono text-[10px] px-2 py-1 rounded-md transition-colors ${
                filter === f ? 'bg-brand-primary text-white' : 'bg-sunken text-muted-foreground hover:bg-brand-primary/10'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox="0 0 600 360" className="w-full h-auto">
        {/* Edges */}
        {edges.map(([from, to]) => {
          const a = nodeMap[from];
          const b = nodeMap[to];
          if (!a || !b || !filteredIds.has(from) || !filteredIds.has(to)) return null;
          return (
            <line
              key={`${from}-${to}`}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="hsl(var(--border-default))"
              strokeWidth="1"
            />
          );
        })}

        {/* Nodes */}
        {filteredNodes.map(n => (
          <g key={n.id}>
            <circle
              cx={n.x} cy={n.y} r={n.r}
              fill={getColor(n.status)}
              opacity={0.85}
              className="transition-all duration-200 hover:opacity-100"
            />
            <text
              x={n.x} y={n.y + n.r + 12}
              textAnchor="middle"
              className="font-mono"
              fontSize="8"
              fill="hsl(var(--text-secondary))"
            >
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

export default NetworkGraph;
