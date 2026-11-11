"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { actions, useStore } from "@/lib/store";

/** Header control: "Sign in" for guests, or a small account menu when signed in. */
export function AccountButton() {
  const { user, mode, accountsEnabled } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!accountsEnabled || mode === "loading") return null;

  if (!user) {
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname === "/login" ? "/planner" : pathname)}`} className="btn btn-secondary btn-sm">
        Sign in
      </Link>
    );
  }

  const label = user.name || user.email.split("@")[0];
  return (
    <div className="account-menu" ref={ref}>
      <button type="button" className="btn btn-ghost btn-sm account-trigger" aria-haspopup="menu" aria-expanded={open}
        aria-controls="account-menu-list" onClick={() => setOpen((o) => !o)}>
        <span className="avatar avatar-sm" aria-hidden="true">{label.slice(0, 1).toUpperCase()}</span>
        <span className="account-name">{label}</span>
      </button>
      {open && (
        <div id="account-menu-list" role="menu" className="account-dropdown">
          <p className="small muted account-email">{user.email}</p>
          <Link role="menuitem" href="/planner">Your planner</Link>
          <Link role="menuitem" href="/profile">Profile &amp; budgets</Link>
          <button role="menuitem" type="button" onClick={async () => {
            setOpen(false);
            await actions.signOut();
            router.push("/");
          }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
