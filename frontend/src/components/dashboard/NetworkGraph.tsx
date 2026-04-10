import { useState, useEffect } from 'react';

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
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const filters = ['All', 'Elite-PQC', 'Standard', 'Vulnerable'];

  useEffect(() => {
    fetch('http://localhost:8000/api/v1/mission-control/graph')
      .then(res => res.json())
      .then(data => {
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      })
      .catch(console.error);
  }, []);

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
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-status-safe/10 text-status-safe border border-status-safe/20 mt-1 inline-block">
            <span className="animate-pulse-dot">●</span> LIVE DATA
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

      <div className="relative group">
        <svg viewBox="0 0 600 360" className="w-full h-auto cursor-crosshair">
          {/* Edges */}
          {edges.map(([from, to], idx) => {
            const a = nodeMap[from];
            const b = nodeMap[to];
            if (!a || !b || !filteredIds.has(from) || !filteredIds.has(to)) return null;
            const isHovered = hoveredNode === from || hoveredNode === to;
            return (
              <line
                key={`${from}-${to}-${idx}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isHovered ? 'hsl(var(--brand-primary))' : 'hsl(var(--border-default))'}
                strokeWidth={isHovered ? "2" : "1"}
                strokeOpacity={isHovered ? "0.8" : "0.4"}
                className="transition-all duration-300"
              />
            );
          })}

          {/* Nodes */}
          {filteredNodes.map(n => (
            <g 
              key={n.id} 
              onMouseEnter={() => setHoveredNode(n.id)}
              onMouseLeave={() => setHoveredNode(null)}
              className="cursor-pointer"
            >
              <circle
                cx={n.x} cy={n.y} r={n.r}
                fill={getColor(n.status)}
                opacity={hoveredNode && hoveredNode !== n.id ? 0.3 : 0.85}
                className="transition-all duration-300 hover:r-[24]"
                stroke={hoveredNode === n.id ? "white" : "none"}
                strokeWidth="2"
              />
              <text
                x={n.x} y={n.y + n.r + 12}
                textAnchor="middle"
                className="font-mono select-none pointer-events-none"
                fontSize="8"
                fill={hoveredNode === n.id ? "hsl(var(--foreground))" : "hsl(var(--text-secondary))"}
                fontWeight={hoveredNode === n.id ? "bold" : "normal"}
              >
                {n.label}
              </text>
            </g>
          ))}
        </svg>
        
        {/* Tooltip */}
        {hoveredNode && nodeMap[hoveredNode] && (
          <div 
            className="absolute top-2 right-2 bg-slate-900/90 text-white p-3 rounded-lg border border-slate-700 shadow-2xl backdrop-blur-sm pointer-events-none z-50 animate-in fade-in zoom-in duration-200"
            style={{ width: '180px' }}
          >
            <div className="text-[10px] text-brand-primary font-bold uppercase mb-1">Asset Details</div>
            <div className="text-xs font-bold mb-1 truncate">{nodeMap[hoveredNode].id}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getColor(nodeMap[hoveredNode].status) }}></div>
              <div className="text-[10px] font-mono uppercase tracking-wider">{nodeMap[hoveredNode].status}</div>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-4 flex gap-4 justify-center border-t border-[hsl(var(--border-default))] pt-4">
        {['safe', 'standard', 'critical'].map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getColor(s) }}></div>
            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">
              {s === 'safe' ? 'Quantum Safe' : s === 'standard' ? 'Transitioning' : 'Vulnerable'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NetworkGraph;
