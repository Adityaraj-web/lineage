import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderUI } from "@/test/render";
import { VaultSkeleton } from "./screens/Skeletons";
import { needsYouText } from "./transitions";

describe("needsYouText", () => {
  it("counts in words", () => {
    expect([0, 1, 2].map(needsYouText)).toEqual(["Nothing needs you", "1 payment needs you", "2 payments need you"]);
  });
});

describe("VaultSkeleton", () => {
  it("shows the inbox heading before the vault loads when the Overview already knows the count", () => {
    renderUI(<VaultSkeleton awaiting={1} />);
    expect(screen.getByRole("heading", { level: 2, name: "1 payment needs you" })).toBeInTheDocument();
  });

  it("shows no heading when nothing is cached", () => {
    renderUI(<VaultSkeleton />);
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
