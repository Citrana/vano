import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test", "@convex-dev/aggregate", "@convex-dev/rate-limiter", "@convex-dev/batch-worker"] } },
    setupFiles: ["./convex/lib/test-setup.ts"],
  },
});
