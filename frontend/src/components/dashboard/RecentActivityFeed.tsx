import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useScanContext } from '@/contexts/ScanContext';
import { api } from '@/lib/api';

const execSubstitutions: [string, string][] = [
  ['Weak cipher', 'Weak encryption method'],
  ['PQC label', 'Security certification'],
  ['Fully Quantum Safe', 'Fully Quantum-Safe'],
];

interface RecentActivityFeedProps {
  execMode?: boolean;
}

interface ActivityEntry {
  icon: string;
  text: string;
  time: string;
  route: string;
}

function toRelativeTime(timestamp: string): string {
  const now = Date.now();
  const value = new Date(timestamp).getTime();
  if (Number.isNaN(value)) return 'just now';

  const deltaMs = value - now;
  const minutes = Math.round(deltaMs / (1000 * 60));
  const hours = Math.round(deltaMs / (1000 * 60 * 60));
  const days = Math.round(deltaMs / (1000 * 60 * 60 * 24));
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  return formatter.format(days, 'day');
}

function iconForKind(kind: string): string {
  const normalized = kind.toLowerCase();
  if (normalized === 'success') return '✅';
  if (normalized === 'error') return '❌';
  if (normalized === 'degraded') return '⚠️';
  if (normalized === 'queued') return '🕒';
  if (normalized === 'stage') return '🔄';
  return '📋';
}

const RecentActivityFeed = ({ execMode = false }: RecentActivityFeedProps) => {
  const navigate = useNavigate();
  const { rootDomain } = useScanContext();
  const d = rootDomain || 'aegis.com';

  const fallbackEntries: ActivityEntry[] = [
    { icon: '✅', text: `Scan completed: 21 assets scanned for ${d}`, time: '10 min ago', route: '' },
    { icon: '⚠️', text: `Weak cipher detected: vpn.${d} (TLS_RSA_WITH_AES_128_CBC_SHA)`, time: '10 min ago', route: '' },
    { icon: '❌', text: `Certificate expiring in 1 day: vpn.${d}`, time: '10 min ago', route: '/dashboard/discovery?tab=ssl' },
    { icon: '🆕', text: `Shadow IT asset discovered: staging-api.${d}`, time: '10 min ago', route: '/dashboard/discovery?tab=shadow' },
    { icon: '🔒', text: 'CBOM generated: aegis-cbom-20260401.json', time: '9 min ago', route: '/dashboard/cbom' },
    { icon: '📋', text: `PQC label issued: pqc-api.${d} — Fully Quantum Safe`, time: '8 min ago', route: '' },
  ];

  const { data } = useQuery({
    queryKey: ['mission-control-recent-activity'],
    queryFn: () => api.getMissionControlActivity(25),
    staleTime: 15000,
  });

  const entries: ActivityEntry[] = data?.items?.length
    ? data.items.map((item) => ({
      icon: iconForKind(item.kind),
      text: `${item.message} (${item.target})`,
      time: toRelativeTime(item.timestamp),
      route: item.route ?? '',
    }))
    : fallbackEntries;

  const applyExecLabels = (text: string) => {
    if (!execMode) return text;
    let result = text;
    execSubstitutions.forEach(([from, to]) => {
      result = result.replace(from, to);
    });
    return result;
  };

  return (
    <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
      <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Recent Activity</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[260px] overflow-y-auto">
          {entries.map((e, i) => (
            <button
              key={i}
              onClick={() => e.route && navigate(e.route)}
              className="w-full flex items-start gap-2.5 px-4 py-2.5 text-left hover:bg-[hsl(var(--bg-sunken))] transition-colors border-b border-border/30 last:border-0"
            >
              <span className="text-sm flex-shrink-0 mt-0.5">{e.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-body text-xs text-foreground leading-relaxed">{applyExecLabels(e.text)}</p>
                <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{e.time}</p>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentActivityFeed;
