import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useScanContext } from '@/contexts/ScanContext';
import { useScanQueue } from '@/contexts/ScanQueueContext';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import DashboardTopBar from '@/components/dashboard/DashboardTopBar';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';
import GlassTabBar from '@/components/dashboard/GlassTabBar';
import CommandPalette from '@/components/dashboard/CommandPalette';
import PageNavButtons from '@/components/dashboard/PageNavButtons';
import OnboardingWizard from '@/components/dashboard/OnboardingWizard';
import { AnimatePresence, motion } from 'framer-motion';
import RainingLetters from '@/components/ui/raining-letters';
import { GradientText } from '@/components/ui/gradient-text';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { X, Maximize2, Minimize2, CheckCircle2, Loader2, Clock, XCircle, StopCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const scanProfiles = ['Quick', 'Standard', 'Deep', 'PQC Focus'] as const;
const exampleChips = ['aegis.com', 'api.aegis.com', 'auth.aegis.com', 'vpn.aegis.com'];

type DashboardLocationState = {
  bypassPrompt?: boolean;
} | null;

const DashboardLayout = () => {
  const [hasScanned, setHasScanned] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setScannedDomain } = useScanContext();
  const { queue, isRunning, minimized, setMinimized, toggleMinimize, cancelQueue, removeQueueItem, startQueue, logs, queueComplete, latestCompletedScanId } = useScanQueue();
  const { setSelectedScanId } = useSelectedScan();
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [scanProfile, setScanProfile] = useState<string>('Standard');
  const [fullPortScanEnabled, setFullPortScanEnabled] = useState(false);
  const [subdomainEnumerationEnabled, setSubdomainEnumerationEnabled] = useState(true);
  const lastSyncedCompletedScanId = useRef<string | null>(null);

  const pathname = location.pathname;
  const shouldBypassPrompt = Boolean((location.state as DashboardLocationState)?.bypassPrompt);

  const getActiveNav = () => {
    if (pathname.includes('/discovery')) return 'discovery';
    if (pathname.includes('/inventory')) return 'inventory';
    if (pathname.includes('/cbom')) return 'cbom';
    if (pathname.includes('/pqc')) return 'pqc';
    if (pathname.includes('/rating')) return 'rating';
    if (pathname.includes('/remediation')) return 'remediation';
    if (pathname.includes('/reporting')) return 'reporting';
    if (pathname.includes('/settings')) return 'settings';
    if (pathname.includes('/scan-console')) return 'scan-console';
    if (pathname.includes('/history')) return 'history';
    return 'dashboard';
  };

  const handleNavClick = (item: string) => {
    const routeMap: Record<string, string> = {
      'dashboard': '/dashboard',
      'discovery': '/dashboard/discovery',
      'discovery:domains': '/dashboard/discovery',
      'discovery:ip subnets': '/dashboard/discovery?tab=ip',
      'discovery:ssl certificates': '/dashboard/discovery?tab=ssl',
      'discovery:software & services': '/dashboard/discovery?tab=software',
      'discovery:network graph': '/dashboard/discovery?tab=network',
      'discovery:shadow it': '/dashboard/discovery?tab=shadow',
      'inventory': '/dashboard/inventory',
      'cbom': '/dashboard/cbom',
      'cbom:overview': '/dashboard/cbom',
      'cbom:per-asset': '/dashboard/cbom/per-asset',
      'cbom:export center': '/dashboard/cbom/export',
      'pqc': '/dashboard/pqc/compliance',
      'pqc:compliance': '/dashboard/pqc/compliance',
      'pqc:hndl intel': '/dashboard/pqc/hndl',
      'pqc:quantum debt': '/dashboard/pqc/quantum-debt',
      'rating': '/dashboard/rating/enterprise',
      'rating:enterprise score': '/dashboard/rating/enterprise',
      'rating:per-asset': '/dashboard/rating/per-asset',
      'rating:tier classification': '/dashboard/rating/tiers',
      'remediation': '/dashboard/remediation/action-plan',
      'remediation:action plan': '/dashboard/remediation/action-plan',
      'remediation:ai patch generator': '/dashboard/remediation/ai-patch',
      'remediation:migration roadmap': '/dashboard/remediation/roadmap',
      'reporting': '/dashboard/reporting/executive',
      'reporting:executive reports': '/dashboard/reporting/executive',
      'reporting:scheduled reports': '/dashboard/reporting/scheduled',
      'reporting:on-demand builder': '/dashboard/reporting/on-demand',
      'scan-console': '/dashboard/scan-console',
      'history': '/dashboard/history',
      'settings': '/dashboard/settings/scan-config',
    };
    const route = routeMap[item] || '/dashboard';
    navigate(route);
  };

  const resolveScanProfile = () => {
    const segments = [scanProfile];
    segments.push(fullPortScanEnabled ? 'Full Port Scan' : 'Bounded Port Scan');
    segments.push(subdomainEnumerationEnabled ? 'Full Enumeration' : 'No Enumeration');
    return segments.join(' + ');
  };

  const handleScan = (domain: string) => {
    const trimmedDomain = domain.trim();
    if (!trimmedDomain) return;
    setScannedDomain(trimmedDomain);
    setHasScanned(true);
    startQueue([trimmedDomain], resolveScanProfile());
  };

  const startSingleTargetScan = () => {
    const target = targetInput.trim();
    if (!target) return;
    setScannedDomain(target);
    setHasScanned(true);
    startQueue([target], resolveScanProfile());
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      startSingleTargetScan();
    }
  };

  const handleStartQueue = () => startSingleTargetScan();

  const handleRunDemo = () => {
    setTargetInput('aegis.com');
    setScannedDomain('aegis.com');
    setHasScanned(true);
    startQueue(['aegis.com'], resolveScanProfile());
  };

  useEffect(() => {
    if (shouldBypassPrompt) {
      setHasScanned(true);
    }
  }, [shouldBypassPrompt]);

  useEffect(() => {
    if (!latestCompletedScanId) return;
    if (lastSyncedCompletedScanId.current === latestCompletedScanId) return;

    lastSyncedCompletedScanId.current = latestCompletedScanId;
    setSelectedScanId(latestCompletedScanId);
  }, [latestCompletedScanId, setSelectedScanId]);

  const isHome = pathname === '/dashboard';
  const showPrompt = isHome && !hasScanned && !shouldBypassPrompt;

  const resolvedCount = queue.filter((item) => item.status === 'done' || item.status === 'failed' || item.status === 'cancelled').length;
  const scanningItem = queue.find((item) => item.status === 'scanning');
  const overallProgress = queue.length > 0 ? Math.round((resolvedCount / queue.length) * 100) : 0;

  const phases = ['Discovery', 'TLS Probing', 'PQC Classification', 'CBOM Generation', 'Certification'];

  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      <DashboardTopBar hasScanned={hasScanned || !isHome} />
      <DashboardSidebar activeItem={getActiveNav()} onItemClick={handleNavClick} />
      <CommandPalette />
      <OnboardingWizard />
      <PageNavButtons />

      <div className="flex-1 overflow-y-auto pb-24 ml-[3.05rem]">
        <AnimatePresence mode="wait">
          {showPrompt ? (
            <motion.div
              key="prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="relative flex flex-col items-center justify-center min-h-screen px-6"
            >
              <RainingLetters />
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="relative z-10 text-center mb-8 bg-background px-6 py-4 rounded-xl">
                <GradientText as="h1" className="font-body font-bold text-3xl lg:text-5xl mb-4">Quantum Readiness Scanner</GradientText>
                <p className="font-body text-base text-muted-foreground max-w-md mx-auto">Enter a single target domain to generate a complete Cryptographic Bill of Materials and quantum risk assessment.</p>
              </motion.div>

              <div className="relative z-10 w-full max-w-2xl space-y-4">
                <div className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-[hsl(var(--accent-amber))] transition-shadow">
                  <input
                    value={targetInput}
                    onChange={(event) => setTargetInput(event.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Enter a single target domain (e.g. aegis.com)"
                    className="w-full bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none py-1"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-body text-muted-foreground">Examples:</span>
                  {exampleChips.map((domain) => (
                    <button key={domain} onClick={() => setTargetInput(domain)} className="font-mono text-xs text-muted-foreground px-3 py-1.5 rounded-lg border border-[hsl(var(--border-default))] hover:border-[hsl(var(--border-strong))] hover:text-foreground transition-colors">
                      {domain}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-body text-muted-foreground">Profile:</span>
                  <div className="flex gap-1 p-1 rounded-xl bg-[hsl(var(--bg-sunken))]">
                    {scanProfiles.map((profile) => (
                      <button
                        key={profile}
                        onClick={() => setScanProfile(profile)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-body transition-all ${scanProfile === profile ? 'bg-[hsl(var(--accent-amber))] text-white font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {profile}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-sunken))] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-body font-semibold text-foreground">Full Port Scan</p>
                      <p className="text-[11px] font-body text-muted-foreground">
                        Scans all TCP ports (1-65535) instead of the bounded default set. Slower, but finds hidden services.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={fullPortScanEnabled ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs whitespace-nowrap"
                      onClick={() => setFullPortScanEnabled((value) => !value)}
                    >
                      {fullPortScanEnabled ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--bg-sunken))] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-body font-semibold text-foreground">Subdomain Enumeration</p>
                      <p className="text-[11px] font-body text-muted-foreground">
                        Enabled uses full Amass enumeration (api/mail/vpn/etc). Disabled checks only root and www hostnames.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={subdomainEnumerationEnabled ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs whitespace-nowrap"
                      onClick={() => setSubdomainEnumerationEnabled((value) => !value)}
                    >
                      {subdomainEnumerationEnabled ? 'Enabled' : 'Disabled'}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={handleRunDemo} className="text-sm">
                    Run Demo Scan
                  </Button>
                  <Button onClick={handleStartQueue} className="flex-1 text-sm" disabled={!targetInput.trim()}>
                    Start Scan
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="content" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="p-5 pt-14">
              <Outlet />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <GlassTabBar hasScanned={hasScanned || !isHome} onScan={handleScan} isLoading={false} />

      {isRunning && !minimized && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-body text-lg font-semibold">Scan Queue Running - {resolvedCount} of {queue.length} targets complete</h2>
              <Button variant="ghost" size="sm" onClick={toggleMinimize}><Minimize2 className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-2">
              {queue.map((item) => (
                <div key={item.id} className={`p-3 rounded-lg border ${item.status === 'scanning' ? 'border-[hsl(var(--accent-amber))] bg-[hsl(var(--accent-amber)/0.05)]' : 'border-border'}`}>
                  <div className="flex items-center gap-3">
                    {item.status === 'queued' && <Clock className="w-4 h-4 text-muted-foreground" />}
                    {item.status === 'scanning' && <Loader2 className="w-4 h-4 text-[hsl(var(--accent-amber))] animate-spin" />}
                    {item.status === 'done' && <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-safe))]" />}
                    {item.status === 'failed' && <XCircle className="w-4 h-4 text-[hsl(var(--status-critical))]" />}
                    {item.status === 'cancelled' && <StopCircle className="w-4 h-4 text-muted-foreground" />}
                    <span className="font-mono text-sm flex-1">{item.target}</span>
                    <span className="text-[10px] font-mono text-muted-foreground capitalize">{item.status}</span>
                    {(item.status === 'queued' || item.status === 'scanning') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] text-muted-foreground hover:text-[hsl(var(--status-critical))]"
                        onClick={() => removeQueueItem(item.id)}
                      >
                        End
                      </Button>
                    )}
                  </div>
                  {item.status === 'scanning' && (
                    <div className="mt-3 space-y-2">
                      <div className="flex gap-1">
                        {phases.map((phase, phaseIndex) => (
                          <div key={phase} className={`flex-1 h-1.5 rounded-full ${phases.indexOf(item.currentPhase) >= phaseIndex ? 'bg-[hsl(var(--accent-amber))]' : 'bg-[hsl(var(--bg-sunken))]'}`} />
                        ))}
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground">{item.currentPhase}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="bg-[hsl(var(--bg-sunken))] rounded-lg p-3 max-h-72 overflow-y-auto">
              <p className="text-[10px] font-mono text-muted-foreground uppercase mb-2">Live Log</p>
              {logs.map((line, index) => (
                <p key={index} className="text-[10px] font-mono text-foreground/80">{line}</p>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {isRunning && minimized && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="fixed bottom-24 right-6 z-[9999] bg-popover border border-border rounded-xl shadow-lg p-3 min-w-[280px]">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-3.5 h-3.5 text-[hsl(var(--accent-amber))] animate-spin" />
            <span className="text-xs font-body">Scanning {Math.min(resolvedCount + 1, queue.length)}/{queue.length} - {scanningItem?.target} - {scanningItem?.currentPhase}...</span>
            <div className="flex-1" />
            <button onClick={toggleMinimize} className="p-0.5"><Maximize2 className="w-3 h-3 text-muted-foreground" /></button>
            <button onClick={() => setCancelConfirm(true)} className="p-0.5"><X className="w-3 h-3 text-muted-foreground" /></button>
          </div>
          <Progress value={overallProgress} className="h-1.5" />
        </motion.div>
      )}

      {queueComplete && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="fixed bottom-24 right-6 z-[90] bg-[hsl(var(--status-safe)/0.1)] border border-[hsl(var(--status-safe)/0.3)] rounded-xl p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-safe))]" />
            <span className="text-xs font-body font-semibold text-[hsl(var(--status-safe))]">Scan Queue Complete</span>
          </div>
        </motion.div>
      )}

      <Dialog open={cancelConfirm} onOpenChange={setCancelConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-body">Cancel Scan Queue?</DialogTitle>
            <DialogDescription className="text-xs">This will stop all remaining scans. Completed scans will be preserved.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setCancelConfirm(false)}>Keep Running</Button>
            <Button variant="destructive" size="sm" onClick={() => { cancelQueue(); setCancelConfirm(false); }}>Cancel Queue</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardLayout;
