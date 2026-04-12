import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react") || id.includes("scheduler")) return "vendor-react";
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("recharts") || id.includes("d3")) return "vendor-charts";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("lucide-react") || id.includes("cmdk")) return "vendor-ui";
          if (id.includes("date-fns") || id.includes("zod") || id.includes("clsx") || id.includes("tailwind-merge")) return "vendor-utils";
          if (id.includes("@supabase") || id.includes("qdrant") || id.includes("openai")) return "vendor-integrations";
          return "vendor-misc";
        },
      },
    },
  },
}));
