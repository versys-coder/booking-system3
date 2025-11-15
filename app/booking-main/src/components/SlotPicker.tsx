import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Typography, Button, CircularProgress, IconButton } from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";

export interface Slot {
  appointment_id: string;
  start_date: string; // "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
  service_id: string;
  [key: string]: any;
}

const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] as const;
const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
] as const;

interface SlotPickerProps {
  slotsByDate: Record<string, Slot[]>;
  calendarDates: string[];
  currentDateIdx: number;
  setCurrentDateIdx: React.Dispatch<React.SetStateAction<number>>;
  selectedSlot: Slot | null;
  setSelectedSlot: React.Dispatch<React.SetStateAction<Slot | null>>;
  isLoading: boolean;
  onBook: (slot: Slot) => void;
}

const ALL_TIMES = [
  "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00",
  "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"
];

function parseDateTime(dateIso: string, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(`${dateIso}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

function formatDatePretty(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} (${WEEKDAYS[d.getDay()]})`;
}

const SlotPicker: React.FC<SlotPickerProps> = ({
  slotsByDate,
  calendarDates,
  currentDateIdx,
  setCurrentDateIdx,
  selectedSlot,
  setSelectedSlot,
  isLoading,
  onBook,
}) => {
  const [localSlot, setLocalSlot] = useState<Slot | null>(null);

  useEffect(() => {
    setLocalSlot(null);
  }, [currentDateIdx, slotsByDate]);

  const nowLocal = useMemo(() => new Date(), []);
  const nowLocalDateString = useMemo(() => nowLocal.toISOString().split("T")[0], [nowLocal]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedDate = calendarDates[currentDateIdx];
  const slotList = slotsByDate[selectedDate] || [];

  const slotsByTime = useMemo(() => {
    const dict: Record<string, Slot> = {};
    for (const slot of slotList) {
      const dt = new Date(slot.start_date.replace(" ", "T"));
      const hhmm = dt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
      if (!dict[hhmm]) dict[hhmm] = slot;
    }
    return dict;
  }, [slotList]);

  const isWorkingDay = useMemo(() => {
    const d = new Date(selectedDate + "T00:00:00");
    const day = d.getDay();
    return day >= 1 && day <= 5;
  }, [selectedDate]);

  const handlePrevDate = useCallback(() => {
    setCurrentDateIdx((i) => Math.max(i - 1, 0));
    setLocalSlot(null);
    if (setSelectedSlot) setSelectedSlot(null);
  }, [setCurrentDateIdx, setSelectedSlot]);

  const handleNextDate = useCallback(() => {
    setCurrentDateIdx((i) => Math.min(i + 1, calendarDates.length - 1));
    setLocalSlot(null);
    if (setSelectedSlot) setSelectedSlot(null);
  }, [setCurrentDateIdx, setSelectedSlot, calendarDates.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onKey(e: KeyboardEvent) {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        const times = ALL_TIMES;
        let currentIdx = -1;
        if (localSlot) {
          const dt = new Date(localSlot.start_date.replace(" ", "T"));
          const t = dt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
          currentIdx = times.indexOf(t);
        }
        let targetIdx = currentIdx;
        if (e.key === "ArrowLeft") targetIdx = Math.max(0, currentIdx === -1 ? 0 : currentIdx - 1);
        if (e.key === "ArrowRight") targetIdx = Math.min(times.length - 1, currentIdx === -1 ? 0 : currentIdx + 1);
        if (e.key === "ArrowUp") targetIdx = Math.max(0, (currentIdx === -1 ? 0 : currentIdx) - 3);
        if (e.key === "ArrowDown") targetIdx = Math.min(times.length - 1, (currentIdx === -1 ? 0 : currentIdx) + 3);

        for (let i = targetIdx; i < times.length; i++) {
          const time = times[i];
          const slot = slotsByTime[time];
          const inactive = isWorkingDay && time === "12:00";
          const slotDate = parseDateTime(selectedDate, time);
          const past = selectedDate === nowLocalDateString && slotDate < nowLocal;
          if (slot && !inactive && !past) {
            setLocalSlot(slot);
            return;
          }
        }
        for (let i = targetIdx; i >= 0; i--) {
          const time = times[i];
          const slot = slotsByTime[time];
          const inactive = isWorkingDay && time === "12:00";
          const slotDate = parseDateTime(selectedDate, time);
          const past = selectedDate === nowLocalDateString && slotDate < nowLocal;
          if (slot && !inactive && !past) {
            setLocalSlot(slot);
            return;
          }
        }
      }
    }
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [localSlot, slotsByTime, isWorkingDay, selectedDate, nowLocalDateString, nowLocal]);

  const InactiveTimeSlot: React.FC<{ time: string; reason?: string }> = ({ time }) => (
    <Button
      disabled
      variant="outlined"
      sx={{
        minWidth: 86,
        height: 44,
        borderRadius: 12,
        color: "#9fb6c9",
        borderColor: "#eef6fb",
        background: "#fcfeff",
        fontWeight: 800,
        opacity: 0.7,
        textTransform: "none",
      }}
    >
      {time}
    </Button>
  );

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={48} />
      </Box>
    );
  }
  if (!calendarDates || calendarDates.length === 0) return null;

  return (
    <Box ref={containerRef} tabIndex={0} sx={{ outline: "none" }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", mb: 2, mt: 1 }}>
        <IconButton
          onClick={handlePrevDate}
          disabled={currentDateIdx === 0}
          size="small"
          aria-label="previous date"
          sx={{ borderRadius: 1, mr: 1 }}
        >
          <ArrowBackIosNewIcon fontSize="small" />
        </IconButton>

        <Typography
          align="center"
          sx={{
            fontWeight: 800,
            fontSize: 20,
            mx: 2,
            color: "#185a90",
            letterSpacing: "0.01em",
          }}
        >
          {formatDatePretty(selectedDate)}
        </Typography>

        <IconButton
          onClick={handleNextDate}
          disabled={currentDateIdx === calendarDates.length - 1}
          size="small"
          aria-label="next date"
          sx={{ borderRadius: 1, ml: 1 }}
        >
          <ArrowForwardIosIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 1.5,
          mb: 2,
        }}
      >
        {ALL_TIMES.map((time) => {
          if (isWorkingDay && time === "12:00") {
            return <InactiveTimeSlot key={time} time={time} reason="break" />;
          }
          const slot = slotsByTime[time];
          if (!slot) {
            return <InactiveTimeSlot key={time} time={time} />;
          }
          const slotDate = parseDateTime(selectedDate, time);
          if (selectedDate === nowLocalDateString && slotDate < nowLocal) {
            return <InactiveTimeSlot key={time} time={time} />;
          }
          const isSelected = localSlot?.appointment_id === slot.appointment_id;
          return (
            <Button
              key={time}
              onClick={() => {
                setLocalSlot(slot);
              }}
              variant={isSelected ? "contained" : "outlined"}
              color={isSelected ? "primary" : "inherit"}
              aria-pressed={isSelected}
              sx={{
                minWidth: 86,
                height: 44,
                borderRadius: 12,
                textTransform: "none",
                fontWeight: 800,
                borderColor: isSelected ? "transparent" : "#e6f3fb",
                background: isSelected ? "linear-gradient(180deg,#2f6fbf,#185a90)" : "#fff",
                color: isSelected ? "#fff" : "#185a90",
                boxShadow: isSelected ? "0 6px 18px rgba(24,90,144,0.18)" : "none",
                transition: "transform 120ms ease, box-shadow 140ms ease",
                "&:hover": { transform: "translateY(-2px)" },
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                px: 2,
              }}
            >
              {time}
            </Button>
          );
        })}
      </Box>

      {localSlot ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              onBook(localSlot);
            }}
            sx={{
              minWidth: 200,
              borderRadius: 14,
              fontWeight: 900,
              fontSize: 18,
              py: 1.2,
              boxShadow: "0 4px 18px #185a9032",
              letterSpacing: ".02em"
            }}
          >
            Забронировать
          </Button>
        </Box>
      ) : (
        <Typography
          align="center"
          sx={{
            mt: 1,
            fontSize: 15,
            color: "#6a8aa6",
            fontWeight: 700,
          }}
        >
          Выберите время для бронирования
        </Typography>
      )}
    </Box>
  );
};

export default SlotPicker;