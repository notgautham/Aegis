import { Link } from 'react-router-dom';
import { scanHistory } from '@/data/demoData';

const SinceLastScanStrip = () => {
  const current = scanHistory[0];
  const prev = scanHistory[1];
  if (!prev) return null;

  const assetDelta = current.assetsFound - prev.assetsFound;
  const scoreDelta = current.qScore - prev.qScore;
  const critDelta = current.criticalFindings - prev.criticalFindings;

  const items = [
    assetDelta !== 0 ? { text: `${assetDelta > 0 ? '+' : ''}${assetDelta} new assets discovered`, link: '/dashboard/discovery' } : null,
    critDelta > 0 ? { text: `${critDelta} new critical finding${critDelta > 1 ? 's' : ''}`, link: '/dashboard/remediation/action-plan' } : null,
    scoreDelta !== 0 ? { text: `Q-Score ${scoreDelta > 0 ? 'improved' : 'decreased'} ${scoreDelta > 0 ? '+' : ''}${scoreDelta}`, link: '/dashboard/rating/enterprise' } : null,
    { text: '1 certificate now expiring in <7 days', link: '/dashboard/inventory' },
  ].filter(Boolean);

  const noChanges = assetDelta === 0 && scoreDelta === 0 && critDelta === 0;

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
