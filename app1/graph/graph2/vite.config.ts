import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  base: "/graph2/",
  plugins: [react()],
  resolve: {
    alias: {
      "@app1/api-client": resolve(__dirname, "../api-client/src")
    }
  },
  build: {
    outDir: "/var/www/app1/graph2/dist",
    emptyOutDir: true
  },
  server: { host: true, port: 5182 }
});