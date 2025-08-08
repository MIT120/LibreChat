/**
 * Centralized logging system with different log levels
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    message: string;
    context?: Record<string, any>;
    error?: Error;
}

export interface ILogger {
    debug(message: string, context?: Record<string, any>): void;
    info(message: string, context?: Record<string, any>): void;
    warn(message: string, context?: Record<string, any>): void;
    error(message: string, error?: Error, context?: Record<string, any>): void;
    setLevel(level: LogLevel): void;
    getLevel(): LogLevel;
    child(prefix: string): ILogger;
}

export class Logger implements ILogger {
    private currentLevel: LogLevel = LogLevel.INFO;
    private prefix: string;

    constructor(prefix: string = 'BookCreationServer') {
        this.prefix = prefix;
    }

    setLevel(level: LogLevel): void {
        this.currentLevel = level;
    }

    getLevel(): LogLevel {
        return this.currentLevel;
    }

    debug(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.DEBUG, message, context);
    }

    info(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.INFO, message, context);
    }

    warn(message: string, context?: Record<string, any>): void {
        this.log(LogLevel.WARN, message, context);
    }

    error(message: string, error?: Error, context?: Record<string, any>): void {
        this.log(LogLevel.ERROR, message, context, error);
    }

    private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
        if (level < this.currentLevel) {
            return;
        }

        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            message,
            ...(context && { context }),
            ...(error && { error }),
        };

        this.output(entry);
    }

    private output(entry: LogEntry): void {
        const timestamp = entry.timestamp.toISOString();
        const levelName = LogLevel[entry.level];
        const prefix = `[${timestamp}] [${this.prefix}] [${levelName}]`;

        let logMessage = `${prefix} ${entry.message}`;

        if (entry.context && Object.keys(entry.context).length > 0) {
            logMessage += ` ${JSON.stringify(entry.context)}`;
        }

        const logMethod = this.getConsoleMethod(entry.level);

        if (entry.error) {
            logMethod(logMessage, entry.error);
        } else {
            logMethod(logMessage);
        }
    }

    private getConsoleMethod(level: LogLevel): typeof console.log {
        switch (level) {
            case LogLevel.DEBUG:
                return console.debug;
            case LogLevel.INFO:
                return console.info;
            case LogLevel.WARN:
                return console.warn;
            case LogLevel.ERROR:
                return console.error;
            default:
                return console.log;
        }
    }

    /**
     * Create a child logger with additional prefix
     */
    child(additionalPrefix: string): Logger {
        const childLogger = new Logger(`${this.prefix}:${additionalPrefix}`);
        childLogger.setLevel(this.currentLevel);
        return childLogger;
    }
}

// Global logger instance
export const logger = new Logger();

// Service tokens for dependency injection
export const LOGGER_TOKEN = Symbol('Logger');
