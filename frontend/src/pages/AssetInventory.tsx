import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Package, Globe, Server, Key, Mail } from 'lucide-react';
import { getStatusColor, getStatusLabel } from '@/data/demoData';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const typeIcons: Record<string, React.ElementType> = { vpn: Key, web: Globe, api: Server, mail: Mail, iot: Cpu, server: Server, load_balancer: Server };
import { Cpu } from 'lucide-react';

const AssetInventory = () => {
  const navigate = useNavigate();
  const { selectedAssets } = useSelectedScan();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const filtered = selectedAssets.filter(a => {
    if (search && !a.domain.includes(search) && !a.ip.includes(search)) return false;
    if (filter !== 'all' && a.type !== filter) return false;
    return true;
  });

  const typeCount = (t: string) => selectedAssets.filter(a => a.type === t).length;
  const filters = [
    { id: 'all', label: 'All', count: selectedAssets.length },
    { id: 'web', label: 'Web Apps', count: typeCount('web') },
    { id: 'api', label: 'APIs', count: typeCount('api') },
    { id: 'vpn', label: 'VPNs', count: typeCount('vpn') },
    { id: 'mail', label: 'Mail', count: typeCount('mail') },
  ];

  return (
    <div className="space-y-5">
      <DataContextBadge />
      <div>
        <h1 className="font-display text-2xl italic text-brand-primary">Asset Inventory</h1>
        <p className="text-xs font-body text-muted-foreground mt-0.5">{selectedAssets.length} assets</p>
      </div>

      {/* Filters + search/add on same row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm font-body"><span className="font-semibold text-foreground">{selectedAssets.length}</span> <span className="text-muted-foreground">total assets</span></div>
          <div className="h-4 w-px bg-border" />
          <div className="flex gap-1.5">
            {filters.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-body transition-all",
                filter === f.id ? "bg-brand-primary text-white" : "bg-[hsl(var(--bg-sunken))] text-muted-foreground hover:text-foreground"
              )}>
                {f.label} ({f.count})
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assets..." className="pl-8 h-8 w-56 text-xs" />
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1"><Plus className="w-3 h-3" />Add Asset</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader><SheetTitle>Add New Asset</SheetTitle></SheetHeader>
              <div className="mt-6 space-y-4">
                <div><label className="text-xs font-body font-medium text-muted-foreground">Asset Name</label><Input className="mt-1 text-xs" placeholder="e.g. portal.example.com" /></div>
                <div><label className="text-xs font-body font-medium text-muted-foreground">URL / Domain</label><Input className="mt-1 text-xs" placeholder="https://..." /></div>
                <div><label className="text-xs font-body font-medium text-muted-foreground">Asset Type</label><select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"><option>Web App</option><option>API</option><option>VPN</option><option>Mail</option><option>Server</option></select></div>
                <div><label className="text-xs font-body font-medium text-muted-foreground">Owner Team</label><Input className="mt-1 text-xs" placeholder="e.g. Digital Banking" /></div>
                <div><label className="text-xs font-body font-medium text-muted-foreground">Business Criticality</label><select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-xs"><option>Customer Facing</option><option>Internal</option><option>Compliance Critical</option></select></div>
                <Button className="w-full mt-4">Add & Scan</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Table */}
      <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-body">
              <thead><tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Asset</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">IP</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Owner</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Criticality</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">TLS</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Cipher</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Key</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Q-Score</th>
                <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Cert Expiry</th>
              </tr></thead>
              <tbody>
                {filtered.map((a, i) => (
                  <tr key={a.id} className={cn("border-b border-border/50 hover:bg-[hsl(var(--bg-sunken))] transition-colors cursor-pointer", i % 2 === 0 && "bg-[hsl(var(--bg-sunken)/0.3)]")}>
                    <td className="px-3 py-2 font-mono font-medium text-foreground cursor-pointer hover:text-brand-primary" onClick={() => navigate(`/dashboard/assets/${a.domain.replace(/\./g, '-')}`)}>{a.domain}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{a.ip}</td>
                    <td className="px-3 py-2"><Badge variant="secondary" className="text-[10px]">{a.type}</Badge></td>
                    <td className="px-3 py-2 text-muted-foreground">{a.ownerTeam}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{a.businessCriticality.replace('_', ' ')}</Badge></td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{a.tls}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground text-[10px] max-w-[120px] truncate">{a.cipher}</td>
                    <td className="px-3 py-2 font-mono">{a.certificate}</td>
                    <td className="px-3 py-2"><span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded" style={{ color: getStatusColor(a.status), backgroundColor: `${getStatusColor(a.status)}15` }}>{getStatusLabel(a.status)}</span></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-8 h-1.5 rounded-full bg-[hsl(var(--bg-sunken))]"><div className="h-full rounded-full" style={{ width: `${a.qScore}%`, backgroundColor: a.qScore <= 40 ? 'hsl(var(--status-critical))' : a.qScore <= 70 ? 'hsl(var(--accent-amber))' : 'hsl(var(--status-safe))' }} /></div>
                        <span className="font-mono">{a.qScore}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{a.certInfo.days_remaining > 0 ? `${a.certInfo.days_remaining}d` : '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AssetInventory;