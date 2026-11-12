import { createCn } from "cn/config";

// The project's type scale (globals.css --text-*), so text-small + text-p1 keep both.
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["hero", "display", "title", "stat", "lead", "body", "small", "micro"] }],
    },
  },
});
