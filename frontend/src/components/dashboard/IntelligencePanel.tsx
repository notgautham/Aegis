import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Asset } from '@/data/demoData';
import { cn } from '@/lib/utils';

interface Insight {
  severity: 'critical' | 'high' | 'safe';
  icon: string;
  headline: string;
  detail: string;
}

const generateInsights = (assets: Asset[]): Insight[] => {
  const insights: Insight[] = [];

  const tlsLegacy = assets.filter(a => a.tlsVersionsSupported.includes('TLS_1_0') || a.tlsVersionsSupported.includes('TLS_1_1'));
  if (tlsLegacy.length > 0)
    insights.push({ severity: 'critical', icon: '🔴', headline: `${tlsLegacy.length} asset${tlsLegacy.length > 1 ? 's' : ''} running legacy TLS`, detail: `${tlsLegacy.map(a => a.domain).slice(0, 2).join(', ')}${tlsLegacy.length > 2 ? ` +${tlsLegacy.length - 2} more` : ''} — TLS 1.0/1.1 are broken protocols with known POODLE/BEAST exploits. Disable immediately.` });

  const expiringCerts = assets.filter(a => a.certInfo.days_remaining > 0 && a.certInfo.days_remaining <= 30);
  if (expiringCerts.length > 0)
    insights.push({ severity: 'critical', icon: '⚠️', headline: `${expiringCerts.length} certificate${expiringCerts.length > 1 ? 's' : ''} expiring within 30 days`, detail: `${expiringCerts.map(a => a.domain).join(', ')} — Expired certificates cause immediate service disruption and user trust warnings.` });

  const noForwardSecrecy = assets.filter(a => !a.forwardSecrecy && a.status !== 'unknown');
  if (noForwardSecrecy.length > 0)
    insights.push({ severity: 'high', icon: '🟠', headline: `${noForwardSecrecy.length} assets lack forward secrecy`, detail: `Without ECDHE, past sessions are retroactively decryptable if the private key is ever compromised. Enables HNDL attacks.` });

  const hndlCritical = assets.filter(a => a.hndlRiskLevel === 'critical' && a.hndlBreakYear);
  if (hndlCritical.length > 0)
    insights.push({ severity: 'high', icon: '⏳', headline: `${hndlCritical.length} assets estimated decryptable by ${Math.min(...hndlCritical.map(a => a.hndlBreakYear!))}`, detail: `Adversaries archiving traffic to ${hndlCritical[0].domain} today can decrypt it when quantum computers reach ~4,000 logical qubits. Migration to ML-KEM-768 is required.` });

  const elitePqc = assets.filter(a => a.status === 'elite-pqc');
  if (elitePqc.length > 0)
    insights.push({ severity: 'safe', icon: '✅', headline: `${elitePqc.length} asset${elitePqc.length > 1 ? 's' : ''} fully quantum-safe`, detail: `${elitePqc.map(a => a.domain).join(', ')} — Certified NIST FIPS 203/204/205 compliant. These assets are shielded against HNDL attacks.` });

  const highCve = assets.filter(a => a.software && a.software.cveCount >= 5);
  if (highCve.length > 0)
    insights.push({ severity: 'high', icon: '🐛', headline: `${highCve.length} assets running software with ≥5 known CVEs`, detail: `${highCve.map(a => `${a.domain} (${a.software!.product} — ${a.software!.cveCount} CVEs)`).slice(0, 2).join(', ')} — Patch or upgrade immediately.` });

  return insights;
};

const severityBorder: Record<string, string> = {
  critical: 'border-l-[hsl(var(--status-critical))]',
  high: 'border-l-[hsl(var(--accent-amber))]',
  safe: 'border-l-[hsl(var(--status-safe))]',
};

interface IntelligencePanelProps {
  assets: Asset[];
  collapsed?: boolean;
}

const IntelligencePanel = ({ assets, collapsed = false }: IntelligencePanelProps) => {
  const insights = generateInsights(assets);
  const [expanded, setExpanded] = useState(!collapsed);
  const maxVisible = 5;

  if (insights.length === 0) return null;

  const visibleInsights = expanded ? insights.slice(0, maxVisible) : insights.slice(0, 1);
  const hasMore = insights.length > maxVisible && expanded;

  return (
    <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-body">AEGIS Intelligence Digest</CardTitle>
          <p className="text-[10px] text-muted-foreground font-body mt-0.5">Derived from scan data — actionable security insights.</p>
        </div>
        {collapsed && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-[10px] font-body text-brand-primary hover:underline cursor-pointer"
          >
            {expanded ? 'Hide insights ▴' : `Show insights ▾ (${insights.length})`}
          </button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {visibleInsights.map((insight, i) => (
          <div
            key={i}
            className={cn(
              "border-l-4 rounded-r-lg p-3 bg-[hsl(var(--bg-sunken)/0.5)]",
              severityBorder[insight.severity]
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">{insight.icon}</span>
              <span className="font-body text-xs font-semibold text-foreground">{insight.headline}</span>
            </div>
            <p className="font-body text-[11px] text-muted-foreground mt-1 leading-relaxed pl-6">{insight.detail}</p>
          </div>
        ))}
        {hasMore && (
          <p className="text-[10px] text-muted-foreground font-body text-center pt-1">
            +{insights.length - maxVisible} more insight{insights.length - maxVisible > 1 ? 's' : ''}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default IntelligencePanel;
