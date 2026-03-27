import { AssetWorkbench } from "@/components/asset-workbench";

export default function AssetWorkbenchPage({
  params,
  searchParams,
}: {
  params: { assetId: string };
  searchParams?: { scan?: string | string[] };
}) {
  const scanParam =
    typeof searchParams?.scan === "string" ? searchParams.scan : null;

  return (
    <AssetWorkbench
      assetId={params.assetId}
      initialScanParam={scanParam}
    />
  );
}
