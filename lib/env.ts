export function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function getBaseUrl(): string {
  return getRequiredEnv("BETTER_AUTH_URL").replace(/\/$/, "");
}
