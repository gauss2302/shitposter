import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

// Load .env: prefer .env.production for prod/CI, then .env.local. Skip if DATABASE_URL already set.
if (!process.env.DATABASE_URL) {
  const prodPath = resolve(process.cwd(), ".env.production");
  const localPath = resolve(process.cwd(), ".env.local");
  if (existsSync(prodPath)) {
    dotenv.config({ path: prodPath });
  } else {
    dotenv.config({ path: localPath });
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
