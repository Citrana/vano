import { CODE_LENGTH } from "../lib/changeRequests";

/** Web Crypto (available in Convex queries/mutations and in tests). */

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A random numeric code, e.g. "042917". */
export function newCode(): string {
  const [n] = crypto.getRandomValues(new Uint32Array(1));
  return String(n % 10 ** CODE_LENGTH).padStart(CODE_LENGTH, "0");
}

/** A random hex token of `bytes` bytes (e.g. a team invite link). */
export function newToken(bytes: number): string {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function newSalt(): string {
  return hex(crypto.getRandomValues(new Uint8Array(16)));
}

/** Lowercase hex SHA-256 of a text (how Convex Auth stores its codes too). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return hex(new Uint8Array(digest));
}

/** Only this hash is stored, never the code. */
export async function hashCode(code: string, salt: string): Promise<string> {
  return await sha256Hex(`${salt}:${code}`);
}

/** Compares two hex strings in constant time. */
export function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
