import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

export interface PinnedPage {
  id: string;
  label: string;
  route: string;
  icon: string; // lucide icon name
}

const DEFAULT_PINS: PinnedPage[] = [
  { id: 'dashboard', label: 'Overview', route: '/dashboard', icon: 'Home' },
  { id: 'pqc:compliance', label: 'PQC', route: '/dashboard/pqc/compliance', icon: 'ShieldCheck' },
  { id: 'cbom:overview', label: 'CBOM', route: '/dashboard/cbom', icon: 'ClipboardList' },
  { id: 'remediation:action-plan', label: 'Remediation', route: '/dashboard/remediation/action-plan', icon: 'Wrench' },
  { id: 'rating:enterprise', label: 'Cyber Rating', route: '/dashboard/rating/enterprise', icon: 'Star' },
];

const STORAGE_KEY = 'aegis-pinned-pages';

interface PinnedPagesContextType {
  pinnedPages: PinnedPage[];
  isPinned: (id: string) => boolean;
  togglePin: (page: PinnedPage) => void;
  removePin: (id: string) => void;
}

const PinnedPagesContext = createContext<PinnedPagesContextType | undefined>(undefined);

export const PinnedPagesProvider = ({ children }: { children: ReactNode }) => {
  const [pinnedPages, setPinnedPages] = useState<PinnedPage[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_PINS;
    } catch {
      return DEFAULT_PINS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pinnedPages));
  }, [pinnedPages]);

  const isPinned = useCallback((id: string) => pinnedPages.some((p) => p.id === id), [pinnedPages]);

  const togglePin = useCallback((page: PinnedPage) => {
    setPinnedPages((prev) => {
      if (prev.some((p) => p.id === page.id)) {
        return prev.filter((p) => p.id !== page.id);
      }
      return [...prev, page];
    });
  }, []);

  const removePin = useCallback((id: string) => {
    setPinnedPages((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return (
    <PinnedPagesContext.Provider value={{ pinnedPages, isPinned, togglePin, removePin }}>
      {children}
    </PinnedPagesContext.Provider>
  );
};

export const usePinnedPages = () => {
  const ctx = useContext(PinnedPagesContext);
  if (!ctx) throw new Error('usePinnedPages must be used within PinnedPagesProvider');
  return ctx;
};
