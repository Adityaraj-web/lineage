// Last good data per screen, kept across client navigations. A screen that mounts with a cached
// value renders it in the navigation's own commit, so shared view-transition elements can pair.
const cache = new Map<string, unknown>();

export const readPollCache = <T>(key: string): T | null => (cache.has(key) ? (cache.get(key) as T) : null);
export const seedPollCache = (key: string, value: unknown): void => void cache.set(key, value);
export const clearPollCache = (): void => cache.clear();
