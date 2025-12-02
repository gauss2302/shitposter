import { Redis } from "ioredis";

// Create a reusable Redis connection
export const createRedisConnection = () => {
  return new Redis(process.env.REDIS_URL!, {
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
