// Vitest `setupFiles` entry (see vitest.config.ts). Tests authenticate with
// convex-test's `withIdentity({ subject: userId })`, which is what
// `getAuthUserId` reads, so no JWT keys are needed here.
process.env.CONVEX_SITE_URL ??= "http://127.0.0.1:3211";
process.env.SITE_URL ??= "http://localhost:3000";
