import React from "react";
import PoolWorkload from "./PoolWorkloadIndicators";
import TemperatureWidget from "./TemperatureWidget";

export default function IndicatorsRow() {
  return (
    <div className="pool-indicators-row" style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
      <PoolWorkload />
      <TemperatureWidget />
    </div>
  );
}