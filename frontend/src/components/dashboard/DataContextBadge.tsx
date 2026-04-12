import { useMemo } from 'react';
import { RefreshCw, ChevronDown, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as demoData from '@/data/demoData';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import { api } from '@/lib/api';
import { adaptScanHistory } from '@/lib/adapters';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

const DataContextBadge = () => {
  const navigate = useNavigate();
  const { selectedScanId, setSelectedScanId, selectedScan: selectedScanFromContext } = useSelectedScan();
  const { data: liveHistory } = useQuery({
    queryKey: ['scan-history-badge'],
    queryFn: async () => {
      const response = await api.getScanHistory();
      const adapted = adaptScanHistory(response);
      const latestRealScanId = [...response.items]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.scan_id ?? null;

      return { adapted, latestRealScanId };
    },
  });

  const scanHistory = useMemo(() => {
    if (!liveHistory?.adapted?.length) return demoData.scanHistory;

    const fallbackScans = demoData.scanHistory.filter(
      (demoScan) => !liveHistory.adapted.some((realScan) => realScan.id === demoScan.id),
    );

    return [...liveHistory.adapted, ...fallbackScans];
  }, [liveHistory]);

  const latestScanId = liveHistory?.latestRealScanId ?? 'SCN-007';
  const activeSelectedScan = scanHistory.find((scan) => scan.id === selectedScanId) ?? selectedScanFromContext;
  const selectedScan = activeSelectedScan;
  const isHistorical = selectedScanId !== latestScanId;

  if (!activeSelectedScan) return null;

  return (
    <div className="flex flex-wrap items-start gap-2">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[hsl(var(--bg-sunken))] border border-[hsl(var(--border-default))] w-fit">
        <span className="text-sm">📡</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 text-[11px] font-body text-muted-foreground hover:text-foreground transition-colors">
              Data from: <span className="font-mono font-semibold text-foreground">{selectedScan.id}</span> · {selectedScan.target} · {selectedScan.started}
              <ChevronDown className="w-3 h-3 ml-0.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[380px]">
            {scanHistory.map(s => (
              <DropdownMenuItem
                key={s.id}
                onClick={() => setSelectedScanId(s.id)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.id === selectedScanId ? 'bg-[hsl(var(--accent-amber))]' : 'bg-transparent border border-muted-foreground/30'}`} />
                <span className="font-mono text-xs font-semibold w-16">{s.id}</span>
                <span className="font-mono text-xs text-muted-foreground flex-1 truncate">{s.target}</span>
                <span className="text-[10px] text-muted-foreground">{s.started.split(',')[0]}</span>
                {s.id === latestScanId && <span className="text-[9px] text-[hsl(var(--accent-amber))] font-body">(current)</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          onClick={() => navigate('/scanner')}
          className="text-[11px] text-brand-primary hover:underline flex items-center gap-1 font-body"
        >
          <RefreshCw className="w-3 h-3" /> {isHistorical ? 'Re-scan this target' : 'Refresh'}
        </button>
      </div>
      {isHistorical && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[hsl(var(--accent-amber)/0.08)] border border-[hsl(var(--accent-amber)/0.2)] w-fit">
          <AlertTriangle className="w-3 h-3 text-[hsl(var(--accent-amber))]" />
          <span className="text-[11px] font-body text-[hsl(var(--accent-amber))]">
            Viewing historical scan {selectedScanId} · {selectedScan.started.split(',')[0]} — This is not current data.
          </span>
          <button
            onClick={() => setSelectedScanId(latestScanId)}
            className="text-[11px] font-body font-semibold text-[hsl(var(--accent-amber))] hover:underline ml-1"
          >
            Switch to Latest →
          </button>
        </div>
      )}
    </div>
  );
};

export default DataContextBadge;
