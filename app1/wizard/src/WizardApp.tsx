import '../../wheel/src/styles.css';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import './styles.css';

import PoolIndicatorEmbed from '../../PoolIndicator/src/PoolIndicatorEmbed';
import PoolWheelWidgetEmbed from '../../wheel/src/PoolWheelWidgetEmbed';
import PhoneForm from './components/PhoneForm';
import SmsForm from './components/SmsForm';
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

const WizardApp: React.FC = () => {
  const urlCfg = useMemo(() => readEmbedConfigFromUrl(), []);
  const [step, setStep] = useState<Step>(1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [phone, setPhone] = useState('');
  const [client, setClient] = useState<any>(null);

  useEffect(() => {
    if (selectedDate && selectedHour != null) {
      try {
        localStorage.setItem('pw:selectedStart', `${selectedDate}T${String(selectedHour).padStart(2,'0')}:00:00`);
      } catch {}
    }
  }, [selectedDate, selectedHour]);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (!ev.data || typeof ev.data !== 'object') return;
      const { type, payload } = ev.data as any;

      if (type === 'dvvs:openBooking' && payload) {
        if (payload.start) {
          const dt = new Date(payload.start);
          if (!isNaN(dt.getTime())) {
            setSelectedDate(dt.toISOString().slice(0,10));
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
              setSelectedDate(dt.toISOString().slice(0,10));
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
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const handleOpenWheel = useCallback((href: string) => {
    try {
      const url = new URL(href, window.location.href);
      const start = url.searchParams.get('start');
      if (start) {
        const dt = new Date(start);
        if (!isNaN(dt.getTime())) {
          setSelectedDate(dt.toISOString().slice(0,10));
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
  const containerStyle: React.CSSProperties = isWheelStep
    ? { width: '100%', maxWidth: 980, margin: '0 auto' }
    : { maxWidth: 640, margin: '0 auto' };

  return (
    <div className="wiz-root">
      <div className="wiz-container" style={containerStyle}>
        {step === 1 && (
          <div className="indicator-wrapper">
            <PoolIndicatorEmbed
              onOpenWheel={handleOpenWheel}
              width="100%"
              // pass url-driven values so iframe embed responds to query params
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
          <PhoneForm
            value={phone}
            onChange={setPhone}
            onSubmit={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}

        {step === 4 && (
          <SmsForm
            phone={phone}
            onSuccess={(clientData) => { setClient(clientData); setStep(5); }}
            onBack={() => setStep(3)}
          />
        )}

        {step === 5 && (
          <Success
            client={client}
            onNewBooking={() => {
              setStep(1);
              setClient(null);
              setPhone('');
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