"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";

type Fields = { name: string; email: string; topic: string; message: string; website: string };
const initial: Fields = { name: "", email: "", topic: "feedback", message: "", website: "" };

function validate(f: Fields) {
  const e: Partial<Record<keyof Fields, string>> = {};
  if (!f.name.trim()) e.name = "Please enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Please enter a valid email address.";
  if (f.message.trim().length < 10) e.message = "Please write at least 10 characters.";
  return e;
}

export function ContactForm() {
  const { active } = useStore();
  const [f, setF] = useState<Fields>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [serverError, setServerError] = useState("");
  const statusRef = useRef<HTMLDivElement>(null);
  const prefilled = useRef(false);

  // Pre-fill from the active profile once
  useEffect(() => {
    if (active && !prefilled.current) {
      prefilled.current = true;
      setF((x) => ({ ...x, name: x.name || (active.name !== "My budget" ? active.name : ""), email: x.email || active.email }));
    }
  }, [active]);

  const bind = (k: keyof Fields) => ({
    id: `c-${k}`,
    name: k,
    value: f[k],
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": errors[k] ? `c-${k}-err` : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setF({ ...f, [k]: e.target.value });
      if (errors[k]) setErrors({ ...errors, [k]: undefined });
    },
  });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = validate(f);
    setErrors(v);
    if (Object.keys(v).length) {
      document.getElementById(`c-${Object.keys(v)[0]}`)?.focus();
      return;
    }
    setStatus("sending");
    setServerError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.fieldErrors) setErrors(data.fieldErrors);
        throw new Error(data.error || "Something went wrong.");
      }
      setStatus("sent");
      setF({ ...initial, name: f.name, email: f.email });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    } finally {
      requestAnimationFrame(() => statusRef.current?.focus());
    }
  }

  const err = (k: keyof Fields) => errors[k] && <span id={`c-${k}-err`} className="error-text">{errors[k]}</span>;

  return (
    <form className="card stack" onSubmit={submit} noValidate aria-describedby="c-required">
      <p id="c-required" className="small muted" style={{ margin: 0 }}>All fields are required.</p>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="c-name">Name</label>
          <input className="input" autoComplete="name" required {...bind("name")} />
          {err("name")}
        </div>
        <div className="field">
          <label htmlFor="c-email">Email</label>
          <input className="input" type="email" autoComplete="email" required {...bind("email")} />
          {err("email")}
        </div>
      </div>
      <div className="field">
        <label htmlFor="c-topic">Topic</label>
        <select className="select" {...bind("topic")}>
          <option value="feedback">Feedback</option>
          <option value="question">Question</option>
          <option value="bug">Report a problem</option>
          <option value="other">Something else</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="c-message">Message</label>
        <textarea className="textarea" required maxLength={4000} {...bind("message")} />
        {err("message")}
      </div>
      {/* Honeypot for bots: hidden from people and assistive tech */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
        <label htmlFor="c-website">Website</label>
        <input tabIndex={-1} autoComplete="off" {...bind("website")} />
      </div>
      <div>
        <button type="submit" className="btn btn-primary" disabled={status === "sending"}>
          {status === "sending" ? (<><span className="spinner" aria-hidden="true" /> Sending…</>) : "Send message"}
        </button>
      </div>
      <div ref={statusRef} tabIndex={-1} aria-live="polite">
        {status === "sent" && <p className="notice success" style={{ margin: 0 }}>Thanks! Your message was sent. We usually reply within two business days.</p>}
        {status === "error" && <p className="notice error" style={{ margin: 0 }}>{serverError}</p>}
      </div>
    </form>
  );
}
