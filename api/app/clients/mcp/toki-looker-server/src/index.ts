/**
 * Refactored Looker MCP Server - Main entry point using improved architecture
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Import components
import { LookerConfigManager } from './config/LookerConfig.js';
import { LookerServiceFactory } from './factories/LookerServiceFactory.js';
import { LookerToolHandlers } from './server/tools/LookerToolHandlers.js';
import { QueryValidator } from './validation/QueryValidator.js';

// Import interfaces
import { ILogger, LogLevel } from './interfaces/ILogger.js';

// Simple console logger implementation
class ConsoleLogger implements ILogger {
    private logLevel: LogLevel = LogLevel.INFO;

    setLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    info(message: string, meta?: any): void {
        console.log(`[INFO] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
    }

    debug(message: string, meta?: any): void {
        if (this.logLevel <= LogLevel.DEBUG || process.env.LOG_LEVEL === 'debug') {
            console.log(`[DEBUG] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
        }
    }

    warn(message: string, meta?: any): void {
        console.warn(`[WARN] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
    }

    error(message: string, error?: any): void {
        console.error(`[ERROR] ${message}`, error);
    }
}

class LookerMCPServer {
    private server: Server;
    private logger: ILogger;
    private configManager: LookerConfigManager;
    private factory: LookerServiceFactory;
    private toolHandlers?: LookerToolHandlers;

    constructor() {
        this.logger = new ConsoleLogger();
        this.configManager = new LookerConfigManager(this.logger);
        this.factory = LookerServiceFactory.getInstance();

        // Initialize server
        this.server = new Server(
            {
                name: 'looker-mcp-server',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupHandlers();
    }

    private setupHandlers(): void {
        // List tools handler
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            try {
                const config = this.configManager.loadConfig();
                const lookerService = this.factory.createLookerService(this.logger, config);
                this.toolHandlers = new LookerToolHandlers(this.logger, lookerService);
                const tools = this.toolHandlers.getTools();

                this.logger.info(`Listing ${tools.length} tools`);
                return {
                    tools: tools.map((tool: any) => ({
                        name: tool.name,
                        description: tool.description,
                        inputSchema: tool.inputSchema
                    }))
                };
            } catch (error) {
                this.logger.error('Failed to list tools', error);
                throw error;
            }
        });

        // Call tool handler
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                const { name, arguments: args } = request.params;
                this.logger.info(`Calling tool: ${name}`, { args });

                if (!this.toolHandlers) {
                    const config = this.configManager.loadConfig();
                    const lookerService = this.factory.createLookerService(this.logger, config);
                    this.toolHandlers = new LookerToolHandlers(this.logger, lookerService);
                }

                const tools = this.toolHandlers.getTools();
                const tool = tools.find((t: any) => t.name === name);

                if (!tool) {
                    throw new Error(`Tool not found: ${name}`);
                }

                // Validate arguments if validator is available
                if (args && this.shouldValidateTool(name)) {
                    this.validateToolArguments(name, args);
                }

                const result = await tool.handler(args);
                this.logger.info(`Tool ${name} completed successfully`);

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            } catch (error) {
                this.logger.error(`Tool ${request.params.name} failed`, error);

                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: false,
                                error: error instanceof Error ? error.message : String(error),
                                message: `Tool execution failed: ${request.params.name}`
                            }, null, 2)
                        }
                    ],
                    isError: true
                };
            }
        });
    }

    private shouldValidateTool(toolName: string): boolean {
        const validationRequiredTools = [
            'looker-query',
            'looker-query-sql',
            'looker-query-url',
            'looker-make-look',
            'looker-analyze-electricity'
        ];
        return validationRequiredTools.includes(toolName);
    }

    private validateToolArguments(toolName: string, args: any): void {
        try {
            switch (toolName) {
                case 'looker-query':
                case 'looker-query-sql':
                case 'looker-query-url':
                    if (args.model && args.explore) {
                        QueryValidator.validateQuery({
                            model: args.model,
                            explore: args.explore,
                            dimensions: args.dimensions,
                            measures: args.measures,
                            filters: args.filters,
                            sorts: args.sorts,
                            limit: args.limit
                        });
                    }
                    break;
                case 'looker-analyze-electricity':
                    QueryValidator.validateElectricityAnalysisRequest(args);
                    break;
            }
        } catch (error) {
            this.logger.warn(`Validation failed for tool ${toolName}`, error);
            // Don't throw here - let the tool handle the validation error
        }
    }

    async run(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        this.logger.info('Looker MCP Server started successfully');
    }
}

// Start the server
const server = new LookerMCPServer();
server.run().catch((error) => {
    console.error('Failed to start Looker MCP Server:', error);
    process.exit(1);
});
