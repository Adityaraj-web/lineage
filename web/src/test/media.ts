// jsdom has no matchMedia. Tests flip prefers-reduced-motion and the pinned-scene query with these.
import { PINNED_QUERY } from "@/hooks/useMediaQuery";

let reduced = false;
let pinned = false;

function install(): void {
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes("prefers-reduced-motion") ? reduced : query === PINNED_QUERY ? pinned : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

export function setReducedMotion(on: boolean): void {
  reduced = on;
  install();
}

export function setPinned(on: boolean): void {
  pinned = on;
  install();
}
