import { cn } from "@/lib/utils";
import { ScanPromptBox } from "@/components/ui/ai-prompt-box";
import { useNavigate, useLocation } from "react-router-dom";
import { usePinnedPages } from "@/contexts/PinnedPagesContext";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import {
  Home, Search, Package, ClipboardList, ShieldCheck, Star, Wrench,
  BarChart3, Settings, Globe, Key, FileText, Server, Cpu, Lock,
  Sparkles, Map, Calendar, PenTool, Terminal, Shield, Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  Home, Search, Package, ClipboardList, ShieldCheck, Star, Wrench,
  BarChart3, Settings, Globe, Key, FileText, Server, Cpu, Lock,
  Sparkles, Map, Calendar, PenTool, Terminal, Shield, Clock,
};

interface GlassTabBarProps {
  hasScanned: boolean;
  onScan?: (domain: string) => void;
  isLoading?: boolean;
  showScannerPrompt?: boolean;
}

const GlassTabBar = ({ hasScanned, onScan, isLoading = false, showScannerPrompt = true }: GlassTabBarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { pinnedPages, removePin } = usePinnedPages();

  if (!hasScanned) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
      <div
        className="relative flex items-center gap-1 px-2.5 py-2.5 rounded-[1.25rem]"
        style={{
          /* Frosted glass base */
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.08) 100%)",
          WebkitBackdropFilter: "blur(40px) saturate(1.8)",
          backdropFilter: "blur(3px) saturate(1.8)",
          /* Multi-layer glass border for refraction effect */
          boxShadow: `
            inset 0 0.5px 0 0 rgba(255,255,255,0.25),
            inset 0 -0.5px 0 0 rgba(255,255,255,0.05),
            inset 0.5px 0 0 0 rgba(255,255,255,0.12),
            inset -0.5px 0 0 0 rgba(255,255,255,0.12),
            0 8px 32px -8px rgba(0,0,0,0.25),
            0 2px 8px -2px rgba(0,0,0,0.15),
            0 0 0 0.5px rgba(255,255,255,0.1)
          `,
        }}
      >
        {/* Top highlight for light refraction */}
        <div
          className="absolute inset-x-3 top-0 h-px rounded-full pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.4) 30%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0.4) 70%, transparent)",
          }}
        />
        {/* Specular highlight blob */}
        <div
          className="absolute top-1 left-1/4 w-1/2 h-3 rounded-full pointer-events-none opacity-30"
          style={{
            background: "radial-gradient(ellipse, rgba(255,255,255,0.6) 0%, transparent 70%)",
          }}
        />

        <AnimatePresence mode="popLayout">
          {pinnedPages.map((page) => {
            const isActive = location.pathname === page.route || location.pathname.startsWith(page.route + "/");
            const IconComponent = iconMap[page.icon] || Home;

            return (
              <motion.div
                key={page.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="relative group/pin"
              >
                <button
                  onClick={() => navigate(page.route)}
                  className={cn(
                    "relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-body whitespace-nowrap transition-all duration-300",
                    isActive
                      ? "text-accent-amber font-semibold"
                      : "text-foreground/70 hover:text-foreground font-medium",
                  )}
                  style={
                    isActive
                      ? {
                          background: "linear-gradient(135deg, rgba(232,160,32,0.15) 0%, rgba(232,160,32,0.08) 100%)",
                          boxShadow: "0 0 16px rgba(232,160,32,0.15), inset 0 0.5px 0 rgba(255,255,255,0.15)",
                        }
                      : {
                          background: "transparent",
                        }
                  }
                >
                  <IconComponent className="w-3.5 h-3.5" />
                  {page.label}
                </button>
                {/* Remove pin button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removePin(page.id);
                  }}
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-foreground/10 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover/pin:opacity-100 transition-opacity hover:bg-foreground/20"
                >
                  <X className="w-2 h-2 text-foreground/120" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {pinnedPages.length > 0 && (
          <div className="mx-1 w-px h-5 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
        )}

        {showScannerPrompt && <ScanPromptBox compact onScan={onScan} isLoading={isLoading} />}
      </div>
    </div>
  );
};

export default GlassTabBar;
