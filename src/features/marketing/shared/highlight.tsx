import type { ReactNode } from "react"

/**
 * Rich-text tag for the one coral word of a headline: messages write
 * `<hl>word</hl>` so each language picks its own word. Coral is only
 * used at headline sizes (>= 24px) for contrast.
 */
export const highlight = { hl: (chunks: ReactNode) => <span className="text-coral">{chunks}</span> }
