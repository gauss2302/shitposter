import { Redis } from "ioredis";

function getRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url || typeof url !== "string" || url.trim() === "") {
    throw new Error(
      "REDIS_URL is not set. Set REDIS_URL in your environment (e.g. redis://localhost:6379)."
    );
  }
  return url;
}

// Create a reusable Redis connection
export const createRedisConnection = () => {
  return new Redis(getRedisUrl(), {
    maxRetriesPerRequest: null, // Required for BullMQ
  });
};

// Singleton for server-side usage
let redis: Redis | null = null;

export const getRedis = () => {
  if (!redis) {
    redis = createRedisConnection();
  }
  return redis;
};
