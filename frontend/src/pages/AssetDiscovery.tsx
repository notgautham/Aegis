import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useScanContext } from '@/contexts/ScanContext';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import DiscoveryDetailPanel from '@/components/dashboard/DiscoveryDetailPanel';
import { Globe, Key, Server, Cpu, Share2, AlertTriangle, Search, Filter, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { domainRecords, ipRecords, softwareRecords, shadowITAlerts, assets } from '@/data/demoData';
import type { DomainRecord, IPRecord, SoftwareRecord, Asset } from '@/data/demoData';
import NetworkGraph from '@/components/dashboard/NetworkGraph';

const tabDefs = [
  { id: 'domains', label: 'Domains', icon: Globe },
  { id: 'ssl', label: 'SSL Certificates', icon: Key },
  { id: 'ip', label: 'IP / Subnets', icon: Server },
  { id: 'software', label: 'Software & Services', icon: Cpu },
  { id: 'network', label: 'Network Graph', icon: Share2 },
  { id: 'shadow', label: 'Shadow IT', icon: AlertTriangle },
];

const riskBadge = (score: number) => {
  if (score >= 75) return <Badge variant="destructive" className="text-[10px]">Critical</Badge>;
  if (score >= 50) return <Badge className="bg-[hsl(var(--status-warn))] text-white text-[10px]">High</Badge>;
  if (score >= 25) return <Badge className="bg-[hsl(var(--accent-amber))] text-white text-[10px]">Medium</Badge>;
  return <Badge className="bg-[hsl(var(--status-safe))] text-white text-[10px]">Low</Badge>;
};

const AssetDiscovery = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'domains';
  const [search, setSearch] = useState('');
  const { rootDomain } = useScanContext();
  const { selectedAssets, selectedScanId, selectedScan } = useSelectedScan();
  const d = rootDomain || 'target.com';

  // Scope toggle state
  const [scopeMode, setScopeMode] = useState<'this-scan' | 'all-time'>('this-scan');
  const displayAssets = scopeMode === 'this-scan' ? selectedAssets : assets;

  // Discovery detail panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelType, setPanelType] = useState<'domain' | 'ssl' | 'ip' | 'software'>('domain');
  const [selectedDomain, setSelectedDomain] = useState<DomainRecord | undefined>();
  const [selectedAssetForPanel, setSelectedAssetForPanel] = useState<Asset | undefined>();
  const [selectedIP, setSelectedIP] = useState<IPRecord | undefined>();
  const [selectedSoftware, setSelectedSoftware] = useState<SoftwareRecord | undefined>();

  const setTab = (tab: string) => setSearchParams({ tab });

  return (
    <div className="space-y-5">
      <DataContextBadge />
      <h1 className="font-display text-2xl italic text-brand-primary">Asset Discovery</h1>

      {/* Scope toggle */}
      <div className="flex items-center gap-2">
        <div className="flex gap-0 p-0.5 rounded-lg bg-[hsl(var(--bg-sunken))] border border-border w-fit">
          <button
            onClick={() => setScopeMode('this-scan')}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-body transition-all",
              scopeMode === 'this-scan' ? "bg-white shadow-sm text-brand-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >📡 This Scan</button>
          <button
            onClick={() => setScopeMode('all-time')}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-body transition-all",
              scopeMode === 'all-time' ? "bg-white shadow-sm text-brand-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >🕐 All Time</button>
        </div>
      </div>

      {scopeMode === 'this-scan' && selectedScan && (
        <p className="text-[11px] font-body text-muted-foreground">
          Showing results from <span className="font-mono font-semibold text-foreground">{selectedScanId}</span> · {selectedScan.target} · <button onClick={() => setScopeMode('all-time')} className="text-brand-primary hover:underline">Switch to All Time</button> for full history.
        </p>
      )}

      {/* Tab strip + search/filter on same row */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 rounded-xl bg-[hsl(var(--bg-sunken))] w-fit">
          {tabDefs.map(t => {
            const countMap: Record<string, number> = {
              domains: domainRecords.length,
              ssl: displayAssets.filter(a => a.certInfo.subject_cn !== 'staging.pnb.co.in').length,
              ip: ipRecords.length,
              software: softwareRecords.length,
              network: 0,
              shadow: shadowITAlerts.length,
            };
            const count = countMap[t.id];
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body transition-all",
                activeTab === t.id ? "bg-white shadow-sm text-brand-primary font-semibold" : "text-muted-foreground hover:text-foreground"
              )}>
                <t.icon className="w-3.5 h-3.5" />{t.label}{count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assets..." className="pl-8 h-8 w-56 text-xs" />
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1"><Filter className="w-3 h-3" />Filters</Button>
        </div>
      </div>

      {/* Tab content */}
      {/* Domains tab — uses domainRecords (always all-time, own dataset) */}
      {activeTab === 'domains' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
          <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-body">
                  <thead><tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Detection</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Domain</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Registered</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Expiry</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Registrar</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Risk</th>
                  </tr></thead>
                  <tbody>
                    {domainRecords.filter(d => !search || d.domain.includes(search)).map((d, i) => (
                      <tr
                        key={d.domain}
                        onClick={() => { setSelectedDomain(d); setPanelType('domain'); setPanelOpen(true); }}
                        className={cn("border-b border-border/50 cursor-pointer hover:bg-[hsl(var(--bg-sunken))] transition-colors", i % 2 === 0 && "bg-[hsl(var(--bg-sunken)/0.3)]")}
                      >
                        <td className="px-3 py-2 font-mono text-muted-foreground">{d.detectionDate}</td>
                        <td className="px-3 py-2 font-mono font-medium text-foreground">{d.domain}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{d.registrationDate}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{d.expiryDate}</td>
                        <td className="px-3 py-2 text-muted-foreground">{d.registrar}</td>
                        <td className="px-3 py-2">
                          <Badge variant={d.status === 'new' ? 'default' : 'secondary'} className="text-[10px]">{d.status}</Badge>
                        </td>
                        <td className="px-3 py-2">{riskBadge(d.riskScore)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)] h-fit">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Smart Insights</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-xs font-body">
              <div className="p-2.5 rounded-lg bg-[hsl(var(--status-warn)/0.08)] border border-[hsl(var(--status-warn)/0.2)]">
                <p className="font-medium text-[hsl(var(--status-warn))]">3 newly discovered domains</p>
                <p className="text-muted-foreground mt-0.5">Including potential Shadow IT assets</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[hsl(var(--status-critical)/0.08)] border border-[hsl(var(--status-critical)/0.2)]">
                <p className="font-medium text-[hsl(var(--status-critical))]">2 domains expiring soon</p>
                <p className="text-muted-foreground mt-0.5">staging.{d}, test-portal.{d}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[hsl(var(--status-safe)/0.08)] border border-[hsl(var(--status-safe)/0.2)]">
                <p className="font-medium text-[hsl(var(--status-safe))]">9 domains confirmed safe</p>
                <p className="text-muted-foreground mt-0.5">Registered with authorized registrar</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'ssl' && (
        <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-body">
                <thead><tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">CN</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">SANs</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">CA</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Algo</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Key</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Valid Until</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Days Left</th>
                </tr></thead>
                <tbody>
                  {displayAssets.filter(a => a.certInfo.subject_cn !== 'staging.pnb.co.in').map((a, i) => (
                    <tr
                      key={a.id}
                      onClick={() => { setSelectedAssetForPanel(a); setPanelType('ssl'); setPanelOpen(true); }}
                      className={cn("border-b border-border/50 cursor-pointer hover:bg-[hsl(var(--bg-sunken))] transition-colors", i % 2 === 0 && "bg-[hsl(var(--bg-sunken)/0.3)]")}
                    >
                      <td className="px-3 py-2 font-mono font-medium">{a.certInfo.subject_cn}</td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{a.certInfo.subject_alt_names.join(', ')}</td>
                      <td className="px-3 py-2 text-muted-foreground">{a.certInfo.certificate_authority}</td>
                      <td className="px-3 py-2 font-mono">{a.certInfo.signature_algorithm.substring(0, 16)}</td>
                      <td className="px-3 py-2 font-mono">{a.certInfo.key_type}-{a.certInfo.key_size || 'PQC'}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{a.certInfo.valid_until}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-[hsl(var(--bg-sunken))]">
                            <div className="h-full rounded-full" style={{
                              width: `${Math.min(100, (a.certInfo.days_remaining / 365) * 100)}%`,
                              backgroundColor: a.certInfo.days_remaining <= 30 ? 'hsl(var(--status-critical))' : a.certInfo.days_remaining <= 90 ? 'hsl(var(--accent-amber))' : 'hsl(var(--status-safe))'
                            }} />
                          </div>
                          <span className={cn("font-mono", a.certInfo.days_remaining <= 30 ? "text-[hsl(var(--status-critical))]" : "text-muted-foreground")}>{a.certInfo.days_remaining}d</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* IP/Subnets tab — uses ipRecords (always all-time, own dataset) */}
      {activeTab === 'ip' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <Card className="flex-1 p-3 shadow-sm"><p className="text-[10px] text-muted-foreground font-body">CRITICAL FINDING</p><p className="text-xs font-body font-medium text-[hsl(var(--status-critical))] mt-1">Port 3389 open on staging.{d} — RDP accessible from internet</p></Card>
            <Card className="flex-1 p-3 shadow-sm"><p className="text-[10px] text-muted-foreground font-body">ALERT</p><p className="text-xs font-body font-medium text-[hsl(var(--status-warn))] mt-1">Port 22 open on vpn.{d} — SSH exposure on internet-facing asset</p></Card>
          </div>
          <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-body">
                  <thead><tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">IP</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Ports</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Subnet</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">ASN</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Location</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">rDNS</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Risk</th>
                  </tr></thead>
                  <tbody>
                    {ipRecords.map((r, i) => (
                      <tr
                        key={r.ip}
                        onClick={() => { setSelectedIP(r); setPanelType('ip'); setPanelOpen(true); }}
                        className={cn("border-b border-border/50 cursor-pointer hover:bg-[hsl(var(--bg-sunken))]", i % 2 === 0 && "bg-[hsl(var(--bg-sunken)/0.3)]")}
                      >
                        <td className="px-3 py-2 font-mono font-medium">{r.ip}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{r.portsOpen.join(', ')}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{r.subnet}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.asn}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.city}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{r.reverseDns}</td>
                        <td className="px-3 py-2"><Badge variant={r.risk === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">{r.risk}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Software tab — uses softwareRecords (always all-time, own dataset) */}
      {activeTab === 'software' && (
        <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-body">
                <thead><tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Product</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Version</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Host</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">EOL Status</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">CVEs</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">PQC</th>
                </tr></thead>
                <tbody>
                  {softwareRecords.map((s, i) => (
                    <tr
                      key={`${s.product}-${s.hostIp}`}
                      onClick={() => { setSelectedSoftware(s); setPanelType('software'); setPanelOpen(true); }}
                      className={cn("border-b border-border/50 cursor-pointer hover:bg-[hsl(var(--bg-sunken))]", i % 2 === 0 && "bg-[hsl(var(--bg-sunken)/0.3)]")}
                    >
                      <td className="px-3 py-2 font-medium">{s.product}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{s.version}</td>
                      <td className="px-3 py-2 text-muted-foreground">{s.type}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{s.hostname}</td>
                      <td className="px-3 py-2">
                        <Badge className={cn("text-[10px]", s.eolStatus === 'end_of_life' ? 'bg-[hsl(var(--status-critical))] text-white' : s.eolStatus === 'eol_soon' ? 'bg-[hsl(var(--accent-amber))] text-white' : 'bg-[hsl(var(--status-safe))] text-white')}>
                          {s.eolStatus === 'end_of_life' ? 'EOL' : s.eolStatus === 'eol_soon' ? 'EOL Soon' : 'Supported'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{s.cveCount > 0 ? <Badge variant="destructive" className="text-[10px]">{s.cveCount} CVEs</Badge> : <span className="text-muted-foreground">0</span>}</td>
                      <td className="px-3 py-2">
                        {s.pqcSupport === 'native' ? <span className="text-[hsl(var(--status-safe))]">✅ Native</span> : s.pqcSupport === 'plugin' ? <span className="text-[hsl(var(--accent-amber))]">⚠ Plugin</span> : <span className="text-[hsl(var(--status-critical))]">❌ None</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'network' && <NetworkGraph />}

      {activeTab === 'shadow' && (
        <div className="space-y-4">
          <Card className="p-3 shadow-sm border-[hsl(var(--status-warn)/0.3)] bg-[hsl(var(--status-warn)/0.05)]">
            <p className="text-xs font-body font-medium text-[hsl(var(--status-warn))]">⚠ {shadowITAlerts.length} Shadow IT assets detected — not in official inventory</p>
          </Card>
          <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-body">
                  <thead><tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Discovered</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Asset</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Detection</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Risk</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Actions</th>
                  </tr></thead>
                  <tbody>
                    {shadowITAlerts.map((s, i) => (
                      <tr key={s.asset} className={cn("border-b border-border/50 hover:bg-[hsl(var(--bg-sunken))]", i % 2 === 0 && "bg-[hsl(var(--bg-sunken)/0.3)]")}>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{s.discoveryDate}</td>
                        <td className="px-3 py-2 font-mono font-medium">{s.asset}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.assetType}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.howDiscovered}</td>
                        <td className="px-3 py-2"><Badge variant={s.riskLevel === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">{s.riskLevel}</Badge></td>
                        <td className="px-3 py-2 flex gap-1">
                          <Button variant="outline" size="sm" className="h-6 text-[10px] px-2">Add to Inventory</Button>
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2">Scan</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <DiscoveryDetailPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        type={panelType}
        domainRecord={selectedDomain}
        asset={selectedAssetForPanel}
        ipRecord={selectedIP}
        softwareRecord={selectedSoftware}
      />
    </div>
  );
};

export default AssetDiscovery;
