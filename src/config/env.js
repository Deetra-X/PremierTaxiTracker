import dotenv from "dotenv";

dotenv.config({ override: true });

export function getEnv(key, { defaultValue } = {}) {
  const value = process.env[key];
  if (value === undefined || value === "") {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getNumberEnv(key, { defaultValue } = {}) {
  const raw = process.env[key];
  if (raw === undefined || raw === "") {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const num = Number(raw);
  if (Number.isNaN(num)) {
    throw new Error(`Invalid number for env var ${key}: ${raw}`);
  }
  return num;
}