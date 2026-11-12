import { ViewTransition } from "react";
import { ScrollOnEnter } from "./ScrollOnEnter";

// Route content: fades out fast, fades in with a slight rise (globals.css: page-in / page-out).
// Must sit in each page.tsx: layouts persist across navigations, so enter/exit never fire there.
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div>
        <ScrollOnEnter />
        {children}
      </div>
    </ViewTransition>
  );
}

// One element that morphs into its namesake on the next page. The child must be a single element
// box (block or inline-block), and both pages must render it in the navigation's own commit.
export function Shared({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <ViewTransition name={name} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}

export const needsYouText = (n: number): string =>
  n === 0 ? "Nothing needs you" : n === 1 ? "1 payment needs you" : `${n} payments need you`;
