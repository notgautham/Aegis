import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandShortcut,
} from '@/components/ui/command';
import {
  Home, Search, Package, ClipboardList, ShieldCheck, Star,
  Wrench, BarChart3, Settings, Globe, Key, FileText,
  Cpu, Lock, Sparkles, Map, Calendar, PenTool, Bell, Plug, Clock, HelpCircle,
} from 'lucide-react';
import { scanHistory as demoScanHistory, getStatusColor, getStatusLabel, getQScoreColor } from '@/data/demoData';
import type { Asset, ScanHistoryEntry } from '@/data/demoData';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import { api } from '@/lib/api';
import { adaptScanHistory } from '@/lib/adapters';

interface SearchRoute {
  label: string;
  path: string;
  icon: React.ElementType;
  group: string;
  keywords: string[];
}

const searchRoutes: SearchRoute[] = [
  { label: 'Dashboard Home', path: '/dashboard', icon: Home, group: 'Navigation', keywords: ['home', 'overview', 'main'] },
  { label: 'Scanner', path: '/scanner', icon: ShieldCheck, group: 'Navigation', keywords: ['scan', 'scanner', 'start'] },
  { label: 'Asset Discovery', path: '/dashboard/discovery', icon: Search, group: 'Navigation', keywords: ['domains', 'discover', 'find'] },
  { label: 'Asset Inventory', path: '/dashboard/inventory', icon: Package, group: 'Navigation', keywords: ['assets', 'inventory', 'list'] },
  { label: 'Scan History', path: '/dashboard/history', icon: Clock, group: 'Navigation', keywords: ['scan', 'history', 'past', 'previous'] },
  { label: 'CBOM Overview', path: '/dashboard/cbom', icon: ClipboardList, group: 'CBOM', keywords: ['cbom', 'cryptographic', 'bill of materials'] },
  { label: 'CBOM Per-Asset', path: '/dashboard/cbom/per-asset', icon: Cpu, group: 'CBOM', keywords: ['cbom', 'asset', 'detail'] },
  { label: 'CBOM Export', path: '/dashboard/cbom/export', icon: FileText, group: 'CBOM', keywords: ['export', 'download', 'cbom'] },
  { label: 'PQC Compliance', path: '/dashboard/pqc/compliance', icon: ShieldCheck, group: 'PQC Posture', keywords: ['pqc', 'compliance', 'quantum'] },
  { label: 'HNDL Intel', path: '/dashboard/pqc/hndl', icon: Lock, group: 'PQC Posture', keywords: ['hndl', 'harvest', 'now decrypt later'] },
  { label: 'Quantum Debt', path: '/dashboard/pqc/quantum-debt', icon: BarChart3, group: 'PQC Posture', keywords: ['quantum', 'debt', 'risk'] },
  { label: 'Enterprise Rating', path: '/dashboard/rating/enterprise', icon: Star, group: 'Cyber Rating', keywords: ['rating', 'score', 'enterprise'] },
  { label: 'Per-Asset Rating', path: '/dashboard/rating/per-asset', icon: FileText, group: 'Cyber Rating', keywords: ['rating', 'asset'] },
  { label: 'View PQC Tier Criteria', path: '/dashboard/rating/enterprise?tiers=open', icon: HelpCircle, group: 'Cyber Rating', keywords: ['tier', 'classification', 'criteria'] },
  { label: 'Action Plan', path: '/dashboard/remediation/action-plan', icon: Wrench, group: 'Remediation', keywords: ['remediation', 'action', 'fix'] },
  { label: 'AI Patch Generator', path: '/dashboard/remediation/ai-patch', icon: Sparkles, group: 'Remediation', keywords: ['ai', 'patch', 'config', 'fix'] },
  { label: 'Migration Roadmap', path: '/dashboard/remediation/roadmap', icon: Map, group: 'Remediation', keywords: ['roadmap', 'migration', 'timeline'] },
  { label: 'Executive Reports', path: '/dashboard/reporting/executive', icon: Key, group: 'Reporting', keywords: ['report', 'executive', 'summary'] },
  { label: 'Scheduled Reports', path: '/dashboard/reporting/scheduled', icon: Calendar, group: 'Reporting', keywords: ['schedule', 'report', 'automated'] },
  { label: 'On-Demand Builder', path: '/dashboard/reporting/on-demand', icon: PenTool, group: 'Reporting', keywords: ['report', 'custom', 'build'] },
  { label: 'Scan Configuration', path: '/dashboard/settings/scan-config', icon: Settings, group: 'Settings', keywords: ['settings', 'config', 'scan'] },
  { label: 'Notifications', path: '/dashboard/settings/notifications', icon: Bell, group: 'Settings', keywords: ['notifications', 'alerts', 'email'] },
  { label: 'Integrations', path: '/dashboard/settings/integrations', icon: Plug, group: 'Settings', keywords: ['integrations', 'jira', 'slack', 'connect'] },
];

// Query syntax patterns
const queryPatterns = [
  { prefix: 'cipher:', filter: (val: string) => (a: Asset) => a.cipher.toLowerCase().includes(val.toLowerCase()) },
  { prefix: 'tls:', filter: (val: string) => (a: Asset) => a.tlsVersionsSupported.some(t => t.includes(val.replace('.', '_'))) || a.tls.includes(val) },
  { prefix: 'status:', filter: (val: string) => (a: Asset) => a.status.includes(val.toLowerCase()) },
  { prefix: 'type:', filter: (val: string) => (a: Asset) => a.type.includes(val.toLowerCase()) },
  { prefix: 'score:<', filter: (val: string) => (a: Asset) => a.qScore < parseInt(val) },
  { prefix: 'score:>', filter: (val: string) => (a: Asset) => a.qScore > parseInt(val) },
  { prefix: 'expiry:<', filter: (val: string) => (a: Asset) => { const days = parseInt(val); return a.certInfo.days_remaining > 0 && a.certInfo.days_remaining < days; }},
];

const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const { selectedAssets, setSelectedScanId } = useSelectedScan();

  const historyQuery = useQuery({
    queryKey: ['command-palette-scan-history'],
    queryFn: async (): Promise<ScanHistoryEntry[]> => adaptScanHistory(await api.getScanHistory()),
    staleTime: 30000,
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const resolvedScanHistory = historyQuery.data && historyQuery.data.length > 0
    ? historyQuery.data
    : demoScanHistory;

  // Check if search is a query
  const queryResult = useMemo(() => {
    if (!search) return null;
    for (const pattern of queryPatterns) {
      if (search.startsWith(pattern.prefix)) {
        const val = search.slice(pattern.prefix.length).replace('d', '');
        if (!val) return null;
        const filtered = selectedAssets.filter(pattern.filter(val));
        return { query: search, results: filtered };
      }
    }
    return null;
  }, [search, selectedAssets]);

  const groups = Array.from(new Set(searchRoutes.map(r => r.group)));

  return (
    <CommandDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(''); }}>
      <CommandInput placeholder="Search pages, assets, settings..." value={search} onValueChange={setSearch} />
      <CommandList>
        {queryResult ? (
          <>
            <CommandGroup heading={`Assets matching "${queryResult.query}" — ${queryResult.results.length} results`}>
              {queryResult.results.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground font-body">No assets match this query.</p>
              ) : (
                queryResult.results.map(a => (
                  <CommandItem
                    key={a.id}
                    value={a.domain}
                    onSelect={() => handleSelect(`/dashboard/assets/${a.domain.replace(/\./g, '-')}`)}
                    className="cursor-pointer"
                    >
                      <Globe className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono text-xs flex-1">{a.domain}</span>
                      <span className="font-mono text-[10px] text-muted-foreground mr-2">{a.ip}</span>
                    <span className="font-mono text-[10px] font-bold mr-2" style={{ color: getQScoreColor(a.qScore) }}>{a.qScore}</span>
                    <span className="text-[9px] font-mono px-1 rounded" style={{ color: getStatusColor(a.status), backgroundColor: `${getStatusColor(a.status)}15` }}>{getStatusLabel(a.status)}</span>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          </>
        ) : (
          <>
            <CommandEmpty>No results found.</CommandEmpty>
            {groups.map(group => (
              <CommandGroup key={group} heading={group}>
                {searchRoutes.filter(r => r.group === group).map(route => {
                  const Icon = route.icon;
                  return (
                    <CommandItem
                      key={route.path}
                      value={`${route.label} ${route.keywords.join(' ')}`}
                      onSelect={() => handleSelect(route.path)}
                      className="cursor-pointer"
                    >
                      <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="font-body text-sm">{route.label}</span>
                      {route.group === 'Navigation' && <CommandShortcut className="font-mono text-[10px]">→</CommandShortcut>}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
            <CommandGroup heading="Scans">
              {resolvedScanHistory.map(s => (
                <CommandItem
                  key={s.id}
                  value={`${s.id} ${s.target} scan report`}
                  onSelect={() => {
                    setSelectedScanId(s.id);
                    handleSelect(`/dashboard/scans/${s.id}`);
                  }}
                  className="cursor-pointer"
                >
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-xs">{s.id}</span>
                  <span className="font-body text-xs text-muted-foreground ml-2">{s.target} · {s.started.split(',')[0]}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {!search && (
          <div className="px-4 py-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground font-body">Try: <span className="font-mono">cipher:DES</span> · <span className="font-mono">expiry:&lt;30d</span> · <span className="font-mono">score:&lt;50</span> · <span className="font-mono">status:critical</span></p>
          </div>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;
