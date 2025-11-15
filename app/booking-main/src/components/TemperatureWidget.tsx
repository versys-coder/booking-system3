import React, { useState, useEffect } from "react";
import { Box, Typography, Paper, Collapse } from "@mui/material";

const TEMP_CARD_ORDER = ["Тренировочный", "Детский", "Демонстрационный", "Прыжковый"];

export type TemperatureWidgetMode = "full" | "mini";
type TemperatureWidgetProps = {
  mode?: TemperatureWidgetMode;
  scale?: number;
};

export function TemperatureWidget({ mode = "full", scale = 1 }: TemperatureWidgetProps) {
  const [temps, setTemps] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/api/pools-temps")
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        setTemps(data || {});
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const isMini = mode === "mini";

  const wrapperStyle: React.CSSProperties = {
    minWidth: isMini ? 160 * scale : 230 * scale,
    maxWidth: open ? 720 * scale : (isMini ? 260 * scale : 320 * scale),
    transition: "max-width 260ms cubic-bezier(.2,.9,.2,1)",
    cursor: "pointer",
    display: "inline-block",
    background: "#fff",
    borderRadius: 32,
    boxShadow: "0 2px 18px #185a9020",
    border: "none"
  };

  const paperStyle: React.CSSProperties = {
    borderRadius: 32,
    padding: isMini ? "10px 18px" : "20px 26px",
    minWidth: isMini ? 160 * scale : 230 * scale,
    maxWidth: open ? 720 * scale : (isMini ? 260 * scale : 320 * scale),
    height: isMini ? 96 * scale : 180 * scale,
    display: "flex",
    alignItems: "center",
    justifyContent: open ? "flex-start" : "center",
    flexDirection: "row",
    gap: open ? 20 * scale : 0,
    overflow: "hidden",
    boxShadow: "none",
    background: "transparent"
  };

  const titleFont = isMini ? 16 * scale : 22 * scale;
  const valueFont = isMini ? 37 * scale : 58 * scale;
  const subFont = isMini ? 15 * scale : 20 * scale;

  return (
    <div
      style={wrapperStyle}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((v) => !v);
      }}
      role="button"
      aria-expanded={open}
    >
      <Paper style={paperStyle} elevation={0}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            minWidth: isMini ? 90 * scale : 160 * scale,
            pr: open ? 3 * scale : 0,
            borderRight: open ? "1.5px solid #eaf1f8" : "none",
            userSelect: "none",
          }}
        >
          <Typography
            sx={{
              fontSize: titleFont,
              fontWeight: 800,
              color: "#185a90",
              textTransform: "uppercase",
              letterSpacing: ".04em",
              marginBottom: 1
            }}
          >
            Температура
          </Typography>

          <Typography
            sx={{
              fontSize: valueFont,
              fontWeight: 900,
              color: "#222",
              lineHeight: 1,
              marginTop: 2 * scale
            }}
          >
            {loading ? "…" : temps["Тренировочный"] != null ? `${temps["Тренировочный"]!.toFixed(1)}°C` : "—"}
          </Typography>

          <Typography
            sx={{
              fontSize: subFont,
              color: "#222",
              fontWeight: 800,
              marginTop: 2 * scale,
              textTransform: "lowercase"
            }}
          >
            тренировочный
          </Typography>
        </Box>

        <Collapse in={open} orientation="horizontal" timeout={260}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 12 * scale, paddingLeft: 18 * scale }}>
            {TEMP_CARD_ORDER.filter((p) => p !== "Тренировочный").map((pool) => (
              <Box key={pool} sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <Typography sx={{ fontSize: 15 * scale, color: "#185a90", fontWeight: 700 }}>{pool}</Typography>
                <Typography sx={{ fontSize: 22 * scale, fontWeight: 900, color: "#222" }}>
                  {loading ? "…" : temps[pool] != null ? `${temps[pool]!.toFixed(1)}°C` : "—"}
                </Typography>
              </Box>
            ))}
          </Box>
        </Collapse>
      </Paper>
    </div>
  );
}

export default TemperatureWidget;