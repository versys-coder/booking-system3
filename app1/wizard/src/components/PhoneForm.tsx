import React, { useEffect, useState } from "react";

/**
 * Универсальная заглушка PhoneForm, которая поддерживает обе встречающиеся сигнатуры:
 * - { slot, initialPhone, onBack, onSubmit(phone) }
 * - { value, onChange, onSubmit(), onBack() }
 *
 * Для отладки:
 * - ?pw_skip_phone=1 автоматически пропустит форму (вызовет onSubmit)
 * - кнопка "Skip (debug)" позволяет вручную пропустить
 */

type Slot = { start_date?: string } | null;

type Props = {
  // possible shapes
  slot?: Slot;
  initialPhone?: string;
  value?: string;
  onChange?: (v: string) => void;
  onBack?: () => void;
  // two variants:
  // variant A: onSubmit(phone: string)
  onSubmit?: ((phone?: string) => void) | undefined;
};

function readQueryFlag(name: string) {
  try {
    return new URLSearchParams(window.location.search).get(name) === "1";
  } catch {
    return false;
  }
}

export default function PhoneForm(props: Props) {
  const { slot } = props;
  const initial = (props.initialPhone ?? props.value) || "";
  const [phone, setPhone] = useState<string>(initial);
  const [error, setError] = useState<string | null>(null);

  const autoSkip = readQueryFlag("pw_skip_phone");

  useEffect(() => {
    // if parent manages value via onChange, keep it in sync
    if (props.onChange && props.value !== undefined) {
      setPhone(props.value);
    }
  }, [props.value, props.onChange]);

  useEffect(() => {
    if (autoSkip) {
      // small delay to let parent mount handlers
      const t = setTimeout(() => {
        doSubmit(true);
      }, 120);
      return () => clearTimeout(t);
    }
  }, []); // eslint-disable-line

  function normalize(p: string) {
    return p.replace(/\D/g, "");
  }

  function doSubmit(force = false) {
    const norm = normalize(phone || "");
    // if parent expects onSubmit(phone)
    if (typeof props.onSubmit === "function") {
      // two cases: parent expects phone param or not
      try {
        // if function length >= 1, pass normalized phone, else call without args
        // (defensive - supports both variants)
        if ((props.onSubmit as Function).length >= 1) {
          // validate loosely unless forced
          if (!force && !/^7?\d{10}$/.test(norm) && !/^\d{10}$/.test(norm)) {
            setError("Введите корректный номер (10-11 цифр) или нажмите Skip");
            return;
          }
          (props.onSubmit as (phone: string) => void)(norm);
          return;
        } else {
          (props.onSubmit as () => void)();
          return;
        }
      } catch (e) {
        // swallow
      }
    }
    // fallback: if parent uses onChange + onSubmit() pattern
    if (props.onChange) {
      props.onChange(norm);
    }
    // try to call onSubmit without args
    try { (props.onSubmit as (() => void))?.(); } catch {}
  }

  return (
    <div style={{ textAlign: "center", padding: 12 }}>
      <div style={{ marginBottom: 10 }}>
        <button className="link" onClick={() => props.onBack?.()}>← назад</button>
      </div>

      <h3>Подтверждение брони</h3>
      {slot && <div className="slot-line">Бронируем: {slot.start_date}</div>}

      <div style={{ marginTop: 12 }}>
        <input
          value={phone}
          onChange={(e) => {
            const v = e.target.value;
            setPhone(v);
            if (props.onChange) props.onChange(v);
          }}
          placeholder="+7 (___) ___-__-__"
          className="input"
          aria-label="phone"
        />
      </div>

      {error && <div className="error">{error}</div>}

      <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center" }}>
        <button className="primary" onClick={() => doSubmit(false)}>Отправить SMS</button>
        <button className="secondary" onClick={() => doSubmit(true)} title="Debug skip">Skip (debug)</button>
      </div>

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
        Для отладки: добавьте в URL <code>?pw_skip_phone=1</code> чтобы автоматически пропустить форму.
      </div>
    </div>
  );
}