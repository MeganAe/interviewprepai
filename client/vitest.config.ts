import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"],
    testTimeout: 12000,
    hookTimeout: 12000,
    fileParallelism: false,
    setupFiles: ["./tests/setup.ts"],
  },
});
