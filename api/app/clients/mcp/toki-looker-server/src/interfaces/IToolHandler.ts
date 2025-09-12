/**
 * Interface for MCP tool handlers
 */

export interface IToolHandler {
    name: string;
    description: string;
    inputSchema: any;
    handler: (args?: any) => Promise<any>;
}
