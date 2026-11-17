// `import.meta.glob` for convex-test module maps (vite's types aren't
// resolvable under pnpm without adding vite as a direct dependency).
interface ImportMeta {
  glob(pattern: string): Record<string, () => Promise<unknown>>;
}
