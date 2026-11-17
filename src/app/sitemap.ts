import type { MetadataRoute } from "next"
import { siteUrl } from "@/lib/site"

/** Public marketing pages (shops are discovered through their own links). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  return ["", "/features", "/pricing", "/demo", "/help"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.8,
  }))
}
