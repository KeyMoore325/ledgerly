"use client";

import { useSyncExternalStore } from "react";
import type { BudgetData, Profile } from "./types";

/**
 * Profiles live in the browser (localStorage), so the planner works with no
 * account or server. Changes broadcast instantly to every open tab via the
 * `storage` event and a BroadcastChannel — that's the "real-time" sync.
 */

const KEY = "budget-planner:v1";
const CHANNEL = "budget-planner";

interface State {
  profiles: Profile[];
  activeId: string | null;
}

const COLORS = ["#2563EB", "#0EA5E9", "#7C3AED", "#059669", "#D97706", "#DB2777"];

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export function sampleBudget(): BudgetData {
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const twoYears = new Date();
  twoYears.setFullYear(twoYears.getFullYear() + 2);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    monthlyIncome: 4800,
    strategy: "avalanche",
    expenses: [
      { id: uid(), name: "Rent", amount: 1550, category: "needs" },
      { id: uid(), name: "Groceries", amount: 420, category: "needs" },
      { id: uid(), name: "Utilities & phone", amount: 210, category: "needs" },
      { id: uid(), name: "Car & transit", amount: 320, category: "needs" },
      { id: uid(), name: "Dining out", amount: 380, category: "wants" },
      { id: uid(), name: "Subscriptions", amount: 75, category: "wants" },
      { id: uid(), name: "Shopping & hobbies", amount: 300, category: "wants" },
    ],
    debts: [
      { id: uid(), name: "Credit card", balance: 4200, apr: 22.9, minPayment: 120 },
      { id: uid(), name: "Car loan", balance: 9800, apr: 6.4, minPayment: 260 },
    ],
    goals: [
      { id: uid(), name: "Emergency fund", target: 9000, saved: 1500, targetDate: iso(nextYear) },
      { id: uid(), name: "Vacation", target: 3000, saved: 200, targetDate: iso(twoYears) },
    ],
  };
}

export function emptyBudget(): BudgetData {
  return { monthlyIncome: 0, strategy: "avalanche", expenses: [], debts: [], goals: [] };
}

function newProfile(name: string, budget: BudgetData, idx = 0): Profile {
  const now = new Date().toISOString();
  return {
    id: uid(),
    name,
    email: "",
    currency: "USD",
    color: COLORS[idx % COLORS.length],
    createdAt: now,
    updatedAt: now,
    budget,
  };
}

// ---------------------------------------------------------------------------

const EMPTY: State = { profiles: [], activeId: null };
let state: State = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;

function read(): State {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      if (Array.isArray(parsed.profiles) && parsed.profiles.length) return parsed;
    }
  } catch {
    /* storage unavailable or corrupt — fall through to a fresh start */
  }
  const p = newProfile("My budget", sampleBudget());
  return { profiles: [p], activeId: p.id };
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  state = read();
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      state = read();
      emit();
    }
  });
  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => {
      state = read();
      emit();
    };
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function commit(next: State) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota or privacy mode: keep in memory only */
  }
  channel?.postMessage("changed");
  emit();
}

function subscribe(l: () => void) {
  ensureLoaded();
  listeners.add(l);
  return () => listeners.delete(l);
}

const getSnapshot = () => {
  ensureLoaded();
  return state;
};
const getServerSnapshot = () => EMPTY;

export function useStore() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const active = s.profiles.find((p) => p.id === s.activeId) ?? s.profiles[0] ?? null;
  return { ...s, active, ready: s.profiles.length > 0 };
}

export const actions = {
  updateBudget(updater: (b: BudgetData) => BudgetData) {
    const s = getSnapshot();
    const id = s.activeId ?? s.profiles[0]?.id;
    commit({
      ...s,
      profiles: s.profiles.map((p) =>
        p.id === id ? { ...p, budget: updater(p.budget), updatedAt: new Date().toISOString() } : p,
      ),
    });
  },
  updateProfile(id: string, patch: Partial<Pick<Profile, "name" | "email" | "currency" | "color">>) {
    const s = getSnapshot();
    commit({
      ...s,
      profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)),
    });
  },
  createProfile(name: string, withSample: boolean) {
    const s = getSnapshot();
    const p = newProfile(name || "New profile", withSample ? sampleBudget() : emptyBudget(), s.profiles.length);
    commit({ profiles: [...s.profiles, p], activeId: p.id });
    return p.id;
  },
  switchProfile(id: string) {
    commit({ ...getSnapshot(), activeId: id });
  },
  deleteProfile(id: string) {
    const s = getSnapshot();
    const profiles = s.profiles.filter((p) => p.id !== id);
    if (profiles.length === 0) {
      const p = newProfile("My budget", emptyBudget());
      commit({ profiles: [p], activeId: p.id });
      return;
    }
    commit({ profiles, activeId: s.activeId === id ? profiles[0].id : s.activeId });
  },
  resetToSample() {
    actions.updateBudget(() => sampleBudget());
  },
  exportActive(): string {
    const s = getSnapshot();
    const p = s.profiles.find((x) => x.id === s.activeId) ?? s.profiles[0];
    return JSON.stringify(p, null, 2);
  },
  importProfile(json: string) {
    const parsed = JSON.parse(json) as Profile;
    if (!parsed || typeof parsed !== "object" || !parsed.budget || !Array.isArray(parsed.budget.expenses)) {
      throw new Error("That file doesn't look like a Budget Planner profile.");
    }
    const s = getSnapshot();
    const p: Profile = { ...parsed, id: uid(), updatedAt: new Date().toISOString() };
    commit({ profiles: [...s.profiles, p], activeId: p.id });
  },
};
