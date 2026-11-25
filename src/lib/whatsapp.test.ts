import { createTranslator } from "next-intl"
import { describe, expect, test } from "vitest"
import en from "../../messages/en.json"
import fr from "../../messages/fr.json"
import { formatMoney } from "../../convex/lib/money"
import { buildOrderMessage, waChatLink, waShareLink } from "./whatsapp"

describe("whatsapp", () => {
  test("order message in English, with size and colour", () => {
    const t = createTranslator({ locale: "en", messages: en, namespace: "Public" })
    const text = buildOrderMessage(t, {
      product: "Wax dress",
      price: formatMoney(2500, "USD", "en"),
      size: "M",
      color: "Red",
      url: "https://vano.app/chez-amani/abc",
    })
    expect(text).toBe(
      [
        "Hello! I'd like to order this product:",
        "Product: Wax dress",
        "Price: $25",
        "Size: M",
        "Color: Red",
        "Link: https://vano.app/chez-amani/abc",
      ].join("\n"),
    )
  })

  test("on sale: the sale price, the normal price and a Sale note", () => {
    const en_t = createTranslator({ locale: "en", messages: en, namespace: "Public" })
    const text = buildOrderMessage(en_t, { product: "Wax dress", price: "$17.50", normalPrice: "$25", url: "https://x/y" })
    expect(text.split("\n")).toEqual([
      "Hello! I'd like to order this product:",
      "Product: Wax dress",
      "Sale price: $17.50 (normal price $25)",
      "On sale at the time of this order.",
      "Link: https://x/y",
    ])
    const fr_t = createTranslator({ locale: "fr", messages: fr, namespace: "Public" })
    expect(buildOrderMessage(fr_t, { product: "Robe", price: "17,50 $", normalPrice: "25 $", url: "u" })).toContain(
      "Prix promo : 17,50 $ (prix normal 25 $)",
    )
  })

  test("with a discount code: the product, the code, the normal and final prices (no sale note)", () => {
    const en_t = createTranslator({ locale: "en", messages: en, namespace: "Public" })
    const text = buildOrderMessage(en_t, {
      product: "Wax dress",
      price: "$22.50",
      normalPrice: "$25",
      code: "WELCOME10",
      size: "M",
      url: "https://x/y",
    })
    expect(text.split("\n")).toEqual([
      "Hello! I'd like to order this product:",
      "Product: Wax dress",
      "Discount code: WELCOME10",
      "Price with the code: $22.50 (normal price $25)",
      "Size: M",
      "Link: https://x/y",
    ])
    const fr_t = createTranslator({ locale: "fr", messages: fr, namespace: "Public" })
    const fr_text = buildOrderMessage(fr_t, { product: "Robe", price: "22,50 $", normalPrice: "25 $", code: "BIENVENUE", url: "u" })
    expect(fr_text).toContain("Code de réduction : BIENVENUE")
    expect(fr_text).toContain("Prix avec le code : 22,50 $ (prix normal 25 $)")
    expect(fr_text).not.toContain("En promotion")
  })

  test("order message in French, without size or colour", () => {
    const t = createTranslator({ locale: "fr", messages: fr, namespace: "Public" })
    const text = buildOrderMessage(t, { product: "Robe", price: "25 $", url: "https://x/y" })
    expect(text.split("\n")).toEqual([
      "Bonjour ! Je voudrais commander ce produit :",
      "Produit : Robe",
      "Prix : 25 $",
      "Lien : https://x/y",
    ])
  })

  test("links", () => {
    expect(waChatLink("+243812345678", "a b&c")).toBe("https://wa.me/243812345678?text=a%20b%26c")
    expect(waShareLink("hi\nthere")).toBe("https://wa.me/?text=hi%0Athere")
  })
})
