import { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import { api } from '@/lib/api';

export interface QueueItem {
  id: string;
  target: string;
  status: 'queued' | 'scanning' | 'done' | 'failed' | 'cancelled';
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
  removeQueueItem: (itemId: string) => void;
  toggleMinimize: () => void;
  setMinimized: (v: boolean) => void;
  queueComplete: boolean;
}

const phases = ['Discovery', 'TLS Probing', 'PQC Classification', 'CBOM Generation', 'Certification'];

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

  const queueRef = useRef<QueueItem[]>([]);
  const cancelledRef = useRef(false);
  const cancelledItemsRef = useRef<Set<string>>(new Set());
  const runningRef = useRef(false);
  const activeItemIdRef = useRef<string | null>(null);
  const queueItemCounterRef = useRef(0);
  const queueCompleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-11), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const updateQueue = useCallback((updater: QueueItem[] | ((prev: QueueItem[]) => QueueItem[])) => {
    setQueue((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      queueRef.current = next;
      return next;
    });
  }, []);

  const finishQueue = useCallback((emitCompleteToast: boolean) => {
    activeItemIdRef.current = null;
    runningRef.current = false;
    setIsRunning(false);
    setMinimized(false);

    if (queueCompleteTimeoutRef.current) {
      clearTimeout(queueCompleteTimeoutRef.current);
      queueCompleteTimeoutRef.current = null;
    }

    if (emitCompleteToast) {
      updateQueue([]);
      setQueueComplete(true);
      addLog('Queue complete');
      queueCompleteTimeoutRef.current = setTimeout(() => setQueueComplete(false), 4000);
    }
  }, [addLog, updateQueue]);

  const buildQueueItems = useCallback((targets: string[]): QueueItem[] => {
    return targets.map((target) => {
      queueItemCounterRef.current += 1;
      const id = `queue-item-${queueItemCounterRef.current}`;
      return {
        id,
        target,
        status: 'queued',
        scanId: `pending-${id}`,
        progress: 0,
        currentPhase: '',
      };
    });
  }, []);

  const processNext = useCallback(() => {
    if (cancelledRef.current || activeItemIdRef.current) return;

    const nextItem = queueRef.current.find((item) => item.status === 'queued');
    if (!nextItem) {
      if (runningRef.current) {
        finishQueue(true);
      }
      return;
    }

    activeItemIdRef.current = nextItem.id;
    updateQueue((prev) => prev.map((item) => (
      item.id === nextItem.id
        ? { ...item, status: 'scanning', currentPhase: phases[0], progress: 0 }
        : item
    )));
    addLog(`Starting scan: ${nextItem.target}`);

    void (async () => {
      let scanId = nextItem.scanId;

      try {
        const { scan_id } = await api.createScan(nextItem.target);
        scanId = scan_id;

        if (cancelledRef.current || cancelledItemsRef.current.has(nextItem.id)) {
          return;
        }

        updateQueue((prev) => prev.map((item) => (
          item.id === nextItem.id
            ? { ...item, scanId: scan_id }
            : item
        )));
        addLog(`Scan created: ${scanId}`);

        let done = false;
        while (!done && !cancelledRef.current && !cancelledItemsRef.current.has(nextItem.id)) {
          await sleep(3000);
          if (cancelledRef.current || cancelledItemsRef.current.has(nextItem.id)) break;

          try {
            const status = await api.getScanStatus(scanId);
            const phase = mapStageToPhase((status as any).stage ?? (status as any).current_stage);
            const prog = phaseProgress(phase);

            updateQueue((prev) => prev.map((item) => (
              item.id === nextItem.id
                ? { ...item, currentPhase: phase, progress: prog }
                : item
            )));
            addLog(`${phase}: ${nextItem.target}`);

            if (status.status === 'completed') {
              done = true;
              updateQueue((prev) => prev.map((item) => (
                item.id === nextItem.id
                  ? { ...item, status: 'done', progress: 100, currentPhase: 'Complete' }
                  : item
              )));
              addLog(`Scan complete: ${nextItem.target}`);

              const assetsFound = status.progress?.assets_discovered ?? 0;
              setNotifications((prev) => [...prev, {
                id: scanId,
                message: `Scan complete: ${nextItem.target} · ${assetsFound} assets found`,
                link: `/dashboard/scans/${scanId}`,
                timestamp: new Date(),
              }]);
            } else if (status.status === 'failed') {
              done = true;
              updateQueue((prev) => prev.map((item) => (
                item.id === nextItem.id
                  ? { ...item, status: 'failed', currentPhase: 'Failed' }
                  : item
              )));
              addLog(`Scan failed: ${nextItem.target}`);
            }
          } catch (pollErr) {
            addLog(`Poll error for ${nextItem.target}: ${pollErr}`);
          }
        }
      } catch (err) {
        if (!cancelledRef.current && !cancelledItemsRef.current.has(nextItem.id)) {
          updateQueue((prev) => prev.map((item) => (
            item.id === nextItem.id
              ? { ...item, status: 'failed', currentPhase: 'Failed' }
              : item
          )));
          addLog(`Failed to start scan for ${nextItem.target}: ${err}`);
        }
      } finally {
        if (cancelledItemsRef.current.has(nextItem.id)) {
          cancelledItemsRef.current.delete(nextItem.id);
        }

        activeItemIdRef.current = null;

        if (cancelledRef.current) {
          finishQueue(false);
          return;
        }

        const hasQueuedItems = queueRef.current.some((item) => item.status === 'queued');
        if (hasQueuedItems) {
          processNext();
          return;
        }

        finishQueue(true);
      }
    })();
  }, [addLog, finishQueue, updateQueue]);

  const startQueue = useCallback((targets: string[], profile: string) => {
    const normalizedTargets = [...new Set(targets.map((target) => target.trim()).filter(Boolean))];
    if (normalizedTargets.length === 0) return;

    cancelledRef.current = false;
    setScanProfile(profile);
    setQueueComplete(false);

    if (queueCompleteTimeoutRef.current) {
      clearTimeout(queueCompleteTimeoutRef.current);
      queueCompleteTimeoutRef.current = null;
    }

    const activeTargets = new Set(
      queueRef.current
        .filter((item) => item.status === 'queued' || item.status === 'scanning')
        .map((item) => item.target.toLowerCase()),
    );

    const freshTargets = normalizedTargets.filter((target) => !activeTargets.has(target.toLowerCase()));
    if (freshTargets.length === 0) {
      addLog('Requested targets are already in the queue');
      return;
    }

    const items = buildQueueItems(freshTargets);

    if (!runningRef.current) {
      runningRef.current = true;
      setIsRunning(true);
      setLogs([]);
      updateQueue(items);
      addLog(`Scan queue started with ${items.length} target${items.length === 1 ? '' : 's'} (${profile})`);
      processNext();
      return;
    }

    updateQueue((prev) => [...prev, ...items]);
    addLog(`Added ${items.length} target${items.length === 1 ? '' : 's'} to the queue`);
    processNext();
  }, [addLog, buildQueueItems, processNext, updateQueue]);

  const cancelQueue = useCallback(() => {
    cancelledRef.current = true;
    updateQueue((prev) => prev.map((item) => (
      item.status === 'queued' || item.status === 'scanning'
        ? { ...item, status: 'cancelled', currentPhase: 'Cancelled', progress: 0 }
        : item
    )));
    addLog('Queue cancelled');
    finishQueue(false);
  }, [addLog, finishQueue, updateQueue]);

  const removeQueueItem = useCallback((itemId: string) => {
    const targetItem = queueRef.current.find((item) => item.id === itemId);
    if (!targetItem) return;
    if (targetItem.status === 'done' || targetItem.status === 'failed' || targetItem.status === 'cancelled') return;

    updateQueue((prev) => prev.map((item) => (
      item.id === itemId
        ? { ...item, status: 'cancelled', currentPhase: 'Cancelled', progress: 0 }
        : item
    )));

    if (targetItem.status === 'scanning') {
      cancelledItemsRef.current.add(itemId);
      addLog(`Ended scan: ${targetItem.target}`);
      return;
    }

    addLog(`Removed queued target: ${targetItem.target}`);
    processNext();
  }, [addLog, processNext, updateQueue]);

  const toggleMinimize = useCallback(() => setMinimized((value) => !value), []);

  return (
    <ScanQueueContext.Provider
      value={{
        queue,
        isRunning,
        minimized,
        scanProfile,
        notifications,
        logs,
        startQueue,
        cancelQueue,
        removeQueueItem,
        toggleMinimize,
        setMinimized,
        queueComplete,
      }}
    >
      {children}
    </ScanQueueContext.Provider>
  );
};

export const useScanQueue = () => {
  const ctx = useContext(ScanQueueContext);
  if (!ctx) throw new Error('useScanQueue must be used within ScanQueueProvider');
  return ctx;
};
