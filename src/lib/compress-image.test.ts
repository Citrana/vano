import { expect, test } from "vitest"
import { fitWithin } from "./compress-image"

test("fitWithin scales the longest side down, never up", () => {
  expect(fitWithin(4000, 3000, 1200)).toEqual({ width: 1200, height: 900 })
  expect(fitWithin(3000, 4000, 1200)).toEqual({ width: 900, height: 1200 })
  expect(fitWithin(800, 600, 1200)).toEqual({ width: 800, height: 600 })
  expect(fitWithin(5000, 10, 1200)).toEqual({ width: 1200, height: 2 })
})
