import { z } from "zod"

/**
 * Zod without its JIT (CLAUDE.md "Security & ownership"): the JIT probes
 * `new Function`, which our CSP blocks (no 'unsafe-eval' in production).
 * Zod falls back on its own, but the browser still reports a CSP
 * violation for the probe. Imported once, first, by the root client provider.
 */
z.config({ jitless: true })
