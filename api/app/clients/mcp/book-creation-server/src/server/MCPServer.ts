/**
 * Main MCP Server Implementation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { AuthorizationError, DatabaseError, NotFoundError, ValidationError } from '../../types/errors.js';
import { BaseService, ServiceHealth, ServiceHealthStatus } from '../core/BaseService.js';
import { ILogger } from '../interfaces/ILogger.js';
import { ServiceContainer } from '../core/ServiceContainer.js';
import { IMCPServer, IToolHandler, SERVICE_TOKENS } from '../interfaces/index.js';

// Tool handlers
import AnalysisToolHandlers from './tools/AnalysisToolHandlers.js';
import { BookToolHandlers } from './tools/BookToolHandlers.js';
import { ChapterToolHandlers } from './tools/ChapterToolHandlers.js';
import { ComicToolHandlers } from './tools/ComicToolHandlers.js';
import { ExportToolHandlers } from './tools/ExportToolHandlers.js';
import { ImageToolHandlers } from './tools/ImageToolHandlers.js';
import { PageToolHandlers } from './tools/PageToolHandlers.js';
import PlanningToolHandlers from './tools/PlanningToolHandlers.js';
import WritingAssistantToolHandlers from './tools/WritingAssistantToolHandlers.js';
import ContentEnhancementToolHandlers from './tools/ContentEnhancementToolHandlers.js';
import { NarrativeConsistencyToolHandlers } from './tools/NarrativeConsistencyToolHandlers.js';
import { ConsistencyAwarePageToolHandlers } from './tools/ConsistencyAwarePageToolHandlers.js';
import { CharacterToolHandlers } from './tools/CharacterToolHandlers.js';
import { WorkspaceToolHandlers } from './tools/WorkspaceToolHandlers.js';
import { TimelineToolHandlers } from './tools/TimelineToolHandlers.js';
import { CompatibilityToolHandlers } from './tools/CompatibilityToolHandlers.js';
import { RevisionToolHandlers } from './tools/RevisionToolHandlers.js';
import { ConversationToolHandlers } from './tools/ConversationToolHandlers.js';
import { UtilityToolHandlers } from './tools/UtilityToolHandlers.js';
import { CodexToolHandlers } from './tools/CodexToolHandlers.js';
import { OutlineToolHandlers } from './tools/OutlineToolHandlers.js';

export class MCPServer extends BaseService implements IMCPServer {
    private server: Server;
    private serviceContainer: ServiceContainer;
    private toolHandlers: Map<string, IToolHandler> = new Map();
    private isRunning = false;

    constructor(logger: ILogger, serviceContainer: ServiceContainer) {
        super(logger);
        this.serviceContainer = serviceContainer;

        this.server = new Server(
            {
                name: 'book-creation-server',
                version: '2.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );
    }

    protected async onInitialize(): Promise<void> {
        await this.setupServices();
        await this.registerToolHandlers();
        this.setupServerHandlers();
        this.setupErrorHandling();
    }

    protected async onDispose(): Promise<void> {
        await this.stop();
    }

    protected async performHealthCheck(): Promise<ServiceHealth> {
        try {
            const registeredToolsCount = this.toolHandlers.size;
            const serverRunning = this.isRunning;

            // Check if essential services are healthy
            const bookService = this.serviceContainer.resolve(SERVICE_TOKENS.BOOK_SERVICE);
            const configService = this.serviceContainer.resolve(SERVICE_TOKENS.CONFIG_SERVICE);
            const databaseService = this.serviceContainer.resolve(SERVICE_TOKENS.DATABASE_SERVICE);

            const serviceHealthChecks = await Promise.all([
                (bookService as any)?.checkHealth?.() || { status: ServiceHealthStatus.UNKNOWN },
                (configService as any)?.checkHealth?.() || { status: ServiceHealthStatus.UNKNOWN },
                (databaseService as any)?.checkHealth?.() || { status: ServiceHealthStatus.UNKNOWN },
            ]);

            const unhealthyServices = serviceHealthChecks.filter(
                (health: any) => health.status === ServiceHealthStatus.UNHEALTHY
            );

            if (unhealthyServices.length > 0) {
                return {
                    status: ServiceHealthStatus.DEGRADED,
                    message: `${unhealthyServices.length} service(s) are unhealthy`,
                    details: {
                        serverRunning,
                        registeredTools: registeredToolsCount,
                        unhealthyServices: unhealthyServices.length,
                    },
                    lastCheck: new Date(),
                };
            }

            return {
                status: ServiceHealthStatus.HEALTHY,
                message: 'MCP Server is operational',
                details: {
                    serverRunning,
                    registeredTools: registeredToolsCount,
                    servicesHealthy: serviceHealthChecks.length,
                },
                lastCheck: new Date(),
            };
        } catch (error) {
            return {
                status: ServiceHealthStatus.UNHEALTHY,
                message: `MCP Server health check failed: ${(error as Error).message}`,
                details: { error: (error as Error).stack },
                lastCheck: new Date(),
            };
        }
    }

    private async setupServices(): Promise<void> {
        this.logger.info('Setting up services');

        // Initialize all services in the container
        const serviceKeys = this.serviceContainer.getRegisteredServices();

        for (const serviceKey of serviceKeys) {
            try {
                const service = this.serviceContainer.resolve(serviceKey);
                if (service && typeof service.initialize === 'function') {
                    await service.initialize();
                    this.logger.debug('Service initialized', { service: String(serviceKey) });
                }
            } catch (error) {
                this.logger.error('Failed to initialize service', { error: error as Error, service: String(serviceKey) });
                throw error;
            }
        }

        this.logger.info('All services initialized successfully');
    }

    private async registerToolHandlers(): Promise<void> {
        this.logger.info('Registering tool handlers');

        // Get services
        const bookService = this.serviceContainer.resolve(SERVICE_TOKENS.BOOK_SERVICE) as any;
        const exportService = this.serviceContainer.resolve(SERVICE_TOKENS.EXPORT_SERVICE) as any;
        const imageService = this.serviceContainer.resolve(SERVICE_TOKENS.IMAGE_SERVICE) as any;

        // Get narrative consistency services
        const narrativeConsistencyService = this.serviceContainer.resolve('NarrativeConsistencyService') as any;
        const consistencyValidationService = this.serviceContainer.resolve('ConsistencyValidationService') as any;

        // Register tool handler groups
        const toolHandlerGroups = [
            new BookToolHandlers(this.logger, bookService, narrativeConsistencyService),
            new ChapterToolHandlers(this.logger, bookService, narrativeConsistencyService),
            new PageToolHandlers(this.logger, bookService, narrativeConsistencyService),
            new ComicToolHandlers(this.logger, bookService, narrativeConsistencyService),
            new ImageToolHandlers(this.logger, imageService, narrativeConsistencyService),
            new ExportToolHandlers(this.logger, exportService, bookService, narrativeConsistencyService),
            // New planning & analysis tools
            new PlanningToolHandlers(this.logger, bookService),
            new AnalysisToolHandlers(
                this.logger,
                this.serviceContainer.resolve(SERVICE_TOKENS.ANALYTICS_SERVICE) as any,
                bookService,
                this.serviceContainer.resolve(SERVICE_TOKENS.AI_CONTENT_SERVICE) as any
            ),
            // Writing assistant features
            new WritingAssistantToolHandlers(
                this.serviceContainer.resolve('WritingAssistantService') as any,
                this.serviceContainer.resolve('PlotAnalysisService') as any,
                this.logger
            ),
            new ContentEnhancementToolHandlers(
                this.serviceContainer.resolve('ContentEnhancementService') as any,
                this.logger
            ),
            // Narrative consistency tools
            new NarrativeConsistencyToolHandlers(this.logger, narrativeConsistencyService),
            new ConsistencyAwarePageToolHandlers(this.logger, bookService, narrativeConsistencyService),
            // Story Codex for context retrieval
            new CodexToolHandlers(this.logger, this.serviceContainer.resolve('CodexRagService') as any),
            // Character management tools
            new CharacterToolHandlers(
                this.logger,
                this.serviceContainer.resolve('ContentEnhancementService') as any,
                narrativeConsistencyService,
                imageService
            ),
            // NovelCrafter-like features
            new WorkspaceToolHandlers(this.logger),
            new TimelineToolHandlers(this.logger),
            new RevisionToolHandlers(this.logger),
            new ConversationToolHandlers(this.logger),
            new UtilityToolHandlers(this.logger),
            // Outline management tools
            new OutlineToolHandlers(this.logger),
        ];

        for (const handlerGroup of toolHandlerGroups) {
            const tools = handlerGroup.getTools();
            for (const tool of tools) {
                this.registerTool(tool);
            }
        }

        this.logger.info(`Registered ${this.toolHandlers.size} tools`);
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

                // Emit update notification after successful tool execution
                this.emitUpdateNotification(name, args, result);

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
                    // Normalize result: convert legacy 'resource' objects with URI to 'resource_link'
                    const normalized = result.map((part: any) => {
                        if (part && part.type === 'resource' && part.resource && typeof part.resource.uri === 'string') {
                            return {
                                type: 'resource_link',
                                name: part.resource.name || 'Resource',
                                uri: part.resource.uri,
                            };
                        }
                        return part;
                    });
                    return {
                        content: normalized,
                    };
                } else {
                    // Object result - stringify it
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
                } else if (error instanceof AuthorizationError) {
                    throw new McpError(ErrorCode.InternalError, error.message);
                } else if (error instanceof DatabaseError) {
                    throw new McpError(ErrorCode.InternalError, 'Database operation failed');
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

    // IMCPServer implementation
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
        return this.executeWithLogging('start', async () => {
            if (this.isRunning) {
                this.logger.warn('Server is already running');
                return;
            }

            this.logger.info('Starting MCP Server');

            const transport = new StdioServerTransport();
            await this.server.connect(transport);

            this.isRunning = true;
            this.logger.info('MCP Server started successfully', {
                tools: this.toolHandlers.size,
            });
        });
    }

    async stop(): Promise<void> {
        return this.executeWithLogging('stop', async () => {
            if (!this.isRunning) {
                this.logger.warn('Server is not running');
                return;
            }

            this.logger.info('Stopping MCP Server');

            try {
                await this.server.close();
                this.isRunning = false;

                // Dispose all services
                const serviceKeys = this.serviceContainer.getRegisteredServices();
                for (const serviceKey of serviceKeys) {
                    try {
                        const service = this.serviceContainer.resolve(serviceKey);
                        if (service && typeof service.dispose === 'function') {
                            await service.dispose();
                        }
                    } catch (error) {
                        this.logger.warn('Failed to dispose service', {
                            service: String(serviceKey),
                            error: (error as Error).message
                        });
                    }
                }

                this.logger.info('MCP Server stopped successfully');
            } catch (error) {
                this.logger.error('Error stopping MCP Server', error as Error);
                throw error;
            }
        });
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

    /**
     * Emit update notification after successful tool execution
     */
    private emitUpdateNotification(toolName: string, args: any, result: any): void {
        try {
            // Extract book ID from args
            const bookId = args?.bookId || args?.book_id;
            if (!bookId) {
                return; // No book ID to notify about
            }

            // Determine update type based on tool name
            let updateType = 'book_updated';
            if (toolName.includes('chapter')) {
                updateType = 'chapter_updated';
            } else if (toolName.includes('page')) {
                updateType = 'page_updated';
            } else if (toolName.includes('export')) {
                updateType = 'export_ready';
            }

            // Make HTTP request to notify the book update service
            const notificationData = {
                bookId,
                updateType,
                toolName,
                timestamp: new Date().toISOString(),
                metadata: {
                    chapterId: args?.chapterId,
                    pageId: args?.pageId,
                    operation: toolName,
                }
            };

            // Use HTTP request to notify the main server
            // Note: This is done asynchronously to not block the tool response
            this.notifyBookUpdateService(notificationData).catch((error) => {
                this.logger.warn('Failed to notify book update service', {
                    error: (error as Error).message,
                    toolName,
                    bookId
                });
            });

        } catch (error) {
            this.logger.warn('Error in emitUpdateNotification', {
                error: (error as Error).message,
                toolName
            });
        }
    }

    /**
     * Notify the book update service via HTTP
     */
    private async notifyBookUpdateService(data: any): Promise<void> {
        const serverHost = process.env.SERVER_HOST || 'http://localhost:3080';

        try {
            const response = await fetch(`${serverHost}/api/book-updates/notify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            // Log but don't throw - we don't want notification failures to break tool execution
            this.logger.debug('Book update notification failed', {
                error: (error as Error).message,
                data
            });
        }
    }

    async getServerStatus(): Promise<{
        running: boolean;
        tools: number;
        services: number;
        health: ServiceHealth;
    }> {
        const health = await this.performHealthCheck();

        return {
            running: this.isRunning,
            tools: this.toolHandlers.size,
            services: this.serviceContainer.getRegisteredServices().length,
            health,
        };
    }
}
