import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { ImageResponse } from "next/og"
import en from "../../messages/en.json"

// Link-preview crawlers (WhatsApp, Facebook…) send no locale, so the
// preview is the English copy, read from messages/en.json.
export const alt = en.Landing.ogAlt
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const CORAL = "#F4511E"
const CORAL_STRONG = "#D63E0F"
const INK = "#1A1412"
const CREAM = "#FFF8F3"
const BLUSH = "#FFE3D6"
const MUTED = "#6B5F59"

/** "…Get <hl>orders</hl>." → words, with the highlighted ones flagged. */
function headlineWords(text: string) {
  const words: { text: string; hl: boolean }[] = []
  for (const part of text.split(/(<hl>.*?<\/hl>)/)) {
    const hl = part.startsWith("<hl>")
    const plain = part.replace(/<\/?hl>/g, "")
    for (const w of plain.split(/\s+/).filter(Boolean)) {
      // Glue punctuation that directly follows a highlight onto its word.
      if (!hl && /^[.,!?]$/.test(w) && words.length) words[words.length - 1].text += w
      else words.push({ text: w, hl })
    }
  }
  return words
}

const font = (weight: number) => readFile(join(process.cwd(), `src/assets/fonts/PlusJakartaSans-${weight}.ttf`))

export default async function OpengraphImage() {
  const words = headlineWords(en.Landing.heroTitle)
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: CREAM, position: "relative", fontFamily: "Jakarta" }}>
        <div style={{ position: "absolute", top: -180, left: -160, width: 560, height: 560, borderRadius: 9999, background: CORAL, opacity: 0.22, filter: "blur(80px)" }} />
        <div style={{ position: "absolute", bottom: -200, right: 120, width: 520, height: 520, borderRadius: 9999, background: BLUSH, filter: "blur(60px)" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 0 0 80px", width: 760, gap: 28 }}>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 800, color: INK, letterSpacing: -1 }}>
            vano<span style={{ color: CORAL }}>.</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: 68, lineHeight: 1.08, fontWeight: 800, color: INK, letterSpacing: -2 }}>
            {words.map((w, i) => (
              <span key={i} style={{ color: w.hl ? CORAL : INK, marginRight: 18 }}>
                {w.text}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 500, color: MUTED }}>{en.Landing.trustFree} · {en.Landing.trustFast}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", width: 280, height: 520, borderRadius: 48, background: INK, padding: 14, transform: "rotate(6deg)" }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, borderRadius: 36, background: CREAM, padding: 20, gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 9999, background: BLUSH }} />
                <div style={{ display: "flex", width: 120, height: 14, borderRadius: 8, background: INK, opacity: 0.85 }} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {[CORAL, BLUSH, "#5B1F4A", "#E8C9B8"].map((c) => (
                  <div key={c} style={{ display: "flex", width: 100, height: 128, borderRadius: 16, background: c, opacity: 0.9 }} />
                ))}
              </div>
              <div style={{ display: "flex", marginTop: "auto", height: 44, borderRadius: 12, background: "#1E874D" }} />
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 10, background: CORAL_STRONG }} />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Jakarta", data: await font(800), weight: 800, style: "normal" },
        { name: "Jakarta", data: await font(500), weight: 500, style: "normal" },
      ],
    },
  )
}
