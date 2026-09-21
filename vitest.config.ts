import { defineConfig } from "vitest/config";
import path from "node:path";

// Mirrors tsconfig.json's "@/*" -> "./*" path alias so lib/*.test.ts files
// can import the same way the app itself does.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Lib files import "server-only" as a guard against being bundled
      // into client components — its default export throws unconditionally
      // outside Next.js's RSC bundler, which is the only thing that resolves
      // it to this no-op empty.js via a "react-server" export condition
      // Vitest doesn't set. Aliasing directly is more robust than trying to
      // get Vite's SSR resolver to honor that condition.
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
  test: {
    environment: "node",
  },
});
