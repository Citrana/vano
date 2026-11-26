import type { TableSpec } from "../../components/data-table/url-state"

/** /dashboard/team URL keys (the shared list, CLAUDE.md "UI"): only the open member (`open`). */
export const TEAM_SPEC = { filters: [] } as const satisfies TableSpec
