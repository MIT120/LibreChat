/**
 * Simple Logger Implementation
 */

import { ILogger, LogLevel } from '../interfaces/ILogger.js';

export class Logger implements ILogger {
    private level: LogLevel = LogLevel.INFO;
    private context: string;

    constructor(context: string = 'TokiLookerServer') {
        this.context = context;
    }

    setLevel(level: LogLevel): void {
        this.level = level;
    }

    debug(message: string, data?: any): void {
        if (this.level <= LogLevel.DEBUG) {
            this.log('DEBUG', message, data);
        }
    }

    info(message: string, data?: any): void {
        if (this.level <= LogLevel.INFO) {
            this.log('INFO', message, data);
        }
    }

    warn(message: string, data?: any): void {
        if (this.level <= LogLevel.WARN) {
            this.log('WARN', message, data);
        }
    }

    error(message: string, error?: Error | any): void {
        if (this.level <= LogLevel.ERROR) {
            this.log('ERROR', message, error);
        }
    }

    private log(level: string, message: string, data?: any): void {
        const timestamp = new Date().toISOString();
        let logEntry = `${timestamp} [${level}] [${this.context}] ${message}`;

        if (data) {
            if (data instanceof Error) {
                logEntry += `\nError: ${data.message}\nStack: ${data.stack}`;
            } else if (typeof data === 'object') {
                try {
                    logEntry += `\nData: ${JSON.stringify(data, null, 2)}`;
                } catch (e) {
                    logEntry += `\nData: [object could not be serialized]`;
                }
            } else {
                logEntry += `\nData: ${data}`;
            }
        }

        console.log(logEntry);
    }
}

export { LogLevel };
