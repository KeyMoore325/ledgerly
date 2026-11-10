import type { MetadataRoute } from "next";
import { articles } from "@/lib/articles";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/planner", "/insights", "/contact"].map((p) => ({
    url: `${site.url}${p}`,
    changeFrequency: "monthly" as const,
    priority: p === "" ? 1 : 0.7,
  }));
  const posts = articles.map((a) => ({
    url: `${site.url}/insights/${a.slug}`,
    lastModified: a.date,
    changeFrequency: "yearly" as const,
    priority: 0.5,
  }));
  return [...pages, ...posts];
}
