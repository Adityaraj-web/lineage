import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    projects: [
      {
        extends: true,
        test: { name: "lib", environment: "node", include: ["src/lib/**/*.test.ts", "src/components/**/*.test.ts", "scripts/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["src/**/*.test.tsx", "src/hooks/**/*.test.ts"],
          setupFiles: ["src/test/setup.ts"],
        },
      },
    ],
  },
});
