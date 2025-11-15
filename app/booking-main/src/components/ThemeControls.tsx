import React from "react";

const FONT_FAMILIES = [
  { label: "Segoe UI", value: "'Segoe UI', Arial, sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Roboto", value: "'Roboto', Arial, sans-serif" },
  { label: "Montserrat", value: "'Montserrat', Arial, sans-serif" },
];
const COLOR_PRESETS = [
  { label: "Синий", value: "#185a90" },
  { label: "Фиолетовый", value: "#7a3fa9" },
  { label: "Зелёный", value: "#1c8a4c" },
  { label: "Оранжевый", value: "#ff8100" },
  { label: "Чёрный", value: "#222" },
];

function setRootVar(name: string, value: string) {
  document.documentElement.style.setProperty(name, value);
}

export default function ThemeControls() {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
        alignItems: "center",
        padding: "14px 16px",
        background: "rgba(255,255,255,0.4)",
        borderRadius: 10,
        margin: "16px auto",
        width: "fit-content",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        zIndex: 1000,
      }}
    >
      <label>
        Шрифт:&nbsp;
        <select
          onChange={e => setRootVar("--theme-font-family", e.target.value)}
          defaultValue={FONT_FAMILIES[0].value}
        >
          {FONT_FAMILIES.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </label>
      <label>
        Размер:&nbsp;
        <input
          type="range"
          min={14}
          max={32}
          defaultValue={20}
          onChange={e => setRootVar("--theme-font-size", e.target.value + "px")}
        />
      </label>
      <label>
        Цвет текста:&nbsp;
        <select
          onChange={e => setRootVar("--theme-color", e.target.value)}
          defaultValue={COLOR_PRESETS[0].value}
        >
          {COLOR_PRESETS.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </label>
      <label>
        Цвет активной:&nbsp;
        <select
          onChange={e => setRootVar("--theme-bg-active", e.target.value)}
          defaultValue={COLOR_PRESETS[0].value}
        >
          {COLOR_PRESETS.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </label>
      <label>
        Цвет активного текста:&nbsp;
        <input
          type="color"
          defaultValue="#ffffff"
          onChange={e => setRootVar("--theme-color-active", e.target.value)}
        />
      </label>
      <label>
        Скругление:&nbsp;
        <input
          type="range"
          min={0}
          max={30}
          defaultValue={12}
          onChange={e => setRootVar("--theme-radius", e.target.value + "px")}
        />
      </label>
      <label>
        Гор. паддинг:&nbsp;
        <input
          type="range"
          min={8}
          max={60}
          defaultValue={26}
          onChange={e => setRootVar("--theme-padding-h", e.target.value + "px")}
        />
      </label>
      <label>
        Мин ширина:&nbsp;
        <input
          type="range"
          min={80}
          max={320}
          defaultValue={150}
          onChange={e => setRootVar("--theme-min-width", e.target.value + "px")}
        />
      </label>
      <label>
        Фон страницы:&nbsp;
        <input
          type="color"
          defaultValue="#f6fafd"
          onChange={e => setRootVar("--theme-page-bg", e.target.value)}
        />
      </label>
    </div>
  );
}