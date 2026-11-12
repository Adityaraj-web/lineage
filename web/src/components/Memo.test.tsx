import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { p4Alice, p5Poisoned } from "@/lib/test-fixtures";
import { renderUI } from "@/test/render";
import { vaultView } from "@/test/views";
import { Memo } from "./Memo";
import { PaymentsTable } from "./vault/PaymentsTable";

const XSS = "<img src=x onerror=alert(1)>";

describe("Memo renders untrusted text as text", () => {
  it("shows an HTML payload literally and creates no element from it", () => {
    const { container } = renderUI(<Memo text={XSS} />);
    expect(screen.getByText(XSS)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("marks invoice tokens without interpreting the rest as HTML", () => {
    const { container } = renderUI(<Memo text="A-102 <b>x</b>" tokens={["A-102"]} />);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent("A-102");
    expect(container.querySelector("b")).toBeNull();
    expect(container).toHaveTextContent("A-102 <b>x</b>");
  });

  it("an XSS memo in the payments table stays literal text", () => {
    const evil = { ...p5Poisoned(), memo: XSS };
    const view = vaultView("vault", [p4Alice(), evil]);
    const { container } = renderUI(<PaymentsTable payments={view.payments} tasks={view.tasks} />);
    expect(screen.getByText(XSS)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("no source file uses dangerouslySetInnerHTML", () => {
    const src = path.resolve(import.meta.dirname, "..");
    const files = readdirSync(src, { recursive: true, encoding: "utf8" }).filter(
      (f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f),
    );
    expect(files.length).toBeGreaterThan(20);
    const offenders = files.filter((f) => readFileSync(path.join(src, f), "utf8").includes("dangerouslySetInnerHTML"));
    expect(offenders).toEqual([]);
  });
});
