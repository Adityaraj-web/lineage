import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("keeps a custom text size next to a text colour", () => {
    expect(cn("text-stat", "text-p1")).toBe("text-stat text-p1");
    expect(cn("text-small text-foreground")).toBe("text-small text-foreground");
  });

  it("still merges two sizes", () => {
    expect(cn("text-small", "text-title")).toBe("text-title");
  });
});
