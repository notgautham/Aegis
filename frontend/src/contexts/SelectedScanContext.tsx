import { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { scanHistory, scanAssetMap, assets } from '@/data/demoData';

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

interface SelectedScanContextType {
  selectedScanId: string;
  setSelectedScanId: (id: string) => void;
  selectedScan: typeof scanHistory[0] | undefined;
  selectedAssets: typeof assets;
  isHistorical: boolean;
}

const SelectedScanContext = createContext<SelectedScanContextType | undefined>(undefined);

export const SelectedScanProvider = ({ children }: { children: ReactNode }) => {
  const [selectedScanId, setSelectedScanId] = useState('SCN-007');

  const selectedScan = useMemo(() => scanHistory.find(s => s.id === selectedScanId), [selectedScanId]);
  const selectedAssets = useMemo(() => {
    const snapshot = scanSnapshots[selectedScanId];
    if (!snapshot) return assets;
    return assets.filter(a => snapshot.assetIds.includes(a.id));
  }, [selectedScanId]);
  const isHistorical = selectedScanId !== 'SCN-007';

  return (
    <SelectedScanContext.Provider value={{ selectedScanId, setSelectedScanId, selectedScan, selectedAssets, isHistorical }}>
      {children}
    </SelectedScanContext.Provider>
  );
};

export const useSelectedScan = () => {
  const ctx = useContext(SelectedScanContext);
  if (!ctx) throw new Error('useSelectedScan must be used within SelectedScanProvider');
  return ctx;
};
