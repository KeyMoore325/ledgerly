import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container narrow page" style={{ textAlign: "center" }}>
      <p className="eyebrow">404</p>
      <h1>We couldn&apos;t find that page</h1>
      <p className="muted">It may have moved. Try the planner or the insights library.</p>
      <div className="btn-row" style={{ justifyContent: "center" }}>
        <Link href="/planner" className="btn btn-primary">Open planner</Link>
        <Link href="/insights" className="btn btn-secondary">Insights</Link>
      </div>
    </div>
  );
}
