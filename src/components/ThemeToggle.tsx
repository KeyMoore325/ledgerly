"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type Theme = "light" | "dark" | "system";
const KEY = "budget-planner:theme";
const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };
const ICON: Record<Theme, string> = { system: "monitor", light: "sun", dark: "moon" };

function apply(t: Theme) {
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Theme | null;
      if (saved && ORDER.includes(saved)) setTheme(saved);
    } catch {}
  }, []);

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {}
  };

  return (
    <button
      type="button"
      className="btn btn-ghost icon-btn"
      onClick={cycle}
      aria-label={`${LABEL[theme]}. Click to change theme`}
      title={LABEL[theme]}
    >
      <Icon name={ICON[theme]} />
    </button>
  );
}
