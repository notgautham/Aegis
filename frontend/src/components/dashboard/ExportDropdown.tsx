import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, FileText, FileCode, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

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
                  onClick={() => setIsOpen(false)}
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
