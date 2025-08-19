/**
 * Logger interface for the MCP server - compatible with core Logger
 */
export interface ILogger {
    info(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
    child(name: string): ILogger;
    // Add compatibility methods for BaseToolHandler
    setLevel(level: any): void;
    getLevel(): any;
}
