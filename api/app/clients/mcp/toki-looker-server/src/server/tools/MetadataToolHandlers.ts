/**
 * Metadata Tool Handlers - Handles all metadata-related Looker tools
 */

import { z } from 'zod';
import { BaseToolHandler } from './BaseToolHandler.js';
import { ILogger } from '../../interfaces/ILogger.js';
import { ILookerService } from '../../interfaces/ILookerService.js';
import { IToolHandler } from '../../interfaces/IToolHandler.js';

export class MetadataToolHandlers extends BaseToolHandler {
    private lookerService: ILookerService;

    constructor(logger: ILogger, lookerService: ILookerService) {
        super(logger);
        this.lookerService = lookerService;
    }

    getTools(): IToolHandler[] {
        return [
            this.createGetModelsHandler(),
            this.createGetExploresHandler(),
            this.createGetDimensionsHandler(),
            this.createGetMeasuresHandler(),
            this.createGetFiltersHandler(),
            this.createGetParametersHandler(),
            this.createGetAvailableFieldsHandler(),
            this.createGetAllAvailableFieldsHandler()
        ];
    }

    private handleError(error: any, operation: string): any {
        this.logger.error(`Error in ${operation}`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            operation
        };
    }

    createGetModelsHandler(): IToolHandler {
        return {
            name: 'looker-get-models',
            description: 'Get all available Looker models',
            inputSchema: this.toJsonSchema(z.object({})),
            handler: async () => {
                try {
                    const models = await this.lookerService.getModels();
                    return {
                        success: true,
                        data: models,
                        count: models.length
                    };
                } catch (error) {
                    return this.handleError(error, 'looker-get-models');
                }
            }
        };
    }

    createGetExploresHandler(): IToolHandler {
        return {
            name: 'looker-get-explores',
            description: 'Get explores for a specific model',
            inputSchema: this.toJsonSchema(z.object({
                model: z.string().describe('Name of the model to get explores for')
            })),
            handler: async (args) => {
                try {
                    const { model } = args as { model: string };
                    const explores = await this.lookerService.getExplores(model);
                    return {
                        success: true,
                        data: explores,
                        count: explores.length,
                        model
                    };
                } catch (error) {
                    return this.handleError(error, 'looker-get-explores');
                }
            }
        };
    }

    createGetDimensionsHandler(): IToolHandler {
        return {
            name: 'looker-get-dimensions',
            description: 'Get dimensions for a specific model and explore',
            inputSchema: this.toJsonSchema(z.object({
                model: z.string().describe('Name of the model'),
                explore: z.string().describe('Name of the explore')
            })),
            handler: async (args) => {
                try {
                    const { model, explore } = args as { model: string; explore: string };
                    const dimensions = await this.lookerService.getDimensions(model, explore);
                    return {
                        success: true,
                        data: dimensions,
                        count: dimensions.length,
                        model,
                        explore
                    };
                } catch (error) {
                    return this.handleError(error, 'looker-get-dimensions');
                }
            }
        };
    }

    createGetMeasuresHandler(): IToolHandler {
        return {
            name: 'looker-get-measures',
            description: 'Get measures for a specific model and explore',
            inputSchema: this.toJsonSchema(z.object({
                model: z.string().describe('Name of the model'),
                explore: z.string().describe('Name of the explore')
            })),
            handler: async (args) => {
                try {
                    const { model, explore } = args as { model: string; explore: string };
                    const measures = await this.lookerService.getMeasures(model, explore);
                    return {
                        success: true,
                        data: measures,
                        count: measures.length,
                        model,
                        explore
                    };
                } catch (error) {
                    return this.handleError(error, 'looker-get-measures');
                }
            }
        };
    }

    createGetFiltersHandler(): IToolHandler {
        return {
            name: 'looker-get-filters',
            description: 'Get filterable dimensions for a specific model and explore',
            inputSchema: this.toJsonSchema(z.object({
                model: z.string().describe('Name of the model'),
                explore: z.string().describe('Name of the explore')
            })),
            handler: async (args) => {
                try {
                    const { model, explore } = args as { model: string; explore: string };
                    const filters = await this.lookerService.getFilters(model, explore);
                    return {
                        success: true,
                        data: filters,
                        count: filters.length,
                        model,
                        explore
                    };
                } catch (error) {
                    return this.handleError(error, 'looker-get-filters');
                }
            }
        };
    }

    createGetParametersHandler(): IToolHandler {
        return {
            name: 'looker-get-parameters',
            description: 'Get parameters for a specific model and explore',
            inputSchema: this.toJsonSchema(z.object({
                model: z.string().describe('Name of the model'),
                explore: z.string().describe('Name of the explore')
            })),
            handler: async (args) => {
                try {
                    const { model, explore } = args as { model: string; explore: string };
                    const parameters = await this.lookerService.getParameters(model, explore);
                    return {
                        success: true,
                        data: parameters,
                        count: parameters.length,
                        model,
                        explore
                    };
                } catch (error) {
                    return this.handleError(error, 'looker-get-parameters');
                }
            }
        };
    }

    createGetAvailableFieldsHandler(): IToolHandler {
        return {
            name: 'looker-get-available-fields',
            description: 'Get all available fields (dimensions and measures) for a specific model and explore',
            inputSchema: this.toJsonSchema(z.object({
                model: z.string().describe('Name of the model'),
                explore: z.string().describe('Name of the explore')
            })),
            handler: async (args) => {
                try {
                    const { model, explore } = args as { model: string; explore: string };
                    const fields = await this.lookerService.getAvailableFields(model, explore);
                    return {
                        success: true,
                        data: fields,
                        model,
                        explore
                    };
                } catch (error) {
                    return this.handleError(error, 'looker-get-available-fields');
                }
            }
        };
    }

    createGetAllAvailableFieldsHandler(): IToolHandler {
        return {
            name: 'looker-get-all-available-fields',
            description: 'Get all available fields from all models and explores (comprehensive field discovery)',
            inputSchema: this.toJsonSchema(z.object({})),
            handler: async () => {
                try {
                    const allFields = await this.lookerService.getAllAvailableFields();
                    return {
                        success: true,
                        data: allFields
                    };
                } catch (error) {
                    return this.handleError(error, 'looker-get-all-available-fields');
                }
            }
        };
    }

    /**
     * Get all metadata tools
     */
    getMetadataTools(): IToolHandler[] {
        return [
            this.createGetModelsHandler(),
            this.createGetExploresHandler(),
            this.createGetDimensionsHandler(),
            this.createGetMeasuresHandler(),
            this.createGetFiltersHandler(),
            this.createGetParametersHandler(),
            this.createGetAvailableFieldsHandler(),
            this.createGetAllAvailableFieldsHandler()
        ];
    }
}
