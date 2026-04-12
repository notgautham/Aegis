import { useState, useEffect, useMemo, useRef, type PointerEvent, type WheelEvent } from 'react';
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
  const [zoom, setZoom] = useState(0.62);
  const [labelMode, setLabelMode] = useState<'auto' | 'on' | 'off'>('auto');
  const [layoutMode, setLayoutMode] = useState<'auto' | 'three-phase'>('auto');
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
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

  const isDenseGraph = filteredNodes.length > 80;
  const showNodeLabels = labelMode === 'on' || (labelMode === 'auto' && !isDenseGraph);

  const labelText = (value: string) => {
    if (!value) return '';
    return value.length > 24 ? `${value.slice(0, 24)}...` : value;
  };

  const inferPhase = (node: any): 'domain' | 'ip' | 'service' => {
    const raw = `${node?.label || node?.id || ''}`.trim().toLowerCase();
    const ipv4Pattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
    const barePortPattern = /^\d{1,5}$/;

    if (ipv4Pattern.test(raw)) return 'ip';
    if (barePortPattern.test(raw) || /\b(port|ssl|ssh|smtp|http|https|dns|service|tag|file)\b/.test(raw)) return 'service';
    return 'domain';
  };

  const displayNodes = useMemo(() => {
    if (layoutMode === 'auto') return filteredNodes;

    const domainNodes: any[] = [];
    const ipNodes: any[] = [];
    const serviceNodes: any[] = [];

    for (const node of filteredNodes) {
      const phase = inferPhase(node);
      if (phase === 'domain') domainNodes.push(node);
      else if (phase === 'ip') ipNodes.push(node);
      else serviceNodes.push(node);
    }

    const assignLane = (lane: any[], laneX: number) => {
      const laneTop = 90;
      const laneHeight = Math.max(520, lane.length * 24);
      const spacing = lane.length > 1 ? laneHeight / (lane.length - 1) : 0;
      return lane.map((node, index) => ({
        ...node,
        x: laneX,
        y: laneTop + index * spacing,
      }));
    };

    return [
      ...assignLane(domainNodes, 140),
      ...assignLane(ipNodes, 460),
      ...assignLane(serviceNodes, 780),
    ];
  }, [filteredNodes, layoutMode]);

  const displayNodeMap = useMemo(
    () => Object.fromEntries(displayNodes.map((node: any) => [node.id, node])),
    [displayNodes],
  );

  const viewBox = useMemo(() => {
    if (!displayNodes.length) return '0 0 600 360';

    const left = Math.min(...displayNodes.map((node: any) => node.x - node.r - 32));
    const right = Math.max(...displayNodes.map((node: any) => node.x + node.r + 32));
    const top = Math.min(...displayNodes.map((node: any) => node.y - node.r - 32));
    const bottom = Math.max(...displayNodes.map((node: any) => node.y + node.r + 48));

    const width = Math.max(680, right - left);
    const height = Math.max(420, bottom - top);
    const safeZoom = Math.min(1.8, Math.max(0.35, zoom));
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const adjustedWidth = width / safeZoom;
    const adjustedHeight = height / safeZoom;
    const adjustedLeft = centerX - adjustedWidth / 2 + pan.x;
    const adjustedTop = centerY - adjustedHeight / 2 + pan.y;

    return `${adjustedLeft} ${adjustedTop} ${adjustedWidth} ${adjustedHeight}`;
  }, [displayNodes, zoom, pan]);

  const filteredIds = new Set(displayNodes.map((n: any) => n.id));

  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setHoveredNode(null);
  }, [selectedScanId, filter, layoutMode]);

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const next = event.deltaY < 0
      ? Math.min(2.2, Number((zoom + 0.06).toFixed(2)))
      : Math.max(0.35, Number((zoom - 0.06).toFixed(2)));
    setZoom(next);
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as SVGSVGElement).setPointerCapture(event.pointerId);
    setIsPanning(true);
    setDragStart({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y });
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragStart || !svgRef.current) return;
    const vb = svgRef.current.viewBox.baseVal;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = vb.width / Math.max(1, rect.width);
    const scaleY = vb.height / Math.max(1, rect.height);
    const deltaX = (event.clientX - dragStart.x) * scaleX;
    const deltaY = (event.clientY - dragStart.y) * scaleY;

    setPan({
      x: dragStart.panX - deltaX,
      y: dragStart.panY - deltaY,
    });
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if ((event.currentTarget as SVGSVGElement).hasPointerCapture(event.pointerId)) {
      (event.currentTarget as SVGSVGElement).releasePointerCapture(event.pointerId);
    }
    setIsPanning(false);
    setDragStart(null);
  };

  return (
    <div className="bg-surface rounded-xl border border-[hsl(var(--border-default))] p-5 shadow-[0_18px_42px_-28px_hsl(var(--brand-primary)/0.45)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-body font-bold text-sm text-foreground">Asset Discovery Network Graph</h3>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-status-safe/10 text-status-safe border border-status-safe/20 mt-1 inline-block">
            <span className="animate-pulse-dot">●</span> LIVE DATA
          </span>
          <p className="font-body text-[11px] text-muted-foreground mt-2">
            Tip: hover nodes to isolate relationships. Click-drag to pan. Use mouse wheel or trackpad pinch/scroll to zoom.
          </p>
        </div>
        <div className="flex gap-1 flex-wrap justify-end">
          <button
            onClick={() => setZoom((value) => Math.max(0.35, Number((value - 0.08).toFixed(2))))}
            className="font-mono text-[10px] px-2 py-1 rounded-md bg-sunken text-muted-foreground hover:bg-brand-primary/10"
            title="Zoom out"
          >
            -
          </button>
          <button
            onClick={() => setZoom(0.62)}
            className="font-mono text-[10px] px-2 py-1 rounded-md bg-sunken text-muted-foreground hover:bg-brand-primary/10"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => setZoom((value) => Math.min(1.8, Number((value + 0.08).toFixed(2))))}
            className="font-mono text-[10px] px-2 py-1 rounded-md bg-sunken text-muted-foreground hover:bg-brand-primary/10"
            title="Zoom in"
          >
            +
          </button>
          {(['auto', 'three-phase'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setLayoutMode(mode)}
              className={`font-mono text-[10px] px-2 py-1 rounded-md transition-colors ${
                layoutMode === mode ? 'bg-brand-primary text-white' : 'bg-sunken text-muted-foreground hover:bg-brand-primary/10'
              }`}
              title={mode === 'auto' ? 'Use discovered graph layout' : 'Force Domain -> IP -> Service lanes'}
            >
              {mode === 'auto' ? 'LAYOUT:AUTO' : 'LAYOUT:3PH'}
            </button>
          ))}
          {(['auto', 'on', 'off'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setLabelMode(mode)}
              className={`font-mono text-[10px] px-2 py-1 rounded-md transition-colors ${
                labelMode === mode ? 'bg-brand-primary text-white' : 'bg-sunken text-muted-foreground hover:bg-brand-primary/10'
              }`}
              title={`Labels ${mode}`}
            >
              L:{mode.toUpperCase()}
            </button>
          ))}
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

      <div className="relative group h-[58vh] min-h-[440px] overflow-hidden rounded-lg border border-[hsl(var(--border-default))] bg-background/40">
        <svg
          ref={svgRef}
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          className={`w-full h-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Edges */}
          {edges.map(([from, to], idx) => {
            const a = displayNodeMap[from];
            const b = displayNodeMap[to];
            if (!a || !b || !filteredIds.has(from) || !filteredIds.has(to)) return null;

            if (isDenseGraph && hoveredNode && from !== hoveredNode && to !== hoveredNode) return null;
            if (isDenseGraph && !hoveredNode && idx % 4 !== 0) return null;

            const isHovered = hoveredNode === from || hoveredNode === to;
            return (
              <line
                key={`${from}-${to}-${idx}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isHovered ? 'hsl(var(--brand-primary))' : 'hsl(var(--border-default))'}
                strokeWidth={isHovered ? "2" : "1"}
                strokeOpacity={isHovered ? "0.82" : isDenseGraph ? "0.22" : "0.4"}
                className="transition-all duration-300"
              />
            );
          })}

          {/* Nodes */}
          {displayNodes.map((n: any) => (
            <g 
              key={n.id} 
              onMouseEnter={() => setHoveredNode(n.id)}
              onMouseLeave={() => setHoveredNode(null)}
              className="cursor-pointer"
            >
              {(() => {
                const displayRadius = isDenseGraph ? Math.max(5, Math.min(n.r, 8)) : n.r;
                return (
                  <circle
                    cx={n.x} cy={n.y} r={displayRadius}
                    fill={getColor(n.status)}
                    opacity={hoveredNode && hoveredNode !== n.id ? 0.3 : 0.85}
                    className="transition-all duration-300"
                    stroke={hoveredNode === n.id ? "white" : "none"}
                    strokeWidth="2"
                  />
                );
              })()}
              {(showNodeLabels || hoveredNode === n.id) && (
                <text
                  x={n.x} y={n.y + (isDenseGraph ? 16 : n.r + 12)}
                  textAnchor="middle"
                  className="font-mono select-none pointer-events-none"
                  fontSize={isDenseGraph ? '7' : '8'}
                  fill={hoveredNode === n.id ? "hsl(var(--foreground))" : "hsl(var(--text-secondary))"}
                  fontWeight={hoveredNode === n.id ? "bold" : "normal"}
                >
                  {labelText(n.label || n.id)}
                </text>
              )}
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

        {isDenseGraph && !hoveredNode && (
          <div className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-mono text-white/80 pointer-events-none">
            Dense graph mode: labels reduced, sample links shown. Hover a node for focused connections.
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
