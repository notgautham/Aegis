import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { scanHistory, scanAssetMap, assets, Asset } from '@/data/demoData';
import { api } from '@/lib/api';
import { adaptScanResults } from '@/lib/adapters';

interface ScanSnapshot {
  qScore: number;
  assetIds: string[];
}

export const scanSnapshots: Record<string, ScanSnapshot> = {
  'SCN-007': { qScore: 370, assetIds: scanAssetMap['SCN-007'] },
  'SCN-006': { qScore: 325, assetIds: scanAssetMap['SCN-006'] },
  'SCN-005': { qScore: 410, assetIds: scanAssetMap['SCN-005'] },
  'SCN-004': { qScore: 295, assetIds: scanAssetMap['SCN-004'] },
  'SCN-003': { qScore: 24, assetIds: scanAssetMap['SCN-003'] },
  'SCN-002': { qScore: 260, assetIds: scanAssetMap['SCN-002'] },
  'SCN-001': { qScore: 210, assetIds: scanAssetMap['SCN-001'] },
};

function isUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

interface SelectedScanContextType {
  selectedScanId: string;
  setSelectedScanId: (id: string) => void;
  selectedScan: typeof scanHistory[0] | undefined;
  selectedAssets: Asset[];
  isHistorical: boolean;
  isLoading: boolean;
  scanError: string | null;
}

const SelectedScanContext = createContext<SelectedScanContextType | undefined>(undefined);

export const SelectedScanProvider = ({ children }: { children: ReactNode }) => {
  const [selectedScanId, setSelectedScanId] = useState('SCN-007');
  const [liveAssets, setLiveAssets] = useState<Asset[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Fetch live data when selectedScanId is a UUID
  useEffect(() => {
    if (!isUUID(selectedScanId)) {
      setLiveAssets(null);
      setScanError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setScanError(null);

    api.getScanResults(selectedScanId)
      .then((response) => {
        if (cancelled) return;
        const adapted = adaptScanResults(response);
        setLiveAssets(adapted);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to fetch scan results:', err);
        setScanError(err instanceof Error ? err.message : 'Failed to fetch scan results');
        setLiveAssets(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedScanId]);

  const selectedScan = useMemo(() => scanHistory.find(s => s.id === selectedScanId), [selectedScanId]);

  const selectedAssets = useMemo(() => {
    // If we have live data from a UUID scan, use it
    if (isUUID(selectedScanId) && liveAssets) return liveAssets;

    // Otherwise fall back to demoData
    const snapshot = scanSnapshots[selectedScanId];
    if (!snapshot) return assets;
    return assets.filter(a => snapshot.assetIds.includes(a.id));
  }, [selectedScanId, liveAssets]);

  const isHistorical = selectedScanId !== 'SCN-007';

  return (
    <SelectedScanContext.Provider value={{ selectedScanId, setSelectedScanId, selectedScan, selectedAssets, isHistorical, isLoading, scanError }}>
      {children}
    </SelectedScanContext.Provider>
  );
};

export const useSelectedScan = () => {
  const ctx = useContext(SelectedScanContext);
  if (!ctx) throw new Error('useSelectedScan must be used within SelectedScanProvider');
  return ctx;
};
