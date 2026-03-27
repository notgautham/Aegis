import { ReportsWorkspace } from "@/components/reports-workspace";

export default function ReportsPage({
  searchParams,
}: {
  searchParams?: { scan?: string | string[] };
}) {
  const scanParam =
    typeof searchParams?.scan === "string" ? searchParams.scan : null;

  return <ReportsWorkspace initialScanParam={scanParam} />;
}
