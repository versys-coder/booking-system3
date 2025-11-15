import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: "/histogram/",        // Критично для корректных путей к ассетам
  plugins: [react()],
  resolve: {
    alias: {
      "@app1/api-client": path.resolve(__dirname, "../api-client/src")
    }
  },
  build: {
    outDir: "/var/www/app1/histogram/dist", // Сразу собираем туда, откуда будет отдавать Apache
    emptyOutDir: true
  },
  server: { host: true, port: 5180 }
});