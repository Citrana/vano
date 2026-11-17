import { v } from "convex/values";
import { sellerMutation } from "./lib/seller";

/**
 * A short-lived upload URL for a (client-compressed) image. The file is
 * only checked and claimed when a shop or product mutation attaches it.
 */
export const generateUploadUrl = sellerMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
