"use client";

import Link from "next/link";
import { useState } from "react";
import { actions, useStore } from "@/lib/store";

/** One-line save indicator for the planner's welcome card. */
export function SaveStatus() {
  const { mode, sync, accountsEnabled } = useStore();

  if (mode === "cloud") {
    const text =
      sync === "saving"
        ? "Saving to your account…"
        : sync === "error"
          ? "Couldn't save just now. We'll keep trying, so leave this tab open."
          : "Saved to your account, so you can pick up on any device.";
    return (
      <p className={`small save-status ${sync}`} role="status" style={{ margin: 0 }}>
        <span className={`live-dot ${sync === "error" ? "warn" : ""}`} aria-hidden="true" /> {text}
      </p>
    );
  }

  return (
    <p className="small muted save-status" style={{ margin: 0 }}>
      <span className="live-dot" aria-hidden="true" /> Saved on this device as you go.
      {accountsEnabled && (
        <>
          {" "}
          <Link href="/login?mode=signup">Create a free account</Link> to keep it safe and track progress.
        </>
      )}
    </p>
  );
}

/** Friendly banners: what happened to guest budgets, offers to import, and errors. */
export function AccountBanners() {
  const { notice, guestBudgetsToImport, mode } = useStore();
  const [busy, setBusy] = useState(false);

  if (mode !== "cloud") return null;

  return (
    <>
      {notice && (
        <div className="banner success" role="status">
          <p>{notice}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => actions.dismissNotice()}>
            Got it
          </button>
        </div>
      )}
      {guestBudgetsToImport > 0 && (
        <div className="banner" role="region" aria-label="Budgets on this device">
          <p>
            We found {guestBudgetsToImport === 1 ? "a budget" : `${guestBudgetsToImport} budgets`} saved on this device from
            before you signed in. Want to add {guestBudgetsToImport === 1 ? "it" : "them"} to your account?
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn-primary btn-sm" disabled={busy}
              onClick={async () => { setBusy(true); await actions.importGuestBudgets(); setBusy(false); }}>
              {busy ? "Adding…" : "Yes, add to my account"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => actions.dismissGuestImport()}>
              No thanks
            </button>
          </div>
        </div>
      )}
    </>
  );
}
