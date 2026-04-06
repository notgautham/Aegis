import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useScanContext } from '@/contexts/ScanContext';
import { useScanQueue } from '@/contexts/ScanQueueContext';
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
import { X, Maximize2, Minimize2, CheckCircle2, Loader2, Clock, XCircle, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const scanProfiles = ['Quick', 'Standard', 'Deep', 'PQC Focus'] as const;
const exampleChips = ['pnb.co.in', 'vpn.pnb.co.in', 'netbanking.pnb.co.in', 'auth.pnb.co.in'];

const TargetChip = ({ value, onRemove }: { value: string; onRemove: () => void }) => (
  <span className="group inline-flex items-center gap-1 font-mono text-xs bg-[hsl(var(--bg-sunken))] text-foreground px-2.5 py-1.5 rounded-lg border border-[hsl(var(--border-default))] transition-colors">
    {value}
    <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 p-0.5 rounded hover:bg-[hsl(var(--status-critical)/0.15)]">
      <X className="w-3 h-3 text-muted-foreground hover:text-[hsl(var(--status-critical))]" />
    </button>
  </span>
);

const DashboardLayout = () => {
  const [hasScanned, setHasScanned] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setScannedDomain } = useScanContext();
  const { queue, isRunning, minimized, setMinimized, toggleMinimize, cancelQueue, startQueue, logs, queueComplete } = useScanQueue();
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [targets, setTargets] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [scanProfile, setScanProfile] = useState<string>('Standard');
  const [fileMsg, setFileMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const pathname = location.pathname;
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

  const handleScan = (domain: string) => {
    setScannedDomain(domain);
    setHasScanned(true);
  };

  const handleDemoScan = () => {
    setScannedDomain('pnb.co.in');
    setHasScanned(true);
  };

  const addChip = (domain: string) => {
    const d = domain.trim();
    if (d && !targets.includes(d)) {
      setTargets(prev => [...prev, d]);
    }
  };

  const removeChip = (domain: string) => {
    setTargets(prev => prev.filter(t => t !== domain));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      const val = inputValue.replace(/,/g, '').trim();
      if (val) {
        addChip(val);
        setInputValue('');
      }
    } else if (e.key === 'Backspace' && !inputValue && targets.length > 0) {
      setTargets(prev => prev.slice(0, -1));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.includes(',')) {
      const parts = val.split(',').map(s => s.trim()).filter(Boolean);
      parts.forEach(p => addChip(p));
      setInputValue('');
    } else {
      setInputValue(val);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/[\r\n,]+/).map(l => l.trim()).filter(Boolean);
      setTargets(prev => [...new Set([...prev, ...lines])]);
      setFileMsg(`Loaded ${lines.length} targets from file`);
      setTimeout(() => setFileMsg(''), 3000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleStartQueue = () => {
    const parsed = [...new Set(targets)];
    if (parsed.length === 0) return;
    startQueue(parsed, scanProfile);
    handleScan(parsed[0]);
  };

  const handleRunDemo = () => {
    setTargets(['pnb.co.in']);
    startQueue(['pnb.co.in'], 'Standard');
    handleScan('pnb.co.in');
  };

  const isHome = pathname === '/dashboard';
  const showPrompt = isHome && !hasScanned;

  const doneCount = queue.filter(q => q.status === 'done').length;
  const scanningItem = queue.find(q => q.status === 'scanning');
  const overallProgress = queue.length > 0 ? Math.round((doneCount / queue.length) * 100) : 0;

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
                <p className="font-body text-base text-muted-foreground max-w-md mx-auto">Enter target domains to generate a complete Cryptographic Bill of Materials and quantum risk assessment.</p>
              </motion.div>

              <div className="relative z-10 w-full max-w-2xl space-y-4">
                {/* Chip input */}
                <div className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-[hsl(var(--accent-amber))] transition-shadow">
                  <div className="flex flex-wrap gap-2 items-center">
                    {targets.map(t => (
                      <TargetChip key={t} value={t} onRemove={() => removeChip(t)} />
                    ))}
                    <input
                      value={inputValue}
                      onChange={handleInputChange}
                      onKeyDown={handleInputKeyDown}
                      placeholder={targets.length === 0 ? "Enter targets separated by comma…" : "Add more…"}
                      className="flex-1 min-w-[160px] bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none py-1"
                    />
                  </div>
                </div>

                {/* Example chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-body text-muted-foreground">Examples:</span>
                  {exampleChips.map(d => (
                    <button key={d} onClick={() => addChip(d)} className="font-mono text-xs text-muted-foreground px-3 py-1.5 rounded-lg border border-[hsl(var(--border-default))] hover:border-[hsl(var(--border-strong))] hover:text-foreground transition-colors">
                      {d}
                    </button>
                  ))}
                </div>

                {/* Upload + Profile on same row */}
                <div className="flex items-center gap-3 flex-wrap">
                  <input ref={fileRef} type="file" accept=".txt,.csv" className="hidden" onChange={handleFileUpload} />
                  <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => fileRef.current?.click()}>
                    <Upload className="w-3 h-3" /> Upload .txt / .csv
                  </Button>
                  {fileMsg && <span className="text-xs font-body text-[hsl(var(--status-safe))] animate-in fade-in">{fileMsg}</span>}
                  <div className="h-4 w-px bg-border mx-1" />
                  <span className="text-xs font-body text-muted-foreground">Profile:</span>
                  <div className="flex gap-1 p-1 rounded-xl bg-[hsl(var(--bg-sunken))]">
                    {scanProfiles.map(p => (
                      <button
                        key={p}
                        onClick={() => setScanProfile(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-body transition-all ${scanProfile === p ? 'bg-[hsl(var(--accent-amber))] text-white font-semibold shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={handleRunDemo} className="text-sm">
                    Run Demo Scan
                  </Button>
                  <Button onClick={handleStartQueue} className="flex-1 text-sm" disabled={targets.length === 0}>
                    Start Scan Queue
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

      <GlassTabBar hasScanned={hasScanned || !isHome} onScan={handleScan} />

      {/* Full-screen scan progress overlay */}
      {isRunning && !minimized && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-8">
          <div className="w-full max-w-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-body text-lg font-semibold">Scan Queue Running — {doneCount} of {queue.length} targets complete</h2>
              <Button variant="ghost" size="sm" onClick={toggleMinimize}><Minimize2 className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-2">
              {queue.map((q, i) => (
                <div key={i} className={`p-3 rounded-lg border ${q.status === 'scanning' ? 'border-[hsl(var(--accent-amber))] bg-[hsl(var(--accent-amber)/0.05)]' : 'border-border'}`}>
                  <div className="flex items-center gap-3">
                    {q.status === 'queued' && <Clock className="w-4 h-4 text-muted-foreground" />}
                    {q.status === 'scanning' && <Loader2 className="w-4 h-4 text-[hsl(var(--accent-amber))] animate-spin" />}
                    {q.status === 'done' && <CheckCircle2 className="w-4 h-4 text-[hsl(var(--status-safe))]" />}
                    {q.status === 'failed' && <XCircle className="w-4 h-4 text-[hsl(var(--status-critical))]" />}
                    <span className="font-mono text-sm flex-1">{q.target}</span>
                    <span className="text-[10px] font-mono text-muted-foreground capitalize">{q.status}</span>
                  </div>
                  {q.status === 'scanning' && (
                    <div className="mt-3 space-y-2">
                      <div className="flex gap-1">
                        {phases.map((p, pi) => (
                          <div key={p} className={`flex-1 h-1.5 rounded-full ${phases.indexOf(q.currentPhase) >= pi ? 'bg-[hsl(var(--accent-amber))]' : 'bg-[hsl(var(--bg-sunken))]'}`} />
                        ))}
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground">{q.currentPhase}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="bg-[hsl(var(--bg-sunken))] rounded-lg p-3 max-h-48 overflow-y-auto">
              <p className="text-[10px] font-mono text-muted-foreground uppercase mb-2">Live Log</p>
              {logs.map((l, i) => (
                <p key={i} className="text-[10px] font-mono text-foreground/80">{l}</p>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {isRunning && minimized && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="fixed bottom-24 right-6 z-[9999] bg-popover border border-border rounded-xl shadow-lg p-3 min-w-[280px]">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-3.5 h-3.5 text-[hsl(var(--accent-amber))] animate-spin" />
            <span className="text-xs font-body">Scanning {doneCount + 1}/{queue.length} · {scanningItem?.target} · {scanningItem?.currentPhase}…</span>
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
            <span className="text-xs font-body font-semibold text-[hsl(var(--status-safe))]">Scan Queue Complete ✓</span>
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