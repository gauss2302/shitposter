import { Queue } from "bullmq";
import { createServer } from "http";
import { createRedisConnection } from "@/lib/queue/connection";

// Parse HEALTH_PORT as number, default to 3001
const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || "3001", 10);
if (isNaN(HEALTH_PORT) || HEALTH_PORT < 1 || HEALTH_PORT > 65535) {
  throw new Error(`Invalid HEALTH_PORT: ${process.env.HEALTH_PORT}. Must be between 1 and 65535.`);
}

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  redis: "connected" | "disconnected";
  queue: {
    waiting: number;
    active: number;
    failed: number;
    delayed: number;
  };
  worker: {
    processing: boolean;
    lastJobAt: string | null;
    jobsProcessed: number;
    jobsFailed: number;
  };
}

// Metrics tracking
export const workerMetrics = {
  lastJobAt: null as Date | null,
  jobsProcessed: 0,
  jobsFailed: 0,
  isProcessing: false,
};

export async function startHealthServer() {
  const redis = createRedisConnection();
  const postQueue = new Queue("post-publishing", { connection: redis });

  const server = createServer(async (req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      try {
        // Check Redis connection
        let redisStatus: "connected" | "disconnected" = "disconnected";
        try {
          await redis.ping();
          redisStatus = "connected";
        } catch {
          redisStatus = "disconnected";
        }

        // Get queue stats
        const counts = await postQueue.getJobCounts(
          "wait",
          "active",
          "failed",
          "delayed"
        );

        const health: HealthStatus = {
          status: redisStatus === "connected" ? "healthy" : "unhealthy",
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          redis: redisStatus,
          queue: {
            waiting: counts.wait || 0,
            active: counts.active || 0,
            failed: counts.failed || 0,
            delayed: counts.delayed || 0,
          },
          worker: {
            processing: workerMetrics.isProcessing,
            lastJobAt: workerMetrics.lastJobAt?.toISOString() || null,
            jobsProcessed: workerMetrics.jobsProcessed,
            jobsFailed: workerMetrics.jobsFailed,
          },
        };

        // Determine overall status
        if (redisStatus === "disconnected") {
          health.status = "unhealthy";
        } else if (counts.failed > 10) {
          health.status = "degraded";
        }

        const statusCode = health.status === "unhealthy" ? 503 : 200;

        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify(health, null, 2));
      } catch (error) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "unhealthy",
            error: error instanceof Error ? error.message : "Unknown error",
          })
        );
      }
    } else if (req.url === "/ready" && req.method === "GET") {
      // Readiness probe - is the worker ready to accept jobs?
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ready: true }));
    } else if (req.url === "/metrics" && req.method === "GET") {
      // Prometheus-style metrics
      const counts = await postQueue.getJobCounts(
        "wait",
        "active",
        "failed",
        "completed",
        "delayed"
      );

      const metrics = `
# HELP worker_jobs_processed_total Total number of jobs processed
# TYPE worker_jobs_processed_total counter
worker_jobs_processed_total ${workerMetrics.jobsProcessed}

# HELP worker_jobs_failed_total Total number of jobs failed
# TYPE worker_jobs_failed_total counter
worker_jobs_failed_total ${workerMetrics.jobsFailed}

# HELP worker_queue_waiting Number of jobs waiting
# TYPE worker_queue_waiting gauge
worker_queue_waiting ${counts.wait || 0}

# HELP worker_queue_active Number of jobs active
# TYPE worker_queue_active gauge
worker_queue_active ${counts.active || 0}

# HELP worker_queue_failed Number of jobs failed
# TYPE worker_queue_failed gauge
worker_queue_failed ${counts.failed || 0}

# HELP worker_queue_delayed Number of jobs delayed
# TYPE worker_queue_delayed gauge
worker_queue_delayed ${counts.delayed || 0}

# HELP worker_uptime_seconds Worker uptime in seconds
# TYPE worker_uptime_seconds gauge
worker_uptime_seconds ${process.uptime()}
`.trim();

      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(metrics);
    } else {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  server.listen(HEALTH_PORT, () => {
    console.log(`🏥 Health server listening on port ${HEALTH_PORT}`);
    console.log(`   - GET /health  - Health check`);
    console.log(`   - GET /ready   - Readiness probe`);
    console.log(`   - GET /metrics - Prometheus metrics`);
  });

  return server;
}
