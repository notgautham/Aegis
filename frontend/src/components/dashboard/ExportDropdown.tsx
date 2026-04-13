import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, FileText, FileCode, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSelectedScan } from "@/contexts/SelectedScanContext";
import { buildPdfReport, safeFileSlug, toIsoStamp, triggerDownload } from "@/lib/download";

const exports = [
  {
    label: "Export PDF",
    description: "Executive summary report",
    icon: FileText,
  },
  {
    label: "Export CBOM",
    description: "CycloneDX 1.7 JSON",
    icon: FileCode,
  },
  {
    label: "Export CDXA",
    description: "Compliance attestation",
    icon: ShieldCheck,
  },
];

const ExportDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { selectedScanResults, selectedAssetResults } = useSelectedScan();

  const exportFile = async (label: string) => {
    const target = safeFileSlug(selectedScanResults?.target ?? "aegis");
    const stamp = toIsoStamp();

    if (label === "Export CBOM") {
      const cboms = selectedAssetResults
        .filter((asset) => asset.cbom)
        .map((asset) => ({
          hostname: asset.hostname,
          port: asset.port,
          cbom: asset.cbom,
        }));
      const payload = { scan_id: selectedScanResults?.scan_id ?? null, target, generated_at: new Date().toISOString(), cboms };
      triggerDownload(JSON.stringify(payload, null, 2), `${target}_cbom_${stamp}.json`, "application/json;charset=utf-8");
      return;
    }

    if (label === "Export CDXA") {
      const certificates = selectedAssetResults
        .filter((asset) => asset.compliance_certificate)
        .map((asset) => ({
          hostname: asset.hostname,
          port: asset.port,
          certificate: asset.compliance_certificate,
        }));
      const payload = {
        scan_id: selectedScanResults?.scan_id ?? null,
        target,
        generated_at: new Date().toISOString(),
        certificates,
      };
      triggerDownload(JSON.stringify(payload, null, 2), `${target}_cdxa_${stamp}.json`, "application/json;charset=utf-8");
      return;
    }

    const pdfBytes = await buildPdfReport({
      title: "AEGIS Executive Summary",
      subtitle: "Top-right export action",
      sections: [
        {
          heading: "Scan Summary",
          lines: [
            `Target: ${selectedScanResults?.target ?? "Not selected"}`,
            `Scan ID: ${selectedScanResults?.scan_id ?? "Not selected"}`,
            `Status: ${selectedScanResults?.status ?? "n/a"}`,
            `Assets: ${selectedScanResults?.summary?.total_assets ?? 0}`,
            `Vulnerable: ${selectedScanResults?.summary?.vulnerable_assets ?? 0}`,
            `Transitioning: ${selectedScanResults?.summary?.transitioning_assets ?? 0}`,
            `Compliant: ${selectedScanResults?.summary?.fully_quantum_safe_assets ?? 0}`,
            `Generated: ${new Date().toISOString()}`,
          ],
        },
        {
          heading: "Per-Asset Rows",
          lines: selectedAssetResults.length > 0
            ? selectedAssetResults.map((asset) => `${asset.hostname ?? "unknown"}:${asset.port} | TLS=${asset.assessment?.tls_version ?? "n/a"} | KEX=${asset.assessment?.kex_algorithm ?? "n/a"} | Tier=${asset.assessment?.compliance_tier ?? "n/a"} | Risk=${asset.assessment?.risk_score ?? "n/a"}`)
            : ["No selected asset rows available."],
        },
      ],
    });

    triggerDownload(pdfBytes, `${target}_executive_${stamp}.pdf`, "application/pdf");
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-body font-medium transition-all",
          "bg-white border border-[hsl(var(--border-default))] text-foreground hover:border-[hsl(var(--border-strong))] shadow-sm"
        )}
      >
        <Download className="w-4 h-4 text-muted-foreground" />
        Export
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-50 w-64 bg-white rounded-xl shadow-xl border border-[hsl(var(--border-default))] overflow-hidden"
            >
              {exports.map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    exportFile(item.label);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-sunken transition-colors text-left"
                >
                  <item.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <div className="text-sm font-body font-medium text-foreground">{item.label}</div>
                    <div className="text-xs font-body text-muted-foreground">{item.description}</div>
                  </div>
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExportDropdown;
