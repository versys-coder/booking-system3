import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  base: "/variant1/",
  plugins: [react()],
  build: {
    outDir: "/var/www/app1/variant1/dist",
    emptyOutDir: true
  },
  server: { host: true, port: 5184 }
});