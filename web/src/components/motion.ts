export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
export const EASE_COUNT = [0.16, 1, 0.3, 1] as const;

export const DUR = { fast: 0.15, base: 0.25, slow: 0.4, slower: 0.6 } as const;

// How long a changed or new row stays marked.
export const MARK_MS = 1800;
export const MARK_MS_REDUCED = 4000;
