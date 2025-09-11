/**
 * Main MCP Server Implementation for Toki Looker Integration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { ILogger } from '../interfaces/ILogger.js';
import { ILookerService } from '../interfaces/ILookerService.js';
import { IToolHandler } from '../interfaces/index.js';
import { LookerToolHandlers } from './tools/LookerToolHandlers.js';
import {
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ValidationError,
    RateLimitError,
    NetworkError,
    LookerError
} from '../../types/errors.js';

export class MCPServer {
    private server: Server;
    private logger: ILogger;
    private lookerService: ILookerService;
    private toolHandlers: Map<string, IToolHandler> = new Map();
    private isRunning = false;

    constructor(logger: ILogger, lookerService: ILookerService) {
        this.logger = logger;
        this.lookerService = lookerService;

        this.server = new Server(
            {
                name: 'toki-looker-server',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );
    }

    async initialize(): Promise<void> {
        this.logger.info('Initializing Toki Looker MCP Server');

        try {
            // Note: We defer Looker authentication until first tool call (lazy initialization)
            // This allows the MCP server to start even without valid Looker credentials

            // Register tool handlers
            await this.registerToolHandlers();

            // Setup server handlers
            this.setupServerHandlers();

            // Setup error handling
            this.setupErrorHandling();

            this.logger.info('Toki Looker MCP Server initialized successfully', {
                toolsRegistered: this.toolHandlers.size,
                lookerAuthDeferred: true
            });
        } catch (error) {
            this.logger.error('Failed to initialize MCP Server', error);
            throw error;
        }
    }

    private async registerToolHandlers(): Promise<void> {
        this.logger.info('Registering Looker tool handlers');

        const lookerToolHandlers = new LookerToolHandlers(this.logger, this.lookerService);
        const tools = lookerToolHandlers.getTools();

        for (const tool of tools) {
            this.registerTool(tool);
        }

        this.logger.info(`Registered ${this.toolHandlers.size} Looker tools`);
    }

    private setupServerHandlers(): void {
        // List tools handler
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            const tools = Array.from(this.toolHandlers.values()).map(handler => ({
                name: handler.name,
                description: handler.description,
                inputSchema: handler.inputSchema,
            }));

            return { tools };
        });

        // Call tool handler
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            const handler = this.toolHandlers.get(name);
            if (!handler) {
                throw new McpError(
                    ErrorCode.MethodNotFound,
                    `Tool '${name}' not found`
                );
            }

            try {
                this.logger.debug('Executing tool', { tool: name, args });
                const result = await handler.handler(args || {});

                // Handle different result types
                if (typeof result === 'string') {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: result,
                            },
                        ],
                    };
                } else if (Array.isArray(result)) {
                    return {
                        content: result,
                    };
                } else {
                    // Object result - format it nicely
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(result, null, 2),
                            },
                        ],
                    };
                }
            } catch (error) {
                this.logger.error('Tool execution failed', { error: error as Error, tool: name, args });

                // Convert application errors to MCP errors
                if (error instanceof ValidationError) {
                    throw new McpError(ErrorCode.InvalidParams, error.message);
                } else if (error instanceof NotFoundError) {
                    throw new McpError(ErrorCode.InternalError, error.message);
                } else if (error instanceof AuthenticationError) {
                    throw new McpError(ErrorCode.InternalError, `Authentication error: ${error.message}`);
                } else if (error instanceof AuthorizationError) {
                    throw new McpError(ErrorCode.InternalError, `Authorization error: ${error.message}`);
                } else if (error instanceof RateLimitError) {
                    throw new McpError(ErrorCode.InternalError, `Rate limit error: ${error.message}`);
                } else if (error instanceof NetworkError) {
                    throw new McpError(ErrorCode.InternalError, `Network error: ${error.message}`);
                } else if (error instanceof LookerError) {
                    throw new McpError(ErrorCode.InternalError, `Looker error: ${error.message}`);
                } else {
                    throw new McpError(ErrorCode.InternalError, 'An unexpected error occurred');
                }
            }
        });
    }

    private setupErrorHandling(): void {
        process.on('uncaughtException', (error) => {
            this.logger.error('Uncaught exception', error);
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('Unhandled rejection', { error: reason as Error, promise });
            process.exit(1);
        });

        process.on('SIGINT', async () => {
            this.logger.info('Received SIGINT, shutting down gracefully');
            await this.stop();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            this.logger.info('Received SIGTERM, shutting down gracefully');
            await this.stop();
            process.exit(0);
        });
    }

    registerTool(tool: IToolHandler): void {
        if (this.toolHandlers.has(tool.name)) {
            throw new Error(`Tool '${tool.name}' is already registered`);
        }

        this.toolHandlers.set(tool.name, tool);
        this.logger.debug('Tool registered', { name: tool.name });
    }

    registerTools(tools: IToolHandler[]): void {
        for (const tool of tools) {
            this.registerTool(tool);
        }
    }

    getRegisteredTools(): IToolHandler[] {
        return Array.from(this.toolHandlers.values());
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            this.logger.warn('Server is already running');
            return;
        }

        this.logger.info('Starting Toki Looker MCP Server');

        const transport = new StdioServerTransport();
        await this.server.connect(transport);

        this.isRunning = true;
        this.logger.info('Toki Looker MCP Server started successfully', {
            tools: this.toolHandlers.size,
        });
    }

    async stop(): Promise<void> {
        if (!this.isRunning) {
            this.logger.warn('Server is not running');
            return;
        }

        this.logger.info('Stopping Toki Looker MCP Server');

        try {
            await this.server.close();
            this.isRunning = false;
            this.logger.info('Toki Looker MCP Server stopped successfully');
        } catch (error) {
            this.logger.error('Error stopping MCP Server', error as Error);
            throw error;
        }
    }

    // Utility methods
    isServerRunning(): boolean {
        return this.isRunning;
    }

    getToolNames(): string[] {
        return Array.from(this.toolHandlers.keys());
    }

    getToolByName(name: string): IToolHandler | undefined {
        return this.toolHandlers.get(name);
    }

    async getServerStatus(): Promise<{
        running: boolean;
        tools: number;
        lookerAuthenticated: boolean;
    }> {
        return {
            running: this.isRunning,
            tools: this.toolHandlers.size,
            lookerAuthenticated: this.lookerService.isAuthenticated(),
        };
    }
}
