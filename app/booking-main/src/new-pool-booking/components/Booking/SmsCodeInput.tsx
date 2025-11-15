import React, { useEffect, useRef, ChangeEvent } from "react";
import { Box } from "@mui/material";

interface SmsCodeInputProps {
  value: string;
  onChange: (val: string) => void;
  length?: number;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  onComplete?: (val: string) => void;
}

const SmsCodeInput: React.FC<SmsCodeInputProps> = ({
  value,
  onChange,
  length = 4,
  error,
  helperText,
  disabled,
  onComplete,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  useEffect(() => {
    if (value.length === length && !disabled && onComplete) {
      onComplete(value);
    }
  }, [value, disabled, length, onComplete]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (disabled) return;
    const val = e.target.value.replace(/\D/g, "").slice(0, length);
    onChange(val);
  }

  function handleNumPadClick(num: number) {
    if (disabled) return;
    if (value.length < length) {
      const nextValue = (value + num).slice(0, length);
      onChange(nextValue);
    }
  }
  function handleNumPadBackspace() {
    if (disabled) return;
    const nextValue = value.slice(0, -1);
    onChange(nextValue);
  }

  return (
    <Box style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <input
        ref={inputRef}
        className="sms-input"
        value={value}
        onChange={handleChange}
        maxLength={length}
        style={{ marginBottom: 8 }}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
      />
      {error && (
        <div style={{ color: "#d32f2f", fontWeight: 700, marginBottom: 8 }}>
          {helperText}
        </div>
      )}
      <Box className="numpad-row">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            className="numpad-button"
            onClick={() => handleNumPadClick(n)}
            tabIndex={-1}
            disabled={disabled}
            type="button"
          >
            {n}
          </button>
        ))}
      </Box>
      <Box className="numpad-row">
        {[4, 5, 6].map((n) => (
          <button
            key={n}
            className="numpad-button"
            onClick={() => handleNumPadClick(n)}
            tabIndex={-1}
            disabled={disabled}
            type="button"
          >
            {n}
          </button>
        ))}
      </Box>
      <Box className="numpad-row">
        {[7, 8, 9].map((n) => (
          <button
            key={n}
            className="numpad-button"
            onClick={() => handleNumPadClick(n)}
            tabIndex={-1}
            disabled={disabled}
            type="button"
          >
            {n}
          </button>
        ))}
      </Box>
      <Box className="numpad-row">
        <button
          className="numpad-button"
          onClick={handleNumPadBackspace}
          tabIndex={-1}
          disabled={disabled}
          type="button"
        >
          ⌫
        </button>
        <button
          className="numpad-button"
          onClick={() => handleNumPadClick(0)}
          tabIndex={-1}
          disabled={disabled}
          type="button"
        >
          0
        </button>
      </Box>
    </Box>
  );
};

export default SmsCodeInput;