import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const honoOrigin = "http://localhost:8787";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Browser stays on the Vite origin so pv_session is same-site.
      "/api": {
        target: honoOrigin,
        changeOrigin: true,
      },
      "/ws": {
        target: honoOrigin,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
