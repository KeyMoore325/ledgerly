import { articles } from "@/lib/articles";
import { site } from "@/lib/site";

export const dynamic = "force-static";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function GET() {
  const sorted = [...articles].sort((a, b) => b.date.localeCompare(a.date));
  const items = sorted
    .map((a) => {
      const url = `${site.url}/insights/${a.slug}`;
      const html = a.body.map((p) => (p.startsWith("## ") ? `<h2>${esc(p.slice(3))}</h2>` : `<p>${esc(p)}</p>`)).join("");
      return `    <item>
      <title>${esc(a.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(a.date + "T12:00:00Z").toUTCString()}</pubDate>
      <description>${esc(a.summary)}</description>
      <content:encoded><![CDATA[${html}]]></content:encoded>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${esc(site.name)} Insights</title>
    <link>${site.url}/insights</link>
    <description>${esc(site.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date(sorted[0]?.date + "T12:00:00Z").toUTCString()}</lastBuildDate>
    <atom:link href="${site.url}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
