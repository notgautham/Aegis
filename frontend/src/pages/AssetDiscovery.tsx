import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useScanContext } from '@/contexts/ScanContext';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import { api, type AssetResultResponse, type DNSRecordResponse } from '@/lib/api';
import { adaptScanHistory, adaptScanResults } from '@/lib/adapters';
import DataContextBadge from '@/components/dashboard/DataContextBadge';
import DiscoveryDetailPanel from '@/components/dashboard/DiscoveryDetailPanel';
import { Globe, Key, Server, Cpu, Share2, AlertTriangle, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  domainRecords as demoDomainRecords,
  ipRecords as demoIpRecords,
  softwareRecords as demoSoftwareRecords,
  shadowITAlerts as demoShadowITAlerts,
  assets as demoAssets,
} from '@/data/demoData';
import type { DomainRecord, IPRecord, SoftwareRecord, Asset, ScanHistoryEntry, ShadowITAlert } from '@/data/demoData';
import NetworkGraph from '@/components/dashboard/NetworkGraph';

const tabDefs = [
  { id: 'domains', label: 'Domains', icon: Globe },
  { id: 'ssl', label: 'SSL Certificates', icon: Key },
  { id: 'ip', label: 'IP / Subnets', icon: Server },
  { id: 'software', label: 'Software & Services', icon: Cpu },
  { id: 'network', label: 'Network Graph', icon: Share2 },
  { id: 'shadow', label: 'Shadow IT', icon: AlertTriangle },
];

const riskBadge = (score: number) => {
  if (score >= 75) return <Badge variant="destructive" className="text-[10px]">Critical</Badge>;
  if (score >= 50) return <Badge className="bg-[hsl(var(--status-warn))] text-white text-[10px]">High</Badge>;
  if (score >= 25) return <Badge className="bg-[hsl(var(--accent-amber))] text-white text-[10px]">Medium</Badge>;
  return <Badge className="bg-[hsl(var(--status-safe))] text-white text-[10px]">Low</Badge>;
};

type ScopeMode = 'this-scan' | 'all-time';

interface ObservedAsset {
  asset: Asset;
  rawAsset: AssetResultResponse | null;
  observedAt: string;
  scanId: string;
  target: string;
}

interface ObservedDNSRecord {
  record: DNSRecordResponse;
  observedAt: string;
  scanId: string;
  target: string;
}

interface DiscoveryQueryResult {
  history: ScanHistoryEntry[];
  completedHistory: ScanHistoryEntry[];
  totalCompletedScanCount: number;
  loadedCompletedScanCount: number;
  observedAssets: ObservedAsset[];
  observedDnsRecords: ObservedDNSRecord[];
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const nestedRecord = (root: Record<string, unknown> | null, key: string): Record<string, unknown> | null =>
  root ? asRecord(root[key]) : null;

const stringValue = (root: Record<string, unknown> | null, key: string): string | null => {
  if (!root) return null;
  const value = root[key];
  return typeof value === 'string' && value.trim() ? value : null;
};

const stringArray = (root: Record<string, unknown> | null, key: string): string[] => {
  if (!root) return [];
  const value = root[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
};

const formatDateCell = (value: string | null | undefined): string => {
  if (!value) return 'Unavailable';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
};

const normalizeDisplayValue = (value: string | null | undefined): string => {
  if (!value) return 'Unavailable';
  const normalized = value.trim();
  if (!normalized || normalized === '—' || normalized.toLowerCase() === 'unknown') {
    return 'Unavailable';
  }
  return normalized;
};

const hasCertificateDetails = (asset: Asset): boolean => {
  if (!asset.certInfo) return false;
  return Boolean(
    (asset.certInfo.subject_cn && asset.certInfo.subject_cn !== 'unknown') ||
    (asset.certInfo.valid_until && asset.certInfo.valid_until !== 'Unavailable') ||
    (asset.certInfo.sha256_fingerprint && asset.certInfo.sha256_fingerprint.length > 10),
  );
};

const getObservedTime = (value: string): number => {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toObservedAssets = (
  items: Asset[],
  scanId: string,
  target: string,
  rawAssets: AssetResultResponse[] = [],
  observedAtOverride?: string | null,
): ObservedAsset[] => {
  const rawById = new Map(rawAssets.map((asset) => [asset.asset_id, asset]));

  return items.map((asset) => ({
    asset,
    rawAsset: rawById.get(asset.id) ?? null,
    observedAt: observedAtOverride ?? asset.lastScanned,
    scanId,
    target,
  }));
};

const toObservedDnsRecords = (
  records: DNSRecordResponse[],
  scanId: string,
  target: string,
  observedAt: string,
): ObservedDNSRecord[] =>
  records.map((record) => ({
    record,
    observedAt,
    scanId,
    target,
  }));

const MAX_ALL_TIME_SCANS = 40;

const assetRiskScore = (asset: Asset): number => Math.max(0, Math.min(100, 100 - asset.qScore));

const assetRiskLevel = (asset: Asset): IPRecord['risk'] => {
  if (asset.status === 'critical') return 'critical';
  if (asset.status === 'unknown') return 'high';
  if (asset.status === 'vulnerable') return 'high';
  if (
    asset.status === 'standard' ||
    asset.status === 'transitioning' ||
    asset.status === 'safe' ||
    asset.complianceTier === 'PQC_TRANSITIONING'
  ) return 'medium';
  return 'low';
};

const latestObservedAssets = (observedAssets: ObservedAsset[]): ObservedAsset[] => {
  const latest = new Map<string, ObservedAsset>();

  observedAssets.forEach((item) => {
    const key = `${item.asset.domain}|${item.asset.port}|${item.asset.type}`;
    const existing = latest.get(key);
    if (!existing || getObservedTime(item.observedAt) > getObservedTime(existing.observedAt)) {
      latest.set(key, item);
    }
  });

  return [...latest.values()].sort((a, b) => {
    const timeDelta = getObservedTime(b.observedAt) - getObservedTime(a.observedAt);
    return timeDelta !== 0 ? timeDelta : a.asset.domain.localeCompare(b.asset.domain);
  });
};

const latestAssets = (observedAssets: ObservedAsset[]): Asset[] =>
  latestObservedAssets(observedAssets).map((item) => item.asset);

const buildDomainRecords = (
  observedAssets: ObservedAsset[],
  observedDnsRecords: ObservedDNSRecord[] = [],
): DomainRecord[] => {
  const grouped = new Map<string, { assets: ObservedAsset[]; dns: ObservedDNSRecord[] }>();

  observedAssets.forEach((item) => {
    const key = item.asset.domain;
    const existing = grouped.get(key) ?? { assets: [], dns: [] };
    existing.assets.push(item);
    grouped.set(key, existing);
  });

  observedDnsRecords.forEach((item) => {
    const key = item.record.hostname;
    const existing = grouped.get(key) ?? { assets: [], dns: [] };
    existing.dns.push(item);
    grouped.set(key, existing);
  });

  return [...grouped.entries()].map(([domain, groupedItems]) => {
    const assetItems = groupedItems.assets;
    const dnsItems = groupedItems.dns;
    const allObservedAt = [
      ...assetItems.map((item) => item.observedAt),
      ...dnsItems.map((item) => item.observedAt),
    ].sort((a, b) => getObservedTime(a) - getObservedTime(b));
    const latestAsset = [...assetItems].sort(
      (a, b) => getObservedTime(a.observedAt) - getObservedTime(b.observedAt),
    )[assetItems.length - 1];
    const seenInScans = new Set([
      ...assetItems.map((item) => item.scanId),
      ...dnsItems.map((item) => item.scanId),
    ]).size;

    return {
      detectionDate: formatDateCell(allObservedAt[0]),
      domain,
      registrationDate: (() => {
        const metadata = nestedRecord(asRecord(latestAsset?.rawAsset?.asset_metadata ?? null), 'domain_enrichment');
        return normalizeDisplayValue(
          stringValue(metadata, 'registration_date')
          ?? latestAsset?.asset.certInfo.valid_from
          ?? null,
        );
      })(),
      expiryDate: (() => {
        const metadata = nestedRecord(asRecord(latestAsset?.rawAsset?.asset_metadata ?? null), 'domain_enrichment');
        return normalizeDisplayValue(
          stringValue(metadata, 'expiry_date')
          ?? latestAsset?.asset.certInfo.valid_until
          ?? null,
        );
      })(),
      registrar: (() => {
        const metadata = nestedRecord(asRecord(latestAsset?.rawAsset?.asset_metadata ?? null), 'domain_enrichment');
        return normalizeDisplayValue(stringValue(metadata, 'registrar'));
      })(),
      company: latestAsset && latestAsset.asset.ownerTeam !== 'Unassigned'
        ? latestAsset.asset.ownerTeam
        : 'Unassigned',
      status: seenInScans > 1 ? 'confirmed' : 'new',
      riskScore: assetItems.length > 0 ? Math.max(...assetItems.map((item) => assetRiskScore(item.asset))) : 0,
      nameservers: (() => {
        const metadata = nestedRecord(asRecord(latestAsset?.rawAsset?.asset_metadata ?? null), 'domain_enrichment');
        const values = stringArray(metadata, 'nameservers');
        return values.length > 0 ? values : [];
      })(),
    };
  }).sort((a, b) => a.domain.localeCompare(b.domain));
};

const buildIPRecords = (observedAssets: ObservedAsset[]): IPRecord[] => {
  const grouped = new Map<string, ObservedAsset[]>();

  observedAssets.filter((item) => item.asset.ip).forEach((item) => {
    const key = item.asset.ip;
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  });

  return [...grouped.entries()].map(([ip, items]) => {
    const sorted = [...items].sort((a, b) => getObservedTime(a.observedAt) - getObservedTime(b.observedAt));
    const latest = sorted[sorted.length - 1];
    const portsOpen = [...new Set([
      ...items.flatMap((item) => {
        if (!Array.isArray(item.rawAsset?.open_ports)) return [];
        return item.rawAsset.open_ports
          .map((portEntry) => {
            if (typeof portEntry !== 'object' || portEntry === null) return Number.NaN;
            const rawPort = (portEntry as Record<string, unknown>).port;
            return typeof rawPort === 'number' ? rawPort : Number(rawPort);
          })
          .filter((port): port is number => Number.isFinite(port));
      }),
      ...items.map((item) => item.asset.port),
    ])].sort((a, b) => a - b);
    const risks = items.map((item) => assetRiskLevel(item.asset));
    const risk = risks.includes('critical')
      ? 'critical'
      : risks.includes('high')
        ? 'high'
        : risks.includes('medium')
          ? 'medium'
          : 'low';

    const networkMetadata = nestedRecord(asRecord(latest.rawAsset?.asset_metadata ?? null), 'network_enrichment');
    const city = stringValue(networkMetadata, 'city');
    const country = stringValue(networkMetadata, 'country');
    const composedLocation = [city, country].filter(Boolean).join(', ');

    return {
      detectionDate: formatDateCell(sorted[0]?.observedAt),
      ip,
      portsOpen,
      subnet: normalizeDisplayValue(stringValue(networkMetadata, 'subnet')),
      asn: normalizeDisplayValue(stringValue(networkMetadata, 'asn')),
      netname: normalizeDisplayValue(stringValue(networkMetadata, 'netname')),
      city: normalizeDisplayValue(composedLocation),
      isp: normalizeDisplayValue(stringValue(networkMetadata, 'isp')),
      reverseDns: normalizeDisplayValue(stringValue(networkMetadata, 'reverse_dns') ?? latest.asset.domain),
      risk,
    };
  }).sort((a, b) => a.ip.localeCompare(b.ip));
};

const buildSoftwareRecords = (observedAssets: ObservedAsset[]): SoftwareRecord[] => {
  const latest = new Map<string, SoftwareRecord & { observedAt: string }>();

  observedAssets.forEach((item) => {
    const fallbackServiceName = (() => {
      if (!Array.isArray(item.rawAsset?.open_ports)) return null;
      const withService = item.rawAsset.open_ports.find((entry) => {
        if (typeof entry !== 'object' || entry === null) return false;
        const serviceName = (entry as Record<string, unknown>).service_name;
        return typeof serviceName === 'string' && serviceName.trim().length > 0;
      }) as Record<string, unknown> | undefined;
      const value = withService?.service_name;
      return typeof value === 'string' && value.trim() ? value.trim() : null;
    })();

    const software = item.asset.software ?? {
      product: item.rawAsset?.server_software
        || (fallbackServiceName === 'https'
          ? `HTTPS Service (${item.asset.port})`
          : fallbackServiceName === 'http'
            ? `HTTP Service (${item.asset.port})`
            : fallbackServiceName)
        || (item.asset.type === 'web'
          ? 'HTTPS Endpoint'
          : item.asset.type === 'api'
            ? 'API Service'
            : item.asset.type === 'vpn'
              ? 'VPN Gateway'
              : 'Network Service'),
      version: '',
      type: item.asset.type === 'web'
        ? 'Web Service'
        : item.asset.type === 'api'
          ? 'API Service'
          : item.asset.type === 'vpn'
            ? 'VPN Service'
            : 'Network Service',
      eolDate: null,
      cveCount: 0,
      pqcNativeSupport: false,
    };
    const eolDate = software.eolDate;
    const eolTime = eolDate ? new Date(eolDate).getTime() : Number.NaN;
    const now = Date.now();
    const eolStatus: SoftwareRecord['eolStatus'] = !eolDate
      ? 'supported'
      : Number.isNaN(eolTime)
        ? 'supported'
        : eolTime < now
          ? 'end_of_life'
          : eolTime - now <= 180 * 24 * 60 * 60 * 1000
            ? 'eol_soon'
            : 'supported';

    const record = {
      detectionDate: formatDateCell(item.observedAt),
      product: software.product,
      version: software.version || 'Unavailable',
      type: software.type,
      port: item.asset.port,
      hostIp: item.asset.ip || 'Unavailable',
      hostname: item.asset.domain,
      eolStatus,
      eolDate: software.eolDate,
      cveCount: software.cveCount,
      pqcSupport: software.pqcNativeSupport ? 'native' : 'none',
      observedAt: item.observedAt,
    } satisfies SoftwareRecord & { observedAt: string };

    const key = `${record.hostname}|${record.product}|${record.version}|${record.port}`;
    const existing = latest.get(key);
    if (!existing || getObservedTime(record.observedAt) > getObservedTime(existing.observedAt)) {
      latest.set(key, record);
    }
  });

  return [...latest.values()]
    .sort((a, b) => a.hostname.localeCompare(b.hostname) || a.product.localeCompare(b.product))
    .map(({ observedAt, ...record }) => record);
};

const buildShadowAlerts = (observedAssets: ObservedAsset[]): ShadowITAlert[] =>
  latestObservedAssets(observedAssets)
    .filter((item) => item.rawAsset?.is_shadow_it || item.asset.status === 'unknown')
    .map((item) => ({
      discoveryDate: formatDateCell(item.observedAt),
      asset: item.asset.domain || item.asset.ip,
      assetType: item.asset.type.toUpperCase(),
      howDiscovered: item.rawAsset?.discovery_source
        ? `Detected via ${item.rawAsset.discovery_source}`
        : 'Inferred from scan results',
      riskLevel: assetRiskLevel(item.asset),
      registeredOwner: item.asset.ownerTeam === 'Unassigned' ? 'Unknown' : item.asset.ownerTeam,
      recommendedAction: 'Investigate ownership and either add to inventory or decommission.',
    }));

const includesSearch = (values: Array<string | number | null | undefined>, search: string): boolean => {
  if (!search) return true;
  const needle = search.toLowerCase();
  return values.some((value) => String(value ?? '').toLowerCase().includes(needle));
};

const AssetDiscovery = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'domains';
  const [search, setSearch] = useState('');
  const { rootDomain } = useScanContext();
  const {
    selectedAssets,
    selectedScanId,
    selectedScan,
    selectedScanResults,
    selectedAssetResults,
    selectedDnsRecords,
    isLoading: selectedScanLoading,
  } = useSelectedScan();
  const d = rootDomain || 'target.com';
  const [scopeMode, setScopeMode] = useState<ScopeMode>('this-scan');
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelType, setPanelType] = useState<'domain' | 'ssl' | 'ip' | 'software'>('domain');
  const [selectedDomain, setSelectedDomain] = useState<DomainRecord | undefined>();
  const [selectedAssetForPanel, setSelectedAssetForPanel] = useState<Asset | undefined>();
  const [selectedIP, setSelectedIP] = useState<IPRecord | undefined>();
  const [selectedSoftware, setSelectedSoftware] = useState<SoftwareRecord | undefined>();

  const { data: discoveryData, isLoading: allTimeLoading } = useQuery<DiscoveryQueryResult>({
    queryKey: ['asset-discovery-all-time', scopeMode],
    enabled: scopeMode === 'all-time',
    queryFn: async () => {
      const historyResponse = await api.getScanHistory({ limit: 400 });
      const adaptedHistory = adaptScanHistory(historyResponse);
      const completedItems = historyResponse.items.filter(
        (item) => item.status.toLowerCase() === 'completed',
      );

      const cappedCompletedItems = completedItems.slice(0, MAX_ALL_TIME_SCANS);

      const settledResults = await Promise.allSettled(cappedCompletedItems.map(async (item) => {
        const result = await api.getScanResults(item.scan_id);
        const observedAt = result.completed_at ?? result.created_at;
        return {
          scanId: item.scan_id,
          target: item.target,
          observedAt,
          assets: adaptScanResults(result),
          rawAssets: result.assets,
          dnsRecords: result.dns_records,
        };
      }));

      const successfulResults = settledResults.flatMap((result) => (
        result.status === 'fulfilled' ? [result.value] : []
      ));

      return {
        history: adaptedHistory,
        completedHistory: adaptScanHistory({ items: completedItems }),
        totalCompletedScanCount: completedItems.length,
        loadedCompletedScanCount: successfulResults.length,
        observedAssets: successfulResults.flatMap((result) => toObservedAssets(
          result.assets,
          result.scanId,
          result.target,
          result.rawAssets,
          result.observedAt,
        )),
        observedDnsRecords: successfulResults.flatMap((result) => toObservedDnsRecords(
          result.dnsRecords,
          result.scanId,
          result.target,
          result.observedAt,
        )),
      };
    },
    staleTime: 30000,
  });

  const selectedHistoryEntry = useMemo(
    () => discoveryData?.history.find((entry) => entry.id === selectedScanId) ?? selectedScan,
    [discoveryData, selectedScan, selectedScanId],
  );

  const selectedObservedAt = selectedScanResults?.completed_at ?? selectedScanResults?.created_at ?? null;
  const currentObservedAssets = useMemo(
    () => toObservedAssets(
      selectedAssets,
      selectedScanId,
      selectedHistoryEntry?.target ?? d,
      selectedAssetResults,
      selectedObservedAt,
    ),
    [selectedAssets, selectedScanId, selectedHistoryEntry, d, selectedAssetResults, selectedObservedAt],
  );
  const currentObservedDnsRecords = useMemo(
    () => selectedObservedAt
      ? toObservedDnsRecords(selectedDnsRecords, selectedScanId, selectedHistoryEntry?.target ?? d, selectedObservedAt)
      : [],
    [selectedDnsRecords, selectedScanId, selectedHistoryEntry, d, selectedObservedAt],
  );

  const allTimeObservedAssets = discoveryData?.observedAssets ?? [];
  const allTimeObservedDnsRecords = discoveryData?.observedDnsRecords ?? [];
  const totalCompletedScanCount = discoveryData?.totalCompletedScanCount ?? 0;
  const loadedCompletedScanCount = discoveryData?.loadedCompletedScanCount ?? 0;
  const liveAllTimeAvailable = loadedCompletedScanCount > 0
    || allTimeObservedAssets.length > 0
    || allTimeObservedDnsRecords.length > 0;
  const activeObservedAssets = scopeMode === 'this-scan'
    ? currentObservedAssets
    : liveAllTimeAvailable
      ? allTimeObservedAssets
      : [];
  const activeObservedDnsRecords = scopeMode === 'this-scan'
    ? currentObservedDnsRecords
    : liveAllTimeAvailable
      ? allTimeObservedDnsRecords
      : [];

  const scopedSslAssets = useMemo(
    () => (scopeMode === 'this-scan'
      ? selectedAssets
      : liveAllTimeAvailable
        ? latestAssets(allTimeObservedAssets)
        : demoAssets),
    [scopeMode, selectedAssets, liveAllTimeAvailable, allTimeObservedAssets],
  );

  const domainData = useMemo(
    () => (scopeMode === 'this-scan'
      ? buildDomainRecords(currentObservedAssets, currentObservedDnsRecords)
      : liveAllTimeAvailable
        ? buildDomainRecords(allTimeObservedAssets, allTimeObservedDnsRecords)
        : demoDomainRecords),
    [scopeMode, currentObservedAssets, currentObservedDnsRecords, liveAllTimeAvailable, allTimeObservedAssets, allTimeObservedDnsRecords],
  );

  const ipData = useMemo(
    () => (scopeMode === 'this-scan'
      ? buildIPRecords(currentObservedAssets)
      : liveAllTimeAvailable
        ? buildIPRecords(allTimeObservedAssets)
        : demoIpRecords),
    [scopeMode, currentObservedAssets, liveAllTimeAvailable, allTimeObservedAssets],
  );

  const softwareData = useMemo(
    () => (scopeMode === 'this-scan'
      ? buildSoftwareRecords(currentObservedAssets)
      : liveAllTimeAvailable
        ? buildSoftwareRecords(allTimeObservedAssets)
        : demoSoftwareRecords),
    [scopeMode, currentObservedAssets, liveAllTimeAvailable, allTimeObservedAssets],
  );

  const shadowData = useMemo(
    () => (scopeMode === 'this-scan'
      ? buildShadowAlerts(currentObservedAssets)
      : liveAllTimeAvailable
        ? buildShadowAlerts(allTimeObservedAssets)
        : demoShadowITAlerts),
    [scopeMode, currentObservedAssets, liveAllTimeAvailable, allTimeObservedAssets],
  );

  const filteredDomains = domainData.filter((record) => includesSearch(
    [record.domain, record.registrar, record.company, record.status, record.detectionDate],
    search,
  ));

  const filteredSslAssets = scopedSslAssets
    .filter((asset) => hasCertificateDetails(asset))
    .filter((asset) => includesSearch(
      [
        asset.domain,
        asset.certInfo.subject_cn,
        asset.certInfo.certificate_authority,
        asset.certInfo.signature_algorithm,
        asset.certInfo.key_type,
        asset.tls,
        asset.cipher,
      ],
      search,
    ));

  const filteredIPs = ipData.filter((record) => includesSearch(
    [record.ip, record.subnet, record.asn, record.city, record.reverseDns, record.risk],
    search,
  ));

  const filteredSoftware = softwareData.filter((record) => includesSearch(
    [record.product, record.version, record.type, record.hostname, record.eolStatus],
    search,
  ));

  const filteredShadow = shadowData.filter((record) => includesSearch(
    [record.asset, record.assetType, record.howDiscovered, record.riskLevel],
    search,
  ));

  const selectedDomainDnsEntries = useMemo(
    () => selectedDomain
      ? activeObservedDnsRecords
        .filter((item) => item.record.hostname === selectedDomain.domain)
        .map((item) => item.record)
      : [],
    [selectedDomain, activeObservedDnsRecords],
  );

  const selectedIpAssetResults = useMemo(
    () => selectedIP
      ? activeObservedAssets
        .filter((item) => item.asset.ip === selectedIP.ip)
        .map((item) => item.rawAsset)
        .filter((item): item is AssetResultResponse => item !== null)
      : [],
    [selectedIP, activeObservedAssets],
  );

  const selectedSoftwareAssetResults = useMemo(
    () => selectedSoftware
      ? activeObservedAssets
        .filter((item) =>
          item.asset.domain === selectedSoftware.hostname &&
          item.asset.port === selectedSoftware.port &&
          ((item.rawAsset?.server_software ?? item.asset.software?.product ?? '') === selectedSoftware.product),
        )
        .map((item) => item.rawAsset)
        .filter((item): item is AssetResultResponse => item !== null)
      : [],
    [selectedSoftware, activeObservedAssets],
  );

  const panelAssetResults = panelType === 'ip'
    ? selectedIpAssetResults
    : panelType === 'software'
      ? selectedSoftwareAssetResults
      : [];

  const countMap: Record<string, number> = {
    domains: filteredDomains.length,
    ssl: filteredSslAssets.length,
    ip: filteredIPs.length,
    software: filteredSoftware.length,
    network: 0,
    shadow: filteredShadow.length,
  };

  const highRiskDomains = domainData.filter((record) => record.riskScore >= 75).length;
  const newDomains = domainData.filter((record) => record.status === 'new').length;
  const lowerRiskDomains = domainData.filter((record) => record.riskScore < 25).length;
  const criticalIP = ipData.find((record) => record.risk === 'critical') ?? ipData[0];
  const nonStandardPortIPs = ipData.filter((record) => record.portsOpen.some((port) => ![80, 443].includes(port))).length;

  const setTab = (tab: string) => setSearchParams({ tab });

  return (
    <div className="space-y-5">
      <DataContextBadge />
      <h1 className="font-display text-2xl italic text-brand-primary">Asset Discovery</h1>

      {/* Scope toggle */}
      <div className="flex items-center gap-2">
        <div className="flex gap-0 p-0.5 rounded-lg bg-[hsl(var(--bg-sunken))] border border-border w-fit">
          <button
            onClick={() => setScopeMode('this-scan')}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-body transition-all",
              scopeMode === 'this-scan' ? "bg-white shadow-sm text-brand-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >📡 This Scan</button>
          <button
            onClick={() => setScopeMode('all-time')}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-body transition-all",
              scopeMode === 'all-time' ? "bg-white shadow-sm text-brand-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >🕐 All Time</button>
        </div>
      </div>

      {scopeMode === 'this-scan' && (
        <p className="text-[11px] font-body text-muted-foreground">
          Showing results from <span className="font-mono font-semibold text-foreground">{selectedScanId}</span>
          {selectedHistoryEntry ? <> · {selectedHistoryEntry.target}</> : null}
          {' '}· <button onClick={() => setScopeMode('all-time')} className="text-brand-primary hover:underline">Switch to All Time</button> for full history.
          {selectedScanLoading && <span className="ml-2">Loading selected scan data...</span>}
        </p>
      )}

      {scopeMode === 'all-time' && (
        <p className="text-[11px] font-body text-muted-foreground">
          {allTimeLoading
            ? 'Loading aggregated discovery history across all scans...'
            : liveAllTimeAvailable
              ? loadedCompletedScanCount < totalCompletedScanCount
                ? `Showing aggregated discovery across ${loadedCompletedScanCount} of ${totalCompletedScanCount} completed scans.`
                : `Showing aggregated discovery across ${loadedCompletedScanCount} completed scans.`
              : 'Live discovery history is unavailable, so this view is using the local demo fallback.'}
        </p>
      )}

      {/* Tab strip + search/filter on same row */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 rounded-xl bg-[hsl(var(--bg-sunken))] w-fit">
          {tabDefs.map(t => {
            const count = countMap[t.id];
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body transition-all",
                activeTab === t.id ? "bg-white shadow-sm text-brand-primary font-semibold" : "text-muted-foreground hover:text-foreground"
              )}>
                <t.icon className="w-3.5 h-3.5" />{t.label}{count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assets..." className="pl-8 h-8 w-56 text-xs" />
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1"><Filter className="w-3 h-3" />Filters</Button>
        </div>
      </div>

      {/* Tab content */}
      {/* Domains tab */}
      {activeTab === 'domains' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
          <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-body">
                  <thead><tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Detection</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Domain</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Registered</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Expiry</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Registrar</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Risk</th>
                  </tr></thead>
                  <tbody>
                    {filteredDomains.map((d, i) => (
                      <tr
                        key={d.domain}
                        onClick={() => { setSelectedDomain(d); setPanelType('domain'); setPanelOpen(true); }}
                        className={cn("border-b border-border/50 cursor-pointer hover:bg-[hsl(var(--bg-sunken))] transition-colors", i % 2 === 0 && "bg-[hsl(var(--bg-sunken)/0.3)]")}
                      >
                        <td className="px-3 py-2 font-mono text-muted-foreground">{d.detectionDate}</td>
                        <td className="px-3 py-2 font-mono font-medium text-foreground">{d.domain}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{d.registrationDate}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{d.expiryDate}</td>
                        <td className="px-3 py-2 text-muted-foreground">{d.registrar}</td>
                        <td className="px-3 py-2">
                          <Badge variant={d.status === 'new' ? 'default' : 'secondary'} className="text-[10px]">{d.status}</Badge>
                        </td>
                        <td className="px-3 py-2">{riskBadge(d.riskScore)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)] h-fit">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-body">Smart Insights</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-xs font-body">
              <div className="p-2.5 rounded-lg bg-[hsl(var(--status-warn)/0.08)] border border-[hsl(var(--status-warn)/0.2)]">
                <p className="font-medium text-[hsl(var(--status-warn))]">{newDomains} newly observed domains</p>
                <p className="text-muted-foreground mt-0.5">Domains seen only once in the current scope may need validation.</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[hsl(var(--status-critical)/0.08)] border border-[hsl(var(--status-critical)/0.2)]">
                <p className="font-medium text-[hsl(var(--status-critical))]">{highRiskDomains} high-risk domains</p>
                <p className="text-muted-foreground mt-0.5">These domains map to the weakest observed cryptographic posture.</p>
              </div>
              <div className="p-2.5 rounded-lg bg-[hsl(var(--status-safe)/0.08)] border border-[hsl(var(--status-safe)/0.2)]">
                <p className="font-medium text-[hsl(var(--status-safe))]">{lowerRiskDomains} lower-risk domains</p>
                <p className="text-muted-foreground mt-0.5">Domains in this bucket currently have the strongest observed posture.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'ssl' && (
        <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-body">
                <thead><tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">CN</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">SANs</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">CA</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Algo</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Key</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Valid Until</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Days Left</th>
                </tr></thead>
                <tbody>
                  {filteredSslAssets.map((a, i) => (
                    <tr
                      key={a.id}
                      onClick={() => { setSelectedAssetForPanel(a); setPanelType('ssl'); setPanelOpen(true); }}
                      className={cn("border-b border-border/50 cursor-pointer hover:bg-[hsl(var(--bg-sunken))] transition-colors", i % 2 === 0 && "bg-[hsl(var(--bg-sunken)/0.3)]")}
                    >
                      <td className="px-3 py-2 font-mono font-medium">{a.certInfo.subject_cn}</td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{a.certInfo.subject_alt_names.join(', ') || 'Unavailable'}</td>
                      <td className="px-3 py-2 text-muted-foreground">{normalizeDisplayValue(a.certInfo.certificate_authority)}</td>
                      <td className="px-3 py-2 font-mono">{normalizeDisplayValue(a.certInfo.signature_algorithm).substring(0, 16)}</td>
                      <td className="px-3 py-2 font-mono">{a.certInfo.key_type}-{a.certInfo.key_size || 'PQC'}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{normalizeDisplayValue(a.certInfo.valid_until)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-[hsl(var(--bg-sunken))]">
                            <div className="h-full rounded-full" style={{
                              width: `${Math.min(100, Math.max(a.certInfo.days_remaining, 0) / 365 * 100)}%`,
                              backgroundColor: a.certInfo.days_remaining <= 30 ? 'hsl(var(--status-critical))' : a.certInfo.days_remaining <= 90 ? 'hsl(var(--accent-amber))' : 'hsl(var(--status-safe))'
                            }} />
                          </div>
                          <span className={cn("font-mono", a.certInfo.days_remaining <= 30 ? "text-[hsl(var(--status-critical))]" : "text-muted-foreground")}>
                            {a.certInfo.days_remaining < 0 ? 'Expired' : `${a.certInfo.days_remaining}d`}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* IP/Subnets tab */}
      {activeTab === 'ip' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <Card className="flex-1 p-3 shadow-sm"><p className="text-[10px] text-muted-foreground font-body">CRITICAL FINDING</p><p className="text-xs font-body font-medium text-[hsl(var(--status-critical))] mt-1">{criticalIP ? `${criticalIP.ip} - highest observed risk in this scope${criticalIP.reverseDns ? ` (${criticalIP.reverseDns})` : ''}` : `No internet-facing IP findings for ${d}.`}</p></Card>
            <Card className="flex-1 p-3 shadow-sm"><p className="text-[10px] text-muted-foreground font-body">ALERT</p><p className="text-xs font-body font-medium text-[hsl(var(--status-warn))] mt-1">{nonStandardPortIPs > 0 ? `${nonStandardPortIPs} IPs expose non-standard public ports in this scope.` : 'No non-standard public ports observed in this scope.'}</p></Card>
          </div>
          <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-body">
                  <thead><tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">IP</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Ports</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Subnet</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">ASN</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Location</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">rDNS</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Risk</th>
                  </tr></thead>
                  <tbody>
                    {filteredIPs.map((r, i) => (
                      <tr
                        key={r.ip}
                        onClick={() => { setSelectedIP(r); setPanelType('ip'); setPanelOpen(true); }}
                        className={cn("border-b border-border/50 cursor-pointer hover:bg-[hsl(var(--bg-sunken))]", i % 2 === 0 && "bg-[hsl(var(--bg-sunken)/0.3)]")}
                      >
                        <td className="px-3 py-2 font-mono font-medium">{r.ip}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{r.portsOpen.join(', ')}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{r.subnet}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.asn}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.city}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{r.reverseDns}</td>
                        <td className="px-3 py-2"><Badge variant={r.risk === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">{r.risk}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Software tab */}
      {activeTab === 'software' && (
        <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-body">
                <thead><tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Product</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Version</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Host</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">EOL Status</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">CVEs</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">PQC</th>
                </tr></thead>
                <tbody>
                  {filteredSoftware.map((s, i) => (
                    <tr
                      key={`${s.product}-${s.hostIp}`}
                      onClick={() => { setSelectedSoftware(s); setPanelType('software'); setPanelOpen(true); }}
                      className={cn("border-b border-border/50 cursor-pointer hover:bg-[hsl(var(--bg-sunken))]", i % 2 === 0 && "bg-[hsl(var(--bg-sunken)/0.3)]")}
                    >
                      <td className="px-3 py-2 font-medium">{s.product}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{s.version}</td>
                      <td className="px-3 py-2 text-muted-foreground">{s.type}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{s.hostname}</td>
                      <td className="px-3 py-2">
                        <Badge className={cn("text-[10px]", s.eolStatus === 'end_of_life' ? 'bg-[hsl(var(--status-critical))] text-white' : s.eolStatus === 'eol_soon' ? 'bg-[hsl(var(--accent-amber))] text-white' : 'bg-[hsl(var(--status-safe))] text-white')}>
                          {s.eolStatus === 'end_of_life' ? 'EOL' : s.eolStatus === 'eol_soon' ? 'EOL Soon' : 'Supported'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{s.cveCount > 0 ? <Badge variant="destructive" className="text-[10px]">{s.cveCount} CVEs</Badge> : <span className="text-muted-foreground">0</span>}</td>
                      <td className="px-3 py-2">
                        {s.pqcSupport === 'native' ? <span className="text-[hsl(var(--status-safe))]">Native</span> : s.pqcSupport === 'plugin' ? <span className="text-[hsl(var(--accent-amber))]">Plugin</span> : <span className="text-[hsl(var(--status-critical))]">None</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'network' && <NetworkGraph />}

      {activeTab === 'shadow' && (
        <div className="space-y-4">
          <Card className="p-3 shadow-sm border-[hsl(var(--status-warn)/0.3)] bg-[hsl(var(--status-warn)/0.05)]">
            <p className="text-xs font-body font-medium text-[hsl(var(--status-warn))]">⚠ {shadowData.length} Shadow IT assets detected — not in official inventory</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Count is computed from live scan assets in the selected scope ({scopeMode === 'this-scan' ? 'This Scan' : 'All Time'}).
            </p>
          </Card>
          <Card className="shadow-[0_8px_30px_-12px_hsl(var(--brand-primary)/0.15)]">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-body">
                  <thead><tr className="border-b border-border bg-[hsl(var(--bg-sunken))]">
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Discovered</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Asset</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Type</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Detection</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Risk</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Actions</th>
                  </tr></thead>
                  <tbody>
                    {filteredShadow.map((s, i) => (
                      <tr key={s.asset} className={cn("border-b border-border/50 hover:bg-[hsl(var(--bg-sunken))]", i % 2 === 0 && "bg-[hsl(var(--bg-sunken)/0.3)]")}>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{s.discoveryDate}</td>
                        <td className="px-3 py-2 font-mono font-medium">{s.asset}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.assetType}</td>
                        <td className="px-3 py-2 text-muted-foreground">{s.howDiscovered}</td>
                        <td className="px-3 py-2"><Badge variant={s.riskLevel === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">{s.riskLevel}</Badge></td>
                        <td className="px-3 py-2 flex gap-1">
                          <Button variant="outline" size="sm" className="h-6 text-[10px] px-2">Add to Inventory</Button>
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2">Scan</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <DiscoveryDetailPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        type={panelType}
        domainRecord={selectedDomain}
        asset={selectedAssetForPanel}
        ipRecord={selectedIP}
        softwareRecord={selectedSoftware}
        dnsEntries={selectedDomainDnsEntries}
        relatedAssetResults={panelAssetResults}
      />
    </div>
  );
};

export default AssetDiscovery;

