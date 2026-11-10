import type { Metadata } from "next";
import Link from "next/link";
import { articles } from "@/lib/articles";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = {
  title: "Insights",
  description: "Short, practical guides on budgeting, paying off debt and saving toward goals.",
  alternates: { canonical: "/insights" },
};

const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export default function InsightsPage() {
  return (
    <div className="container page">
      <header className="page-head" style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "end" }}>
        <div>
          <p className="eyebrow">Insights</p>
          <h1>Guides for better budgets</h1>
          <p style={{ margin: 0 }}>Short reads on the ideas behind the planner&apos;s suggestions.</p>
        </div>
        <a href="/rss.xml" className="btn btn-secondary btn-sm"><Icon name="rss" size={16} /> Subscribe via RSS</a>
      </header>
      <ul className="article-list">
        {articles.map((a) => (
          <li key={a.slug}>
            <Link href={`/insights/${a.slug}`} className="card article-card">
              <p className="small muted" style={{ marginBottom: 8 }}>
                <time dateTime={a.date}>{fmt(a.date)}</time> · {a.readMinutes} min read
              </p>
              <h2>{a.title}</h2>
              <p>{a.summary}</p>
              <span className="small" style={{ color: "var(--primary)", fontWeight: 600, display: "inline-flex", gap: 6, alignItems: "center" }}>
                Read guide <Icon name="arrow" size={16} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
