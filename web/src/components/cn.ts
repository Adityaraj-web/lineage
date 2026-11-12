import { createCn } from "cn/config";

// The project's type scale (globals.css --text-*), so text-small + text-p1-fg keep both.
export const cn = createCn({
  extend: { classGroups: { "font-size": [{ text: ["display", "h1", "h2", "h3", "body", "small", "eyebrow", "stat"] }] } },
});
