/**
 * Simple level-based logger. Respects LOG_LEVEL and CI.
 * In production or when LOG_LEVEL is set, only messages at or above that level are emitted.
 * Scripts: use LOG_LEVEL=error or CI=true to suppress info/debug.
 */

const LEVELS = ["debug", "info", "warn", "error"] as const;
type Level = (typeof LEVELS)[number];

function parseLevel(): Level {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw && LEVELS.includes(raw as Level)) return raw as Level;
  if (process.env.NODE_ENV === "production") return "info";
  return "debug";
}

const currentLevel = parseLevel();
const levelIndex = LEVELS.indexOf(currentLevel);

function shouldLog(level: Level): boolean {
  return LEVELS.indexOf(level) >= levelIndex;
}

function log(level: Level, ...args: unknown[]) {
  if (!shouldLog(level)) return;
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

export const logger = {
  debug: (...args: unknown[]) => log("debug", ...args),
  info: (...args: unknown[]) => log("info", ...args),
  warn: (...args: unknown[]) => log("warn", ...args),
  error: (...args: unknown[]) => log("error", ...args),
};
