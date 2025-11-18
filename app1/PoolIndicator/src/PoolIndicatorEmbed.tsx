import React, { useEffect, useRef, useState } from "react";
import "./pool-indicator.css";

/**
 * PoolIndicatorEmbed — hardened version
 * - inserts strong local css similar to Wheel embed
 * - applies inline styles with !important where necessary
 * - listens for postMessage { type: 'dvvs:embedConfig' }
 * - reports height via postMessage { type: 'dvvs:wizard:height', height }
 */
type Props = {
  apiBase?: string;
  poolName?: string;
  wheelSrc?: string;
  updateMs?: number;
  width?: string;
  height?: string;
  cardHeight?: string;
  minHeight?: string;
  bg?: "transparent" | "auto";
  panel?: boolean;
  font?: string;
  color?: string;
  onOpenWheel?: (href: string) => void;
};

export default function PoolIndicatorEmbed(props: Props) {
  const {
    apiBase = "",
    poolName = "Тренировочный",
    wheelSrc = "https://price.dvvs-ekb.ru/embed/?mode=compact&bg=transparent&font=bebas&panel=1&color=fff",
    updateMs = 30000,
    width = "100%",
    height: propHeight,
    cardHeight: propCardHeight,
    minHeight: propMinHeight,
    bg: propBg,
    panel: propPanel,
    font: propFont,
    color: propColor,
    onOpenWheel,
  } = props;

  const outerRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const [available, setAvailable] = useState<number | null>(null);
  const [temp, setTemp] = useState<number | null>(null);

  // Inline CSS (scoped for this embed) — modeled after Wheel embed rules
  const embeddedCss = `
    /* force transparent backgrounds and reset paddings that may create frame */
    html, body, #root, .wiz-root, .pw-embed-root, .pw-embed-outer {
      margin: 0 !important;
      padding: 0 !important;
      background: transparent !important;
      background-color: transparent !important;
    }
    /* ensure card area uses theme variables and transparent panel */
    .pw-embed-root .pw-panel, .pw-embed-root .paper, .pw-embed-root .wiz-container {
      background: transparent !important;
      background-color: transparent !important;
      box-shadow: none !important;
      border: 0 !important;
      padding: 0 !important;
    }
    /* safeguard for pseudo backgrounds */
    .pw-embed-root::before, .pw-embed-root::after,
    .pw-embed-root *::before, .pw-embed-root *::after {
      content: none !important;
      display: none !important;
      background: transparent !important;
    }
    /* card defaults */
    .pw-embed-outer { box-sizing: border-box !important; }
    .pw-embed-card { background: var(--pw-bg, rgba(10,10,10,0.8)) !important; box-shadow: none !important; border: 0 !important; }
  `;

  // read params from url
  function readParamsFromUrl() {
    try {
      const sp = new URLSearchParams(window.location.search);
      return {
        height: sp.get("height") || undefined,
        cardHeight: sp.get("cardHeight") || undefined,
        minHeight: sp.get("minHeight") || undefined,
        bg: sp.get("bg") === "transparent" ? "transparent" : undefined,
        panel: sp.get("panel") === "0" ? false : sp.get("panel") === "1" ? true : undefined,
        font: sp.get("font") || undefined,
        color: sp.get("color") || undefined,
      };
    } catch (e) {
      return {};
    }
  }

  // fetch API values (same logic as before)
  useEffect(() => {
    let mounted = true;
    const apiBaseCandidates = apiBase ? [apiBase.replace(/\/+$/, "")] : ["", "/catalog/api-backend", "/catalog/api-backend/api"];
    async function tryFetch(path: string) {
      for (const base of apiBaseCandidates) {
        try {
          const url = base ? base.replace(/\/+$/, "") + path : path;
          const r = await fetch(url, { cache: "no-store" });
          if (!r.ok) throw new Error("http " + r.status);
          const j = await r.json().catch(() => null);
          return { ok: true, json: j };
        } catch {}
      }
      return { ok: false };
    }
    async function load() {
      if (!mounted) return;
      try {
        const cap = await tryFetch("/api/capacity/now");
        setAvailable(cap.ok && cap.json && typeof cap.json.available !== "undefined" ? Number(cap.json.available) : null);
        const t = await tryFetch("/api/pools-temps");
        setTemp(t.ok && t.json && t.json[poolName] != null ? Number(t.json[poolName]) : null);
      } catch {
        setAvailable(null);
        setTemp(null);
      }
    }
    load();
    const id = setInterval(load, updateMs);
    return () => { mounted = false; clearInterval(id); };
  }, [apiBase, poolName, updateMs]);

  // central apply function: sets inline styles with important and injects extra style node
  function applyConfig(cfg: { cardHeight?: string; height?: string; minHeight?: string; bg?: string; panel?: boolean; color?: string; }) {
    const outer = outerRef.current;
    const card = cardRef.current;
    function setImportant(el: HTMLElement | null, prop: string, value: string) {
      try { el?.style.setProperty(prop, value, "important"); } catch (e) {}
    }

    // apply on outer/card
    if (outer) {
      if (cfg.height) setImportant(outer, "height", cfg.height);
      if (cfg.minHeight) setImportant(outer, "min-height", cfg.minHeight);
      if (cfg.cardHeight) setImportant(outer, "--pw-card-height", cfg.cardHeight);
      if (cfg.color) {
        setImportant(outer, "--color-primary", cfg.color);
        setImportant(outer, "--color-primary-strong", cfg.color);
        setImportant(outer, "--theme-color", cfg.color);
      }
      if (cfg.bg === "transparent") {
        setImportant(outer, "background", "transparent");
        setImportant(outer, "background-color", "transparent");
      }
    }
    if (card) {
      if (cfg.cardHeight) setImportant(card, "--pw-card-height", cfg.cardHeight);
      if (cfg.minHeight) setImportant(card, "min-height", cfg.minHeight);
      setImportant(card, "padding", "12px 14px");
    }

    // climb parents inside iframe and neutralize panels (wiz-root, wiz-container, panel, paper)
    try {
      let el: HTMLElement | null = outer || card || null;
      let depth = 0;
      while (el && depth < 8) {
        const parent = el.parentElement;
        if (!parent) break;
        // stop at body/html
        if (parent.tagName.toLowerCase() === "body" || parent.tagName.toLowerCase() === "html") break;
        setImportant(parent, "background", "transparent");
        setImportant(parent, "background-color", "transparent");
        setImportant(parent, "box-shadow", "none");
        setImportant(parent, "border", "0px");
        setImportant(parent, "padding", "0px");
        setImportant(parent, "margin", "0px");
        if (cfg.cardHeight) setImportant(parent, "--pw-card-height", cfg.cardHeight);
        el = parent;
        depth++;
      }
    } catch (e) {
      // ignore
    }

    // inject style to neutralize pseudo-elements and enforce transparent variables locally
    try {
      const id = "pw-indicator-local-reset";
      let st = document.getElementById(id) as HTMLStyleElement | null;
      const rootSel = outer ? (outer.id ? `#${outer.id}` : ".pw-embed-outer") : ".pw-embed-outer";
      const txt = `
/* auto-generated reset for pool-indicator embed */
${rootSel}, ${rootSel} * { background: transparent !important; background-image: none !important; box-shadow: none !important; border: 0 !important; --theme-page-bg: transparent !important; --color-bg-page: transparent !important; }
${rootSel}::before, ${rootSel}::after, ${rootSel} *::before, ${rootSel} *::after { content: none !important; display: none !important; background: transparent !important; }
`;
      if (!st) {
        st = document.createElement("style");
        st.id = id;
        st.appendChild(document.createTextNode(txt));
        document.head.appendChild(st);
      } else {
        st.textContent = txt;
      }
    } catch (e) {}
  }

  // apply config on mount from props / url and with retries
  useEffect(() => {
    const urlCfg = readParamsFromUrl();
    const cfg = {
      height: propHeight ?? urlCfg.height,
      cardHeight: propCardHeight ?? urlCfg.cardHeight,
      minHeight: propMinHeight ?? urlCfg.minHeight,
      bg: propBg ?? urlCfg.bg,
      panel: typeof propPanel === "boolean" ? propPanel : urlCfg.panel,
      color: propColor ?? urlCfg.color,
    };
    // immediate apply + repeated attempts to survive widget DOM mutations
    applyConfig(cfg);
    let attempts = 0;
    const maxAttempts = 8;
    const t = setInterval(() => {
      attempts++;
      applyConfig(cfg);
      if (attempts >= maxAttempts) clearInterval(t);
    }, 300);

    const mo = new MutationObserver(() => applyConfig(cfg));
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });

    return () => {
      clearInterval(t);
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propHeight, propCardHeight, propMinHeight, propBg, propPanel, propFont, propColor, width]);

  // listen for postMessage config from parent
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      try {
        const data = e.data;
        if (!data || typeof data !== "object") return;
        if (data.type === "dvvs:embedConfig" && data.payload) {
          const p = data.payload;
          applyConfig({
            cardHeight: p.cardHeight,
            height: p.height,
            minHeight: p.minHeight,
            bg: p.bg,
            panel: p.panel,
            color: p.color,
          });
          try { e.source?.postMessage?.({ type: "dvvs:embedConfigApplied", payload: { ok: true } }, e.origin || "*"); } catch (err) {}
        }
      } catch (err) { /* ignore */ }
    }
    window.addEventListener("message", onMsg, false);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // report height to parent (use ResizeObserver and polling fallback)
  useEffect(() => {
    const card = cardRef.current;
    function reportHeight() {
      try {
        const el = cardRef.current || outerRef.current;
        if (!el) return;
        const h = Math.round(el.getBoundingClientRect().height);
        window.parent.postMessage({ type: "dvvs:wizard:height", height: h }, "*");
      } catch (e) {}
    }
    reportHeight();
    const ro = (window as any).ResizeObserver ? new (window as any).ResizeObserver(reportHeight) : null;
    if (ro && cardRef.current) ro.observe(cardRef.current);
    const id = setInterval(reportHeight, 800);
    return () => {
      if (ro) ro.disconnect();
      clearInterval(id);
    };
  }, []);

  function openWheel(href: string) {
    try { if (typeof onOpenWheel === "function") { onOpenWheel(href); return; } } catch (e) {}
    try { parent.postMessage({ type: "pw:openWheel", href }, "*"); } catch (e) {}
    try { window.location.href = href; } catch (e) {}
  }

  const placesText = available != null ? String(available) : "—";
  const tempText = temp != null ? Number(temp).toFixed(2) : "—";

  return (
    <div className="pw-embed-root" style={{ width }}>
      {/* Inject local strong CSS to neutralize host-like effects inside this frame */}
      <style>{embeddedCss}</style>

      <div className="pw-embed-outer" ref={outerRef} style={{ width, ...(propHeight ? { height: propHeight } : {}) }}>
        <div className="pw-embed-card" ref={cardRef} role="region" aria-label="Индикатор бассейна">
          <div className="pw-title-center">Сейчас в тренировочном бассейне</div>

          <div className="pw-values-row">
            <div className="pw-col-block">
              <div className="pw-col-num">{placesText}</div>
              <div className="pw-col-label">свободных мест</div>
            </div>

            <div className="pw-col-block">
              <div className="pw-col-num">{tempText}</div>
              <div className="pw-col-label">градуса</div>
            </div>
          </div>

          <div className="pw-footer">
            <button
              type="button"
              className="pw-book-btn"
              onClick={() => { openWheel(wheelSrc); try { window.postMessage({ type: 'pw:openWheel-click', href: wheelSrc }, '*'); } catch(e){} }}
              aria-label="Забронировать"
            >
              Забронировать
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}