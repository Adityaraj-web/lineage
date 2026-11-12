import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import { setReducedMotion } from "./media";

function Probe() {
  return <p>reduced:{String(useReducedMotionPref())}</p>;
}

describe("ui test harness", () => {
  it("renders TSX under jsdom", () => {
    render(<Probe />);
    expect(screen.getByText("reduced:false")).toBeInTheDocument();
  });

  it("feeds prefers-reduced-motion to useReducedMotionPref per test", () => {
    setReducedMotion(true);
    render(<Probe />);
    expect(screen.getByText("reduced:true")).toBeInTheDocument();
  });
});
