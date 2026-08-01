import { defineConfig } from "vitest/config";
import path from "node:path";

// Mirrors tsconfig.json's "@/*" -> "./*" path alias so lib/*.test.ts files
// can import the same way the app itself does.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
  },
});
