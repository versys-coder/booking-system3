import React, { useEffect, useRef, useState } from "react";
import "./pool-indicator.css";

type Props = {
  apiBase?: string;
  poolName?: string;
  wheelSrc?: string;
  updateMs?: number;
  width?: string;
  height?: string;
};

export default function PoolIndicatorEmbed({
  apiBase = "",
  poolName = "Тренировочный",
  wheelSrc = "https://price.dvvs-ekb.ru/embed/?mode=compact&bg=transparent&font=bebas&panel=1&color=fff",
  updateMs = 30000,
  width = "100%",
  height = "",
}: Props) {
  const [localWheelSrc, setLocalWheelSrc] = useState<string>(wheelSrc);
  const [available, setAvailable] = useState<number | null>(null);
  const [temp, setTemp] = useState<number | null>(null);

  const rowRef = useRef<HTMLDivElement | null>(null);
  const leftNumRef = useRef<HTMLDivElement | null>(null);
  const rightNumRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const qs = new URLSearchParams(window.location.search);
      const qWheel = qs.get("wheelSrc");
      const qPool = qs.get("poolName");
      const qUpdate = qs.get("updateMs");
      if (qWheel) setLocalWheelSrc(decodeURIComponent(qWheel));
      if (qPool) {
        // (оставляем poolName параметром, компонент получает poolName сверху)
      }
      if (qUpdate) {
        const u = Number(qUpdate);
        if (!Number.isNaN(u) && u > 0) {
          // no-op
        }
      }
    } catch {}
  }, []);

  // Fetch (как было)
  useEffect(() => {
    let mounted = true;
    const apiBaseCandidates = apiBase
      ? [apiBase.replace(/\/+$/, "")]
      : ["", "/catalog/api-backend", "/catalog/api-backend/api"];

    async function tryFetch(path: string) {
      for (const base of apiBaseCandidates) {
        try {
          const url = base ? base.replace(/\/+$/, "") + path : path;
          const r = await fetch(url, { cache: "no-store" });
          if (!r.ok) throw new Error("http " + r.status);
          const j = await r.json().catch(() => null);
          return { ok: true, json: j };
        } catch {
          // next
        }
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
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [apiBase, poolName, updateMs]);

  // Strong inline enforcement: use style.setProperty(..., 'important')
  useEffect(() => {
    const el = rowRef.current;
    if (!el) return;

    // Force display:flex !important
    try {
      el.style.setProperty("display", "flex", "important");
      el.style.setProperty("flex-direction", "row", "important");
      el.style.setProperty("flex-wrap", "nowrap", "important");
      el.style.setProperty("align-items", "center", "important");
      el.style.setProperty("justify-content", "center", "important");
      el.style.setProperty("column-gap", "var(--pw-gap)", "important");
      el.style.setProperty("width", "100%", "important");
      el.style.setProperty("min-width", "0", "important");
    } catch (e) {
      // ignore
    }

    // Apply forced styles to children columns
    try {
      const children = Array.from(el.querySelectorAll<HTMLElement>(".pw-col-block"));
      children.forEach((c) => {
        c.style.setProperty("flex", "0 0 calc(50% - (var(--pw-gap) / 2))", "important");
        c.style.setProperty("min-width", "64px", "important");
        c.style.setProperty("box-sizing", "border-box", "important");
        c.style.setProperty("padding", "0.12rem 0.25rem", "important");
      });
    } catch (e) {}

    // Force Bebas inline on number elements as last resort (important)
    try {
      if (leftNumRef.current) leftNumRef.current.style.setProperty("font-family", `"Bebas Neue", Arial, sans-serif`, "important");
      if (rightNumRef.current) rightNumRef.current.style.setProperty("font-family", `"Bebas Neue", Arial, sans-serif`, "important");
    } catch (e) {}
  }, []);

  function openWheel(href: string) {
    try {
      const fe = window.frameElement as HTMLIFrameElement | null;
      if (fe) {
        fe.src = href;
        return;
      }
    } catch (e) {}
    try {
      parent.postMessage({ type: "pw:openWheel", href }, "*");
    } catch (e) {}
    try {
      window.location.href = href;
    } catch (e) {}
  }

  const placesText = available != null ? String(available) : "—";
  const tempText = temp != null ? Number(temp).toFixed(2) : "—";

  return (
    <div className="pw-embed-outer" style={{ width, height: height || "var(--pw-card-height)" }}>
      <div className="pw-embed-card" role="region" aria-label="Индикатор бассейна">
        <div className="pw-title-center">Сейчас в тренировочном бассейне</div>

        <div className="pw-values-row" ref={rowRef}>
          <div className="pw-col-block">
            <div className="pw-col-num" ref={leftNumRef}>{placesText}</div>
            <div className="pw-col-label">свободных мест</div>
          </div>

          <div className="pw-col-block">
            <div className="pw-col-num" ref={rightNumRef}>{tempText}</div>
            <div className="pw-col-label">градуса</div>
          </div>
        </div>

        <div className="pw-footer">
          <button type="button" className="pw-book-btn" onClick={() => openWheel(localWheelSrc)} aria-label="Забронировать">
            Забронировать
          </button>
        </div>
      </div>
    </div>
  );
}