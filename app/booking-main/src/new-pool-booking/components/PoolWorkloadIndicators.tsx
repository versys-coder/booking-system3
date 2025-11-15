import React, { useEffect, useState } from "react";

// Параметры бассейна (если меняются — вынеси в props)
const TOTAL_LANES = 10;
const LANE_CAPACITY = 12;

interface ApiResponse {
  currentNow: {
    date: string;
    hour: number;
    current: number | null;
    source: string;
  };
  // другие поля не нужны для этой карточки
}

export default function PoolWorkload() {
  const [people, setPeople] = useState<number | null>(null);
  const [free, setFree] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch("/api/pool-workload?start_hour=7&end_hour=21")
      .then((res) => res.json())
      .then((data: ApiResponse) => {
        if (!mounted) return;
        const totalPlaces = TOTAL_LANES * LANE_CAPACITY;
        const current = data.currentNow?.current ?? null;
        setPeople(current);
        setFree(current == null ? null : Math.max(0, totalPlaces - current));
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  return (
    <>
      <div className="pool-indicator-card">
        <div className="pool-indicator-label">В бассейне</div>
        <div className="pool-indicator-value">
          {loading ? "…" : people != null ? people : "—"}
        </div>
        <div className="pool-indicator-desc">сейчас человек</div>
      </div>
      <div className="pool-indicator-card">
        <div className="pool-indicator-label">Свободно мест</div>
        <div className="pool-indicator-value">
          {loading ? "…" : free != null ? free : "—"}
        </div>
        <div className="pool-indicator-desc">мест осталось</div>
      </div>
    </>
  );
}