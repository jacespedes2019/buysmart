import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["scripts/live-verification.test.ts"], environment: "node" },
});
