import { describe, expect, test } from "vitest"
import en from "../../../../messages/en.json"
import fr from "../../../../messages/fr.json"
import { ALL_PERMISSIONS, PERMISSION_AREAS } from "../../../../convex/lib/permissions"

/** A permission added later can't ship without a label in both languages. */
describe("permission labels", () => {
  for (const [lang, messages] of [["en", en], ["fr", fr]] as const) {
    const labels = messages.Permissions as Record<string, Record<string, string>>
    test(`${lang}: every area and permission has a label`, () => {
      for (const area of PERMISSION_AREAS) expect(labels[area]?.title, `${area}.title`).toBeTruthy()
      for (const permission of ALL_PERMISSIONS) {
        const [area, action] = permission.split(".")
        expect(labels[area]?.[action], permission).toBeTruthy()
      }
    })
  }
})
