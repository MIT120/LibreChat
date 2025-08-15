/**
 * Tool Factory for generating common tool configurations
 */

import { z } from 'zod';
import { ToolConfig } from './BaseToolHandler.js';
import { getSchemaRegistry } from './SchemaRegistry.js';
import { GenericFormatters } from './ResponseFormatters.js';

/**
 * CRUD operation types
 */
export type CrudOperation = 'create' | 'get' | 'list' | 'update' | 'delete';

/**
 * CRUD handlers interface
 */
export interface CrudHandlers<TEntity, TCreateInput, TUpdateInput, TListInput> {
    create?: (input: TCreateInput) => Promise<TEntity>;
    get?: (id: string, options?: any) => Promise<TEntity>;
    list?: (input: TListInput) => Promise<{ data: TEntity[]; pagination: any }>;
    update?: (id: string, updates: TUpdateInput) => Promise<TEntity>;
    delete?: (id: string, authorId: string) => Promise<void>;
}

/**
 * CRUD formatters interface
 */
export interface CrudFormatters<TEntity> {
    created?: (entity: TEntity) => string;
    detail?: (entity: TEntity) => string;
    list?: (result: { data: TEntity[]; pagination: any }) => string;
    updated?: (entity: TEntity, updatedFields: string[]) => string;
    deleted?: (entityId: string) => string;
}

/**
 * Tool factory for creating standardized tools
 */
export class ToolFactory {
    /**
     * Create a complete CRUD tool set for an entity
     */
    static createCrudTools<TEntity, TCreateInput, TUpdateInput, TListInput>(
        entityName: string,
        entityNameLower: string,
        handlers: CrudHandlers<TEntity, TCreateInput, TUpdateInput, TListInput>,
        formatters: CrudFormatters<TEntity>,
        options: {
            includeOperations?: CrudOperation[];
            customDescriptions?: Partial<Record<CrudOperation, string>>;
        } = {}
    ): ToolConfig[] {
        const tools: ToolConfig[] = [];
        const registry = getSchemaRegistry();
        const operations = options.includeOperations || ['create', 'get', 'list', 'update', 'delete'];

        // Create operation
        if (operations.includes('create') && handlers.create) {
            tools.push({
                name: `create_${entityNameLower}`,
                description: options.customDescriptions?.create || 
                           `Create a new ${entityNameLower}`,
                inputSchema: registry.getInputSchema(`create${entityName}`) || {},
                zodSchema: registry.get(`create${entityName}`) || z.any(),
                handler: handlers.create,
                formatter: formatters.created || 
                          ((entity: any) => GenericFormatters.created(entityName, entity)),
            });
        }

        // Get operation
        if (operations.includes('get') && handlers.get) {
            tools.push({
                name: `get_${entityNameLower}`,
                description: options.customDescriptions?.get || 
                           `Retrieve a ${entityNameLower} by ID`,
                inputSchema: {
                    type: 'object',
                    properties: {
                        [`${entityNameLower}Id`]: { 
                            type: 'string', 
                            description: `${entityName} identifier` 
                        },
                    },
                    required: [`${entityNameLower}Id`],
                },
                zodSchema: z.object({
                    [`${entityNameLower}Id`]: z.string().min(1),
                }),
                handler: async (input: any) => handlers.get!(input[`${entityNameLower}Id`]),
                formatter: formatters.detail || 
                          ((entity: any) => JSON.stringify(entity, null, 2)),
            });
        }

        // List operation
        if (operations.includes('list') && handlers.list) {
            tools.push({
                name: `list_${entityNameLower}s`,
                description: options.customDescriptions?.list || 
                           `List ${entityNameLower}s with filtering options`,
                inputSchema: registry.getInputSchema(`list${entityName}s`) || 
                           registry.getInputSchema('listBooks') || {}, // Fallback
                zodSchema: registry.get(`list${entityName}s`) || 
                          registry.get('listBooks') || z.any(), // Fallback
                handler: handlers.list,
                formatter: formatters.list || 
                          ((result: any) => JSON.stringify(result, null, 2)),
            });
        }

        // Update operation
        if (operations.includes('update') && handlers.update) {
            tools.push({
                name: `update_${entityNameLower}`,
                description: options.customDescriptions?.update || 
                           `Update ${entityNameLower} information`,
                inputSchema: {
                    type: 'object',
                    properties: {
                        [`${entityNameLower}Id`]: { 
                            type: 'string', 
                            description: `${entityName} identifier` 
                        },
                        updates: {
                            type: 'object',
                            description: 'Object containing fields to update',
                        },
                    },
                    required: [`${entityNameLower}Id`, 'updates'],
                },
                zodSchema: z.object({
                    [`${entityNameLower}Id`]: z.string().min(1),
                    updates: registry.get(`update${entityName}`) || z.any(),
                }),
                handler: async (input: any) => {
                    return handlers.update!(input[`${entityNameLower}Id`], input.updates);
                },
                formatter: formatters.updated || 
                          ((entity: any) => GenericFormatters.updated(entityName, entity)),
            });
        }

        // Delete operation
        if (operations.includes('delete') && handlers.delete) {
            tools.push({
                name: `delete_${entityNameLower}`,
                description: options.customDescriptions?.delete || 
                           `Delete a ${entityNameLower} and all associated content`,
                inputSchema: {
                    type: 'object',
                    properties: {
                        [`${entityNameLower}Id`]: { 
                            type: 'string', 
                            description: `${entityName} identifier` 
                        },
                        authorId: { 
                            type: 'string', 
                            description: 'Author identifier for verification' 
                        },
                    },
                    required: [`${entityNameLower}Id`, 'authorId'],
                },
                zodSchema: z.object({
                    [`${entityNameLower}Id`]: z.string().min(1),
                    authorId: z.string().min(1),
                }),
                handler: async (input: any) => {
                    await handlers.delete!(input[`${entityNameLower}Id`], input.authorId);
                    return { [`${entityNameLower}Id`]: input[`${entityNameLower}Id`] };
                },
                formatter: formatters.deleted || 
                          ((result: any) => GenericFormatters.deleted(entityName, result[`${entityNameLower}Id`])),
            });
        }

        return tools;
    }

    /**
     * Create a simple tool configuration
     */
    static createTool<TInput, TOutput>(config: {
        name: string;
        description: string;
        inputSchema: Record<string, any>;
        zodSchema: z.ZodSchema<TInput>;
        handler: (input: TInput) => Promise<TOutput>;
        formatter?: (output: TOutput, input: TInput) => string;
    }): ToolConfig<TInput, TOutput> {
        return {
            name: config.name,
            description: config.description,
            inputSchema: config.inputSchema,
            zodSchema: config.zodSchema,
            handler: config.handler,
            formatter: config.formatter,
        };
    }

    /**
     * Create a statistics tool
     */
    static createStatsTool<TStats>(
        entityName: string,
        entityNameLower: string,
        handler: (id: string) => Promise<TStats>,
        formatter?: (stats: TStats) => string
    ): ToolConfig {
        return {
            name: `get_${entityNameLower}_statistics`,
            description: `Retrieve detailed statistics about a ${entityNameLower}`,
            inputSchema: {
                type: 'object',
                properties: {
                    [`${entityNameLower}Id`]: { 
                        type: 'string', 
                        description: `${entityName} identifier` 
                    },
                },
                required: [`${entityNameLower}Id`],
            },
            zodSchema: z.object({
                [`${entityNameLower}Id`]: z.string().min(1),
            }),
            handler: async (input: any) => handler(input[`${entityNameLower}Id`]),
            formatter: formatter || ((stats: any) => JSON.stringify(stats, null, 2)),
        };
    }

    /**
     * Create a search tool
     */
    static createSearchTool<TSearchInput, TSearchResult>(
        entityName: string,
        entityNameLower: string,
        handler: (input: TSearchInput) => Promise<TSearchResult[]>,
        inputSchema?: Record<string, any>,
        zodSchema?: z.ZodSchema<TSearchInput>,
        formatter?: (results: TSearchResult[]) => string
    ): ToolConfig {
        const defaultInputSchema = {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query' },
                limit: { type: 'number', description: 'Maximum results', default: 20 },
                offset: { type: 'number', description: 'Pagination offset', default: 0 },
            },
            required: ['query'],
        };

        const defaultZodSchema = z.object({
            query: z.string().min(1),
            limit: z.number().int().min(1).max(100).default(20),
            offset: z.number().int().min(0).default(0),
        });

        return {
            name: `search_${entityNameLower}s`,
            description: `Search ${entityNameLower}s`,
            inputSchema: inputSchema || defaultInputSchema,
            zodSchema: zodSchema || defaultZodSchema,
            handler: handler as any,
            formatter: formatter as any || ((results: any[]) => {
                if (results.length === 0) {
                    return `No ${entityNameLower}s found matching your search.`;
                }
                return `Found ${results.length} ${entityNameLower}(s):\n\n` +
                       results.map((item, i) => `${i + 1}. ${JSON.stringify(item, null, 2)}`).join('\n');
            }),
        };
    }

    /**
     * Create a validation tool
     */
    static createValidationTool<TInput>(
        entityName: string,
        entityNameLower: string,
        validator: (input: TInput) => Promise<{ isValid: boolean; errors: string[] }>,
        inputSchema: Record<string, any>,
        zodSchema: z.ZodSchema<TInput>
    ): ToolConfig {
        return {
            name: `validate_${entityNameLower}`,
            description: `Validate ${entityNameLower} data`,
            inputSchema,
            zodSchema,
            handler: validator,
            formatter: (result: any) => {
                if (result.isValid) {
                    return `✅ ${entityName} data is valid.`;
                } else {
                    return `❌ ${entityName} validation failed:\n\n` +
                           result.errors.map((error: string) => `- ${error}`).join('\n');
                }
            },
        };
    }

    /**
     * Create a batch operation tool
     */
    static createBatchTool<TInput, TOutput>(
        operationName: string,
        entityNameLower: string,
        handler: (inputs: TInput[]) => Promise<TOutput[]>,
        itemInputSchema: Record<string, any>,
        itemZodSchema: z.ZodSchema<TInput>,
        formatter?: (results: TOutput[]) => string
    ): ToolConfig {
        return {
            name: `batch_${operationName}_${entityNameLower}s`,
            description: `Perform batch ${operationName} operation on multiple ${entityNameLower}s`,
            inputSchema: {
                type: 'object',
                properties: {
                    items: {
                        type: 'array',
                        items: itemInputSchema,
                        description: `Array of ${entityNameLower} data`,
                    },
                },
                required: ['items'],
            },
            zodSchema: z.object({
                items: z.array(itemZodSchema),
            }),
            handler: async (input: any) => handler(input.items),
            formatter: formatter || ((results: any[]) => {
                const successful = results.filter(r => !r.error).length;
                const failed = results.length - successful;
                return `✅ Batch operation completed: ${successful} successful, ${failed} failed.`;
            }),
        };
    }
}
