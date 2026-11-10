import Link from "next/link";
import { Icon } from "@/components/Icon";
import { site } from "@/lib/site";

const features = [
  { icon: "bolt", title: "Updates as you type", text: "Every number recalculates instantly, and changes sync across your open tabs." },
  { icon: "card", title: "Debt payoff plans", text: "Compare avalanche and snowball on your own balances, with real interest and dates." },
  { icon: "target", title: "Goals with deadlines", text: "See what each goal needs per month, and when you'll get there at today's pace." },
  { icon: "spark", title: "Suggestions that add up", text: "Concrete adjustments sized to your budget, plus optional AI advice from Claude." },
  { icon: "user", title: "Multiple profiles", text: "Keep separate plans for yourself, your household or a what-if scenario." },
  { icon: "shield", title: "Private by default", text: "No sign-up. Your numbers stay in your browser unless you ask Claude for advice." },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: site.name,
  url: site.url,
  description: site.description,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="hero" aria-labelledby="hero-title">
        <div className="container hero-grid">
          <div>
            <p className="eyebrow">Free budget planner</p>
            <h1 id="hero-title">A clear plan for your money, and what to change next.</h1>
            <p className="lead">
              Add your income, expenses, debts and goals. Ledgerly shows where you stand and suggests realistic
              adjustments to reach your goals sooner.
            </p>
            <div className="btn-row">
              <Link href="/planner" className="btn btn-primary">
                Open the planner <Icon name="arrow" size={18} />
              </Link>
              <Link href="/insights" className="btn btn-secondary">
                Read the guides
              </Link>
            </div>
          </div>
          <aside className="card hero-preview" aria-label="Example plan summary">
            <div className="card-head">
              <h2 className="h3" style={{ fontSize: "1rem" }}>Example plan</h2>
              <span className="badge success">Health 90</span>
            </div>
            <div className="preview-row"><span className="muted">Take-home income</span><strong>$4,800</strong></div>
            <div className="preview-row"><span className="muted">Left after bills</span><strong style={{ color: "var(--success)" }}>$1,165</strong></div>
            <div className="preview-row"><span className="muted">Debt-free in</span><strong>1 yr 7 mo</strong></div>
            <div className="preview-row"><span className="muted">Emergency fund</span><strong>On track · Nov 2027</strong></div>
            <p className="small muted" style={{ margin: "12px 0 0" }}>
              Suggestion: put $423/month extra toward the 22.9% credit card. You'd be debt-free 28 months sooner and save
              about $2,700 in interest.
            </p>
          </aside>
        </div>
      </section>

      <section className="container" aria-labelledby="features-title">
        <h2 id="features-title" className="sr-only">Features</h2>
        <ul className="features" style={{ listStyle: "none", margin: 0 }}>
          {features.map((f) => (
            <li key={f.title} className="card feature">
              <div className="feature-icon"><Icon name={f.icon} /></div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </li>
          ))}
        </ul>

        <div className="cta-band">
          <div>
            <h2 style={{ color: "#fff" }}>Build your plan in about five minutes</h2>
            <p>We start you with an example budget. Edit it or clear it and enter your own numbers.</p>
          </div>
          <Link href="/planner" className="btn">Get started</Link>
        </div>
      </section>
      <div style={{ height: 64 }} />
    </>
  );
}
