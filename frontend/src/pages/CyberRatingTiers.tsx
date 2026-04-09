import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Shield, AlertTriangle, XCircle, Star, FileText } from 'lucide-react';
import SectionTabBar from '@/components/dashboard/SectionTabBar';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import { useSelectedScan } from '@/contexts/SelectedScanContext';

const ratingTabs = [
  { id: 'enterprise', label: 'Enterprise Score', icon: Star, route: '/dashboard/rating/enterprise' },
  { id: 'per-asset', label: 'Per-Asset', icon: FileText, route: '/dashboard/rating/per-asset' },
  { id: 'tiers', label: 'Tier Classification', icon: Shield, route: '/dashboard/rating/tiers' },
];

const tiers = [
  {
    id: 'elite_pqc', label: 'Tier 1 — Elite-PQC', icon: Shield, color: 'hsl(var(--status-safe))', bgColor: 'hsl(var(--status-safe)/0.08)',
    criteria: ['TLS 1.3 only + strong ciphers (AES-GCM/ChaCha20)', 'ML-KEM-768 or ML-DSA-65 implemented', 'ECDHE/ML-KEM + cert ≥2048-bit', 'HSTS enabled + no weak protocols'],
    action: 'Maintain Configuration — Periodic Monitoring',
    configs: { nginx: 'ssl_protocols TLSv1.3;\nssl_ecdh_curve X25519MLKEM768;\nssl_certificate /etc/ssl/ml-dsa-65.crt;', apache: 'SSLProtocol -all +TLSv1.3\nSSLOpenSSLConfCmd Curves X25519MLKEM768' },
  },
  {
    id: 'standard', label: 'Tier 2 — Standard', icon: Shield, color: 'hsl(210, 70%, 50%)', bgColor: 'hsl(210, 70%, 50%/0.08)',
    criteria: ['TLS 1.2/1.3 supported', 'ECDHE key exchange + ≥2048-bit keys', 'Strong ciphers (AES-256-GCM)', 'Forward secrecy enabled'],
    action: 'Gradual Improvement — Disable legacy protocols, standardise cipher suites',
    configs: { nginx: 'ssl_protocols TLSv1.2 TLSv1.3;\nssl_ciphers ECDHE-RSA-AES256-GCM-SHA384;', apache: 'SSLProtocol -all +TLSv1.2 +TLSv1.3' },
  },
  {
    id: 'legacy', label: 'Tier 3 — Legacy', icon: AlertTriangle, color: 'hsl(var(--accent-amber))', bgColor: 'hsl(var(--accent-amber)/0.08)',
    criteria: ['TLS 1.0/1.1 enabled', 'CBC mode ciphers', 'No forward secrecy', 'Key possibly ≤1024-bit'],
    action: 'Remediation Required — Upgrade TLS stack, rotate certificates, remove weak cipher suites',
    configs: {},
  },
  {
    id: 'critical', label: 'Critical', icon: XCircle, color: 'hsl(var(--status-critical))', bgColor: 'hsl(var(--status-critical)/0.08)',
    criteria: ['SSLv2/SSLv3 enabled', 'DES or export-grade ciphers', 'Key <1024-bit', 'Known CVEs in TLS stack'],
    action: 'Immediate Action — Block or isolate service, replace certificate and TLS configuration',
    configs: {},
  },
];

const CyberRatingTiers = () => {
  const [expanded, setExpanded] = useState<string[]>(['elite_pqc']);
  const { selectedAssets } = useSelectedScan();
  const toggle = (id: string) => setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="space-y-5">
      <DataContextBadge />
      <h1 className="font-display text-2xl italic text-brand-primary">Tier Classification</h1>
      <SectionTabBar tabs={ratingTabs} />

      <div className="space-y-3">
        {tiers.map(t => {
          const isOpen = expanded.includes(t.id);
          const tierAssets = selectedAssets.filter(a => a.tier === t.id);

          return (
            <Card key={t.id} className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)] overflow-hidden" style={{ borderLeftWidth: 4, borderLeftColor: t.color }}>
              <button onClick={() => toggle(t.id)} className="w-full flex items-center gap-3 px-5 py-4 text-left">
                {isOpen ? <ChevronDown className="w-4 h-4" style={{ color: t.color }} /> : <ChevronRight className="w-4 h-4" style={{ color: t.color }} />}
                <t.icon className="w-5 h-5" style={{ color: t.color }} />
                <span className="font-body text-sm font-semibold flex-1" style={{ color: t.color }}>{t.label}</span>
                <Badge style={{ backgroundColor: t.bgColor, color: t.color }} className="text-[10px]">{tierAssets.length} assets</Badge>
              </button>

              {isOpen && (
                <CardContent className="pt-0 pb-5 px-5 space-y-4">
                  {/* Criteria */}
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-2">Compliance Criteria</p>
                    <ul className="space-y-1">
                      {t.criteria.map((c, i) => (
                        <li key={i} className="text-xs font-body text-foreground/80 flex items-start gap-2">
                          <span className="mt-0.5" style={{ color: t.color }}>•</span>{c}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action */}
                  <div className="p-3 rounded-lg" style={{ backgroundColor: t.bgColor }}>
                    <p className="text-[10px] font-body text-muted-foreground uppercase tracking-wider">Required Action</p>
                    <p className="text-xs font-body font-medium mt-1">{t.action}</p>
                  </div>

                  {/* Example configs */}
                  {Object.keys(t.configs).length > 0 && (
                    <div>
                      <p className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-2">Example Configuration</p>
                      {Object.entries(t.configs).map(([server, config]) => (
                        <div key={server} className="mb-2">
                          <Badge variant="outline" className="text-[10px] mb-1">{server}</Badge>
                          <pre className="text-[10px] font-mono bg-[hsl(var(--bg-sunken))] p-2.5 rounded-lg overflow-x-auto">{config}</pre>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Asset list */}
                  {tierAssets.length > 0 && (
                    <div>
                      <p className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-2">Assets in this tier ({tierAssets.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {tierAssets.map(a => (
                          <span key={a.id} className="font-mono text-[10px] px-2 py-1 rounded-md bg-[hsl(var(--bg-sunken))]">{a.domain}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default CyberRatingTiers;
