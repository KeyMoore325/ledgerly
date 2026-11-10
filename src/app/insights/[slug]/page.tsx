import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { articles, getArticle } from "@/lib/articles";
import { site } from "@/lib/site";

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = getArticle((await params).slug);
  if (!a) return {};
  return {
    title: a.title,
    description: a.summary,
    alternates: { canonical: `/insights/${a.slug}` },
    openGraph: { type: "article", title: a.title, description: a.summary, publishedTime: a.date },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const a = getArticle((await params).slug);
  if (!a) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.summary,
    datePublished: a.date,
    publisher: { "@type": "Organization", name: site.name },
    mainEntityOfPage: `${site.url}/insights/${a.slug}`,
  };

  return (
    <article className="container narrow page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Breadcrumb" className="small" style={{ marginBottom: 16 }}>
        <Link href="/insights">← All insights</Link>
      </nav>
      <header className="page-head">
        <h1>{a.title}</h1>
        <p className="small" style={{ margin: 0 }}>
          <time dateTime={a.date}>
            {new Date(a.date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </time>{" "}
          · {a.readMinutes} min read
        </p>
      </header>
      <div className="prose">
        {a.body.map((p, i) => (p.startsWith("## ") ? <h2 key={i}>{p.slice(3)}</h2> : <p key={i}>{p}</p>))}
      </div>
      <div className="cta-band" style={{ marginTop: 40 }}>
        <div>
          <h2 style={{ color: "#fff", fontSize: "1.25rem" }}>Try it on your own numbers</h2>
          <p>The planner applies these ideas to your budget automatically.</p>
        </div>
        <Link href="/planner" className="btn">Open the planner</Link>
      </div>
    </article>
  );
}
