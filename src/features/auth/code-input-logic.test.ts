import { describe, expect, test } from "vitest"
import { EMPTY_BOX as E, enterDigits, eraseDigit, formatWait, fromBoxes, isFilled, toBoxes, typedDigits } from "./code-input-logic"

describe("code input logic", () => {
  test("value ↔ boxes, spaces mark empty boxes", () => {
    expect(toBoxes("", 6)).toEqual([E, E, E, E, E, E])
    expect(toBoxes("12 4", 6)).toEqual(["1", "2", E, "4", E, E])
    expect(toBoxes("1a2", 3)).toEqual(["1", E, "2"])
    expect(fromBoxes(["1", "2", E, "4", E, E])).toBe("12 4")
    expect(fromBoxes([E, E])).toBe("")
  })

  test("isFilled needs every digit", () => {
    expect(isFilled("123456", 6)).toBe(true)
    expect(isFilled("12 456", 6)).toBe(false)
    expect(isFilled("12345", 6)).toBe(false)
  })

  test("typed digits: only digits, the old one dropped when a browser appends", () => {
    expect(typedDigits(E, "7")).toBe("7")
    expect(typedDigits("3", "37")).toBe("7")
    expect(typedDigits("3", "7")).toBe("7")
    expect(typedDigits(E, "12-34 56")).toBe("123456")
    expect(typedDigits(E, "a")).toBe("")
  })

  test("one digit advances to the next box, never past the last", () => {
    expect(enterDigits(toBoxes("", 6), 0, "4")).toEqual({ boxes: toBoxes("4", 6), focus: 1 })
    expect(enterDigits(toBoxes("12345", 6), 5, "6")).toEqual({ boxes: toBoxes("123456", 6), focus: 5 })
    expect(enterDigits(toBoxes("12", 6), 1, "")).toEqual({ boxes: toBoxes("12", 6), focus: 1 })
  })

  test("a full pasted code fills every box from the first, whatever box has focus", () => {
    expect(enterDigits(toBoxes("9", 6), 3, "123456")).toEqual({ boxes: toBoxes("123456", 6), focus: 5 })
    expect(enterDigits(toBoxes("", 6), 2, "1234567")).toEqual({ boxes: toBoxes("123456", 6), focus: 5 })
  })

  test("a partial paste fills from the focused box", () => {
    expect(enterDigits(toBoxes("1", 6), 1, "23")).toEqual({ boxes: toBoxes("123", 6), focus: 3 })
    expect(enterDigits(toBoxes("1234", 6), 4, "567")).toEqual({ boxes: toBoxes("123456", 6), focus: 5 })
  })

  test("backspace clears this box, else the previous one", () => {
    expect(eraseDigit(toBoxes("123", 6), 2)).toEqual({ boxes: toBoxes("12", 6), focus: 2 })
    expect(eraseDigit(toBoxes("12", 6), 2)).toEqual({ boxes: toBoxes("1", 6), focus: 1 })
    expect(eraseDigit(toBoxes("", 6), 0)).toEqual({ boxes: toBoxes("", 6), focus: 0 })
  })

  test("formatWait", () => {
    expect(formatWait(42)).toBe("0:42")
    expect(formatWait(60)).toBe("1:00")
    expect(formatWait(845.2)).toBe("14:06")
    expect(formatWait(-3)).toBe("0:00")
  })
})
