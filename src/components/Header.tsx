"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { nav, site } from "@/lib/site";
import { Icon } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";
import { AccountButton } from "./AccountButton";

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const links = (
    <ul>
      {nav.map((n) => (
        <li key={n.href}>
          <Link href={n.href} aria-current={isCurrent(n.href) ? "page" : undefined}>
            {n.label}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label={`${site.name} home`}>
          <span className="brand-mark">
            <Icon name="logo" size={18} />
          </span>
          {site.name}
        </Link>
        <nav className="nav" aria-label="Main">
          {links}
        </nav>
        <ThemeToggle />
        <AccountButton />
        <button
          type="button"
          className="btn btn-ghost icon-btn menu-btn"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name={open ? "close" : "menu"} />
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" className="mobile-nav" aria-label="Mobile">
          {links}
        </nav>
      )}
    </header>
  );
}
