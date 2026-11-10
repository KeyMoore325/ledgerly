"use client";

import { useId, useState } from "react";

/** Small "?" button that reveals a plain-language explanation inline. */
export function InfoTip({ term, children }: { term: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="info-tip">
      <button
        type="button"
        className="info-tip-btn"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`What does ${term} mean?`}
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {open && (
        <span id={id} role="note" className="info-tip-body">
          {children}
        </span>
      )}
    </span>
  );
}
