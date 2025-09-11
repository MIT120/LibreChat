/**
 * Interfaces Index - Export all interface definitions
 */

export * from './ILogger.js';
export * from './ILookerService.js';

// Tool Handler Interface
export interface IToolHandler {
    name: string;
    description: string;
    inputSchema: any;
    handler: (args: any) => Promise<any>;
}
