import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api/swap/paraswap": {
        target: "https://api.paraswap.io",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/swap\/paraswap/, ""),
      },
    },
  },
  optimizeDeps: {
    exclude: ["@consenlabs/tcx-wasm"],
  },
});
