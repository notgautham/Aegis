import { AssetCatalogWorkspace } from "@/components/asset-catalog-workspace";

export default function AssetCatalogPage({
  searchParams,
}: {
  searchParams?: { scan?: string | string[] };
}) {
  const scanParam =
    typeof searchParams?.scan === "string" ? searchParams.scan : null;

  return <AssetCatalogWorkspace initialScanParam={scanParam} />;
}
