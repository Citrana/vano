// @vitest-environment node
import { readdirSync } from "node:fs"
import { join } from "node:path"
import { expect, test } from "vitest"
import { RESERVED_SLUGS } from "../../convex/lib/slug"

/** Top-level URL segments, looking through (group) folders. */
function topLevelSegments(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      if (entry.name.startsWith("(") && entry.name.endsWith(")")) return topLevelSegments(join(dir, entry.name))
      if (entry.name.startsWith("[") || entry.name.startsWith("_")) return []
      return [entry.name]
    })
}

test("every top-level route is a reserved slug, so no shop can shadow it", () => {
  const segments = topLevelSegments(join(__dirname))
  expect(segments.length).toBeGreaterThan(0)
  for (const segment of segments) {
    expect(RESERVED_SLUGS.has(segment), `"${segment}" must be in RESERVED_SLUGS`).toBe(true)
  }
})
