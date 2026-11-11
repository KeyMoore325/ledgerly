"use client";

import { useState } from "react";

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  id: string;
}

/** Password field with a show/hide toggle. */
export function PasswordInput({ id, ...rest }: Props) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input id={id} className="input" type={show ? "text" : "password"} style={{ paddingRight: 72 }} {...rest} />
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", minHeight: 34 }}
        aria-pressed={show}
        aria-controls={id}
        onClick={() => setShow((s) => !s)}
      >
        {show ? "Hide" : "Show"}
        <span className="sr-only"> password</span>
      </button>
    </div>
  );
}
