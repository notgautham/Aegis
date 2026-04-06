import React, { useState, useRef, useEffect } from "react";
import { ArrowUp, Paperclip, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ScanPromptBoxProps {
  onScan?: (domain: string) => void;
  onDemoScan?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

const ScanPromptBox = React.forwardRef<HTMLDivElement, ScanPromptBoxProps>(
  (
    {
      onScan,
      onDemoScan,
      isLoading = false,
      placeholder = "Enter domain to scan (e.g. pnb.co.in)",
      className,
      compact = false,
    },
    ref
  ) => {
    const [input, setInput] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, compact ? 44 : 120)}px`;
      }
    }, [input, compact]);

    const handleSubmit = () => {
      if (input.trim()) {
        onScan?.(input.trim());
        setInput("");
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    };

    const hasContent = input.trim() !== "";

    if (compact) {
      return (
        <div
          ref={ref}
          className={cn(
            "flex items-center gap-2 rounded-full border border-[hsl(var(--border-default))] bg-white/80 backdrop-blur-xl px-3 py-1.5",
            className
          )}
        >
          <Shield className="w-3.5 h-3.5 text-accent-amber flex-shrink-0" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="Scan domain..."
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground font-mono focus:outline-none min-w-[120px]"
          />
          <button
            onClick={handleSubmit}
            disabled={!hasContent}
            className={cn(
              "h-6 w-6 rounded-full flex items-center justify-center transition-all",
              hasContent
                ? "bg-brand-primary text-accent-amber"
                : "bg-sunken text-muted-foreground"
            )}
          >
            <ArrowUp className="w-3 h-3" />
          </button>
        </div>
      );
    }

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={cn(
          "w-full max-w-2xl rounded-3xl border border-[hsl(var(--border-default))] bg-surface p-3 shadow-[0_8px_40px_rgba(0,0,0,0.08)] transition-all duration-300",
          isLoading && "border-accent-amber/50",
          className
        )}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isLoading}
          rows={1}
          className="w-full bg-transparent px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground font-mono focus:outline-none resize-none min-h-[44px]"
        />

        <div className="flex items-center justify-between pt-2 px-1">
          <div className="flex items-center gap-1">
            <button className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-sunken hover:text-foreground transition-colors">
              <Paperclip className="h-4 w-4" />
            </button>

            <button
              onClick={onDemoScan}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-body font-medium text-accent-amber border border-accent-amber/30 bg-accent-amber-light/50 hover:bg-accent-amber-light transition-colors"
            >
              <span>▶</span> Run Demo Scan
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!hasContent || isLoading}
            className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center transition-all duration-200",
              hasContent
                ? "bg-brand-primary text-accent-amber hover:brightness-110"
                : "bg-sunken text-muted-foreground"
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    );
  }
);

ScanPromptBox.displayName = "ScanPromptBox";

export { ScanPromptBox };
export default ScanPromptBox;
