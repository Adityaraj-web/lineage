import { describe, expect, it } from "vitest";
import { FOOTER, pageProblems } from "./check-site";

const ok = `<!DOCTYPE html><html><body><main>Lineage</main><footer>${FOOTER}</footer></body></html>`;
const HTML = "text/html; charset=utf-8";

describe("pageProblems", () => {
  it("passes a 200 HTML page with the footer", () => {
    expect(pageProblems(200, HTML, ok)).toEqual([]);
  });

  it("flags a non-200 status", () => {
    expect(pageProblems(404, HTML, ok)).toEqual(["status 404"]);
  });

  it("flags a non-HTML content type", () => {
    expect(pageProblems(200, "application/json", ok)).toEqual(["content-type application/json"]);
  });

  it("flags a missing content type", () => {
    expect(pageProblems(200, null, ok)).toEqual(["content-type missing"]);
  });

  it("flags a missing footer", () => {
    expect(pageProblems(200, HTML, "<html><body>Lineage</body></html>")).toEqual([`no "${FOOTER}"`]);
  });

  it.each(["fakewallet", "bg=old", "palette-f07"])("flags a page containing %s", (m) => {
    expect(pageProblems(200, HTML, ok.replace("Lineage", `?${m}`))).toEqual([`contains "${m}"`]);
  });
});
