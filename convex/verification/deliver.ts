import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { activeSender } from "./registry";

/** Sends a verification code with the live sender (scheduled by `changeRequests.sendPhoneCode`). */
export const send = internalAction({
  args: { phone: v.string(), code: v.string() },
  returns: v.null(),
  handler: async (_ctx, { phone, code }) => {
    const sender = activeSender();
    if (!sender) return null;
    try {
      await sender.send(phone, code);
    } catch (error) {
      console.error(`[verification] ${sender.id} failed`, error);
    }
    return null;
  },
});
