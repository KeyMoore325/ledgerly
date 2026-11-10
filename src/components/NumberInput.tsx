"use client";

import { useEffect, useState } from "react";

interface Props {
  id: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  step?: number;
  ariaLabel?: string;
  describedBy?: string;
}

/** Text-backed numeric input: lets people type "12." or clear the field without fighting React. */
export function NumberInput({ id, value, onChange, prefix, suffix, min = 0, step = 1, ariaLabel, describedBy }: Props) {
  const [text, setText] = useState(value ? String(value) : "");

  useEffect(() => {
    const parsed = parseFloat(text);
    if ((Number.isNaN(parsed) ? 0 : parsed) !== value) setText(value ? String(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const input = (
    <input
      id={id}
      className="input"
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder="0"
      value={text}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      data-step={step}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.]/g, "");
        setText(raw);
        const n = parseFloat(raw);
        onChange(Number.isNaN(n) ? 0 : Math.max(min, n));
      }}
      style={suffix ? { paddingRight: 28 } : undefined}
    />
  );

  if (!prefix && !suffix) return input;
  return (
    <div className="input-prefix" style={{ position: "relative" }}>
      {prefix && <span aria-hidden="true">{prefix}</span>}
      {input}
      {suffix && (
        <span aria-hidden="true" style={{ left: "auto", right: 10 }}>
          {suffix}
        </span>
      )}
    </div>
  );
}
