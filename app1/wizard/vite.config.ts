import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: '/wizard/', // Путь SPA в продакшене!
  plugins: [react()],
  server: {
    port: 5180
  },
  resolve: {
    alias: {
      // Импорт wheel/Indicator как: import ... from "@wheel/components/Indicator"
      "@wheel": path.resolve(__dirname, "../wheel/src"),
      "@app1/api-client": path.resolve(__dirname, "../api-client/src")
      // Добавляй другие алиасы если нужно
    }
  }
});