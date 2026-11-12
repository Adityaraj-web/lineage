import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderUI } from "@/test/render";
import { Nav } from "./Nav";

vi.mock("next/navigation", () => ({ usePathname: () => "/vault/guarded" }));

const LABELS = ["Overview", "Lineage vault", "LimitsOnly vault", "Compare"];

describe("Nav", () => {
  it("links the four pages and marks the current one", () => {
    renderUI(<Nav />);
    const main = screen.getByRole("navigation", { name: "Main" });
    expect(within(main).getAllByRole("link").map((l) => l.textContent)).toEqual(LABELS);
    expect(within(main).getByRole("link", { name: "LimitsOnly vault" })).toHaveAttribute("aria-current", "page");
    expect(within(main).getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("collapses into a menu that opens, lists the pages and closes on Escape", () => {
    renderUI(<Nav />);
    const button = screen.getByRole("button", { name: "Menu" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    act(() => fireEvent.click(button));
    expect(button).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("navigation", { name: "Pages" });
    expect(within(menu).getAllByRole("link").map((l) => l.textContent)).toEqual(LABELS);
    expect(within(menu).getByRole("link", { name: "LimitsOnly vault" })).toHaveAttribute("aria-current", "page");
    act(() => fireEvent.keyDown(document.activeElement ?? menu, { key: "Escape" }));
    expect(screen.queryByRole("navigation", { name: "Pages" })).toBeNull();
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("says it is on testnet in plain words", () => {
    renderUI(<Nav />);
    expect(screen.getByText("Testnet")).toBeInTheDocument();
  });
});
