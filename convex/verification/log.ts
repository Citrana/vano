import type { CodeSender } from "./sender";

/**
 * Development sender: nothing leaves the server, the code is written to
 * the Convex log (and shown on screen in test mode, see registry.ts).
 */
export const logSender: CodeSender = {
  id: "log",
  async send(phone, code) {
    console.log(`[verification] code for ${phone} is ${code}`);
  },
};
