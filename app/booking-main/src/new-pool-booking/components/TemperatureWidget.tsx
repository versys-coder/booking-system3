import React, { useState, useEffect } from "react";
import { Box, Typography, IconButton, Collapse } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";

const TEMP_CARD_ORDER = ["Тренировочный", "Детский", "Демонстрационный", "Прыжковый"];

export default function TemperatureWidget() {
  const [temps, setTemps] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
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

  // Параметры анимации — меняй тут
  const duration = 500; // ms — длительность анимации раскрытия + появления текста
  const easing = "cubic-bezier(.2,.9,.2,1)";

  const closedWidth = "var(--indicator-card-width)"; // 187px
  const openWidth = "calc(var(--indicator-card-width) * 3.3)";
  const cardRadius = "var(--indicator-card-radius)";
  const cardBg = "var(--indicator-card-bg)";
  const cardShadow = "var(--indicator-card-shadow)";
  const cardPadding = "var(--indicator-card-padding)";

  return (
    <div
      className="pool-indicator-card"
      style={{
        width: open ? openWidth : closedWidth,
        minWidth: open ? openWidth : closedWidth,
        maxWidth: open ? openWidth : closedWidth,
        borderRadius: cardRadius,
        background: cardBg,
        boxShadow: cardShadow,
        padding: cardPadding,
        margin: "0 10px",
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        position: "relative",
        cursor: "pointer",
        transition: `width ${duration}ms ${easing}`,
        overflow: "hidden",
        boxSizing: "border-box",
        willChange: "width",
      }}
      onClick={() => setOpen((v) => !v)}
      role="button"
      aria-expanded={open}
    >
      {/* Левая фиксированная колонка */}
      <Box
        sx={{
          flex: "0 0 auto",
          width: closedWidth,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          pr: 2,
          borderRight: open ? "1px solid #d5dbe2" : "none",
          userSelect: "none",
          boxSizing: "border-box",
        }}
      >
        <div className="pool-indicator-label" style={{ marginBottom: 8, textAlign: "left", width: "100%" }}>
          ТЕМПЕРАТУРА
        </div>

        <div className="pool-indicator-value" style={{ marginBottom: 6, textAlign: "left", width: "100%" }}>
          {loading ? "…" : temps["Тренировочный"] != null ? `${temps["Тренировочный"]!.toFixed(1)}°C` : "—"}
        </div>

        <div className="pool-indicator-desc" style={{ textAlign: "left", width: "100%" }}>
          тренировочный
        </div>
      </Box>

      {/* Правая часть — Collapse + анимация opacity/translateX */}
      <Collapse in={open} orientation="horizontal" timeout={duration} style={{ display: "flex" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 3,
            pl: 2,
            pr: 2,
            flex: "1 1 auto",
            minWidth: 0,
            boxSizing: "border-box",
            // анимируем именно контент: opacity и смещение
            opacity: open ? 1 : 0,
            transform: open ? "translateX(0)" : "translateX(-8px)",
            transition: `opacity ${duration}ms ${easing}, transform ${duration}ms ${easing}`,
            willChange: "opacity, transform",
            pointerEvents: open ? "auto" : "none",
          }}
        >
          {TEMP_CARD_ORDER.filter((p) => p !== "Тренировочный").map((pool) => (
            <Box
              key={pool}
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                minWidth: 70,
                mr: 2,
                boxSizing: "border-box",
              }}
            >
              <Typography
                sx={{
                  color: "var(--indicator-label-color)",
                  font: "700 15px 'Roboto Condensed', Arial, sans-serif",
                  mb: "2px",
                }}
              >
                {pool}
              </Typography>
              <Typography sx={{ color: "var(--indicator-value-color)", font: "700 21px 'Roboto Condensed', Arial, sans-serif" }}>
                {loading ? "…" : temps[pool] != null ? `${temps[pool]!.toFixed(1)}°C` : "—"}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>

      <IconButton
        size="small"
        sx={{
          position: "absolute",
          right: 12,
          top: 12,
          background: "#dde6ee",
          zIndex: 2,
        }}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={open ? "Свернуть" : "Развернуть"}
      >
        {open ? <ChevronLeftIcon /> : <ChevronRightIcon />}
      </IconButton>
    </div>
  );
}