import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

// Create a postgres client optimized for workers
// Connection details are parsed from DATABASE_URL
const workerClient = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const workerDb = drizzle(workerClient, { schema });

// Export schema for convenience
export * from "./schema";
