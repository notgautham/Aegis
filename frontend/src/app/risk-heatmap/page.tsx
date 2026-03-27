import { RiskHeatmapWorkspace } from "@/components/risk-heatmap-workspace";

export default function RiskHeatmapPage({
  searchParams,
}: {
  searchParams?: { scan?: string | string[] };
}) {
  const scanParam =
    typeof searchParams?.scan === "string" ? searchParams.scan : null;

  return <RiskHeatmapWorkspace initialScanParam={scanParam} />;
}
