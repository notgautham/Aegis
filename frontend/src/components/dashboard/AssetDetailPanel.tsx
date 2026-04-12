import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Asset } from '@/data/demoData';
import { getStatusLabel, getQScoreColor } from '@/data/demoData';
import { buildHndlEstimateExplanation } from '@/lib/hndlModel';
import { Shield, Globe, Lock, Clock, AlertTriangle, Server, Key } from 'lucide-react';

interface AssetDetailPanelProps {
  asset: Asset | null;
  open: boolean;
  onClose: () => void;
}

const priorityColors: Record<string, string> = {
  P1: 'bg-status-critical/10 text-status-critical border-status-critical/20',
  P2: 'bg-status-vuln/10 text-status-vuln border-status-vuln/20',
  P3: 'bg-status-warn/10 text-status-warn border-status-warn/20',
  P4: 'bg-muted text-muted-foreground border-border',
};

const effortLabels: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High' };

const AssetDetailPanel = ({ asset, open, onClose }: AssetDetailPanelProps) => {
  if (!asset) return null;

  const dimensions = [
    { label: 'TLS Version', score: asset.dimensionScores.tls_version, max: 100 },
    { label: 'Key Exchange', score: asset.dimensionScores.key_exchange, max: 100 },
    { label: 'Cipher Strength', score: asset.dimensionScores.cipher_strength, max: 100 },
    { label: 'Certificate', score: asset.dimensionScores.certificate_algo, max: 100 },
    { label: 'Forward Secrecy', score: asset.dimensionScores.forward_secrecy, max: 100 },
    { label: 'PQC Readiness', score: asset.dimensionScores.pqc_readiness, max: 100 },
  ];

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto p-0">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-[hsl(var(--border-default))]">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-brand-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="font-mono text-sm truncate">{asset.domain}</SheetTitle>
                <p className="font-mono text-[10px] text-muted-foreground">{asset.ip} • Port {asset.port}</p>
              </div>
              <Badge className={`font-mono text-[10px] ${asset.status === 'critical' ? 'bg-status-critical/10 text-status-critical' : asset.status === 'safe' || asset.status === 'transitioning' || asset.status === 'elite-pqc' ? 'bg-status-safe/10 text-status-safe' : 'bg-accent-amber/10 text-accent-amber'}`}>
                {getStatusLabel(asset.status)}
              </Badge>
            </div>
          </SheetHeader>

          {/* Q-Score Hero */}
          <div className="flex items-center gap-6 mt-5">
            <div className="relative">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="32" fill="none" stroke="hsl(var(--border-default))" strokeWidth="5" />
                <circle cx="40" cy="40" r="32" fill="none" stroke={getQScoreColor(asset.qScore)} strokeWidth="5" strokeDasharray={`${(asset.qScore / 100) * 201} 201`} strokeLinecap="round" transform="rotate(-90 40 40)" />
                <text x="40" y="44" textAnchor="middle" className="font-mono text-lg font-bold" fill={getQScoreColor(asset.qScore)}>{asset.qScore}</text>
              </svg>
            </div>
            <div className="flex-1 space-y-1.5">
              {dimensions.slice(0, 3).map(d => (
                <div key={d.label} className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground w-20 truncate">{d.label}</span>
                  <div className="flex-1 h-1.5 bg-sunken rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${d.score}%`, backgroundColor: getQScoreColor(d.score) }} />
                  </div>
                  <span className="font-mono text-[10px] w-6 text-right" style={{ color: getQScoreColor(d.score) }}>{d.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="details" className="p-4">
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="details" className="font-mono text-[10px]">Details</TabsTrigger>
            <TabsTrigger value="crypto" className="font-mono text-[10px]">Crypto</TabsTrigger>
            <TabsTrigger value="remediation" className="font-mono text-[10px]">Remediation</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Server, label: 'Type', value: asset.type.toUpperCase() },
                { icon: Shield, label: 'Tier', value: asset.tier.replace('_', ' ').toUpperCase() },
                { icon: Key, label: 'Owner', value: asset.ownerTeam },
                { icon: Clock, label: 'Last Scan', value: new Date(asset.lastScanned).toLocaleDateString() },
              ].map(item => (
                <div key={item.label} className="bg-sunken/50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <item.icon className="w-3 h-3 text-muted-foreground" />
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">{item.label}</span>
                  </div>
                  <p className="font-mono text-xs font-medium text-foreground">{item.value}</p>
                </div>
              ))}
            </div>

            {/* Certificate */}
            <div>
              <h4 className="font-mono text-[10px] text-muted-foreground uppercase mb-2">Certificate</h4>
              <div className="bg-sunken/50 rounded-lg p-3 space-y-2">
                {[
                  { label: 'Issuer', value: asset.certInfo.certificate_authority },
                  { label: 'Algorithm', value: asset.certInfo.signature_algorithm },
                  { label: 'Key', value: `${asset.certInfo.key_type} ${asset.certInfo.key_size}` },
                  { label: 'Expires', value: asset.certInfo.days_remaining > 0 ? `${asset.certInfo.days_remaining} days` : 'Expired' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between">
                    <span className="font-mono text-[10px] text-muted-foreground">{row.label}</span>
                    <span className="font-mono text-xs text-foreground">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* HNDL */}
            {asset.hndlYears !== null && (
              <div className="bg-status-critical/5 border border-status-critical/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-status-critical" />
                  <span className="font-mono text-[10px] text-status-critical font-semibold uppercase">HNDL Risk</span>
                </div>
                <p className="font-body text-xs text-foreground">
                  Data intercepted today could be decrypted in <strong className="font-mono text-status-critical">{asset.hndlYears} years</strong> (by {asset.hndlBreakYear})
                </p>
                <p className="font-body text-[10px] text-muted-foreground mt-2 leading-relaxed">
                  {buildHndlEstimateExplanation({ breakYear: asset.hndlBreakYear })}
                </p>
              </div>
            )}

            {/* Software */}
            {asset.software && (
              <div>
                <h4 className="font-mono text-[10px] text-muted-foreground uppercase mb-2">Software</h4>
                <div className="bg-sunken/50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="font-mono text-[10px] text-muted-foreground">Product</span>
                    <span className="font-mono text-xs text-foreground">{asset.software.product} {asset.software.version}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono text-[10px] text-muted-foreground">CVEs</span>
                    <span className="font-mono text-xs text-foreground">{asset.software.cveCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono text-[10px] text-muted-foreground">PQC Support</span>
                    <span className="font-mono text-xs text-foreground">{asset.software.pqcNativeSupport ? 'Native' : 'None'}</span>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="crypto" className="space-y-4">
            <div>
              <h4 className="font-mono text-[10px] text-muted-foreground uppercase mb-3">Dimension Scores</h4>
              <div className="space-y-3">
                {dimensions.map(d => (
                  <div key={d.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs text-foreground">{d.label}</span>
                      <span className="font-mono text-xs font-bold" style={{ color: getQScoreColor(d.score) }}>{d.score}/100</span>
                    </div>
                    <div className="h-2 bg-sunken rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${d.score}%`, backgroundColor: getQScoreColor(d.score) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'TLS', value: asset.tls },
                { label: 'Key Exchange', value: asset.keyExchange },
                { label: 'Cipher', value: asset.cipher.split('_').slice(-2).join('_') },
                { label: 'Forward Secrecy', value: asset.forwardSecrecy ? '✓ Yes' : '✗ No' },
                { label: 'HSTS', value: asset.hstsEnabled ? '✓ Enabled' : '✗ Disabled' },
                { label: 'Crypto Agility', value: `${asset.cryptoAgilityScore}/10` },
              ].map(item => (
                <div key={item.label} className="bg-sunken/50 rounded-lg p-3">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase block mb-0.5">{item.label}</span>
                  <span className="font-mono text-xs font-medium text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="remediation" className="space-y-3">
            {asset.remediation.length === 0 ? (
              <div className="text-center py-8">
                <Shield className="w-8 h-8 text-status-safe mx-auto mb-2" />
                <p className="font-body text-sm text-muted-foreground">No remediation actions needed</p>
              </div>
            ) : (
              asset.remediation.map((r, i) => (
                <div key={i} className="bg-sunken/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={`font-mono text-[10px] ${priorityColors[r.priority]}`}>{r.priority}</Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">{effortLabels[r.effort]} effort</Badge>
                    <Badge variant="outline" className="font-mono text-[10px] ml-auto">{r.status.replace('_', ' ')}</Badge>
                  </div>
                  <p className="font-body text-xs font-medium text-foreground mb-0.5">{r.finding}</p>
                  <p className="font-body text-xs text-muted-foreground">{r.action}</p>
                </div>
              ))
            )}

            <Separator />

            <div className="flex gap-2">
              <button className="flex-1 font-body text-xs font-semibold bg-accent-amber text-brand-primary py-2 rounded-lg">
                Generate AI Patch
              </button>
              <button className="flex-1 font-body text-xs text-brand-primary border border-[hsl(var(--border-default))] py-2 rounded-lg">
                Export CBOM
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

export default AssetDetailPanel;
