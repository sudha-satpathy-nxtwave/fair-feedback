/**
 * Lightweight client-side PIN hashing using Web Crypto SHA-256 + a fixed salt.
 *
 * NOTE: This is *obfuscation*, not real password security. The whole PIN model
 * is intentionally a low-friction gate, not strong auth. Real account security
 * needs server-side bcrypt + per-user salts + auth.users.
 */
const SALT = "fairfeedback.v1.salt::do-not-change";

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${SALT}::${pin}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const computed = await hashPin(pin);
  // constant-time-ish compare
  if (computed.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return diff === 0;
}
