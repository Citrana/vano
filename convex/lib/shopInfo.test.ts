import { describe, expect, test } from "vitest";
import { cleanInfoText, cleanShopInfo, socialHandle, socialUrl, SHOP_INFO_LIMITS } from "./shopInfo";

describe("social handles", () => {
  test("a handle, @handle or a profile link of that network", () => {
    expect(socialHandle("instagram", " @chez.amani ")).toBe("chez.amani");
    expect(socialHandle("instagram", "https://www.instagram.com/chez.amani/?hl=fr")).toBe("chez.amani");
    expect(socialHandle("instagram", "instagram.com/chez_amani")).toBe("chez_amani");
    expect(socialHandle("tiktok", "https://www.tiktok.com/@chezamani")).toBe("chezamani");
    expect(socialHandle("facebook", "facebook.com/chez-amani")).toBe("chez-amani");
    expect(socialHandle("instagram", "")).toBeUndefined();
    expect(socialHandle("instagram", undefined)).toBeUndefined();
  });

  test("anything else is refused", () => {
    expect(socialHandle("instagram", "https://evil.com/chezamani")).toBeNull();
    expect(socialHandle("tiktok", "instagram.com/chezamani")).toBeNull();
    expect(socialHandle("instagram", "chez amani")).toBeNull();
    expect(socialHandle("instagram", "javascript:alert(1)")).toBeNull();
    expect(socialHandle("tiktok", "a")).toBeNull();
  });

  test("links are built from the handle", () => {
    expect(socialUrl("instagram", "chez.amani")).toBe("https://www.instagram.com/chez.amani");
    expect(socialUrl("tiktok", "chezamani")).toBe("https://www.tiktok.com/@chezamani");
    expect(socialUrl("facebook", "chez-amani")).toBe("https://www.facebook.com/chez-amani");
  });
});

describe("cleanShopInfo", () => {
  test("cleans text, drops empties, refuses too long or bad links", () => {
    expect(cleanInfoText("  Mon–Sat\n 9–18 ", 50)).toBe("Mon–Sat 9–18");
    expect(cleanShopInfo({ openingHours: " ", deliveryAreas: "Goma", socials: { instagram: "@a.b", tiktok: "" } })).toEqual({
      ok: true,
      value: { openingHours: undefined, deliveryAreas: "Goma", socials: { instagram: "a.b" } },
    });
    expect(cleanShopInfo({})).toEqual({ ok: true, value: { openingHours: undefined, deliveryAreas: undefined, socials: undefined } });
    expect(cleanShopInfo({ openingHours: "x".repeat(SHOP_INFO_LIMITS.openingHoursMax + 1) })).toEqual({ ok: false, problem: "tooLong" });
    expect(cleanShopInfo({ socials: { facebook: "https://evil.com/x" } })).toEqual({ ok: false, problem: "social" });
  });
});
