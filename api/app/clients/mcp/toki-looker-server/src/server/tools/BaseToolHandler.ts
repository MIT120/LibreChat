/**
 * Base Tool Handler - Common functionality for all tool handlers
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { IToolHandler } from '../../interfaces/index.js';
import { ILogger } from '../../interfaces/ILogger.js';

export abstract class BaseToolHandler {
    protected logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    protected toJsonSchema(zodSchema: z.ZodType): any {
        const schema: any = zodToJsonSchema(zodSchema, 'inputSchema');
        // Return the inner schema definition directly to avoid $ref issues with MCP
        if (schema.$ref === '#/definitions/inputSchema' && schema.definitions?.inputSchema) {
            return schema.definitions.inputSchema;
        }
        return schema;
    }

    protected createSuccessResponse(data: any, message: string): any {
        return {
            success: true,
            ...data,
            message
        };
    }

    protected createErrorResponse(error: any, message: string): any {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            message
        };
    }

    protected async executeWithErrorHandling<T>(
        operation: () => Promise<T>,
        operationName: string,
        successMessage: string
    ): Promise<any> {
        try {
            this.logger.info(`Executing ${operationName}`);
            const result = await operation();
            return this.createSuccessResponse(result, successMessage);
        } catch (error) {
            this.logger.error(`Failed to execute ${operationName}`, error);
            throw error;
        }
    }

    abstract getTools(): IToolHandler[];
}
