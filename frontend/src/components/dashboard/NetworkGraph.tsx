import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { useSelectedScan } from '@/contexts/SelectedScanContext';

function isUUID(id: string | undefined | null): id is string {
  return !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function getColor(status: string) {
  switch (status) {
    case 'critical': return 'hsl(var(--status-critical))';
    case 'vulnerable': return 'hsl(var(--status-critical))';
    case 'standard': return 'hsl(var(--accent-amber))';
    case 'transitioning': return 'hsl(var(--accent-amber))';
    case 'safe': return 'hsl(var(--status-safe))';
    case 'elite-pqc': return 'hsl(var(--status-safe))';
    case 'unknown': return 'hsl(var(--status-unknown))';
    default: return 'hsl(var(--status-unknown))';
  }
}

const NetworkGraph = () => {
  const [filter, setFilter] = useState('All');
  const [zoom, setZoom] = useState(0.78);
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const { selectedScanId } = useSelectedScan();
  const filters = ['All', 'Elite-PQC', 'Transitioning', 'Vulnerable'];

  useEffect(() => {
    let cancelled = false;

    api.getMissionControlGraph({
      scanId: isUUID(selectedScanId) ? selectedScanId : undefined,
      limit: 500,
    })
      .then((data) => {
        if (cancelled) return;
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error(error);
          setNodes([]);
          setEdges([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedScanId]);

  const uniqueNodes = useMemo(() => {
    const byId = new Map<string, any>();
    for (const node of nodes) {
      if (node?.id) {
        byId.set(node.id, node);
      }
    }
    return Array.from(byId.values());
  }, [nodes]);

  const nodeMap = Object.fromEntries(uniqueNodes.map(n => [n.id, n]));

  const filteredNodes = filter === 'All'
    ? uniqueNodes
    : uniqueNodes.filter(n => {
        if (filter === 'Elite-PQC') return n.status === 'elite-pqc';
        if (filter === 'Vulnerable') return n.status === 'vulnerable' || n.status === 'critical' || n.status === 'unknown';
        return n.status === 'transitioning';
      });

  const viewBox = useMemo(() => {
    if (!filteredNodes.length) return '0 0 600 360';

    const left = Math.min(...filteredNodes.map((node) => node.x - node.r - 32));
    const right = Math.max(...filteredNodes.map((node) => node.x + node.r + 32));
    const top = Math.min(...filteredNodes.map((node) => node.y - node.r - 32));
    const bottom = Math.max(...filteredNodes.map((node) => node.y + node.r + 48));

    const width = Math.max(600, right - left);
    const height = Math.max(360, bottom - top);
    const safeZoom = Math.min(2.0, Math.max(0.45, zoom));
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const adjustedWidth = width / safeZoom;
    const adjustedHeight = height / safeZoom;
    const adjustedLeft = centerX - adjustedWidth / 2;
    const adjustedTop = centerY - adjustedHeight / 2;

    return `${adjustedLeft} ${adjustedTop} ${adjustedWidth} ${adjustedHeight}`;
  }, [filteredNodes, zoom]);

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
          <button
            onClick={() => setZoom((value) => Math.max(0.45, Number((value - 0.1).toFixed(2))))}
            className="font-mono text-[10px] px-2 py-1 rounded-md bg-sunken text-muted-foreground hover:bg-brand-primary/10"
            title="Zoom out"
          >
            -
          </button>
          <button
            onClick={() => setZoom(0.78)}
            className="font-mono text-[10px] px-2 py-1 rounded-md bg-sunken text-muted-foreground hover:bg-brand-primary/10"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => setZoom((value) => Math.min(2.0, Number((value + 0.1).toFixed(2))))}
            className="font-mono text-[10px] px-2 py-1 rounded-md bg-sunken text-muted-foreground hover:bg-brand-primary/10"
            title="Zoom in"
          >
            +
          </button>
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

      <div className="relative group overflow-auto max-h-[68vh]">
        <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className="w-full h-auto min-w-[600px] cursor-crosshair">
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
            className="absolute top-2 right-2 bg-black/90 text-white p-3 rounded-lg border border-white/20 shadow-2xl backdrop-blur-sm pointer-events-none z-50 animate-in fade-in zoom-in duration-200"
            style={{ width: '180px' }}
          >
            <div className="text-[10px] text-white/80 font-bold uppercase mb-1 tracking-wider">Asset Details</div>
            <div className="text-xs font-bold mb-1 truncate text-white">{nodeMap[hoveredNode].id}</div>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getColor(nodeMap[hoveredNode].status) }}></div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-white">{nodeMap[hoveredNode].status}</div>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-4 flex gap-4 justify-center border-t border-[hsl(var(--border-default))] pt-4">
        {['elite-pqc', 'transitioning', 'vulnerable', 'critical'].map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getColor(s) }}></div>
            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">
              {s === 'elite-pqc'
                ? 'Fully Quantum Safe'
                : s === 'transitioning'
                  ? 'PQC Transitioning'
                  : s === 'vulnerable'
                    ? 'Quantum Vulnerable'
                    : 'Critically Vulnerable'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NetworkGraph;
