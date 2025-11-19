import '../../wheel/src/styles.css';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './styles.css';

import PoolIndicatorEmbed from '../../PoolIndicator/src/PoolIndicatorEmbed';
import PoolWheelWidgetEmbed from '../../wheel/src/PoolWheelWidgetEmbed';
import Success from './components/Success';

type Step = 1 | 2 | 3 | 4 | 5;

function readEmbedConfigFromUrl() {
  try {
    const sp = new URLSearchParams(window.location.search);
    const modeParam = sp.get("mode") || sp.get("layout");
    const bg = (sp.get("bg") || sp.get("background") || "").toLowerCase();
    const mode: "minimal" | "compact" = modeParam === "compact" ? "compact" : "minimal";
    const transparentBg = bg === "transparent" || bg === "none" || sp.get("noBg") === "1";
    const font = (sp.get("font") || "").toLowerCase();
    const panel = (sp.get("panel") ?? (mode === "compact" ? "1" : "0")) !== "0";
    const color = (sp.get("color") || "#ffffff").replace("#", "");
    const cardHeight = sp.get("cardHeight") || undefined;
    const height = sp.get("height") || undefined;
    return { mode, transparentBg, font, panel, color, cardHeight, height };
  } catch (e) {
    return { mode: "minimal", transparentBg: false, font: "", panel: true, color: "ffffff", cardHeight: undefined, height: undefined };
  }
}

type SelectedSlot = {
  start_date?: string;
  [k: string]: any;
};

const WizardApp: React.FC = () => {
  const urlCfg = useMemo(() => readEmbedConfigFromUrl(), []);
  const [step, setStep] = useState<Step>(1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [client, setClient] = useState<any>(null);

  // persist selected start locally (only when both parts present)
  useEffect(() => {
    if (selectedDate && selectedHour != null) {
      try {
        localStorage.setItem('pw:selectedStart', `${selectedDate}T${String(selectedHour).padStart(2, '0')}:00:00`);
      } catch { /* ignore */ }
    }
  }, [selectedDate, selectedHour]);

  // message handler: stable identity with useCallback
  const onMessage = useCallback((ev: MessageEvent) => {
    if (!ev.data || typeof ev.data !== 'object') return;
    const { type, payload } = ev.data as any;

    if (type === 'dvvs:openBooking' && payload) {
      if (payload.start) {
        const dt = new Date(payload.start);
        if (!isNaN(dt.getTime())) {
          setSelectedDate(dt.toISOString().slice(0, 10));
          setSelectedHour(dt.getHours());
          setStep(3);
          return;
        }
      }
      setStep(2);
      return;
    }

    if (type === 'pw:openWheel' && (ev as any).data && (ev as any).data.href) {
      try {
        const href = (ev as any).data.href as string;
        const url = new URL(href, window.location.href);
        const start = url.searchParams.get('start');
        if (start) {
          const dt = new Date(start);
          if (!isNaN(dt.getTime())) {
            setSelectedDate(dt.toISOString().slice(0, 10));
            setSelectedHour(dt.getHours());
            setStep(3);
            return;
          }
        }
      } catch (e) { /* ignore */ }
      setStep(2);
      return;
    }

    if (type === 'dvvs:booking:success' && payload && payload.client) {
      setClient(payload.client);
      setStep(5);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onMessage]);

  const handleOpenWheel = useCallback((href: string) => {
    try {
      const url = new URL(href, window.location.href);
      const start = url.searchParams.get('start');
      if (start) {
        const dt = new Date(start);
        if (!isNaN(dt.getTime())) {
          setSelectedDate(dt.toISOString().slice(0, 10));
          setSelectedHour(dt.getHours());
          setStep(3);
          return;
        }
      }
    } catch (e) { /* ignore */ }
    setStep(2);
  }, []);

  const handleSlotSelected = useCallback((dateIso: string, hour: number) => {
    setSelectedDate(dateIso);
    setSelectedHour(hour);
    try { localStorage.setItem('pw:selectedStart', `${dateIso}T${String(hour).padStart(2,'0')}:00:00`); } catch {}
    setStep(3);
  }, []);

  const isWheelStep = step === 2;
  const containerStyle = useMemo<React.CSSProperties>(() => {
    return isWheelStep
      ? { width: '100%', maxWidth: 980, margin: '0 auto' }
      : { maxWidth: 640, margin: '0 auto' };
  }, [isWheelStep]);

  function ConfirmationPanel() {
    const slotText = selectedDate ? `${selectedDate}${selectedHour != null ? ' ' + String(selectedHour).padStart(2, '0') + ':00' : ''}` : '—';
    return (
      <div style={{ textAlign: "center", padding: 12 }}>
        <div style={{ marginBottom: 10 }}>
          <button className="link" onClick={() => setStep(2)}>← назад</button>
        </div>

        <h3>Подтверждение брони (debug)</h3>
        <div className="slot-line">Бронируем: {slotText}</div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 8 }}>
          <button
            className="primary"
            onClick={() => {
              const fakeClient = { id: "debug-client", start: `${slotText}`, phone: "70000000000" };
              setClient(fakeClient);
              try { window.parent.postMessage?.({ type: 'dvvs:booking:success', payload: { client: fakeClient } }, '*'); } catch {}
              setStep(5);
            }}
          >
            Подтвердить (симуляция)
          </button>

          <button
            className="secondary"
            onClick={() => {
              setClient({ id: "skipped-debug" });
              setStep(5);
            }}
          >
            Skip (debug)
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>
          Это временная панель подтверждения — PhoneForm и SmsForm отключены для отладки.
        </div>
      </div>
    );
  }

  return (
    <div className="wiz-root">
      <div className="wiz-container" style={containerStyle}>
        {step === 1 && (
          <div
            className="indicator-wrapper"
            style={{
              position: 'relative',
              zIndex: 2147483645,
              pointerEvents: 'auto',
            }}
          >
            <PoolIndicatorEmbed
              apiBase="/catalog/api-backend"
              onOpenWheel={handleOpenWheel}
              width="100%"
              height={urlCfg.height}
              cardHeight={urlCfg.cardHeight}
              bg={urlCfg.transparentBg ? "transparent" : undefined}
              panel={urlCfg.panel}
              font={urlCfg.font}
              color={urlCfg.color}
            />
          </div>
        )}

        {step === 2 && (
          <PoolWheelWidgetEmbed
            mode={urlCfg.mode}
            font={urlCfg.font}
            panel={urlCfg.panel}
            transparentBg={urlCfg.transparentBg}
            color={"#" + (urlCfg.color || "ffffff")}
            onSelectSlot={handleSlotSelected}
          />
        )}

        {step === 3 && (
          <ConfirmationPanel />
        )}

        {step === 4 && (
          <div style={{ textAlign: "center", padding: 12 }}>
            <div>Step 4 (SMS) disabled for debugging.</div>
            <div style={{ marginTop: 8 }}>
              <button className="primary" onClick={() => { setClient({ id: "debug-from-4" }); setStep(5); }}>Continue</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <Success
            client={client}
            onNewBooking={() => {
              setStep(1);
              setClient(null);
              setSelectedDate(null);
              setSelectedHour(null);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default WizardApp;
