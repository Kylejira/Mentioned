import * as Sentry from "@sentry/nextjs"

type LogLevel = "debug" | "info" | "warn" | "error"

interface LogContext {
  [key: string]: unknown
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const MIN_LEVEL = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) || "debug"]

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= MIN_LEVEL
}

function formatMessage(level: LogLevel, tag: string, message: string, ctx?: LogContext): string {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${tag}]`
  if (ctx && Object.keys(ctx).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(ctx)}`
  }
  return `${prefix} ${message}`
}

function captureToSentry(tag: string, message: string, ctx?: LogContext) {
  try {
    Sentry.captureMessage(`[${tag}] ${message}`, {
      level: "error",
      extra: ctx,
    })
  } catch {
    // Sentry not initialized — silently ignore
  }
}

function createTaggedLogger(tag: string) {
  return {
    debug(message: string, ctx?: LogContext) {
      if (shouldLog("debug")) console.debug(formatMessage("debug", tag, message, ctx))
    },
    info(message: string, ctx?: LogContext) {
      if (shouldLog("info")) console.info(formatMessage("info", tag, message, ctx))
    },
    warn(message: string, ctx?: LogContext) {
      if (shouldLog("warn")) console.warn(formatMessage("warn", tag, message, ctx))
    },
    error(message: string, ctx?: LogContext) {
      if (shouldLog("error")) console.error(formatMessage("error", tag, message, ctx))
      captureToSentry(tag, message, ctx)
    },
  }
}

export const log = {
  create: createTaggedLogger,

  debug(message: string, ctx?: LogContext) {
    if (shouldLog("debug")) console.debug(formatMessage("debug", "app", message, ctx))
  },
  info(message: string, ctx?: LogContext) {
    if (shouldLog("info")) console.info(formatMessage("info", "app", message, ctx))
  },
  warn(message: string, ctx?: LogContext) {
    if (shouldLog("warn")) console.warn(formatMessage("warn", "app", message, ctx))
  },
  error(message: string, ctx?: LogContext) {
    if (shouldLog("error")) console.error(formatMessage("error", "app", message, ctx))
    captureToSentry("app", message, ctx)
  },
}
