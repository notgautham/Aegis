import { HistoryWorkspace } from "@/components/history-workspace";

export default function HistoryPage({
  searchParams,
}: {
  searchParams?: { scan?: string | string[] };
}) {
  const scanParam =
    typeof searchParams?.scan === "string" ? searchParams.scan : null;

  return <HistoryWorkspace initialScanParam={scanParam} />;
}
