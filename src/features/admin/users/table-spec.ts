import type { TableSpec } from "../data-table/url-state"

/** /admin/users URL keys. `roleId` options are loaded at run time. Newest first. */
export const USERS_SPEC = {
  filters: [
    { kind: "select", key: "roleId" },
    { kind: "select", key: "status", options: ["active", "suspended"] },
  ],
  order: "desc",
} as const satisfies TableSpec
