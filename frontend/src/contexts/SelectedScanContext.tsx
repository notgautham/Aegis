import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { scanHistory, scanAssetMap, assets, Asset } from '@/data/demoData';
import { api, type AssetResultResponse, type DNSRecordResponse, type ScanResultsResponse } from '@/lib/api';
import { adaptScanResults } from '@/lib/adapters';

const SELECTED_SCAN_STORAGE_KEY = 'aegis-selected-scan-id';

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
  selectedScanResults: ScanResultsResponse | null;
  selectedAssetResults: AssetResultResponse[];
  selectedDnsRecords: DNSRecordResponse[];
  isHistorical: boolean;
  isLoading: boolean;
  scanError: string | null;
}

const SelectedScanContext = createContext<SelectedScanContextType | undefined>(undefined);

export const SelectedScanProvider = ({ children }: { children: ReactNode }) => {
  const [selectedScanId, setSelectedScanId] = useState(() => localStorage.getItem(SELECTED_SCAN_STORAGE_KEY) ?? '');
  const [liveScanResults, setLiveScanResults] = useState<ScanResultsResponse | null>(null);
  const [liveScanResultsScanId, setLiveScanResultsScanId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const initializeSelectedScan = async () => {
      const savedSelection = localStorage.getItem(SELECTED_SCAN_STORAGE_KEY);

      try {
        const historyResponse = await api.getScanHistory();
        if (cancelled) return;

        const latestRealScanId = [...historyResponse.items]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.scan_id ?? null;

        const savedSelectionIsValid = savedSelection
          ? isUUID(savedSelection)
            ? historyResponse.items.some((item) => item.scan_id === savedSelection)
            : scanHistory.some((item) => item.id === savedSelection)
          : false;

        if (savedSelectionIsValid) {
          setSelectedScanId(savedSelection!);
          return;
        }

        if (latestRealScanId) {
          setSelectedScanId(latestRealScanId);
          return;
        }

        setSelectedScanId('SCN-007');
      } catch {
        if (cancelled) return;
        if (savedSelection && (isUUID(savedSelection) || scanHistory.some((item) => item.id === savedSelection))) {
          setSelectedScanId(savedSelection);
          return;
        }
        setSelectedScanId('SCN-007');
      }
    };

    initializeSelectedScan();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedScanId) return;
    localStorage.setItem(SELECTED_SCAN_STORAGE_KEY, selectedScanId);
  }, [selectedScanId]);

  // Fetch live data when selectedScanId is a UUID
  useEffect(() => {
    if (!selectedScanId) {
      setLiveScanResults(null);
      setLiveScanResultsScanId(null);
      setScanError(null);
      setIsLoading(false);
      return;
    }

    if (!isUUID(selectedScanId)) {
      setLiveScanResults(null);
      setLiveScanResultsScanId(null);
      setScanError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const requestScanId = selectedScanId;
    setLiveScanResults(null);
    setLiveScanResultsScanId(null);
    setIsLoading(true);
    setScanError(null);

    api.getScanResults(requestScanId)
      .then((response) => {
        if (cancelled) return;
        setLiveScanResults(response);
        setLiveScanResultsScanId(requestScanId);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to fetch scan results:', err);
        setScanError(err instanceof Error ? err.message : 'Failed to fetch scan results');
        setLiveScanResults(null);
        setLiveScanResultsScanId(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedScanId]);

  const selectedScan = useMemo(() => scanHistory.find(s => s.id === selectedScanId), [selectedScanId]);

  const selectedScanResults = useMemo(() => {
    if (!isUUID(selectedScanId)) return null;
    if (liveScanResultsScanId !== selectedScanId) return null;
    return liveScanResults;
  }, [selectedScanId, liveScanResults, liveScanResultsScanId]);

  const selectedAssets = useMemo(() => {
    if (!selectedScanId) return [];

    // If we have live data from a UUID scan, use it
    if (isUUID(selectedScanId)) {
      if (selectedScanResults) return adaptScanResults(selectedScanResults);
      return [];
    }

    // Otherwise fall back to demoData
    const snapshot = scanSnapshots[selectedScanId];
    if (!snapshot) return assets;
    return assets.filter(a => snapshot.assetIds.includes(a.id));
  }, [selectedScanId, selectedScanResults]);

  const selectedAssetResults = useMemo(
    () => selectedScanResults?.assets ?? [],
    [selectedScanResults],
  );

  const selectedDnsRecords = useMemo(
    () => selectedScanResults?.dns_records ?? [],
    [selectedScanResults],
  );

  const isHistorical = selectedScanId !== 'SCN-007';

  return (
    <SelectedScanContext.Provider value={{
      selectedScanId,
      setSelectedScanId,
      selectedScan,
      selectedAssets,
      selectedScanResults,
      selectedAssetResults,
      selectedDnsRecords,
      isHistorical,
      isLoading,
      scanError,
    }}>
      {children}
    </SelectedScanContext.Provider>
  );
};

export const useSelectedScan = () => {
  const ctx = useContext(SelectedScanContext);
  if (!ctx) throw new Error('useSelectedScan must be used within SelectedScanProvider');
  return ctx;
};
