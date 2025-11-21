import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/paytest/",   // фронт лежит по SITE/paytest/
  plugins: [react()],
  server: {
    port: 5170,
    host: true,
    proxy: {
      // для локальной разработки
      "/catalog": {
        target: "http://localhost", // твой PHP-backend
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});