import React from "react";

export interface PoolTopIndicatorsProps {
  current: number | null;
  freePlaces: number | null;
  temperature: number | null;
}

export const PoolTopIndicators: React.FC<PoolTopIndicatorsProps> = ({
  current,
  freePlaces,
  temperature,
}) => {
  return (
    <div className="pool-top-indicators">
      <div className="pool-indicator-card">
        <div className="pool-indicator-title">В БАССЕЙНЕ</div>
        <div className="pool-indicator-value">{current == null ? "—" : current}</div>
        <div className="pool-indicator-desc">сейчас человек</div>
      </div>
      <div className="pool-indicator-card">
        <div className="pool-indicator-title">СВОБОДНО</div>
        <div className="pool-indicator-value">{freePlaces == null ? "—" : freePlaces}</div>
        <div className="pool-indicator-desc">мест осталось</div>
      </div>
      <div className="pool-indicator-card">
        <div className="pool-indicator-title">ТЕМПЕРАТУРА</div>
        <div className="pool-indicator-value">
          {temperature == null ? "—" : `${temperature}°C`}
        </div>
        <div className="pool-indicator-desc">тренировочный</div>
      </div>
    </div>
  );
};

export default PoolTopIndicators;