import React, { useEffect, useRef, useState } from "react";
// Импорт компонента Индикатора из PoolIndicator
import Indicator from "../../PoolIndicator/src/PoolIndicatorEmbed";
// Импорт PoolWheelWidget (основное "колесо") из wheel
import PoolWheel from "../../wheel/src/PoolWheelWidgetEmbed";

// Локальные формы (можно заменить на свои продвинутые позже)
import PhoneForm from "./components/PhoneForm";
import SmsForm from "./components/SmsForm";
import Success from "./components/Success";

export type SelectedSlot = { start_date: string; pool?: string } | null;
type Step = "indicator" | "wheel" | "phone" | "sms" | "success";

/**
 * WizardApp — основной SPA компонент.
 *
 * Добавлена поддержка встраивания (embed):
 * - если приложение загружено в iframe, оно будет публиковать высоту контента в parent
 *   через window.parent.postMessage({ type: 'dvvs:wizard:height', height: <px> }, '*')
 * - приложение читает query-параметры (mode, bg, font, panel, color и т.п.) и может
 *   применять простые вариации отображения.
 * - также слушает сообщения от parent с type = 'dvvs:parent:setTheme' для динамического
 *   управления параметрами из родителя.
 *
 * Это минимальная, безопасная реализация — расширяй под свои нужды.
 */
export default function WizardApp(): JSX.Element {
  const [step, setStep] = useState<Step>("indicator");
  const [slot, setSlot] = useState<SelectedSlot>(null);
  const [phone, setPhone] = useState<string>("");
  const [bookingResult, setBookingResult] = useState<any | null>(null);

  // embed-related state
  const rootRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // visual options from query
  const [embedOptions] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return {
        mode: params.get("mode") || undefined,
        bg: params.get("bg") || undefined,
        font: params.get("font") || undefined,
        panel: params.get("panel") || undefined,
        color: params.get("color") || undefined,
        // add more params as needed
      };
    } catch (e) {
      return {};
    }
  });

  function goToWheel() {
    setStep("wheel");
  }
  function onSlotSelected(s: SelectedSlot) {
    setSlot(s);
    setStep("phone");
  }
  function onPhoneSubmitted(ph: string) {
    setPhone(ph);
    setStep("sms");
  }
  function onBookingComplete(res: any) {
    setBookingResult(res);
    setStep("success");
  }
  function restart() {
    setSlot(null);
    setPhone("");
    setBookingResult(null);
    setStep("indicator");
  }

  // Send height message to parent (for embed iframe auto-resize)
  function postHeightToParent() {
    try {
      if (!rootRef.current) return;
      const el = rootRef.current;
      // Measure the content height. Use scrollHeight to capture full content.
      const height = Math.ceil(el.scrollHeight || el.offsetHeight || 480);
      // Parent embed code expects message.type === 'dvvs:wheels:height' or similar.
      // We use 'dvvs:wizard:height' (parent can adapt), and also include a generic key.
      const payload = { type: "dvvs:wizard:height", height };
      // postMessage targetOrigin '*' is used so parent can filter by origin itself.
      // Parent embed script typically checks e.origin === ALLOWED_ORIGIN.
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(payload, "*");
      }
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => {
    // Send initial height once mounted (defer to next tick so DOM is painted)
    const t0 = setTimeout(postHeightToParent, 80);

    // Setup ResizeObserver to notify parent about size changes
    if (rootRef.current && typeof ResizeObserver !== "undefined") {
      resizeObserverRef.current = new ResizeObserver(() => {
        postHeightToParent();
      });
      resizeObserverRef.current.observe(rootRef.current);
    } else {
      // Fallback: listen to window resize
      const onWinResize = () => postHeightToParent();
      window.addEventListener("resize", onWinResize);
      // cleanup will remove it
      // store cleanup reference via resizeObserverRef.current === null flag
      resizeObserverRef.current = null;
    }

    // Message listener from parent
    function onMessage(e: MessageEvent) {
      // If you want stricter security, check e.origin here:
      // if (e.origin !== "https://price.dvvs-ekb.ru") return;

      const data = e.data;
      if (!data || typeof data !== "object") return;

      // parent can request a height update
      if (data && (data.type === "dvvs:parent:requestHeight" || data.type === "dvvs:request:height")) {
        postHeightToParent();
      }

      // parent can set theme / small customizations dynamically
      if (data && data.type === "dvvs:parent:setTheme" && data.theme) {
        // example: data.theme = { bg: '#fff', color: '#000' }
        Object.keys(data.theme).forEach((k) => {
          try {
            // set CSS variables on root for simple theming
            (document.documentElement.style as any).setProperty(`--embed-${k}`, data.theme[k]);
          } catch (err) {}
        });
        // After applying theme, re-send height (if layout changed)
        setTimeout(postHeightToParent, 80);
      }
    }
    window.addEventListener("message", onMessage, false);

    return () => {
      clearTimeout(t0);
      if (resizeObserverRef.current) {
        try {
          resizeObserverRef.current.disconnect();
        } catch (e) {}
      } else {
        window.removeEventListener("resize", postHeightToParent);
      }
      window.removeEventListener("message", onMessage, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whenever visible content changes, inform parent
  useEffect(() => {
    // small delay so DOM updates settle
    const t = setTimeout(postHeightToParent, 60);
    return () => clearTimeout(t);
  }, [step, slot, phone, bookingResult]);

  // Apply embed options (simple example: change background when bg=transparent)
  useEffect(() => {
    if (!embedOptions) return;
    if (embedOptions.bg === "transparent") {
      // ensure root background is transparent
      if (rootRef.current) {
        rootRef.current.style.background = "transparent";
      }
      document.documentElement.style.setProperty("--embed-bg", "transparent");
    }
    if (embedOptions.color) {
      document.documentElement.style.setProperty("--embed-color", `#${embedOptions.color.replace(/^#/, "")}`);
    }
    if (embedOptions.font) {
      // optional: load a font or set className to apply font family if you ship fonts
      document.documentElement.setAttribute("data-embed-font", embedOptions.font);
    }
    // Notify parent after applying styles
    setTimeout(postHeightToParent, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={rootRef} className="wiz-root" style={{ background: undefined }}>
      {step === "indicator" && <Indicator onBook={goToWheel} />}

      {step === "wheel" && (
        <PoolWheel
          onBack={() => setStep("indicator")}
          onSelectSlot={(s) => onSlotSelected(s)}
        />
      )}

      {step === "phone" && slot && (
        <PhoneForm
          slot={slot}
          initialPhone={phone}
          onBack={() => setStep("wheel")}
          onSubmit={(ph) => onPhoneSubmitted(ph)}
        />
      )}

      {step === "sms" && slot && (
        <SmsForm
          slot={slot}
          phone={phone}
          onBack={() => setStep("phone")}
          onComplete={(res) => onBookingComplete(res)}
        />
      )}

      {step === "success" && bookingResult && (
        <Success result={bookingResult} onClose={restart} />
      )}
    </div>
  );
}