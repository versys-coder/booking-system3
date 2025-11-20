import '../../wheel/src/styles.css';
import './styles.css';

import React from "react";
import { createRoot } from "react-dom/client";
import WizardApp from "./WizardApp";

/**
 * Установка window.__PW_API_BASE__ ранним скриптом.
 * - При сборке можно задать VITE_API_BASE (import.meta.env.VITE_API_BASE).
 * - По умолчанию используем безопасный префикс: /catalog/api-backend/api.
 * - Если сервер уже вписал window.__PW_API_BASE__ (например некорректно /wizard/api),
 *   мы перепишем его только если он явно указывает на SPA путь.
 */
declare global {
  interface Window {
    __PW_API_BASE__?: string;
  }
}

(function initApiBase() {
  const envBase = (import.meta.env && (import.meta.env.VITE_API_BASE as string)) || "";
  const defaultBase = "/catalog/api-backend/api";
  const candidate = envBase && envBase.trim() ? envBase.trim() : defaultBase;

  try {
    const existing = window.__PW_API_BASE__;
    if (existing && typeof existing === "string" && existing.trim()) {
      if (existing.indexOf("/wizard") === 0 || existing.indexOf("/embed") === 0) {
        window.__PW_API_BASE__ = candidate.replace(/\/+$/, "");
        // eslint-disable-next-line no-console
        console.info("[pw] overridden __PW_API_BASE__", window.__PW_API_BASE__);
      } else {
        // eslint-disable-next-line no-console
        console.info("[pw] using existing __PW_API_BASE__", existing);
      }
    } else {
      window.__PW_API_BASE__ = candidate.replace(/\/+$/, "");
      // eslint-disable-next-line no-console
      console.info("[pw] set __PW_API_BASE__", window.__PW_API_BASE__);
    }
  } catch (e) {
    (window as any).__PW_API_BASE__ = candidate.replace(/\/+$/, "");
  }
})();

// Bootstrap приложения
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <WizardApp />
    </React.StrictMode>
  );
}