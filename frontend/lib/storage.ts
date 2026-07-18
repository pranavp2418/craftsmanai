/**
 * SSR-safe, type-safe localStorage wrapper.
 *
 * Why this file exists:
 * - `localStorage` is undefined during server-side rendering. Touching it without
 *   guards will crash the build / first render.
 * - `JSON.parse(localStorage.getItem(key) || "[]")` throws if the stored value
 *   is malformed (corrupted by an extension, a previous bug, or a manual edit).
 *   That crashes the page.
 * - `setItem` can throw `QuotaExceededError` in private-browsing or full-storage
 *   modes. Unhandled, that crashes the user flow.
 *
 * All of those are handled here. Use this instead of `localStorage` directly.
 */

const isBrowser = (): boolean =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

/**
 * Read a JSON-encoded value from localStorage.
 * Returns `fallback` if the key is missing, the value is malformed, or we're on the server.
 */
export function getJSON<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Malformed JSON, blocked storage, or other read error — fall back gracefully.
    return fallback;
  }
}

/**
 * Write a JSON-encodable value to localStorage.
 * Returns `true` on success, `false` if the write failed (quota, private mode, SSR).
 */
export function setJSON(key: string, value: unknown): boolean {
  if (!isBrowser()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove a key. No-op on the server or on error.
 */
export function remove(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Centralised storage keys. Keep these here so it's easy to see (and audit)
 * everything the app persists to the user's browser.
 */
export const STORAGE_KEYS = {
  ARCHIVED_REQUESTS: "archivedRequests",
  ARCHIVED_VERSIONS: "archivedVersions",
  GENERATED_IMAGES: "generatedImages",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
