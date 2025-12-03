import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Create a postgres client optimized for workers with multiple concurrent queries
const workerClient = postgres(connectionString, {
  max: 10, // Maximum number of connections in the pool
  idle_timeout: 20,
  connect_timeout: 10,
});

export const workerDb = drizzle(workerClient, { schema });

// Export schema for convenience
export * from "./schema";
