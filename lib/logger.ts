/**
 * Centralized logging utility for the application
 * Can be easily toggled on/off and configured for different log levels
 * 
 * Environment variables:
 * NEXT_PUBLIC_DEBUG_LOGS=true/false
 * NEXT_PUBLIC_LOG_LEVEL=debug|info|warn|error
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerConfig {
  enabled: boolean
  level: LogLevel
  prefix: string
}

const logLevelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

class Logger {
  private config: LoggerConfig

  constructor() {
    this.config = this.loadConfig()
  }

  private loadConfig(): LoggerConfig {
    // Dynamically read environment variables at runtime
    const isClient = typeof window !== 'undefined'
    const debugLogsEnv = isClient 
      ? window.__NEXT_PUBLIC_DEBUG_LOGS__ ?? (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true')
      : (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true')
    
    const logLevelEnv = isClient
      ? window.__NEXT_PUBLIC_LOG_LEVEL__ ?? (process.env.NEXT_PUBLIC_LOG_LEVEL || 'info')
      : (process.env.NEXT_PUBLIC_LOG_LEVEL || 'info')

    return {
      enabled: debugLogsEnv === true || debugLogsEnv === 'true',
      level: (logLevelEnv as LogLevel) || 'info',
      prefix: '[v0]',
    }
  }

  setConfig(config: Partial<LoggerConfig>) {
    this.config = { ...this.config, ...config }
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false
    return logLevelPriority[level] >= logLevelPriority[this.config.level]
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string[] {
    const timestamp = new Date().toISOString()
    const prefix = `${this.config.prefix} [${level.toUpperCase()}] ${timestamp}`
    
    if (data !== undefined) {
      return [prefix, message, data]
    }
    return [prefix, message]
  }

  debug(message: string, data?: any) {
    if (this.shouldLog('debug')) {
      console.log(...this.formatMessage('debug', message, data))
    }
  }

  info(message: string, data?: any) {
    if (this.shouldLog('info')) {
      console.info(...this.formatMessage('info', message, data))
    }
  }

  warn(message: string, data?: any) {
    if (this.shouldLog('warn')) {
      console.warn(...this.formatMessage('warn', message, data))
    }
  }

  error(message: string, data?: any) {
    if (this.shouldLog('error')) {
      console.error(...this.formatMessage('error', message, data))
    }
  }
}

export const logger = new Logger()

// Export for testing/configuration
export { Logger }
export type { LoggerConfig, LogLevel }
