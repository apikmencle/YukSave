export type HistoryItem = {
  url: string;
  title: string;
  author: string;
  thumbnail: string;
  downloadedAt: number;
};

const STORAGE_KEY = "yuksave-history";
const MAX_ITEMS = 10;

/**
 * Purely client-side, on-device history — nothing here ever touches our
 * servers. It's a convenience list ("what did I just grab?"), not an
 * account feature, so localStorage is the right fit (no sync needed,
 * no auth, and it should survive a page reload but nothing more).
 */
export function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupted or inaccessible storage shouldn't break the page.
    return [];
  }
}

export function addToHistory(item: Omit<HistoryItem, "downloadedAt">): HistoryItem[] {
  const existing = loadHistory().filter((h) => h.url !== item.url);
  const next = [{ ...item, downloadedAt: Date.now() }, ...existing].slice(0, MAX_ITEMS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked (private browsing) — history just won't
    // persist this time, not worth surfacing an error for.
  }
  return next;
}

export function clearHistory(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do if storage isn't accessible.
  }
}
