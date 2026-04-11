import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSelectedScan } from '@/contexts/SelectedScanContext';
import { api } from '@/lib/api';
import { adaptScanHistory } from '@/lib/adapters';

const SinceLastScanStrip = () => {
  const { selectedAssets } = useSelectedScan();
  const { data: scanHistory } = useQuery({
    queryKey: ['dashboard-since-last-scan'],
    queryFn: async () => adaptScanHistory(await api.getScanHistory({ limit: 10 })),
  });
  const completedScans = (scanHistory ?? []).filter((scan) => scan.status.toLowerCase() === 'completed');
  const current = completedScans[0];
  const prev = completedScans[1];
  if (!current || !prev) return null;

  const assetDelta = current.assetsFound - prev.assetsFound;
  const scoreDelta = current.qScore - prev.qScore;
  const critDelta = current.criticalFindings - prev.criticalFindings;
  const expiringSoon = selectedAssets.filter((asset) => asset.certInfo.days_remaining <= 7).length;

  const items = [
    assetDelta > 0
      ? { text: `+${assetDelta} new assets discovered`, link: '/dashboard/discovery' }
      : assetDelta < 0
        ? { text: `${Math.abs(assetDelta)} fewer assets discovered in latest scan`, link: '/dashboard/discovery' }
        : null,
    critDelta > 0 ? { text: `${critDelta} new critical finding${critDelta > 1 ? 's' : ''}`, link: '/dashboard/remediation/action-plan' } : null,
    critDelta < 0 ? { text: `${Math.abs(critDelta)} critical finding${Math.abs(critDelta) > 1 ? 's' : ''} resolved`, link: '/dashboard/remediation/action-plan' } : null,
    scoreDelta !== 0 ? { text: `Q-Score ${scoreDelta > 0 ? 'improved' : 'decreased'} ${scoreDelta > 0 ? '+' : ''}${scoreDelta}`, link: '/dashboard/rating/enterprise' } : null,
    expiringSoon > 0 ? { text: `${expiringSoon} certificate${expiringSoon > 1 ? 's' : ''} now expiring in <7 days`, link: '/dashboard/inventory' } : null,
  ].filter(Boolean);

  const noChanges = assetDelta === 0 && scoreDelta === 0 && critDelta === 0 && expiringSoon === 0;

  return (
    <div className="px-4 py-2.5 rounded-lg bg-[hsl(var(--bg-sunken))] border border-[hsl(var(--border-default))] mb-5">
      <div className="flex items-center gap-2 flex-wrap text-xs font-body">
        <span className="text-sm">🔄</span>
        <span className="text-muted-foreground font-medium">Since {prev.id} ({prev.started.split(',')[0]}):</span>
        {noChanges ? (
          <span className="text-[hsl(var(--status-safe))]">No changes detected since last scan · System stable ✓</span>
        ) : (
          items.map((item, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground">·</span>}
              <Link to={item!.link} className="text-brand-primary hover:underline">{item!.text}</Link>
            </span>
          ))
        )}
      </div>
    </div>
  );
};

export default SinceLastScanStrip;
