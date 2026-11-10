import Link from "next/link";
import { nav, site } from "@/lib/site";
import { Icon } from "./Icon";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <p style={{ fontWeight: 700, color: "var(--text)" }}>{site.name}</p>
          <p>{site.tagline}. Your budget data stays in this browser.</p>
          <p className="small">
            Ledgerly offers general budgeting guidance, not personalized financial, tax or investment advice.
          </p>
        </div>
        <div>
          <h2>Product</h2>
          <ul>
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href}>{n.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Follow</h2>
          <ul>
            <li>
              <a href="/rss.xml" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <Icon name="rss" size={16} /> RSS feed
              </a>
            </li>
            <li>
              <Link href="/contact">Get in touch</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="container" style={{ marginTop: 24 }}>
        <p className="small">© {new Date().getFullYear()} {site.name}</p>
      </div>
    </footer>
  );
}
