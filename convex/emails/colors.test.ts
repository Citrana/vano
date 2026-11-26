// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { EMAIL_COLORS } from "./layout";

// Vitest blanks CSS imports, so the file is read from disk (node env).
const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
const token = (name: string) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1]?.toLowerCase();

test("email brand colours match the globals.css tokens", () => {
  expect(EMAIL_COLORS).toEqual({
    plum: token("plum"),
    cream: token("cream"),
    ink: token("ink"),
    card: token("card"),
    muted: token("muted-foreground"),
    border: token("border"),
  });
});
