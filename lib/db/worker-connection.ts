import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

// Create a postgres client optimized for workers with explicit config
const workerClient = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  // Explicitly prevent postgres-js from using system user
  username: "postgres",
  password: "postgres",
  database: "socialposter",
  host: "localhost",
  port: 5432,
});

export const workerDb = drizzle(workerClient, { schema });

// Export schema for convenience
export * from "./schema";
