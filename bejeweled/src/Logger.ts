/**
 * Simple logging utility that respects debug mode
 * Provides structured logging with different levels
 */
export class Logger {
  private context: string
  private debugMode: boolean

  constructor(context: string, debugMode: boolean = false) {
    this.context = context
    this.debugMode = debugMode
  }

  setDebugMode(enabled: boolean) {
    this.debugMode = enabled
  }

  /**
   * Debug logs - only shown in debug mode
   */
  debug(...args: any[]) {
    if (this.debugMode) {
      console.log(`[${this.context}]`, ...args)
    }
  }

  /**
   * Info logs - always shown
   */
  info(...args: any[]) {
    console.log(`[${this.context}]`, ...args)
  }

  /**
   * Warning logs - always shown
   */
  warn(...args: any[]) {
    console.warn(`[${this.context}]`, ...args)
  }

  /**
   * Error logs - always shown
   */
  error(...args: any[]) {
    console.error(`[${this.context}]`, ...args)
  }

  /**
   * Create a child logger with a sub-context
   */
  child(subContext: string): Logger {
    return new Logger(`${this.context}:${subContext}`, this.debugMode)
  }
}
