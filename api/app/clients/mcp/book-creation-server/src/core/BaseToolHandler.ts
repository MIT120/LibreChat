/**
 * Base Tool Handler class to reduce boilerplate code across tool handlers
 */

import { z, ZodSchema } from 'zod';
import { ILogger } from '../interfaces/ILogger.js';
import { IToolHandler } from '../interfaces/index.js';
import { ToolExecutor } from '../server/ToolExecutor.js';

/**
 * Configuration for a single tool
 */
export interface ToolConfig<TInput = any, TOutput = any> {
    name: string;
    description: string;
    inputSchema: Record<string, any>; // JSON Schema
    zodSchema: ZodSchema<TInput>;
    handler: (input: TInput) => Promise<TOutput>;
    formatter?: (result: TOutput, input: TInput) => Promise<any> | any;
}

/**
 * Base class for tool handlers that provides common functionality
 */
export abstract class BaseToolHandler {
    protected logger: ILogger;
    protected tools: Map<string, ToolConfig> = new Map();

    constructor(logger: ILogger, className?: string) {
        this.logger = logger.child(className || this.constructor.name);
    }

    /**
     * Register a tool with the handler
     */
    protected registerTool<TInput, TOutput>(config: ToolConfig<TInput, TOutput>): void {
        this.tools.set(config.name, config);
        this.logger.debug(`Registered tool: ${config.name}`);
    }

    /**
     * Get all registered tools as MCP tool handlers
     */
    getTools(): IToolHandler[] {
        return Array.from(this.tools.values()).map(config => ({
            name: config.name,
            description: config.description,
            inputSchema: config.inputSchema,
            handler: async (args: any) => {
                return ToolExecutor.run({
                    name: config.name,
                    logger: this.logger,
                    schema: config.zodSchema,
                    args,
                    perform: config.handler,
                    format: config.formatter || this.defaultFormatter,
                });
            },
        }));
    }

    /**
     * Default formatter - just returns the result as a string
     */
    protected defaultFormatter(result: any): string {
        if (typeof result === 'string') {
            return result;
        }
        return JSON.stringify(result, null, 2);
    }

    /**
     * Create a standardized success response
     */
    protected createSuccessResponse(
        entityType: string,
        action: string,
        entity: any,
        additionalInfo?: string
    ): string {
        const timestamp = new Date().toLocaleDateString();
        let response = `✅ ${entityType} ${action} successfully!\n\n`;

        if (entity._id) {
            response += `**${entityType} ID:** ${entity._id}\n`;
        }

        if (entity.title || entity.name) {
            response += `**Title:** ${entity.title || entity.name}\n`;
        }

        if (entity.status) {
            response += `**Status:** ${entity.status}\n`;
        }

        response += `**${action === 'created' ? 'Created' : 'Updated'}:** ${timestamp}\n`;

        if (additionalInfo) {
            response += `\n${additionalInfo}`;
        }

        return response;
    }

    /**
     * Create a standardized list response
     */
    protected createListResponse<T>(
        entityType: string,
        items: T[],
        formatter: (item: T, index: number) => string,
        totalCount?: number,
        pagination?: { offset: number; limit: number; hasMore: boolean }
    ): string {
        if (items.length === 0) {
            return `📚 No ${entityType.toLowerCase()}s found.`;
        }

        let response = `📚 **${entityType}s**\n\n`;

        if (totalCount !== undefined) {
            response += `Found ${totalCount} ${entityType.toLowerCase()}(s)\n`;
        }

        if (pagination) {
            response += `Showing ${items.length} of ${totalCount || items.length} ` +
                `(${pagination.offset + 1}-${pagination.offset + items.length})\n\n`;
        }

        items.forEach((item, index) => {
            response += formatter(item, index) + '\n\n';
        });

        if (pagination?.hasMore) {
            response += `📄 More results available. Use offset ${pagination.offset + pagination.limit} to see more.`;
        }

        return response.trim();
    }

    /**
     * Create a standardized detail response
     */
    protected createDetailResponse(
        entityType: string,
        entity: any,
        sections: Array<{ title: string; content: string; condition?: boolean }>
    ): string {
        let response = `📖 **${entity.title || entity.name || entityType}**\n\n`;

        // Add main information section
        response += `**${entityType} Information:**\n`;
        if (entity._id) response += `- **ID:** ${entity._id}\n`;
        if (entity.status) response += `- **Status:** ${entity.status}\n`;
        if (entity.createdAt) response += `- **Created:** ${new Date(entity.createdAt).toLocaleDateString()}\n`;
        if (entity.updatedAt) response += `- **Last Updated:** ${new Date(entity.updatedAt).toLocaleDateString()}\n`;

        // Add custom sections
        sections.forEach(section => {
            if (section.condition !== false) {
                response += `\n**${section.title}:**\n${section.content}\n`;
            }
        });

        return response;
    }

    /**
     * Abstract method for derived classes to define their tools
     */
    protected abstract defineTools(): void;

    /**
     * Initialize the tool handler by defining tools
     */
    initialize(): void {
        this.defineTools();
        this.logger.info(`Initialized ${this.tools.size} tools`);
    }
}
