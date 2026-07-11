/**
 * Where the Nocturne server lives and what credentials this browser holds.
 * Resolution order for the API URL: `?api=` query param (persisted, so a
 * rotating quick-tunnel URL needs setting once) → localStorage →
 * NEXT_PUBLIC_API_URL → localhost:9876. All storage access is best-effort:
 * a wall display in a locked-down kiosk may not have localStorage.
 */
const DEFAULT_API_URL = "http://localhost:9876";

const LS_API_URL = "nocturne:apiUrl";
const LS_API_KEY = "nocturne:apiKey";
const lsViewCode = (slug: string) => `nocturne:viewCode:${slug}`;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable — the session still works, it just won't persist
  }
}

export function getApiUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (typeof window === "undefined") return envUrl ?? DEFAULT_API_URL;
  const param = new URLSearchParams(window.location.search).get("api");
  if (param) {
    write(LS_API_URL, param);
    return param;
  }
  return read(LS_API_URL) ?? envUrl ?? DEFAULT_API_URL;
}

export function getWsUrl(): string {
  return getApiUrl().replace(/^http/, "ws");
}

export function getApiKey(): string | null {
  return read(LS_API_KEY);
}

export function setApiKey(key: string | null): void {
  write(LS_API_KEY, key);
}

export function getViewCode(slug: string): string | null {
  return read(lsViewCode(slug));
}

export function setViewCode(slug: string, code: string | null): void {
  write(lsViewCode(slug), code);
}
