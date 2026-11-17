/** Marketing pages in nav/footer order (labels: `Marketing.<key>`). Not a client module, so server components can import it. */
export const MARKETING_LINKS = [
  { href: "/features", key: "navFeatures" },
  { href: "/pricing", key: "navPricing" },
  { href: "/demo", key: "navDemo" },
  { href: "/help", key: "navHelp" },
] as const
