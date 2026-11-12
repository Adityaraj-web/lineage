"use client";

import { useLayoutEffect } from "react";

// Next resets scroll after a navigation commits, but view transitions snapshot the new page inside
// that commit, and React pairs shared elements only when both are in the viewport. Scrolling here
// (layout effect, same commit) puts the new page where it will land before the snapshot.
// Back/forward keeps the browser's restored position.
let fromHistory = false;
if (typeof window !== "undefined") window.addEventListener("popstate", () => void (fromHistory = true));

export function ScrollOnEnter() {
  useLayoutEffect(() => {
    if (fromHistory) {
      fromHistory = false;
      return;
    }
    const id = decodeURIComponent(window.location.hash.slice(1));
    const target = id ? document.getElementById(id) : null;
    if (target) target.scrollIntoView({ block: "start" });
    else window.scrollTo(0, 0);
  }, []);
  return null;
}
