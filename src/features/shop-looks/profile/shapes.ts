import type { ProfileShape } from "../../../../convex/lib/looks/profile"

/**
 * Profile photo shapes (CLAUDE.md "Shop looks" → "Profile"): original
 * simple geometry, one path per shape in a 100×100 box, centred on 50,50
 * so a shape can be scaled around its centre (border and halo bands).
 */

/** Eight round petals on a circle, reaching 50 from the centre. */
function flowerPath(): string {
  const petals = 8
  const r0 = 41.5
  const pts = Array.from({ length: petals }, (_, i) => {
    const a = (i / petals) * Math.PI * 2 - Math.PI / 2
    return [50 + r0 * Math.cos(a), 50 + r0 * Math.sin(a)] as const
  })
  const chord = 2 * r0 * Math.sin(Math.PI / petals)
  const lobe = (chord / 2) * 1.06
  const f = (n: number) => n.toFixed(2)
  return `M${f(pts[0][0])} ${f(pts[0][1])}${pts
    .map((_, i) => {
      const [x, y] = pts[(i + 1) % petals]
      return `A${f(lobe)} ${f(lobe)} 0 0 1 ${f(x)} ${f(y)}`
    })
    .join("")}Z`
}

export const PROFILE_SHAPE_PATHS: Record<ProfileShape, string> = {
  circle: "M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z",
  rounded: "M22 0H78A22 22 0 0 1 100 22V78A22 22 0 0 1 78 100H22A22 22 0 0 1 0 78V22A22 22 0 0 1 22 0Z",
  squircle: "M50 0C88 0 100 12 100 50S88 100 50 100S0 88 0 50S12 0 50 0Z",
  flower: flowerPath(),
  arch: "M0 50A50 50 0 0 1 100 50V90A10 10 0 0 1 90 100H10A10 10 0 0 1 0 90Z",
}
