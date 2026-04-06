import { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import { api } from '@/lib/api';

export interface QueueItem {
  target: string;
  status: 'queued' | 'scanning' | 'done' | 'failed';
  scanId: string;
  progress: number;
  currentPhase: string;
}

export interface ScanNotification {
  id: string;
  message: string;
  link: string;
  timestamp: Date;
}

interface ScanQueueContextType {
  queue: QueueItem[];
  isRunning: boolean;
  minimized: boolean;
  scanProfile: string;
  notifications: ScanNotification[];
  logs: string[];
  startQueue: (targets: string[], profile: string) => void;
  cancelQueue: () => void;
  toggleMinimize: () => void;
  setMinimized: (v: boolean) => void;
  queueComplete: boolean;
}

const phases = ['Discovery', 'TLS Probing', 'PQC Classification', 'CBOM Generation', 'Certification'];

// Map backend stage strings to frontend phase names
function mapStageToPhase(stage: string | undefined): string {
  if (!stage) return phases[0];
  const s = stage.toLowerCase();
  if (s.includes('discover') || s.includes('enumerat')) return 'Discovery';
  if (s.includes('tls') || s.includes('probe') || s.includes('handshake')) return 'TLS Probing';
  if (s.includes('pqc') || s.includes('classif') || s.includes('quantum')) return 'PQC Classification';
  if (s.includes('cbom') || s.includes('bill') || s.includes('generat')) return 'CBOM Generation';
  if (s.includes('cert') || s.includes('final') || s.includes('complet')) return 'Certification';
  return phases[0];
}

function phaseProgress(phase: string): number {
  const idx = phases.indexOf(phase);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / phases.length) * 100);
}

const ScanQueueContext = createContext<ScanQueueContextType | undefined>(undefined);

export const ScanQueueProvider = ({ children }: { children: ReactNode }) => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [scanProfile, setScanProfile] = useState('standard');
  const [notifications, setNotifications] = useState<ScanNotification[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [queueComplete, setQueueComplete] = useState(false);
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-7), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const processQueue = useCallback(async (items: QueueItem[]) => {
    for (let i = 0; i < items.length; i++) {
      if (cancelledRef.current) break;

      // Mark current item as scanning
      setQueue(prev => {
        const next = [...prev];
        next[i] = { ...next[i], status: 'scanning', currentPhase: phases[0], progress: 0 };
        return next;
      });
      addLog(`Starting scan: ${items[i].target}`);

      let scanId = items[i].scanId;

      try {
        // 1. Create scan
        const { scan_id } = await api.createScan(items[i].target);
        scanId = scan_id;
        setQueue(prev => {
          const next = [...prev];
          next[i] = { ...next[i], scanId: scan_id };
          return next;
        });
        addLog(`Scan created: ${scanId}`);

        // 2. Poll until completed or failed
        let done = false;
        while (!done && !cancelledRef.current) {
          await sleep(3000);
          if (cancelledRef.current) break;

          try {
            const status = await api.getScanStatus(scanId);
            const phase = mapStageToPhase((status as any).stage ?? (status as any).current_stage);
            const prog = phaseProgress(phase);

            setQueue(prev => {
              const next = [...prev];
              next[i] = { ...next[i], currentPhase: phase, progress: prog };
              return next;
            });
            addLog(`${phase}: ${items[i].target}`);

            if (status.status === 'completed') {
              done = true;
              setQueue(prev => {
                const next = [...prev];
                next[i] = { ...next[i], status: 'done', progress: 100, currentPhase: 'Complete' };
                return next;
              });
              addLog(`✓ Scan complete: ${items[i].target}`);

              const assetsFound = status.progress?.assets_discovered ?? 0;
              setNotifications(prev => [...prev, {
                id: scanId,
                message: `Scan complete: ${items[i].target} · ${assetsFound} assets found`,
                link: `/dashboard/scans/${scanId}`,
                timestamp: new Date(),
              }]);
            } else if (status.status === 'failed') {
              done = true;
              setQueue(prev => {
                const next = [...prev];
                next[i] = { ...next[i], status: 'failed', currentPhase: 'Failed' };
                return next;
              });
              addLog(`✗ Scan failed: ${items[i].target}`);
            }
          } catch (pollErr) {
            addLog(`⚠ Poll error for ${items[i].target}: ${pollErr}`);
            // Continue polling — transient errors shouldn't kill the queue
          }
        }
      } catch (err) {
        // createScan failed
        setQueue(prev => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'failed', currentPhase: 'Failed' };
          return next;
        });
        addLog(`✗ Failed to start scan for ${items[i].target}: ${err}`);
      }
    }

    // All done
    if (!cancelledRef.current) {
      setQueueComplete(true);
      addLog('✓ All scans complete');
      setTimeout(() => setQueueComplete(false), 4000);
    }
    setIsRunning(false);
    runningRef.current = false;
  }, [addLog]);

  const startQueue = useCallback((targets: string[], profile: string) => {
    if (runningRef.current) return;
    cancelledRef.current = false;
    runningRef.current = true;
    setScanProfile(profile);
    setQueueComplete(false);

    const items: QueueItem[] = targets.map((t, i) => ({
      target: t,
      status: i === 0 ? 'scanning' as const : 'queued' as const,
      scanId: `pending-${i}`,
      progress: 0,
      currentPhase: i === 0 ? phases[0] : '',
    }));

    setQueue(items);
    setIsRunning(true);
    setLogs([]);
    addLog(`Scan queue started with ${targets.length} targets (${profile})`);

    processQueue(items);
  }, [addLog, processQueue]);

  const cancelQueue = useCallback(() => {
    cancelledRef.current = true;
    setIsRunning(false);
    runningRef.current = false;
    setQueue(prev => prev.map(q => q.status === 'queued' || q.status === 'scanning' ? { ...q, status: 'failed' } : q));
    addLog('✗ Queue cancelled');
  }, [addLog]);

  const toggleMinimize = useCallback(() => setMinimized(m => !m), []);

  return (
    <ScanQueueContext.Provider value={{ queue, isRunning, minimized, scanProfile, notifications, logs, startQueue, cancelQueue, toggleMinimize, setMinimized, queueComplete }}>
      {children}
    </ScanQueueContext.Provider>
  );
};

export const useScanQueue = () => {
  const ctx = useContext(ScanQueueContext);
  if (!ctx) throw new Error('useScanQueue must be used within ScanQueueProvider');
  return ctx;
};
