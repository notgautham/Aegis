import { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';

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

const ScanQueueContext = createContext<ScanQueueContextType | undefined>(undefined);

export const ScanQueueProvider = ({ children }: { children: ReactNode }) => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [scanProfile, setScanProfile] = useState('standard');
  const [notifications, setNotifications] = useState<ScanNotification[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [queueComplete, setQueueComplete] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-7), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const startQueue = useCallback((targets: string[], profile: string) => {
    if (isRunning) return;
    cancelledRef.current = false;
    setScanProfile(profile);
    setQueueComplete(false);

    const items: QueueItem[] = targets.map((t, i) => ({
      target: t,
      status: i === 0 ? 'scanning' : 'queued',
      scanId: `SCN-${String(8 + i).padStart(3, '0')}`,
      progress: 0,
      currentPhase: i === 0 ? phases[0] : '',
    }));

    setQueue(items);
    setIsRunning(true);
    setLogs([]);
    addLog(`Scan queue started with ${targets.length} targets (${profile})`);

    let currentIdx = 0;
    let phaseIdx = 0;

    intervalRef.current = setInterval(() => {
      if (cancelledRef.current) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }

      phaseIdx++;
      if (phaseIdx >= phases.length) {
        // Current target done
        setQueue(prev => {
          const next = [...prev];
          next[currentIdx] = { ...next[currentIdx], status: 'done', progress: 100, currentPhase: 'Complete' };
          return next;
        });

        const target = items[currentIdx].target;
        const scanId = items[currentIdx].scanId;
        addLog(`✓ Scan complete: ${target}`);

        setNotifications(prev => [...prev, {
          id: scanId,
          message: `Scan complete: ${target} · ${Math.floor(Math.random() * 10 + 5)} assets found · Q-Score ${Math.floor(Math.random() * 400 + 200)}`,
          link: `/dashboard/scans/${scanId}`,
          timestamp: new Date(),
        }]);

        currentIdx++;
        phaseIdx = 0;

        if (currentIdx >= items.length) {
          // All done
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsRunning(false);
          setQueueComplete(true);
          addLog('✓ All scans complete');
          setTimeout(() => setQueueComplete(false), 4000);
          return;
        }

        // Start next
        setQueue(prev => {
          const next = [...prev];
          next[currentIdx] = { ...next[currentIdx], status: 'scanning', currentPhase: phases[0], progress: 0 };
          return next;
        });
        addLog(`Starting scan: ${items[currentIdx].target}`);
      } else {
        // Update progress
        setQueue(prev => {
          const next = [...prev];
          next[currentIdx] = {
            ...next[currentIdx],
            currentPhase: phases[phaseIdx],
            progress: Math.round(((phaseIdx + 1) / phases.length) * 100),
          };
          return next;
        });
        addLog(`${phases[phaseIdx]}: ${items[currentIdx].target}`);
      }
    }, 5000);
  }, [isRunning, addLog]);

  const cancelQueue = useCallback(() => {
    cancelledRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
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
