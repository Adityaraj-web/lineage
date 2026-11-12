import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(import.meta.dirname, "../..");
const PKG = "@hot-labs/near-connect";
const CONNECTOR = path.join("components", "wallet", "connector.ts");

describe("NEAR Connect stays isolated", () => {
  it("only components/wallet/connector.ts mentions the package", () => {
    const files = readdirSync(SRC, { recursive: true, encoding: "utf8" }).filter(
      (f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f),
    );
    expect(files.length).toBeGreaterThan(20);
    const users = files.filter((f) => readFileSync(path.join(SRC, f), "utf8").includes(PKG));
    expect(users).toEqual([CONNECTOR]);
  });

  it("connector.ts loads it only through a dynamic import", () => {
    const code = readFileSync(path.join(SRC, CONNECTOR), "utf8");
    expect(code).toContain(`await import("${PKG}")`);
    const staticValueImport = new RegExp(String.raw`^\s*import\s+(?!type\b)[^;]*from\s+["']${PKG}["']`, "m");
    expect(code).not.toMatch(staticValueImport);
    expect(code).not.toMatch(new RegExp(String.raw`require\(\s*["']${PKG}`));
  });

  it("web/package.json pins 0.12.0 exactly and adds no other NEAR wallet library", () => {
    const pkg = JSON.parse(readFileSync(path.resolve(SRC, "../package.json"), "utf8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
    expect(deps[PKG]).toBe("0.12.0");
    expect(Object.keys(deps).filter((d) => d === "near-api-js" || d.startsWith("@near-wallet-selector/") || d.startsWith("@near-js/"))).toEqual([]);
  });
});
