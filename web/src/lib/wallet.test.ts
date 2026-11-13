import { describe, expect, it } from "vitest";
import { roleFor } from "./wallet";
import { ALICE, ROOT } from "./test-fixtures";

describe("roleFor", () => {
  it("no account is disconnected", () => {
    expect(roleFor(null, ROOT)).toBe("disconnected");
    expect(roleFor(null, null)).toBe("disconnected");
  });

  it("the vault's owner is owner", () => {
    expect(roleFor(ROOT, ROOT)).toBe("owner");
  });

  it("matching is exact: case or whitespace differences are viewers", () => {
    expect(roleFor("Lineage-aditya.testnet", ROOT)).toBe("viewer");
    expect(roleFor(` ${ROOT}`, ROOT)).toBe("viewer");
  });

  it("any other account is a viewer", () => {
    expect(roleFor(ALICE, ROOT)).toBe("viewer");
  });

  it("an unknown owner makes everyone a viewer", () => {
    expect(roleFor(ROOT, null)).toBe("viewer");
  });
});
