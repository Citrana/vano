import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/**
 * Image rules (CLAUDE.md "Images"). The browser compresses to ~300 KB
 * before upload; the server accepts up to 1 MB to leave headroom (e.g. a
 * PNG logo that compresses badly). Ownership checks and deletion live in
 * `seller.ts` (`claimImages`, `deleteFilesNotIn`).
 */
export const MAX_IMAGE_BYTES = 1_000_000;

export function imageProblem(
  meta: { contentType?: string; size: number } | null,
): "missing" | "type" | "size" | null {
  if (meta === null) return "missing";
  if (!meta.contentType?.startsWith("image/")) return "type";
  return meta.size > MAX_IMAGE_BYTES ? "size" : null;
}

export async function urlOf(
  ctx: QueryCtx,
  id: Id<"_storage"> | undefined,
): Promise<string | null> {
  return id === undefined ? null : await ctx.storage.getUrl(id);
}

export async function urlsOf(
  ctx: QueryCtx,
  ids: readonly Id<"_storage">[],
): Promise<string[]> {
  const urls = await Promise.all(ids.map((id) => ctx.storage.getUrl(id)));
  return urls.filter((url): url is string => url !== null);
}
