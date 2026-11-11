"use client";

import { useSyncExternalStore } from "react";
import type { RealtimeChannel, Session, User } from "@supabase/supabase-js";
import type { BudgetData, Profile } from "./types";
import { getSupabase } from "./supabase/client";
import { isSupabaseConfigured } from "./supabase/config";

/**
 * Where budgets live:
 * - Guest mode: in this browser (localStorage). Changes broadcast to other tabs
 *   via the `storage` event and a BroadcastChannel.
 * - Signed in: in the person's Supabase account. Edits apply instantly on screen,
 *   save in the background, and stream to their other devices via Realtime.
 */

const KEY = "budget-planner:v1";
const CHANNEL = "budget-planner";
const activeKey = (userId: string) => `budget-planner:active:${userId}`;
const importedKey = (userId: string) => `budget-planner:imported:${userId}`;
const SAVE_DELAY_MS = 700;
const RETRY_DELAY_MS = 5000;

export type Mode = "loading" | "local" | "cloud";
export type SyncStatus = "idle" | "saving" | "saved" | "error";
export interface AccountUser {
  id: string;
  email: string;
  name: string;
}

interface State {
  mode: Mode;
  user: AccountUser | null;
  profiles: Profile[];
  activeId: string | null;
  sync: SyncStatus;
  /** Guest budgets on this device that haven't been added to the account yet. */
  guestBudgetsToImport: number;
  /** A one-off friendly message, e.g. after budgets were moved into the account. */
  notice: string | null;
  loadError: string | null;
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

export const DEFAULT_BUDGET_NAME = "My budget";

/** Avatar letter: the person's name if they gave one, otherwise the budget's. */
export const profileInitial = (p: Pick<Profile, "name" | "budgetName">) =>
  (p.name.trim() || p.budgetName.trim() || "?").slice(0, 1).toUpperCase();

function newProfile(names: { name?: string; budgetName?: string }, budget: BudgetData, idx = 0): Profile {
  const now = new Date().toISOString();
  return {
    id: uid(),
    name: names.name?.trim() ?? "",
    budgetName: names.budgetName?.trim() || DEFAULT_BUDGET_NAME,
    email: "",
    currency: "USD",
    color: COLORS[idx % COLORS.length],
    createdAt: now,
    updatedAt: now,
    budget,
  };
}

/**
 * Profiles saved before budgets had their own name used `name` as the budget
 * label. Move that into `budgetName` and leave the person's name blank.
 */
function normalize(p: Profile): Profile {
  if (typeof p.budgetName === "string" && p.budgetName.trim()) return p;
  return { ...p, budgetName: p.name?.trim() || DEFAULT_BUDGET_NAME, name: "" };
}

// ---------------------------------------------------------------------------
// Browser storage (guest mode)

function safeGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota or privacy mode: keep in memory only */
  }
}

/** Guest budgets saved on this device, or null if nothing has been saved yet. */
function readLocal(): { profiles: Profile[]; activeId: string | null } | null {
  try {
    const raw = safeGet(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { profiles: Profile[]; activeId: string | null };
    if (!Array.isArray(parsed.profiles) || parsed.profiles.length === 0) return null;
    return { profiles: parsed.profiles.map(normalize), activeId: parsed.activeId };
  } catch {
    return null; // corrupt data: fall through to a fresh start
  }
}

function writeLocal(profiles: Profile[], activeId: string | null) {
  safeSet(KEY, JSON.stringify({ profiles, activeId }));
  channel?.postMessage("changed");
}

// ---------------------------------------------------------------------------
// Account storage (signed in)

const COLUMNS = "id,budget_name,currency,color,data,created_at,updated_at";
interface BudgetRow {
  id: string;
  budget_name: string;
  currency: string;
  color: string;
  data: BudgetData;
  created_at: string;
  updated_at: string;
}

function toUser(u: User): AccountUser {
  const meta = (u.user_metadata ?? {}) as { display_name?: string };
  return { id: u.id, email: u.email ?? "", name: meta.display_name ?? "" };
}

function rowToProfile(row: BudgetRow, user: AccountUser): Profile {
  return {
    id: row.id,
    name: user.name,
    budgetName: row.budget_name,
    email: user.email,
    currency: row.currency,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    budget: { ...emptyBudget(), ...(row.data ?? {}) },
  };
}

function profileToRow(p: Profile) {
  return {
    budget_name: p.budgetName.trim().slice(0, 60) || DEFAULT_BUDGET_NAME,
    currency: /^[A-Z]{3}$/.test(p.currency) ? p.currency : "USD",
    color: /^#[0-9A-Fa-f]{6}$/.test(p.color) ? p.color : COLORS[0],
    data: p.budget,
  };
}

// ---------------------------------------------------------------------------
// State plumbing

const EMPTY: State = {
  mode: "loading",
  user: null,
  profiles: [],
  activeId: null,
  sync: "idle",
  guestBudgetsToImport: 0,
  notice: null,
  loadError: null,
};
let state: State = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null = null;
let realtime: RealtimeChannel | null = null;
let loadingUserId: string | null = null;

const pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();
const inFlight = new Set<string>();
let nameTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  emit();
}

function enterLocal() {
  teardownCloud();
  const local = readLocal();
  let profiles = local?.profiles ?? [];
  let activeId = local?.activeId ?? null;
  if (profiles.length === 0) {
    const p = newProfile({}, sampleBudget());
    profiles = [p];
    activeId = p.id;
  }
  state = { ...EMPTY, mode: "local", profiles, activeId };
  emit();
}

function teardownCloud() {
  pendingSaves.forEach((t) => clearTimeout(t));
  pendingSaves.clear();
  inFlight.clear();
  if (nameTimer) clearTimeout(nameTimer);
  nameTimer = null;
  loadingUserId = null;
  if (realtime) {
    getSupabase()?.removeChannel(realtime);
    realtime = null;
  }
}

async function enterCloud(session: Session) {
  const sb = getSupabase();
  if (!sb) return;
  const user = toUser(session.user);
  if (loadingUserId === user.id || (state.mode === "cloud" && state.user?.id === user.id)) return;
  teardownCloud();
  loadingUserId = user.id;
  setState({ mode: "loading", user, loadError: null });

  const { data, error } = await sb.from("budgets").select(COLUMNS).order("created_at");
  if (loadingUserId !== user.id) return; // signed out or switched while loading
  if (error) {
    loadingUserId = null;
    setState({ mode: "cloud", profiles: [], loadError: "We couldn't load your budgets just now. Check your connection and refresh the page." });
    return;
  }

  let rows = (data ?? []) as BudgetRow[];
  const guest = readLocal();
  const alreadyImported = safeGet(importedKey(user.id)) === "1";
  let notice: string | null = null;
  let guestBudgetsToImport = 0;

  if (rows.length === 0) {
    // First visit to this account: bring this device's budgets along, or start one.
    const seed =
      guest && !alreadyImported
        ? guest.profiles.map((p) => ({ ...profileToRow(p), id: uid() }))
        : [{ ...profileToRow(newProfile({}, emptyBudget())), id: uid() }];
    const inserted = await sb.from("budgets").insert(seed).select(COLUMNS);
    if (loadingUserId !== user.id) return;
    if (inserted.error) {
      loadingUserId = null;
      setState({ mode: "cloud", profiles: [], loadError: "We couldn't set up your account's first budget. Please refresh and try again." });
      return;
    }
    rows = inserted.data as BudgetRow[];
    if (guest && !alreadyImported) {
      safeSet(importedKey(user.id), "1");
      notice =
        guest.profiles.length === 1
          ? "We moved the budget from this device into your account. It's safe now! 🎉"
          : `We moved ${guest.profiles.length} budgets from this device into your account. They're safe now! 🎉`;
    }
  } else if (guest && !alreadyImported) {
    guestBudgetsToImport = guest.profiles.length;
  }

  const profiles = rows.map((r) => rowToProfile(r, user));
  const savedActive = safeGet(activeKey(user.id));
  const activeId = profiles.some((p) => p.id === savedActive) ? savedActive : profiles[0]?.id ?? null;

  loadingUserId = null;
  state = { ...EMPTY, mode: "cloud", user, profiles, activeId, sync: "saved", guestBudgetsToImport, notice };
  emit();
  subscribeRealtime(user);
}

function subscribeRealtime(user: AccountUser) {
  const sb = getSupabase();
  if (!sb) return;
  const table = { schema: "public", table: "budgets" } as const;
  realtime = sb
    .channel(`budgets:${user.id}`)
    .on("postgres_changes", { event: "INSERT", ...table, filter: `user_id=eq.${user.id}` }, (p) =>
      applyRemoteRow(p.new as BudgetRow),
    )
    .on("postgres_changes", { event: "UPDATE", ...table, filter: `user_id=eq.${user.id}` }, (p) =>
      applyRemoteRow(p.new as BudgetRow),
    )
    // Delete events can't be filtered and only carry the row id, so ignore ids we don't have.
    .on("postgres_changes", { event: "DELETE", ...table }, (p) => applyRemoteDelete((p.old as { id?: string }).id))
    .subscribe();
}

function applyRemoteRow(row: BudgetRow) {
  if (state.mode !== "cloud" || !state.user) return;
  // Our own unsaved edits win; the server will catch up when they save.
  if (pendingSaves.has(row.id) || inFlight.has(row.id)) return;
  const incoming = rowToProfile(row, state.user);
  const exists = state.profiles.some((p) => p.id === row.id);
  setState({
    profiles: exists ? state.profiles.map((p) => (p.id === row.id ? incoming : p)) : [...state.profiles, incoming],
    activeId: state.activeId ?? incoming.id,
  });
}

function applyRemoteDelete(id: string | undefined) {
  if (!id || state.mode !== "cloud" || !state.profiles.some((p) => p.id === id)) return;
  const profiles = state.profiles.filter((p) => p.id !== id);
  setState({ profiles, activeId: state.activeId === id ? profiles[0]?.id ?? null : state.activeId });
}

function scheduleSave(id: string) {
  const existing = pendingSaves.get(id);
  if (existing) clearTimeout(existing);
  pendingSaves.set(id, setTimeout(() => void flush(id), SAVE_DELAY_MS));
  if (state.sync !== "saving") setState({ sync: "saving" });
}

async function flush(id: string) {
  pendingSaves.delete(id);
  const sb = getSupabase();
  const p = state.profiles.find((x) => x.id === id);
  if (!sb || !p || state.mode !== "cloud") return;
  inFlight.add(id);
  const { error } = await sb.from("budgets").update(profileToRow(p)).eq("id", id);
  inFlight.delete(id);
  if (error) {
    setState({ sync: "error" });
    setTimeout(() => {
      if (state.mode === "cloud" && !pendingSaves.has(id)) scheduleSave(id);
    }, RETRY_DELAY_MS);
    return;
  }
  if (pendingSaves.size === 0 && inFlight.size === 0) setState({ sync: "saved" });
}

async function flushAll() {
  const ids = [...pendingSaves.keys()];
  ids.forEach((id) => clearTimeout(pendingSaves.get(id)));
  await Promise.all(ids.map((id) => flush(id)));
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;

  // Cross-tab sync for guest mode
  window.addEventListener("storage", (e) => {
    if (e.key === KEY && state.mode === "local") enterLocal();
  });
  if ("BroadcastChannel" in window) {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => {
      if (state.mode === "local") enterLocal();
    };
  }
  // Warn before closing the tab if an edit hasn't reached the account yet.
  window.addEventListener("beforeunload", (e) => {
    if (pendingSaves.size || inFlight.size) e.preventDefault();
  });

  const sb = getSupabase();
  if (!sb) {
    enterLocal();
    return;
  }
  sb.auth.onAuthStateChange((event, session) => {
    // Supabase recommends not calling other Supabase APIs synchronously inside this callback.
    setTimeout(() => {
      if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !session)) {
        enterLocal();
      } else if (session && (event === "INITIAL_SESSION" || event === "SIGNED_IN")) {
        void enterCloud(session);
      } else if (session && event === "USER_UPDATED" && state.mode === "cloud") {
        const user = toUser(session.user);
        setState({ user, profiles: state.profiles.map((p) => ({ ...p, name: user.name, email: user.email })) });
      }
    }, 0);
  });
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
  return {
    ...s,
    active,
    ready: s.mode !== "loading" && s.profiles.length > 0,
    accountsEnabled: isSupabaseConfigured,
  };
}

// ---------------------------------------------------------------------------
// Actions

function activeIdOrFirst() {
  return state.activeId ?? state.profiles[0]?.id ?? null;
}

/** Replace one profile in state, then persist it the right way for the current mode. */
function changeProfile(id: string, fn: (p: Profile) => Profile) {
  const profiles = state.profiles.map((p) => (p.id === id ? { ...fn(p), updatedAt: new Date().toISOString() } : p));
  setState({ profiles });
  if (state.mode === "cloud") scheduleSave(id);
  else writeLocal(profiles, state.activeId);
}

async function insertCloud(profiles: Profile[]): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !state.user) return false;
  const user = state.user;
  const withIds = profiles.map((p) => ({ ...p, id: uid(), name: user.name, email: user.email }));
  withIds.forEach((p) => inFlight.add(p.id));
  setState({ profiles: [...state.profiles, ...withIds], activeId: withIds[withIds.length - 1]?.id ?? state.activeId });
  const { error } = await sb.from("budgets").insert(withIds.map((p) => ({ ...profileToRow(p), id: p.id })));
  withIds.forEach((p) => inFlight.delete(p.id));
  if (error) {
    const ids = new Set(withIds.map((p) => p.id));
    const remaining = state.profiles.filter((p) => !ids.has(p.id));
    setState({ profiles: remaining, activeId: remaining[0]?.id ?? null, notice: "That didn't save to your account. Please try again." });
    return false;
  }
  if (state.user) safeSet(activeKey(state.user.id), state.activeId ?? "");
  return true;
}

export const actions = {
  updateBudget(updater: (b: BudgetData) => BudgetData) {
    const id = activeIdOrFirst();
    if (id) changeProfile(id, (p) => ({ ...p, budget: updater(p.budget) }));
  },

  updateProfile(id: string, patch: Partial<Pick<Profile, "name" | "budgetName" | "email" | "currency" | "color">>) {
    if (state.mode !== "cloud") {
      changeProfile(id, (p) => ({ ...p, ...patch }));
      return;
    }
    // Signed in: your name belongs to the account; email is managed by sign-in.
    const { name, email: _email, ...budgetFields } = patch;
    void _email;
    if (name !== undefined && state.user) {
      const user = { ...state.user, name };
      setState({ user, profiles: state.profiles.map((p) => ({ ...p, name })) });
      if (nameTimer) clearTimeout(nameTimer);
      nameTimer = setTimeout(() => {
        void getSupabase()?.auth.updateUser({ data: { display_name: name.trim() } });
      }, SAVE_DELAY_MS);
    }
    if (Object.keys(budgetFields).length) changeProfile(id, (p) => ({ ...p, ...budgetFields }));
  },

  createProfile(names: { name?: string; budgetName?: string }, withSample: boolean) {
    const p = newProfile(
      { name: names.name, budgetName: names.budgetName || "New budget" },
      withSample ? sampleBudget() : emptyBudget(),
      state.profiles.length,
    );
    if (state.mode === "cloud") {
      void insertCloud([p]);
      return;
    }
    const profiles = [...state.profiles, p];
    setState({ profiles, activeId: p.id });
    writeLocal(profiles, p.id);
  },

  switchProfile(id: string) {
    setState({ activeId: id });
    if (state.mode === "cloud" && state.user) safeSet(activeKey(state.user.id), id);
    else writeLocal(state.profiles, id);
  },

  deleteProfile(id: string) {
    const profiles = state.profiles.filter((p) => p.id !== id);
    const activeId = state.activeId === id ? profiles[0]?.id ?? null : state.activeId;

    if (state.mode === "cloud") {
      const t = pendingSaves.get(id);
      if (t) clearTimeout(t);
      pendingSaves.delete(id);
      setState({ profiles, activeId });
      void getSupabase()
        ?.from("budgets")
        .delete()
        .eq("id", id)
        .then(({ error }) => {
          if (error) setState({ notice: "We couldn't delete that budget. Please refresh and try again." });
        });
      if (profiles.length === 0) void insertCloud([newProfile({}, emptyBudget())]);
      return;
    }

    if (profiles.length === 0) {
      const p = newProfile({}, emptyBudget());
      setState({ profiles: [p], activeId: p.id });
      writeLocal([p], p.id);
      return;
    }
    setState({ profiles, activeId });
    writeLocal(profiles, activeId);
  },

  resetToSample() {
    actions.updateBudget(() => sampleBudget());
  },

  exportActive(): string {
    const p = state.profiles.find((x) => x.id === state.activeId) ?? state.profiles[0];
    return JSON.stringify(p, null, 2);
  },

  importProfile(json: string) {
    const parsed = JSON.parse(json) as Profile;
    if (!parsed || typeof parsed !== "object" || !parsed.budget || !Array.isArray(parsed.budget.expenses)) {
      throw new Error("Hmm, that file doesn't look like a Ledgerly budget.");
    }
    const p: Profile = normalize({ ...parsed, id: uid(), updatedAt: new Date().toISOString() });
    if (state.mode === "cloud") {
      void insertCloud([p]);
      return;
    }
    const profiles = [...state.profiles, p];
    setState({ profiles, activeId: p.id });
    writeLocal(profiles, p.id);
  },

  /** Add this device's guest budgets to the signed-in account. */
  async importGuestBudgets() {
    const guest = readLocal();
    if (state.mode !== "cloud" || !state.user || !guest) return;
    const ok = await insertCloud(guest.profiles);
    if (ok && state.user) {
      safeSet(importedKey(state.user.id), "1");
      setState({
        guestBudgetsToImport: 0,
        notice: guest.profiles.length === 1 ? "Done! That budget is now in your account. 🎉" : `Done! ${guest.profiles.length} budgets are now in your account. 🎉`,
      });
    }
  },

  dismissGuestImport() {
    if (state.user) safeSet(importedKey(state.user.id), "1");
    setState({ guestBudgetsToImport: 0 });
  },

  dismissNotice() {
    setState({ notice: null });
  },

  /** Save anything still pending, then sign out. Guest budgets on this device are left as they were. */
  async signOut() {
    await flushAll();
    await getSupabase()?.auth.signOut();
  },
};
