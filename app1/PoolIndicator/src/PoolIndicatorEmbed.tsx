import React, { useEffect, useRef, useState } from "react";
import "./pool-indicator.css";

/**
 * PoolIndicatorEmbed — hardened version (rewritten)
 *
 * Changes vs original:
 * - applyConfig accepts extended payload fields (inlineBg, bgOpacity, bgR/bgG/bgB, offsetTop)
 * - applyConfig always writes inline styles with "important" to beat host CSS
 * - ensures document.body/documentElement inside iframe are transparent
 * - neutralizes parent wrappers up to a few levels
 * - retries applying config (interval + MutationObserver) to survive DOM mutations
 * - listens for postMessage dvvs:embedConfig and replies with dvvs:embedConfigApplied
 * - reports height via dvvs:wizard:height (ResizeObserver + polling)
 * - keeps previous behavior: reads URL params and props on mount
 */

type ConfigPayload = {
  cardHeight?: string;
  height?: string;
  minHeight?: string;
  bg?: string;
  panel?: boolean;
  color?: string;
  // extended fields
  inlineBg?: string;        // explicit rgba string, e.g. 'rgba(4,22,25,0.72)'
  bgOpacity?: number;       // 0..1
  bgR?: number;
  bgG?: number;
  bgB?: number;
  offsetTop?: number;       // px
};

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
        // extended values that may be passed via URL
        bgOpacity: sp.get("bg_opacity") ? Number(sp.get("bg_opacity")) : undefined,
        bgR: sp.get("bg_r") ? Number(sp.get("bg_r")) : undefined,
        bgG: sp.get("bg_g") ? Number(sp.get("bg_g")) : undefined,
        bgB: sp.get("bg_b") ? Number(sp.get("bg_b")) : undefined,
        offsetTop: sp.get("offsetTop") ? Number(sp.get("offsetTop")) : undefined,
      } as any;
    } catch (e) {
      return {} as any;
    }
  }

  // simple fetch helpers (try multiple bases)
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

  // centralized function that applies config robustly (inline + important)
  function applyConfig(cfgRaw: Partial<ConfigPayload> = {}) {
    const cfg: ConfigPayload = { ...(cfgRaw as ConfigPayload) };

    const outer = outerRef.current;
    const card = cardRef.current;

    function setImportant(el: HTMLElement | null, prop: string, value: string) {
      try { el?.style.setProperty(prop, value, "important"); } catch (e) {}
    }

    // ensure body/html transparent
    try {
      if (typeof document !== "undefined") {
        try { document.documentElement.style.setProperty("background", "transparent", "important"); } catch (e) {}
        try { document.documentElement.style.setProperty("background-color", "transparent", "important"); } catch (e) {}
        try { document.body && document.body.style.setProperty("background", "transparent", "important"); } catch (e) {}
        try { document.body && document.body.style.setProperty("background-color", "transparent", "important"); } catch (e) {}
      }
    } catch (e) {}

    // apply dimensions and variables on outer/card
    if (outer) {
      if (cfg.height) setImportant(outer, "height", cfg.height);
      if (cfg.minHeight) setImportant(outer, "min-height", cfg.minHeight);
      if (cfg.cardHeight) setImportant(outer, "--pw-card-height", cfg.cardHeight);
      if (typeof cfg.offsetTop !== "undefined") setImportant(outer, "padding-top", `${cfg.offsetTop}px`);
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

    // build explicit bg string: prefer inlineBg, else bgR/bgG/bgB/bgOpacity, else fallback to CSS var
    let bgString: string | null = null;
    if (cfg.inlineBg) {
      bgString = cfg.inlineBg;
    } else if (typeof cfg.bgR === "number" && typeof cfg.bgG === "number" && typeof cfg.bgB === "number") {
      const opacity = typeof cfg.bgOpacity === "number" ? cfg.bgOpacity : 0.72;
      bgString = `rgba(${cfg.bgR},${cfg.bgG},${cfg.bgB},${opacity})`;
    } else if (typeof cfg.bgOpacity === "number") {
      bgString = `rgba(4,22,25,${cfg.bgOpacity})`;
    }

    // force apply card background inline (important) if we have a bgString
    if (card) {
      if (bgString) {
        setImportant(card, "background", bgString);
        setImportant(card, "background-color", bgString);
        setImportant(card, "--pw-bg", bgString);
        setImportant(card, "--pw-bg-opacity", String(cfg.bgOpacity ?? 0.72));
      } else {
        // ensure at least variable-based background is used
        setImportant(card, "background", "var(--pw-bg, rgba(4,22,25,0.72))");
      }
    }

    // neutralize parents up to 8 levels to avoid wrapper backgrounds/shadows
    try {
      let el: HTMLElement | null = card || outer || null;
      let depth = 0;
      while (el && depth < 8) {
        const parent = el.parentElement;
        if (!parent) break;
        if (parent.tagName.toLowerCase() === "body" || parent.tagName.toLowerCase() === "html") break;
        setImportant(parent, "background", "transparent");
        setImportant(parent, "background-color", "transparent");
        setImportant(parent, "box-shadow", "none");
        setImportant(parent, "border", "0");
        setImportant(parent, "padding", "0");
        setImportant(parent, "margin", "0");
        el = parent;
        depth++;
      }
    } catch (e) {
      // ignore
    }

    // inject small style node to cover pseudo-elements and enforce variables for the root selector
    try {
      const id = "pw-indicator-local-reset";
      const rootSel = outer ? (outer.id ? `#${outer.id}` : ".pw-embed-outer") : ".pw-embed-outer";
      const txt = `
${rootSel}, ${rootSel} * { background: transparent !important; background-image: none !important; box-shadow: none !important; border: 0 !important; --theme-page-bg: transparent !important; --color-bg-page: transparent !important; }
${rootSel}::before, ${rootSel}::after, ${rootSel} *::before, ${rootSel} *::after { content: none !important; display: none !important; background: transparent !important; }
`;
      let st = document.getElementById(id) as HTMLStyleElement | null;
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

  // apply initial config from props + url and keep retrying to survive DOM mutations
  useEffect(() => {
    const urlCfg = readParamsFromUrl() as any;
    const cfg: Partial<ConfigPayload> = {
      height: propHeight ?? urlCfg.height,
      cardHeight: propCardHeight ?? urlCfg.cardHeight,
      minHeight: propMinHeight ?? urlCfg.minHeight,
      bg: propBg ?? urlCfg.bg,
      panel: typeof propPanel === "boolean" ? propPanel : urlCfg.panel,
      color: propColor ?? urlCfg.color,
      bgOpacity: urlCfg.bgOpacity,
      bgR: urlCfg.bgR,
      bgG: urlCfg.bgG,
      bgB: urlCfg.bgB,
      offsetTop: urlCfg.offsetTop,
    };

    // immediate application + repeated attempts
    applyConfig(cfg as Partial<ConfigPayload>);
    let attempts = 0;
    const maxAttempts = 12;
    const t = setInterval(() => {
      attempts++;
      applyConfig(cfg as Partial<ConfigPayload>);
      if (attempts >= maxAttempts) clearInterval(t);
    }, 300);

    const mo = new MutationObserver(() => applyConfig(cfg as Partial<ConfigPayload>));
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });

    return () => {
      clearInterval(t);
      mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propHeight, propCardHeight, propMinHeight, propBg, propPanel, propFont, propColor, width]);

  // postMessage listener: accept dvvs:embedConfig with extended payload and reply ack
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      try {
        const data = e.data;
        if (!data || typeof data !== "object") return;
        if (data.type === "dvvs:embedConfig" && data.payload) {
          const p: any = data.payload;
          // normalize payload types
          const payload: Partial<ConfigPayload> = {
            cardHeight: p.cardHeight,
            height: p.height,
            minHeight: p.minHeight,
            bg: p.bg,
            panel: p.panel,
            color: p.color,
            inlineBg: p.inlineBg,
            bgOpacity: typeof p.bgOpacity === "number" ? p.bgOpacity : (p.bgOpacity ? Number(p.bgOpacity) : undefined),
            bgR: typeof p.bgR === "number" ? p.bgR : (p.bgR ? Number(p.bgR) : undefined),
            bgG: typeof p.bgG === "number" ? p.bgG : (p.bgG ? Number(p.bgG) : undefined),
            bgB: typeof p.bgB === "number" ? p.bgB : (p.bgB ? Number(p.bgB) : undefined),
            offsetTop: typeof p.offsetTop === "number" ? p.offsetTop : (p.offsetTop ? Number(p.offsetTop) : undefined),
          };
          applyConfig(payload);
          // try to reply to source (ack)
          try { e.source?.postMessage?.({ type: "dvvs:embedConfigApplied", payload: { ok: true } }, e.origin || "*"); } catch (err) {}
        }
      } catch (err) {
        // ignore
      }
    }
    window.addEventListener("message", onMsg, false);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // report height to parent (ResizeObserver + polling fallback)
  useEffect(() => {
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