// jsdom has no matchMedia. Tests flip prefers-reduced-motion with this.
let reduced = false;

export function setReducedMotion(on: boolean): void {
  reduced = on;
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes("prefers-reduced-motion") ? reduced : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
