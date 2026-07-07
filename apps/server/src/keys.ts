function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** `noct_` + 256 bits of CSPRNG hex. High entropy → a plain SHA-256 at rest is enough. */
export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `noct_${hex(bytes)}`;
}

/** Short opaque id used to manage (list/revoke) a key without exposing it. */
export function newKeyId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `key_${hex(bytes)}`;
}

export const API_KEY_PATTERN = /^noct_[0-9a-f]{64}$/;

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return hex(new Uint8Array(digest));
}
