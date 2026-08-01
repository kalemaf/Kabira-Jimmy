import { config } from "dotenv";
config({ path: ".env.local" });
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Only used by Prisma CLI commands (generate/db push/migrate/studio) —
    // the running app connects independently via lib/db.ts, which reads
    // DATABASE_URL (Neon's pooled endpoint) directly. `db push`/migrate are
    // unreliable against the pooled endpoint (PgBouncer), so CLI commands
    // get the direct connection instead; falls back to DATABASE_URL if
    // DIRECT_URL isn't set so this doesn't break environments without one.
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
