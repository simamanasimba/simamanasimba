import pino, { type Logger } from "pino";

const REDACT_PATHS = [
  "password",
  "passwordHash",
  "*.password",
  "*.passwordHash",
  "req.headers.authorization",
  "req.headers.cookie",
  "*.accessToken",
  "*.refreshToken",
  "*.accessTokenEnc",
  "*.refreshTokenEnc",
  "*.tokenHash",
  "*.token",
];

export function createLogger(name: string): Logger {
  return pino({
    name,
    level: process.env.LOG_LEVEL ?? "info",
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    transport:
      process.env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
        : undefined,
  });
}

export type { Logger };
