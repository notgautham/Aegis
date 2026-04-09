import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Check, Sparkles, ClipboardList, Map as MapIcon, CheckCircle2, Loader2, TerminalSquare, FileText, ArrowRight, BookOpen, ShieldCheck } from 'lucide-react';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import SectionTabBar from '@/components/dashboard/SectionTabBar';
import { useSelectedScan } from '@/contexts/SelectedScanContext';

const remediationTabs = [
  { id: 'action-plan', label: 'Action Plan', icon: ClipboardList, route: '/dashboard/remediation/action-plan' },
  { id: 'ai-patch', label: 'AI Patch Generator', icon: Sparkles, route: '/dashboard/remediation/ai-patch' },
  { id: 'roadmap', label: 'Migration Roadmap', icon: MapIcon, route: '/dashboard/remediation/roadmap' },
];

const serverTypes = ['nginx', 'Apache', 'IIS', 'HAProxy'];
const priorityImpact: Record<string, number> = { P1: 20, P2: 12, P3: 6, P4: 3 };

function detectServer(assetSoftware: string | null | undefined): string {
  const product = assetSoftware?.toLowerCase() ?? '';
  if (product.includes('apache')) return 'Apache';
  if (product.includes('iis')) return 'IIS';
  if (product.includes('haproxy')) return 'HAProxy';
  return 'nginx';
}

function buildCitationLabel(rawAsset: ReturnType<typeof useSelectedScan>['selectedAssetResults'][number] | undefined, fallback?: string | null): string {
  if (fallback) return fallback;

  const firstDocument = rawAsset?.remediation?.source_citations?.documents?.[0];
  if (!firstDocument) return 'AEGIS remediation bundle';

  return [firstDocument.title, firstDocument.section, firstDocument.path].filter(Boolean).join(' - ');
}

function cleanRoadmapText(value: string): string {
  return value
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/^\s*[*#>-]+\s?/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\r/g, '')
    .trim();
}

function isLikelyHeading(line: string): boolean {
  if (!line) return false;
  if (/^\d+\./.test(line)) return false;
  if (line.includes(':')) return false;
  if (line.length > 42) return false;
  return /^[A-Z][A-Za-z0-9/ +()-]+$/.test(line);
}

function splitRoadmapSections(value: string): Array<{ heading: string; lines: string[] }> {
  const cleaned = cleanRoadmapText(value);
  if (!cleaned) return [];

  const sections: Array<{ heading: string; lines: string[] }> = [];
  let current: { heading: string; lines: string[] } | null = null;

  cleaned.split('\n').map((line) => line.trim()).filter(Boolean).forEach((line) => {
    const isHeading = /:$/.test(line) || isLikelyHeading(line);

    if (isHeading) {
      current = { heading: line.replace(/:$/, ''), lines: [] };
      sections.push(current);
      return;
    }

    if (!current) {
      current = { heading: 'Overview', lines: [] };
      sections.push(current);
    }

    current.lines.push(line.replace(/^\d+\.\s*/, ''));
  });

  return sections;
}

function parseRoadmapLine(line: string): { title: string; body: string; reference: string | null } {
  const referenceMatch = line.match(/\(([^)]+)\)\s*$/);
  const reference = referenceMatch ? referenceMatch[1] : null;
  const withoutReference = referenceMatch ? line.slice(0, referenceMatch.index).trim() : line;
  const colonIndex = withoutReference.indexOf(':');

  if (colonIndex > 0) {
    return {
      title: withoutReference.slice(0, colonIndex).trim(),
      body: withoutReference.slice(colonIndex + 1).trim(),
      reference,
    };
  }

  return {
    title: withoutReference,
    body: '',
    reference,
  };
}

function getSectionTone(heading: string): {
  chipClassName: string;
  railClassName: string;
  summary: string;
  panelClassName: string;
  iconClassName: string;
} {
  const normalized = heading.toLowerCase();

  if (normalized.includes('preparation') || normalized.includes('prerequisite') || normalized.includes('assessment')) {
    return {
      chipClassName: 'bg-[hsl(var(--status-warning)/0.12)] text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning)/0.25)]',
      railClassName: 'from-[hsl(var(--status-warning))] to-[hsl(var(--status-warning)/0.15)]',
      summary: 'Prepare inventory, dependencies, and policy alignment before production rollout.',
      panelClassName: 'border-[hsl(var(--status-warning)/0.18)] bg-[hsl(var(--status-warning)/0.04)]',
      iconClassName: 'bg-[hsl(var(--status-warning)/0.12)] text-[hsl(var(--status-warning))]',
    };
  }

  if (normalized.includes('hybrid') || normalized.includes('transition')) {
    return {
      chipClassName: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
      railClassName: 'from-brand-primary to-brand-primary/10',
      summary: 'Adopt hybrid cryptography first so compatibility remains intact during migration.',
      panelClassName: 'border-brand-primary/15 bg-brand-primary/5',
      iconClassName: 'bg-brand-primary/10 text-brand-primary',
    };
  }

  if (normalized.includes('full') || normalized.includes('replacement') || normalized.includes('migration')) {
    return {
      chipClassName: 'bg-[hsl(var(--status-safe)/0.12)] text-[hsl(var(--status-safe))] border-[hsl(var(--status-safe)/0.25)]',
      railClassName: 'from-[hsl(var(--status-safe))] to-[hsl(var(--status-safe)/0.15)]',
      summary: 'Complete the transition by replacing legacy algorithms and validating long-term operations.',
      panelClassName: 'border-[hsl(var(--status-safe)/0.18)] bg-[hsl(var(--status-safe)/0.04)]',
      iconClassName: 'bg-[hsl(var(--status-safe)/0.12)] text-[hsl(var(--status-safe))]',
    };
  }

  return {
    chipClassName: 'bg-[hsl(var(--bg-sunken))] text-muted-foreground border-border',
    railClassName: 'from-muted-foreground/70 to-muted-foreground/10',
    summary: 'Progress this phase methodically using the guidance attached to each task below.',
    panelClassName: 'border-border bg-background',
    iconClassName: 'bg-brand-primary/10 text-brand-primary',
  };
}

const RemediationAIPatch = () => {
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const { selectedAssets, selectedAssetResults, isLoading, scanError } = useSelectedScan();
  const [selectedAsset, setSelectedAsset] = useState<string>('');
  const [selectedFinding, setSelectedFinding] = useState<string>('all');
  const [selectedServer, setSelectedServer] = useState<string>('nginx');

  useEffect(() => {
    if (selectedAssets.length === 0) {
      setSelectedAsset('');
      return;
    }

    if (!selectedAssets.some((asset) => asset.id === selectedAsset)) {
      setSelectedAsset(selectedAssets[0]?.id ?? '');
    }
  }, [selectedAsset, selectedAssets]);

  const asset = selectedAssets.find((item) => item.id === selectedAsset) ?? selectedAssets[0];
  const rawAsset = selectedAssetResults.find((item) => item.asset_id === asset?.id);
  const remediationActions = rawAsset?.remediation_actions ?? [];
  const assetFindings = remediationActions.length > 0
    ? remediationActions.map((action) => action.finding)
    : (asset?.remediation ?? []).map((action) => action.finding);

  const patchBundle = typeof rawAsset?.remediation?.patch_config === 'string' ? rawAsset.remediation.patch_config.trim() : '';
  const roadmapSections = splitRoadmapSections(typeof rawAsset?.remediation?.migration_roadmap === 'string' ? rawAsset.remediation.migration_roadmap : '');
  const isPqcSafe = Boolean(asset) && remediationActions.length === 0 && asset.status === 'elite-pqc';

  const relevantPatches = useMemo(() => {
    if (!asset) return [];

    const filteredActions = selectedFinding === 'all'
      ? remediationActions
      : remediationActions.filter((action) => action.finding === selectedFinding);

    if (filteredActions.length === 0 && patchBundle) {
      return [{
        finding: 'All findings',
        label: 'Recommended patch bundle',
        code: patchBundle,
        impact: Math.max(6, Math.round((100 - asset.qScore) / 2)),
        nistRef: buildCitationLabel(rawAsset),
        generatedFromBundle: true,
        priority: 'P2',
      }];
    }

    return filteredActions.map((action) => ({
      finding: action.finding,
      label: action.action,
      code: patchBundle
        ? `# Target server: ${selectedServer}\n# Asset: ${asset.domain}\n# Finding: ${action.finding}\n${patchBundle}`
        : `# No server-specific patch bundle is persisted yet for this action.\n# Asset: ${asset.domain}\n# Target server: ${selectedServer}\n# Recommended action:\n# ${action.action}`,
      impact: priorityImpact[action.priority] ?? 6,
      nistRef: buildCitationLabel(rawAsset, action.nist_reference),
      generatedFromBundle: Boolean(patchBundle),
      priority: action.priority,
    }));
  }, [asset, patchBundle, rawAsset, remediationActions, selectedFinding, selectedServer]);

  const totalImpact = relevantPatches.reduce((sum, patch) => sum + patch.impact, 0);

  useEffect(() => {
    if (!asset) return;
    setSelectedServer(detectServer(rawAsset?.server_software ?? asset?.software?.product));
    setSelectedFinding('all');
  }, [asset?.id, asset?.software?.product, rawAsset?.server_software]);

  if (isLoading && selectedAssets.length === 0) {
    return (
      <div className="space-y-5">
        <DataContextBadge />
        <div>
          <h1 className="font-display text-2xl italic text-brand-primary">AI Patch Generator</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">Auto-generated configuration patches for PQC migration</p>
        </div>
        <SectionTabBar tabs={remediationTabs} />
        <Card className="bg-surface border-border">
          <CardContent className="py-10 flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-body text-sm">Loading remediation bundle for the selected scan...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (scanError && selectedAssets.length === 0) {
    return (
      <div className="space-y-5">
        <DataContextBadge />
        <div>
          <h1 className="font-display text-2xl italic text-brand-primary">AI Patch Generator</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">Auto-generated configuration patches for PQC migration</p>
        </div>
        <SectionTabBar tabs={remediationTabs} />
        <Card className="bg-surface border-border">
          <CardContent className="py-8 text-center">
            <p className="font-body text-sm text-muted-foreground">The selected scan could not be loaded for this page.</p>
            <p className="font-mono text-[10px] text-muted-foreground mt-2">{scanError}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="space-y-5">
        <DataContextBadge />
        <div>
          <h1 className="font-display text-2xl italic text-brand-primary">AI Patch Generator</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">Auto-generated configuration patches for PQC migration</p>
        </div>
        <SectionTabBar tabs={remediationTabs} />
        <Card className="bg-surface border-border">
          <CardContent className="py-8 text-center">
            <p className="font-body text-sm text-muted-foreground">No assets available for the selected scan.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCopy = (code: string, key: string) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(key);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-5">
      <DataContextBadge />
      <div>
        <h1 className="font-display text-2xl italic text-brand-primary">AI Patch Generator</h1>
        <p className="font-body text-sm text-muted-foreground mt-1">Auto-generated configuration patches for PQC migration</p>
      </div>
      <SectionTabBar tabs={remediationTabs} />

      <Card className="bg-surface border-border">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <label className="font-body text-[10px] text-muted-foreground uppercase">Asset</label>
              <Select value={asset.id} onValueChange={setSelectedAsset}>
                <SelectTrigger className="w-52 h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{selectedAssets.map((item) => <SelectItem key={item.id} value={item.id}>{item.domain}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-body text-[10px] text-muted-foreground uppercase">Finding</label>
              <Select value={selectedFinding} onValueChange={setSelectedFinding}>
                <SelectTrigger className="w-52 h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Findings</SelectItem>
                  {assetFindings.map((finding) => <SelectItem key={finding} value={finding}>{finding}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-body text-[10px] text-muted-foreground uppercase">Server Type</label>
              <Select value={selectedServer} onValueChange={setSelectedServer}>
                <SelectTrigger className="w-32 h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{serverTypes.map((server) => <SelectItem key={server} value={server}>{server}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isPqcSafe ? (
        <Card className="bg-surface border-border">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-16 h-16 text-[hsl(var(--status-safe))] mx-auto mb-4" />
            <h2 className="font-body text-lg font-bold text-[hsl(var(--status-safe))]">This asset is already Fully Quantum Safe</h2>
            <p className="font-body text-sm text-muted-foreground mt-2">No patch bundle is required. {asset.domain} already has no remaining remediation actions in the current scan.</p>
            <Button variant="outline" className="mt-4 text-xs">Review Certificate Posture</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {relevantPatches.length === 0 ? (
            <Card className="bg-surface border-border">
              <CardContent className="py-8 text-center">
                <p className="font-body text-sm text-muted-foreground">No remediation bundle or action-specific patch is available for the selected finding yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {relevantPatches.map((patch, index) => {
                const copyKey = `patch-${index}`;
                return (
                  <Card key={copyKey} className="bg-surface border-border overflow-hidden shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
                    <CardHeader className="pb-2 border-b border-border bg-[hsl(var(--bg-sunken)/0.45)]">
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <TerminalSquare className="w-4 h-4 text-brand-primary" />
                            <CardTitle className="font-body text-sm">{patch.label}</CardTitle>
                          </div>
                          <p className="font-body text-xs text-muted-foreground">{patch.finding}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">{selectedServer}</Badge>
                            <Badge className="text-[10px] bg-[hsl(var(--status-safe))] text-white">+{patch.impact} pts</Badge>
                            <Badge variant="outline" className="text-[10px]">{patch.priority}</Badge>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => handleCopy(patch.code, copyKey)}>
                          {copiedIndex === copyKey ? <><Check className="w-3 h-3 text-status-safe" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <pre className="bg-brand-primary text-accent-amber-light font-mono text-xs p-4 overflow-x-auto leading-relaxed min-h-[180px]"><code>{patch.code}</code></pre>
                      <div className="px-4 py-3 bg-[hsl(var(--bg-sunken))] border-t border-border flex items-center justify-between gap-3 flex-wrap">
                        <div className="space-y-1">
                          <p className="font-mono text-[10px] text-muted-foreground">Validation: <code className="text-foreground">openssl s_client -connect {asset.domain}:443 -tls1_3</code></p>
                          <p className="font-mono text-[10px] text-muted-foreground">Reference: <span className="text-foreground">{patch.nistRef}</span></p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{patch.generatedFromBundle ? 'Bundle-backed' : 'Guidance fallback'}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {roadmapSections.length > 0 && (
            <Card className="bg-surface border-border shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-primary" />
                  <CardTitle className="font-body text-base">Roadmap Context</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)] gap-4">
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-brand-primary/10 bg-gradient-to-br from-brand-primary/5 via-background to-background p-4 shadow-[0_10px_25px_-18px_hsl(var(--brand-primary)/0.3)]">
                      <div className="flex items-center gap-2 text-brand-primary">
                        <BookOpen className="w-4 h-4" />
                        <span className="font-mono text-[10px] uppercase tracking-[0.22em]">Roadmap brief</span>
                      </div>
                      <p className="mt-3 font-body text-base font-semibold text-foreground">Phase-by-phase migration guidance for {asset.domain}</p>
                      <p className="mt-2 font-body text-sm leading-relaxed text-foreground/80">
                        This section reformats the persisted remediation roadmap into an operator-friendly brief so teams can move from preparation to full PQC replacement with clearer sequencing.
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-border bg-white px-3 py-2 shadow-sm">
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Sections</p>
                          <p className="mt-1 font-body text-xl font-semibold text-foreground">{roadmapSections.length}</p>
                        </div>
                        <div className="rounded-xl border border-border bg-white px-3 py-2 shadow-sm">
                          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Focus</p>
                          <p className="mt-1 font-body text-xs font-medium leading-snug text-foreground">
                            {selectedFinding === 'all' ? 'Portfolio remediation guidance' : selectedFinding}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-white p-3 shadow-[0_10px_25px_-20px_hsl(var(--brand-primary)/0.22)]">
                      <div className="flex items-center gap-2 px-1 pb-2">
                        <ShieldCheck className="w-4 h-4 text-brand-primary" />
                        <p className="font-body text-xs font-semibold text-foreground">Migration phases</p>
                      </div>
                      <div className="space-y-2">
                        {roadmapSections.map((section, sectionIndex) => {
                          const tone = getSectionTone(section.heading);
                          return (
                            <div key={`summary-${section.heading}`} className={`rounded-xl border px-3 py-2.5 shadow-sm ${tone.panelClassName}`}>
                              <div className="flex items-start gap-3">
                                <div className={`mt-0.5 h-10 w-1.5 rounded-full bg-gradient-to-b ${tone.railClassName}`} />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                      Phase {sectionIndex + 1}
                                    </span>
                                    <Badge variant="outline" className={`text-[10px] ${tone.chipClassName}`}>
                                      {section.lines.length} task{section.lines.length === 1 ? '' : 's'}
                                    </Badge>
                                  </div>
                                  <p className="mt-1 font-body text-sm font-semibold text-foreground">{section.heading}</p>
                                  <p className="mt-1 font-body text-xs leading-relaxed text-foreground/75">{tone.summary}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {roadmapSections.map((section, sectionIndex) => {
                      const tone = getSectionTone(section.heading);
                      return (
                        <div
                          key={section.heading}
                          className={`relative overflow-hidden rounded-2xl border p-4 shadow-[0_12px_28px_-18px_hsl(var(--brand-primary)/0.18)] ${tone.panelClassName}`}
                        >
                          <div className={`pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${tone.railClassName}`} />

                          <div className="pl-2">
                            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl font-mono text-xs font-semibold ${tone.iconClassName}`}>
                                    {sectionIndex + 1}
                                  </div>
                                  <div>
                                    <p className="font-body text-base font-semibold text-foreground">{section.heading}</p>
                                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Migration phase</p>
                                  </div>
                                </div>
                                <p className="font-body text-sm leading-relaxed text-foreground/80 max-w-2xl">{tone.summary}</p>
                              </div>
                              <Badge variant="outline" className={`text-[10px] ${tone.chipClassName}`}>
                                {section.lines.length} actionable item{section.lines.length === 1 ? '' : 's'}
                              </Badge>
                            </div>

                            <div className="space-y-3">
                              {section.lines.map((line, index) => {
                                const item = parseRoadmapLine(line);
                                return (
                                  <div
                                    key={`${section.heading}-${index}`}
                                    className="rounded-xl border border-border bg-white px-4 py-3 shadow-sm"
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full ${tone.iconClassName}`}>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="min-w-0 flex-1 space-y-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <p className="font-body text-sm font-semibold text-foreground">{item.title}</p>
                                          {item.reference && (
                                            <Badge variant="outline" className="text-[10px] bg-[hsl(var(--bg-sunken)/0.65)]">
                                              {item.reference}
                                            </Badge>
                                          )}
                                        </div>
                                        {item.body && (
                                          <p className="font-body text-sm leading-relaxed text-foreground/75">{item.body}</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {relevantPatches.length > 0 && (
            <Card className="bg-[hsl(var(--status-safe)/0.05)] border-[hsl(var(--status-safe)/0.2)]">
              <CardContent className="py-3 flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-[hsl(var(--status-safe))]" />
                <p className="font-body text-sm">
                  Applying the available remediation guidance to <strong className="font-mono">{asset.domain}</strong>: projected Q-Score uplift <span className="font-mono font-bold text-[hsl(var(--status-safe))]">+{totalImpact} points</span>
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default RemediationAIPatch;
