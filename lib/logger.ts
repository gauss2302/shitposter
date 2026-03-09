/**
 * Level-based logger. Respects LOG_LEVEL and CI.
 * In production or when LOG_LEVEL is set, only messages at or above that level are emitted.
 * When NODE_ENV=production or LOG_FORMAT=json, logs one JSON object per line for log aggregators.
 */

const LEVELS = ["debug", "info", "warn", "error"] as const;
type Level = (typeof LEVELS)[number];

function parseLevel(): Level {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw && LEVELS.includes(raw as Level)) return raw as Level;
  if (process.env.NODE_ENV === "production") return "info";
  return "debug";
}

function shouldUseJsonFormat(): boolean {
  if (process.env.LOG_FORMAT === "json") return true;
  if (process.env.NODE_ENV === "production") return true;
  return false;
}

const currentLevel = parseLevel();
const levelIndex = LEVELS.indexOf(currentLevel);
const jsonFormat = shouldUseJsonFormat();

function shouldLog(level: Level): boolean {
  return LEVELS.indexOf(level) >= levelIndex;
}

function serializeMessage(args: unknown[]): string {
  if (args.length === 0) return "";
  if (args.length === 1 && typeof args[0] === "string") return args[0];
  try {
    return args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
  } catch {
    return String(args[0]);
  }
}

function log(level: Level, ...args: unknown[]) {
  if (!shouldLog(level)) return;
  const timestamp = new Date().toISOString();
  if (jsonFormat) {
    const payload: Record<string, unknown> = {
      level,
      message: serializeMessage(args),
      timestamp,
    };
    if (args.length === 1 && typeof args[0] === "object" && args[0] !== null && !Array.isArray(args[0])) {
      const obj = args[0] as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) {
        if (k !== "level" && k !== "message" && k !== "timestamp") payload[k] = v;
      }
    }
    const line = JSON.stringify(payload);
    switch (level) {
      case "error":
        console.error(line);
        break;
      case "warn":
        console.warn(line);
        break;
      default:
        console.log(line);
    }
  } else {
    const prefix = `[${level.toUpperCase()}]`;
    switch (level) {
      case "error":
        console.error(prefix, ...args);
        break;
      case "warn":
        console.warn(prefix, ...args);
        break;
      default:
        console.log(prefix, ...args);
    }
  }
}

export const logger = {
  debug: (...args: unknown[]) => log("debug", ...args),
  info: (...args: unknown[]) => log("info", ...args),
  warn: (...args: unknown[]) => log("warn", ...args),
  error: (...args: unknown[]) => log("error", ...args),
};
