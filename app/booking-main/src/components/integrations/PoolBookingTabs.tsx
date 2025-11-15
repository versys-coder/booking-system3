import React, { useState, useMemo } from "react";
import BookingApp from "../BookingApp";
import PoolWorkload from "../PoolWorkload";
import PoolWorkloadBookingIntegrated from "./PoolWorkloadBookingIntegrated";
import PoolHeatmapBookingIntegratedFull from "./PoolHeatmapBookingIntegratedFull";
import PoolWheelBookingIntegratedFull from "./PoolWheelBookingIntegratedFull";
import QuickBookingFlow, { VirtualSlot } from "./QuickBookingFlow";
import { useSlotsIndex } from "./useSlotsIndex";
import TemperatureWidget from "../TemperatureWidget";

// Верхние индикаторы
const PoolTopIndicators: React.FC<{
  current: number | null;
  freePlaces: number | null;
}> = ({ current, freePlaces }) => {
  const [showTempPopup, setShowTempPopup] = useState(false);
  const tempBtnRef = React.useRef<HTMLDivElement>(null);

  const [popupLeft, setPopupLeft] = useState(0);
  const [popupTop, setPopupTop] = useState(0);

  const openTempPopup = () => {
    if (tempBtnRef.current) {
      const rect = tempBtnRef.current.getBoundingClientRect();
      setPopupLeft(rect.right + window.scrollX + 12);
      setPopupTop(rect.top + window.scrollY - 8);
      setShowTempPopup(true);
    }
  };
  const closeTempPopup = () => setShowTempPopup(false);

  return (
    <div
      className="pool-top-indicators"
      style={{
        display: "flex",
        gap: 16,
        justifyContent: "flex-start",
        alignItems: "flex-start",
        marginBottom: 36,
        marginLeft: 44,
        minHeight: 64,
        position: "relative",
        zIndex: 2,
      }}
    >
      <div
        className="pool-indicator-card"
        style={{
          background: "#eaf6ff",
          borderRadius: 20,
          boxShadow: "0 2px 12px #31628c11",
          padding: "10px 20px 10px 20px",
          minWidth: 120,
          maxWidth: 140,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          className="pool-indicator-title"
          style={{
            color: "#185a90",
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: ".04em",
            marginBottom: 1,
            textAlign: "center",
          }}
        >
          В БАССЕЙНЕ
        </div>
        <div
          className="pool-indicator-value"
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: "#123",
            marginBottom: 2,
            textAlign: "center",
          }}
        >
          {current == null ? "—" : current}
        </div>
        <div
          className="pool-indicator-desc"
          style={{
            fontSize: 9,
            color: "#185a90",
            opacity: 0.85,
            fontWeight: 500,
            marginTop: 1,
            textAlign: "center",
          }}
        >
          сейчас человек
        </div>
      </div>
      <div
        className="pool-indicator-card"
        style={{
          background: "#eaf6ff",
          borderRadius: 20,
          boxShadow: "0 2px 12px #31628c11",
          padding: "10px 20px 10px 20px",
          minWidth: 120,
          maxWidth: 140,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div
          className="pool-indicator-title"
          style={{
            color: "#185a90",
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: ".04em",
            marginBottom: 1,
            textAlign: "center",
          }}
        >
          СВОБОДНО
        </div>
        <div
          className="pool-indicator-value"
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: "#123",
            marginBottom: 2,
            textAlign: "center",
          }}
        >
          {freePlaces == null ? "—" : freePlaces}
        </div>
        <div
          className="pool-indicator-desc"
          style={{
            fontSize: 9,
            color: "#185a90",
            opacity: 0.85,
            fontWeight: 500,
            marginTop: 1,
            textAlign: "center",
          }}
        >
          мест осталось
        </div>
      </div>
      <div
        className="pool-indicator-card"
        style={{
          background: "#eaf6ff",
          borderRadius: 20,
          boxShadow: "0 2px 12px #31628c11",
          padding: "6px 12px 6px 12px",
          minWidth: 110,
          maxWidth: 140,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          cursor: "pointer",
        }}
        onMouseEnter={openTempPopup}
        onMouseLeave={closeTempPopup}
        ref={tempBtnRef}
      >
        <div
          className="pool-indicator-title"
          style={{
            fontWeight: 700,
            fontSize: 12,
            color: "#185a90",
            letterSpacing: ".03em",
            marginBottom: 0,
            textAlign: "center",
          }}
        >
          ТЕМПЕРАТУРА
        </div>
        <div
          className="pool-indicator-value"
          style={{
            padding: 0,
            margin: 0,
            width: "auto",
          }}
        >
          <TemperatureWidget mode="mini" scale={0.9} />
        </div>
        <div
          className="pool-indicator-desc"
          style={{
            fontSize: 9,
            color: "#185a90",
            opacity: 0.85,
            fontWeight: 500,
            marginTop: 1,
            textAlign: "center",
          }}
        >
          тренировочный
        </div>
        {showTempPopup && (
          <div
            className="temperature-popup"
            style={{
              position: "fixed",
              left: popupLeft,
              top: popupTop,
              zIndex: 1002,
              background: "#fff",
              borderRadius: 36,
              boxShadow: "0 4px 40px #185a9020",
              padding: "26px 44px 24px 44px",
              minWidth: 520,
              maxWidth: 900,
              display: "flex",
              alignItems: "flex-start",
              gap: 50,
              fontSize: 24,
              fontWeight: 600,
              color: "#123",
              whiteSpace: "nowrap",
              overflowX: "auto",
            }}
            onMouseEnter={openTempPopup}
            onMouseLeave={closeTempPopup}
          >
            <TemperatureWidget mode="full" />
          </div>
        )}
      </div>
    </div>
  );
};

type LocalTabKey =
  | "visual-combo"
  | "workload-integration"
  | "heatmap-integration"
  | "wheel-integration";

const LOCAL_TABS: { key: LocalTabKey; label: string }[] = [
  { key: "visual-combo", label: "Вариант 1" },
  { key: "workload-integration", label: "Вариант 2" },
  { key: "heatmap-integration", label: "Вариант 3" },
  { key: "wheel-integration", label: "Вариант 4" },
];

export default function PoolBookingTabs() {
  const [tab, setTab] = useState<LocalTabKey>("visual-combo");
  const [selectedSlot, setSelectedSlot] = useState<VirtualSlot | null>(null);
  const { loading: slotsLoading, error: slotsError, resolveSlot } = useSlotsIndex();

  // Эти значения должны приходить из API/стейта, здесь — заглушки для примера
  const current = 7;
  const freePlaces = 113;

  function handleSelectHour(date: string, hour: number) {
    const real = resolveSlot(date, hour);
    if (real) {
      setSelectedSlot({
        appointment_id: real.appointment_id,
        start_date: real.start_date,
        date,
        hour,
      });
    } else {
      setSelectedSlot({
        appointment_id: `virtual-${date}-${hour}`,
        start_date: `${date} ${String(hour).padStart(2, "0")}:00:00`,
        date,
        hour,
      });
    }
  }
  function resetFlow() {
    setSelectedSlot(null);
  }

  const headerStatus = useMemo(() => {
    if (slotsLoading) return "Слоты: загрузка…";
    if (slotsError) return "Слоты: ошибка";
    return "Слоты: ✓";
  }, [slotsLoading, slotsError]);

  const gridLeftOffset = 44;
  const gridMaxWidth = 1400;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6fafd",
        fontFamily: '"Roboto Condensed", Arial, sans-serif',
        color: "#606A76",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Кнопки вкладок */}
      <div className="pool-booking-tabs-bar">
        {LOCAL_TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setSelectedSlot(null);
              }}
              className={`pool-booking-tab-btn${active ? " active" : ""}`}
              type="button"
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          margin: "0 auto",
          width: "100%",
          maxWidth: gridMaxWidth,
          flex: 1,
          minHeight: 0,
          padding: "8px 0 32px 0",
          overflow: "auto",
        }}
      >
        {/* ВАРИАНТ 1 */}
        <div style={{ display: tab === "visual-combo" ? "block" : "none" }}>
          <PoolTopIndicators current={current} freePlaces={freePlaces} />
          <div
            className="pool-section-row"
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 32,
              justifyContent: "flex-start",
              alignItems: "stretch",
              maxWidth: gridMaxWidth,
              marginLeft: gridLeftOffset,
            }}
          >
            <div className="pool-section-col" style={{ flexBasis: 0, flexGrow: 7, maxWidth: "70%" }}>
              <PoolWorkload compact onHourSelect={handleSelectHour} />
            </div>
            <div className="pool-section-col" style={{ flexBasis: 0, flexGrow: 3, maxWidth: "30%" }}>
              <BookingApp />
            </div>
          </div>
        </div>

        {/* ВАРИАНТ 2 */}
        <div style={{ display: tab === "workload-integration" ? "block" : "none" }}>
          <PoolTopIndicators current={current} freePlaces={freePlaces} />
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 32,
              justifyContent: "flex-start",
              alignItems: "stretch",
              marginLeft: gridLeftOffset,
              maxWidth: gridMaxWidth,
            }}
          >
            <div style={{ flex: "7 1 0", maxWidth: "70%" }}>
              <PoolWorkloadBookingIntegrated onSelectSlot={handleSelectHour} />
            </div>
            <div style={{ flex: "3 1 0", maxWidth: "30%" }}>
              <QuickBookingFlow
                virtualSlot={selectedSlot}
                onReset={resetFlow}
                hintWhenNoSlot="Наведите на столбец и нажмите 'Забронировать'"
              />
            </div>
          </div>
        </div>

        {/* ВАРИАНТ 3 */}
        <div style={{ display: tab === "heatmap-integration" ? "block" : "none" }}>
          <PoolTopIndicators current={current} freePlaces={freePlaces} />
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 32,
              justifyContent: "flex-start",
              alignItems: "stretch",
              marginLeft: gridLeftOffset,
              maxWidth: gridMaxWidth,
            }}
          >
            <div style={{ flex: "7 1 0", maxWidth: "70%" }}>
              <PoolHeatmapBookingIntegratedFull onSelectSlot={handleSelectHour} />
            </div>
            <div style={{ flex: "3 1 0", maxWidth: "30%" }}>
              <QuickBookingFlow
                virtualSlot={selectedSlot}
                onReset={resetFlow}
                hintWhenNoSlot="Кликните на клетку и нажмите 'Забронировать'"
              />
            </div>
          </div>
        </div>

        {/* ВАРИАНТ 4: Колеса и бронирование в один flex-row */}
        <div style={{ display: tab === "wheel-integration" ? "block" : "none" }}>
          <PoolTopIndicators current={current} freePlaces={freePlaces} />
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 32,
              justifyContent: "flex-start",
              alignItems: "stretch",
              marginLeft: gridLeftOffset,
              maxWidth: gridMaxWidth,
              width: `calc(100% - ${gridLeftOffset}px)`,
            }}
          >
            <div style={{ flex: "7 1 0", maxWidth: "70%" }}>
              <PoolWheelBookingIntegratedFull
                onSelectSlot={handleSelectHour}
                virtualSlot={selectedSlot}
                onReset={resetFlow}
              />
            </div>
            {/* QuickBookingFlow теперь внутри PoolWheelBookingIntegratedFull */}
          </div>
        </div>
      </div>

      {/* Статус внизу */}
      <div style={{ padding: "8px 12px", fontSize: 13, color: "rgba(0,0,0,0.55)" }}>
        {headerStatus}
      </div>
    </div>
  );
}