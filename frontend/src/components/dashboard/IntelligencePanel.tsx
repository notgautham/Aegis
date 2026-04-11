import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Asset } from '@/data/demoData';
import { cn } from '@/lib/utils';
import { isTransitionAsset } from '@/lib/status';

interface Insight {
  severity: 'critical' | 'high' | 'safe';
  headline: string;
  detail: string;
}

const hasLegacyTls = (versions: string[]): boolean =>
  versions.some((version) => {
    const normalized = version.toUpperCase().replace(/\s+/g, '');
    return normalized.includes('TLS1.0') || normalized.includes('TLSV1.0') || normalized.includes('TLS_1_0') ||
      normalized.includes('TLS1.1') || normalized.includes('TLSV1.1') || normalized.includes('TLS_1_1');
  });

const summarizeDomains = (assets: Asset[]): string =>
  assets.map((asset) => asset.domain).slice(0, 2).join(', ');

const generateInsights = (assets: Asset[]): Insight[] => {
  const insights: Insight[] = [];

  const tlsLegacy = assets.filter((asset) => hasLegacyTls(asset.tlsVersionsSupported));
  if (tlsLegacy.length > 0) {
    insights.push({
      severity: 'critical',
      headline: `${tlsLegacy.length} asset${tlsLegacy.length > 1 ? 's' : ''} running legacy TLS`,
      detail: `${summarizeDomains(tlsLegacy)}${tlsLegacy.length > 2 ? ` +${tlsLegacy.length - 2} more` : ''} - TLS 1.0/1.1 are broken protocols with known downgrade and decryption risks. Disable them immediately.`,
    });
  }

  const expiringCerts = assets.filter((asset) => asset.certInfo.days_remaining > 0 && asset.certInfo.days_remaining <= 30);
  if (expiringCerts.length > 0) {
    insights.push({
      severity: 'critical',
      headline: `${expiringCerts.length} certificate${expiringCerts.length > 1 ? 's' : ''} expiring within 30 days`,
      detail: `${expiringCerts.map((asset) => asset.domain).join(', ')} - expired certificates cause immediate service disruption and browser trust failures.`,
    });
  }

  const noForwardSecrecy = assets.filter((asset) => !asset.forwardSecrecy && asset.status !== 'unknown');
  if (noForwardSecrecy.length > 0) {
    insights.push({
      severity: 'high',
      headline: `${noForwardSecrecy.length} asset${noForwardSecrecy.length > 1 ? 's' : ''} lack forward secrecy`,
      detail: 'Without ECDHE or a hybrid modern key exchange, past sessions become retroactively decryptable if the private key is ever exposed.',
    });
  }

  const hndlCritical = assets.filter((asset) => asset.hndlRiskLevel === 'critical' && asset.hndlBreakYear);
  if (hndlCritical.length > 0) {
    insights.push({
      severity: 'high',
      headline: `${hndlCritical.length} asset${hndlCritical.length > 1 ? 's' : ''} estimated decryptable by ${Math.min(...hndlCritical.map((asset) => asset.hndlBreakYear!))}`,
      detail: `Adversaries archiving traffic to ${hndlCritical[0].domain} today can potentially decrypt it once large-scale quantum capability matures.`,
    });
  }

  const elitePqc = assets.filter((asset) => asset.status === 'elite-pqc');
  if (elitePqc.length > 0) {
    insights.push({
      severity: 'safe',
      headline: `${elitePqc.length} asset${elitePqc.length > 1 ? 's' : ''} fully quantum-safe`,
      detail: `${elitePqc.map((asset) => asset.domain).join(', ')} - these assets are already aligned with strong post-quantum posture and help anchor the migration baseline.`,
    });
  }

  const highCve = assets.filter((asset) => asset.software && asset.software.cveCount >= 5);
  if (highCve.length > 0) {
    insights.push({
      severity: 'high',
      headline: `${highCve.length} asset${highCve.length > 1 ? 's' : ''} running software with >=5 known CVEs`,
      detail: `${highCve.map((asset) => `${asset.domain} (${asset.software!.product} - ${asset.software!.cveCount} CVEs)`).slice(0, 2).join(', ')} - patch or upgrade immediately.`,
    });
  }

  const criticalOrVulnerable = assets.filter((asset) => asset.status === 'critical' || asset.status === 'vulnerable');
  if (criticalOrVulnerable.length > 0) {
    insights.push({
      severity: criticalOrVulnerable.some((asset) => asset.status === 'critical') ? 'critical' : 'high',
      headline: `${criticalOrVulnerable.length} asset${criticalOrVulnerable.length > 1 ? 's' : ''} still rely on classically vulnerable posture`,
      detail: `${summarizeDomains(criticalOrVulnerable)}${criticalOrVulnerable.length > 2 ? ` +${criticalOrVulnerable.length - 2} more` : ''} - prioritize hybrid key exchange and certificate upgrades before cryptographic debt compounds.`,
    });
  }

  const transitioning = assets.filter((asset) => isTransitionAsset(asset) || asset.status === 'standard');
  if (transitioning.length > 0) {
    insights.push({
      severity: 'high',
      headline: `${transitioning.length} asset${transitioning.length > 1 ? 's are' : ' is'} in active PQC transition`,
      detail: `${summarizeDomains(transitioning)}${transitioning.length > 2 ? ` +${transitioning.length - 2} more` : ''} - these systems are partly modernized but still need full post-quantum rollout to reach the highest tier.`,
    });
  }

  if (insights.length === 0 && assets.length > 0) {
    const averageScore = Math.round(assets.reduce((sum, asset) => sum + asset.qScore, 0) / assets.length);
    insights.push({
      severity: averageScore >= 70 ? 'safe' : averageScore >= 40 ? 'high' : 'critical',
      headline: `${assets.length} asset${assets.length > 1 ? 's' : ''} analyzed with average Q-Score ${averageScore}`,
      detail: 'Live scan data is loaded correctly. More specialized digest insights will appear automatically when the scan exposes legacy TLS, expiry pressure, HNDL urgency, or stronger PQC-safe coverage.',
    });
  }

  return insights;
};

const severityBorder: Record<string, string> = {
  critical: 'border-l-[hsl(var(--status-critical))]',
  high: 'border-l-[hsl(var(--accent-amber))]',
  safe: 'border-l-[hsl(var(--status-safe))]',
};

const severityDot: Record<Insight['severity'], string> = {
  critical: 'bg-[hsl(var(--status-critical))]',
  high: 'bg-[hsl(var(--accent-amber))]',
  safe: 'bg-[hsl(var(--status-safe))]',
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
          <p className="text-[10px] text-muted-foreground font-body mt-0.5">Derived from scan data - actionable security insights.</p>
        </div>
        {collapsed && (
          <button
            onClick={() => setExpanded((value) => !value)}
            className="text-[10px] font-body text-brand-primary hover:underline cursor-pointer"
          >
            {expanded ? 'Hide insights ^' : `Show insights v (${insights.length})`}
          </button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {visibleInsights.map((insight, index) => (
          <div
            key={index}
            className={cn(
              'border-l-4 rounded-r-lg p-3 bg-[hsl(var(--bg-sunken)/0.5)]',
              severityBorder[insight.severity],
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', severityDot[insight.severity])} />
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
