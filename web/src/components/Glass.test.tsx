import Link from "next/link";
import { describe, expect, it } from "vitest";
import { renderUI } from "@/test/render";
import { Glass } from "./Glass";

describe("Glass", () => {
  it("renders its children in a card by default", () => {
    const { getByText } = renderUI(
      <Glass>
        <p>Inside the glass</p>
      </Glass>,
    );
    const panel = getByText("Inside the glass").parentElement!;
    expect(panel).toHaveAttribute("data-glass", "card");
    expect(panel).toHaveClass("glass", "glass-card");
  });

  it("takes a tier and an element, including a link", () => {
    const { getByRole } = renderUI(
      <Glass as={Link} href="/compare" tier="stage">
        See the attack side by side
      </Glass>,
    );
    const link = getByRole("link", { name: "See the attack side by side" });
    expect(link).toHaveAttribute("href", "/compare");
    expect(link).toHaveAttribute("data-glass", "stage");
  });

  it("passes other props through and keeps the chip tier free of glare", () => {
    const { getByLabelText } = renderUI(
      <Glass as="ul" tier="chip" aria-label="Chips" glare>
        <li>One</li>
      </Glass>,
    );
    const ul = getByLabelText("Chips");
    expect(ul.tagName).toBe("UL");
    expect(ul).toHaveClass("glass-chip");
    expect(ul.querySelector(".glass-glare")).toBeNull();
  });
});
