/**
 * Schema Registry for managing and organizing validation schemas
 */

import { z, ZodSchema } from 'zod';
import { 
    CommonSchemas, 
    StatusSchemas, 
    ObjectSchemas, 
    EntitySchemas, 
    InputSchemaGenerators 
} from './CommonSchemas.js';

/**
 * Schema category for organization
 */
export enum SchemaCategory {
    BASIC = 'basic',
    ENTITY = 'entity',
    OPERATION = 'operation',
    VALIDATION = 'validation',
    INPUT = 'input',
}

/**
 * Schema metadata for registry
 */
export interface SchemaMetadata {
    name: string;
    category: SchemaCategory;
    description: string;
    version: string;
    dependencies?: string[];
    examples?: any[];
}

/**
 * Registered schema entry
 */
export interface RegisteredSchema {
    schema: ZodSchema;
    metadata: SchemaMetadata;
    inputSchema?: Record<string, any>; // JSON Schema for MCP tools
}

/**
 * Schema registry for managing all validation schemas
 */
export class SchemaRegistry {
    private static instance: SchemaRegistry;
    private schemas: Map<string, RegisteredSchema> = new Map();
    private categories: Map<SchemaCategory, Set<string>> = new Map();

    private constructor() {
        this.initializeCategories();
        this.registerBuiltInSchemas();
    }

    /**
     * Get singleton instance
     */
    static getInstance(): SchemaRegistry {
        if (!SchemaRegistry.instance) {
            SchemaRegistry.instance = new SchemaRegistry();
        }
        return SchemaRegistry.instance;
    }

    /**
     * Initialize category sets
     */
    private initializeCategories(): void {
        Object.values(SchemaCategory).forEach(category => {
            this.categories.set(category, new Set());
        });
    }

    /**
     * Register built-in schemas
     */
    private registerBuiltInSchemas(): void {
        // Register basic schemas
        Object.entries(CommonSchemas).forEach(([name, schema]) => {
            this.register(name, {
                schema,
                metadata: {
                    name,
                    category: SchemaCategory.BASIC,
                    description: `Common ${name} validation schema`,
                    version: '1.0.0',
                },
            });
        });

        // Register status schemas
        Object.entries(StatusSchemas).forEach(([name, schema]) => {
            this.register(name, {
                schema,
                metadata: {
                    name,
                    category: SchemaCategory.VALIDATION,
                    description: `Status validation schema for ${name}`,
                    version: '1.0.0',
                },
            });
        });

        // Register object schemas
        Object.entries(ObjectSchemas).forEach(([name, schema]) => {
            this.register(name, {
                schema,
                metadata: {
                    name,
                    category: SchemaCategory.ENTITY,
                    description: `Object schema for ${name}`,
                    version: '1.0.0',
                },
            });
        });

        // Register entity schemas
        Object.entries(EntitySchemas).forEach(([name, schema]) => {
            this.register(name, {
                schema,
                metadata: {
                    name,
                    category: SchemaCategory.OPERATION,
                    description: `Entity operation schema for ${name}`,
                    version: '1.0.0',
                },
                inputSchema: this.zodToJsonSchema(schema),
            });
        });
    }

    /**
     * Register a new schema
     */
    register(name: string, registeredSchema: RegisteredSchema): void {
        this.schemas.set(name, registeredSchema);
        this.categories.get(registeredSchema.metadata.category)?.add(name);
    }

    /**
     * Get a schema by name
     */
    get<T = any>(name: string): ZodSchema<T> | null {
        const registered = this.schemas.get(name);
        return registered ? registered.schema as ZodSchema<T> : null;
    }

    /**
     * Get schema metadata
     */
    getMetadata(name: string): SchemaMetadata | null {
        const registered = this.schemas.get(name);
        return registered ? registered.metadata : null;
    }

    /**
     * Get JSON schema for MCP tools
     */
    getInputSchema(name: string): Record<string, any> | null {
        const registered = this.schemas.get(name);
        return registered?.inputSchema || null;
    }

    /**
     * Get all schemas in a category
     */
    getByCategory(category: SchemaCategory): Map<string, RegisteredSchema> {
        const categorySchemas = new Map<string, RegisteredSchema>();
        const schemaNames = this.categories.get(category) || new Set();
        
        schemaNames.forEach(name => {
            const schema = this.schemas.get(name);
            if (schema) {
                categorySchemas.set(name, schema);
            }
        });
        
        return categorySchemas;
    }

    /**
     * Check if a schema exists
     */
    has(name: string): boolean {
        return this.schemas.has(name);
    }

    /**
     * List all schema names
     */
    list(): string[] {
        return Array.from(this.schemas.keys());
    }

    /**
     * Search schemas by name pattern
     */
    search(pattern: string): Map<string, RegisteredSchema> {
        const results = new Map<string, RegisteredSchema>();
        const regex = new RegExp(pattern, 'i');
        
        this.schemas.forEach((schema, name) => {
            if (regex.test(name) || regex.test(schema.metadata.description)) {
                results.set(name, schema);
            }
        });
        
        return results;
    }

    /**
     * Validate data against a schema
     */
    validate<T>(schemaName: string, data: unknown): { success: boolean; data?: T; errors?: any[] } {
        const schema = this.get<T>(schemaName);
        if (!schema) {
            return { success: false, errors: [{ message: `Schema '${schemaName}' not found` }] };
        }

        try {
            const validatedData = schema.parse(data);
            return { success: true, data: validatedData };
        } catch (error: any) {
            return { 
                success: false, 
                errors: error.issues || [{ message: error.message }] 
            };
        }
    }

    /**
     * Create a composite schema from multiple schemas
     */
    compose(schemaNames: string[], options: { partial?: boolean } = {}): ZodSchema | null {
        const schemas: any[] = [];
        
        for (const name of schemaNames) {
            const schema = this.get(name);
            if (!schema) return null;
            
            if (schema instanceof z.ZodObject) {
                schemas.push(schema.shape);
            }
        }
        
        if (schemas.length === 0) return null;
        
        const composedShape = Object.assign({}, ...schemas);
        const composedSchema = z.object(composedShape);
        
        return options.partial ? composedSchema.partial() : composedSchema;
    }

    /**
     * Convert Zod schema to JSON Schema (simplified)
     */
    private zodToJsonSchema(schema: ZodSchema): Record<string, any> {
        // This is a simplified conversion - in a real implementation,
        // you might want to use a library like zod-to-json-schema
        
        if (schema instanceof z.ZodObject) {
            const properties: Record<string, any> = {};
            const required: string[] = [];
            
            Object.entries(schema.shape).forEach(([key, value]) => {
                properties[key] = this.zodTypeToJsonSchema(value as ZodSchema);
                
                // Check if field is required (not optional)
                if (!(value instanceof z.ZodOptional)) {
                    required.push(key);
                }
            });
            
            return {
                type: 'object',
                properties,
                required: required.length > 0 ? required : undefined,
            };
        }
        
        return this.zodTypeToJsonSchema(schema);
    }

    /**
     * Convert individual Zod type to JSON Schema property
     */
    private zodTypeToJsonSchema(zodType: ZodSchema): Record<string, any> {
        if (zodType instanceof z.ZodString) {
            return { type: 'string' };
        }
        
        if (zodType instanceof z.ZodNumber) {
            return { type: 'number' };
        }
        
        if (zodType instanceof z.ZodBoolean) {
            return { type: 'boolean' };
        }
        
        if (zodType instanceof z.ZodEnum) {
            return { 
                type: 'string', 
                enum: zodType.options 
            };
        }
        
        if (zodType instanceof z.ZodArray) {
            return {
                type: 'array',
                items: this.zodTypeToJsonSchema(zodType.element),
            };
        }
        
        if (zodType instanceof z.ZodOptional) {
            return this.zodTypeToJsonSchema(zodType.unwrap());
        }
        
        if (zodType instanceof z.ZodObject) {
            return this.zodToJsonSchema(zodType);
        }
        
        // Default fallback
        return { type: 'string' };
    }

    /**
     * Register a tool schema with CRUD operations
     */
    registerCrudSchemas(entityName: string, baseSchema: ZodSchema): void {
        const operations = ['create', 'update', 'get', 'list', 'delete'];
        
        operations.forEach(operation => {
            const schemaName = `${operation}${entityName}`;
            let schema: ZodSchema;
            let inputSchema: Record<string, any>;
            
            switch (operation) {
                case 'create':
                    schema = baseSchema;
                    inputSchema = InputSchemaGenerators.basicCrud(entityName).create;
                    break;
                case 'update':
                    schema = baseSchema instanceof z.ZodObject ? baseSchema.partial() : baseSchema;
                    inputSchema = InputSchemaGenerators.basicCrud(entityName).update;
                    break;
                case 'get':
                    schema = z.object({ [`${entityName.toLowerCase()}Id`]: CommonSchemas.id });
                    inputSchema = InputSchemaGenerators.basicCrud(entityName).get;
                    break;
                case 'list':
                    schema = EntitySchemas.listBooks; // Generic list schema
                    inputSchema = InputSchemaGenerators.list(entityName);
                    break;
                case 'delete':
                    schema = EntitySchemas.deleteWithAuthor;
                    inputSchema = InputSchemaGenerators.basicCrud(entityName).delete;
                    break;
                default:
                    return;
            }
            
            this.register(schemaName, {
                schema,
                metadata: {
                    name: schemaName,
                    category: SchemaCategory.OPERATION,
                    description: `${operation} operation schema for ${entityName}`,
                    version: '1.0.0',
                    dependencies: [entityName],
                },
                inputSchema,
            });
        });
    }

    /**
     * Export schemas for debugging or documentation
     */
    export(): Record<string, any> {
        const exported: Record<string, any> = {};
        
        this.schemas.forEach((registered, name) => {
            exported[name] = {
                metadata: registered.metadata,
                inputSchema: registered.inputSchema,
            };
        });
        
        return exported;
    }

    /**
     * Clear all registered schemas (mainly for testing)
     */
    clear(): void {
        this.schemas.clear();
        this.categories.clear();
        this.initializeCategories();
    }

    /**
     * Get statistics about registered schemas
     */
    getStats(): Record<string, any> {
        const stats: Record<string, any> = {
            total: this.schemas.size,
            byCategory: {},
        };
        
        this.categories.forEach((schemas, category) => {
            stats.byCategory[category] = schemas.size;
        });
        
        return stats;
    }
}

/**
 * Convenience function to get the global schema registry
 */
export const getSchemaRegistry = (): SchemaRegistry => SchemaRegistry.getInstance();

/**
 * Convenience functions for common schema operations
 */
export const SchemaUtils = {
    /**
     * Get a schema by name
     */
    get: <T = any>(name: string): ZodSchema<T> | null => {
        return getSchemaRegistry().get<T>(name);
    },
    
    /**
     * Validate data against a schema
     */
    validate: <T = any>(schemaName: string, data: unknown) => {
        return getSchemaRegistry().validate<T>(schemaName, data);
    },
    
    /**
     * Get input schema for MCP tools
     */
    getInputSchema: (name: string): Record<string, any> | null => {
        return getSchemaRegistry().getInputSchema(name);
    },
    
    /**
     * Check if a schema exists
     */
    has: (name: string): boolean => {
        return getSchemaRegistry().has(name);
    },
};
