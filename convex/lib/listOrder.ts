import { v } from "convex/values";

/**
 * Direction of an admin list's date column (the only sortable column:
 * it follows the index, so every page stays in order). Search results
 * come back by relevance and ignore it.
 */
export const sortOrderValidator = v.union(v.literal("asc"), v.literal("desc"));
export type SortOrder = "asc" | "desc";
