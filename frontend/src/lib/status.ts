import type { Asset } from '@/data/demoData';

export function isTransitionAsset(asset: Asset): boolean {
  return (
    asset.complianceTier === 'PQC_TRANSITIONING' ||
    asset.status === 'transitioning' ||
    asset.status === 'safe'
  );
}

export function isPqcReadyAsset(asset: Asset): boolean {
  return asset.status === 'elite-pqc' || isTransitionAsset(asset);
}
