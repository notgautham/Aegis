import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Terminal, Play, RotateCcw, CheckCircle2, Loader2, Clock, LayoutDashboard, FileText, Wrench } from 'lucide-react';
import { useScanContext } from '@/contexts/ScanContext';
import { useScanQueue } from '@/contexts/ScanQueueContext';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import { api, type ScanRuntimeEvent, type ScanStatusResponse } from '@/lib/api';

const phases = ['Discovery', 'TLS Probing', 'PQC Classification', 'CBOM Generation', 'Certification'];

function isUUID(id: string | undefined | null): id is string {
  return !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function mapStageToPhase(stage: string | null | undefined): string {
  if (!stage) return phases[0];
  const value = stage.toLowerCase();
  if (value.includes('discover') || value.includes('enumerat') || value.includes('validating_dns') || value.includes('scanning_ports')) return 'Discovery';
  if (value.includes('tls') || value.includes('probe') || value.includes('handshake') || value.includes('processing_tls')) return 'TLS Probing';
  if (value.includes('pqc') || value.includes('classif') || value.includes('analysis') || value.includes('assessment')) return 'PQC Classification';
  if (value.includes('cbom') || value.includes('bill') || value.includes('generat')) return 'CBOM Generation';
  if (value.includes('cert') || value.includes('final') || value.includes('complet') || value.includes('remediation')) return 'Certification';
  return phases[0];
}

function formatTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatEventLine(event: ScanRuntimeEvent): string {
  const kind = event.kind.toUpperCase().padEnd(8, ' ');
  return `[${formatTime(event.timestamp)}] [${kind}] ${event.message}`;
}

function terminalChromeLines(target: string, scanId: string): string[] {
  return [
    '================================================',
    '   AEGIS Quantum Readiness Scanner',
    `   Target: ${target}`,
    `   Scan ID: ${scanId}`,
    '================================================',
    '',
  ];
}

const ScanConsole = () => {
  const { scannedDomain, rootDomain } = useScanContext();
  const navigate = useNavigate();
  const { queue, isRunning: queueRunning, logs, startQueue, cancelQueue } = useScanQueue();
  const { selectedScanId, setSelectedScanId, selectedScan } = useSelectedScan();
  const logRef = useRef<HTMLDivElement>(null);

  const activeQueueItem = useMemo(
    () => queue.find((item) => item.status === 'scanning') ?? null,
    [queue],
  );

  const latestCompletedQueueItem = useMemo(
    () => [...queue].reverse().find((item) => item.status === 'done') ?? null,
    [queue],
  );

  const consoleScanId = activeQueueItem?.scanId && isUUID(activeQueueItem.scanId)
    ? activeQueueItem.scanId
    : isUUID(selectedScanId)
      ? selectedScanId
      : latestCompletedQueueItem?.scanId && isUUID(latestCompletedQueueItem.scanId)
        ? latestCompletedQueueItem.scanId
        : null;

  const { data: scanStatus } = useQuery<ScanStatusResponse>({
    queryKey: ['scan-console-status', consoleScanId],
    queryFn: () => api.getScanStatus(consoleScanId!),
    enabled: isUUID(consoleScanId),
    refetchInterval: activeQueueItem ? 3000 : false,
    staleTime: 1000,
  });

  const displayTarget = scanStatus?.target || activeQueueItem?.target || scannedDomain || selectedScan?.target || rootDomain || 'No target selected';
  const displayScanId = consoleScanId || activeQueueItem?.scanId || 'pending';
  const launchTarget = scannedDomain || rootDomain || selectedScan?.target || '';

  const currentPhaseName = mapStageToPhase(scanStatus?.stage || activeQueueItem?.currentPhase || null);
  const currentPhaseIndex = phases.indexOf(currentPhaseName);
  const completed = scanStatus?.status === 'completed' || (!activeQueueItem && latestCompletedQueueItem?.status === 'done');
  const failed = scanStatus?.status === 'failed';
  const overallProgress = completed
    ? 100
    : failed
      ? 100
      : activeQueueItem
        ? activeQueueItem.progress
        : currentPhaseIndex >= 0
          ? Math.round(((currentPhaseIndex + 1) / phases.length) * 100)
          : 0;

  const eventLines = (scanStatus?.events ?? []).map(formatEventLine);
  const terminalLines = useMemo(() => {
    if (eventLines.length > 0) {
      return [...terminalChromeLines(displayTarget, displayScanId), ...eventLines];
    }

    if (logs.length > 0) {
      return [...terminalChromeLines(displayTarget, displayScanId), ...logs];
    }

    return [];
  }, [displayTarget, displayScanId, eventLines, logs]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [terminalLines]);

  const startScan = () => {
    if (!launchTarget) return;
    startQueue([launchTarget], 'standard');
  };

  const resetScan = () => {
    if (activeQueueItem) {
      cancelQueue();
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-body text-2xl font-bold text-foreground">Scan Console</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">Real-time scanning terminal backed by live backend events</p>
        </div>
        <div className="flex gap-2">
          {!activeQueueItem && !queueRunning && (
            <Button onClick={startScan} disabled={!launchTarget} className="gap-1.5 text-xs bg-accent-amber text-brand-primary hover:brightness-105 disabled:opacity-50">
              <Play className="w-3.5 h-3.5" /> Start Scan
            </Button>
          )}
          {(activeQueueItem || queueRunning) && (
            <Button onClick={resetScan} variant="outline" className="gap-1.5 text-xs">
              <RotateCcw className="w-3.5 h-3.5" /> Cancel Scan
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {phases.map((phase, index) => {
          const isDone = completed ? true : index < currentPhaseIndex;
          const isCurrent = !completed && !failed && index === currentPhaseIndex;

          return (
            <div key={phase} className={`flex-1 text-center px-2 py-2 rounded-lg border transition-all ${
              isCurrent ? 'border-accent-amber bg-accent-amber/5' :
              isDone ? 'border-status-safe/30 bg-status-safe/5' :
              failed && index === currentPhaseIndex ? 'border-status-critical/30 bg-status-critical/5' :
              'border-border bg-surface'
            }`}>
              <div className="flex items-center justify-center gap-1 mb-0.5">
                {isDone ? (
                  <CheckCircle2 className="w-3 h-3 text-status-safe" />
                ) : isCurrent ? (
                  <Loader2 className="w-3 h-3 text-accent-amber animate-spin" />
                ) : failed && index === currentPhaseIndex ? (
                  <RotateCcw className="w-3 h-3 text-status-critical" />
                ) : (
                  <Clock className="w-3 h-3 text-muted-foreground" />
                )}
                <span className="font-mono text-[9px] font-bold">{index + 1}</span>
              </div>
              <p className="font-mono text-[9px] text-muted-foreground leading-tight">{phase}</p>
            </div>
          );
        })}
      </div>

      {(activeQueueItem || completed || failed || scanStatus) && (
        <Card className="bg-surface border-border">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">
                {completed ? 'SCAN COMPLETE' : failed ? 'SCAN FAILED' : `PHASE ${Math.max(currentPhaseIndex + 1, 1)}: ${currentPhaseName.toUpperCase()}`}
              </span>
              <span className="font-mono text-[10px] font-bold text-foreground">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-1.5" />
          </CardContent>
        </Card>
      )}

      <Card className="bg-brand-primary border-border overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10">
          <Terminal className="w-3.5 h-3.5 text-accent-amber" />
          <span className="font-mono text-[10px] text-white/60">aegis-scanner - {displayTarget}</span>
          {(activeQueueItem || queueRunning) && (
            <Badge className="bg-status-safe/20 text-status-safe text-[9px] font-mono ml-auto">LIVE</Badge>
          )}
        </div>
        <div
          ref={logRef}
          className="p-4 h-[400px] overflow-y-auto font-mono text-xs leading-relaxed"
        >
          {terminalLines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/30">
              <Terminal className="w-8 h-8 mb-3" />
              <p className="text-sm">Select a real scan or start a new one</p>
              <p className="text-[10px] mt-1">The console will show live backend events here</p>
            </div>
          ) : (
            terminalLines.map((line, index) => (
              <motion.div
                key={`${line}-${index}`}
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.1 }}
                className={`${
                  line.includes('[ERROR') || line.includes('[FAILED') || line.includes('[DEGRADED') ? 'text-status-critical' :
                  line.includes('[SUCCESS') || line.includes('[QUEUED') ? 'text-status-safe' :
                  line.includes('[STAGE') ? 'text-accent-amber' :
                  line.includes('[INFO') ? 'text-white/80' :
                  line.includes('====') ? 'text-accent-amber' :
                  'text-white/70'
                }`}
              >
                {line || '\u00A0'}
              </motion.div>
            ))
          )}
          {(activeQueueItem || queueRunning) && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="text-accent-amber"
            >
              ¦
            </motion.span>
          )}
        </div>
      </Card>

      {(completed || failed) && isUUID(displayScanId) && (
        <Card className="bg-surface border-border">
          <CardContent className="pt-5 pb-4">
            <h3 className="font-body text-sm font-semibold mb-4">What do you want to do next?</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="p-4 rounded-lg border border-border hover:border-[hsl(var(--accent-amber)/0.3)] transition-colors">
                <LayoutDashboard className="w-5 h-5 text-brand-primary mb-2" />
                <h4 className="font-body text-xs font-semibold">View Full Results</h4>
                <p className="text-[10px] text-muted-foreground font-body mt-1">See everything this scan found in the dashboard.</p>
                <Button size="sm" className="mt-3 text-xs h-7" onClick={() => { setSelectedScanId(displayScanId); navigate('/dashboard', { state: { bypassPrompt: true } }); }}>Open in Dashboard ?</Button>
              </div>
              <div className="p-4 rounded-lg border border-border hover:border-[hsl(var(--accent-amber)/0.3)] transition-colors">
                <FileText className="w-5 h-5 text-brand-primary mb-2" />
                <h4 className="font-body text-xs font-semibold">View Scan Report</h4>
                <p className="text-[10px] text-muted-foreground font-body mt-1">See the detailed per-scan report with findings and CBOM.</p>
                <Button size="sm" className="mt-3 text-xs h-7" onClick={() => navigate(`/dashboard/scans/${displayScanId}`)}>View Scan Report ?</Button>
              </div>
              <div className="p-4 rounded-lg border border-border hover:border-[hsl(var(--accent-amber)/0.3)] transition-colors">
                <Wrench className="w-5 h-5 text-brand-primary mb-2" />
                <h4 className="font-body text-xs font-semibold">Start Remediation</h4>
                <p className="text-[10px] text-muted-foreground font-body mt-1">Jump directly to the remediation action plan.</p>
                <Button size="sm" className="mt-3 text-xs h-7" onClick={() => { setSelectedScanId(displayScanId); navigate('/dashboard/remediation/action-plan'); }}>Go to Remediation ?</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
};

export default ScanConsole;
