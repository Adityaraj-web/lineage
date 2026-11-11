import { errorMessage } from "./near.js";

export const step = (msg: string): void => console.log(`→ ${msg}`);
export const skip = (msg: string): void => console.log(`skip: ${msg}`);
export const info = (msg: string): void => console.log(`  ${msg}`);

export class CheckFailed extends Error {}

export class Checklist {
  passed = 0;
  failed = 0;

  // fn returns an optional detail string; throwing (CheckFailed or anything else) marks ✘.
  async check(label: string, fn: () => Promise<string | void>): Promise<void> {
    try {
      const detail = await fn();
      this.passed++;
      console.log(`✔ ${label}${detail ? ` — ${detail}` : ""}`);
    } catch (e) {
      this.failed++;
      const reason = e instanceof CheckFailed ? e.message : errorMessage(e);
      console.log(`✘ ${label} — ${reason}`);
    }
  }

  skipped(label: string, reason: string): void {
    console.log(`- ${label} — skipped: ${reason}`);
  }

  get ok(): boolean {
    return this.failed === 0;
  }
}

export function expect(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new CheckFailed(msg);
}

export function expectEq<T>(actual: T, expected: T, what: string): void {
  const a = JSON.stringify(actual, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  const b = JSON.stringify(expected, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  if (a !== b) throw new CheckFailed(`${what}: expected ${b}, got ${a}`);
}
