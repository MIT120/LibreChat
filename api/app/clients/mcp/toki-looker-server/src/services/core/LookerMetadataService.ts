/**
 * Looker Metadata Service - Handles models, explores, dimensions, measures, etc.
 */

import { BaseLookerService } from '../base/BaseLookerService.js';
import { ILogger } from '../../interfaces/ILogger.js';
import { LookerConfig } from '../../../types/index.js';
import { Looker40SDK } from '@looker/sdk';
import {
    LookerModel,
    LookerExplore,
    LookerDimension,
    LookerMeasure,
    LookerFilter,
    LookerParameter
} from '../../../types/index.js';
import { ILookmlModelExplore } from '@looker/sdk';

export class LookerMetadataService extends BaseLookerService {
    constructor(logger: ILogger, config: LookerConfig) {
        super(logger, config);
    }

    async getModels(): Promise<LookerModel[]> {
        return this.makeSDKCall(
            () => this.sdk.ok(this.sdk.all_lookml_models({ fields: 'name,explores' })),
            'getModels'
        ) as Promise<LookerModel[]>;
    }

    async getExplores(modelName: string): Promise<LookerExplore[]> {
        return this.makeSDKCall(
            () => this.sdk.ok(this.sdk.lookml_model(modelName, 'explores')),
            'getExplores'
        ).then(model => (model.explores || []) as LookerExplore[]);
    }

    async getDimensions(modelName: string, exploreName: string): Promise<LookerDimension[]> {
        return this.makeSDKCall(
            () => this.sdk.ok(this.sdk.lookml_model_explore({
                lookml_model_name: modelName,
                explore_name: exploreName
            })),
            'getDimensions'
        ).then((explore: ILookmlModelExplore) => ((explore as any).dimensions || (explore as any).fields?.dimensions || []) as LookerDimension[]);
    }

    async getMeasures(modelName: string, exploreName: string): Promise<LookerMeasure[]> {
        return this.makeSDKCall(
            () => this.sdk.ok(this.sdk.lookml_model_explore({
                lookml_model_name: modelName,
                explore_name: exploreName
            })),
            'getMeasures'
        ).then((explore: ILookmlModelExplore) => ((explore as any).measures || (explore as any).fields?.measures || []) as LookerMeasure[]);
    }

    async getFilters(modelName: string, exploreName: string): Promise<LookerFilter[]> {
        return this.makeSDKCall(
            () => this.sdk.ok(this.sdk.lookml_model_explore({
                lookml_model_name: modelName,
                explore_name: exploreName
            })),
            'getFilters'
        ).then((explore: ILookmlModelExplore) => {
            const filters: LookerFilter[] = [];
            const dimensions = (explore as any)?.dimensions || (explore as any)?.fields?.dimensions || [];
            if (dimensions.length > 0) {
                dimensions.forEach((dim: any) => {
                    if (dim.can_filter) {
                        filters.push({
                            name: dim.name,
                            label: dim.label_short || dim.label,
                            description: dim.description,
                            type: dim.type,
                            suggestions: dim.suggestions
                        });
                    }
                });
            }
            return filters;
        });
    }

    async getParameters(modelName: string, exploreName: string): Promise<LookerParameter[]> {
        return this.makeSDKCall(
            () => this.sdk.ok(this.sdk.lookml_model_explore({
                lookml_model_name: modelName,
                explore_name: exploreName
            })),
            'getParameters'
        ).then((explore: ILookmlModelExplore) => ((explore as any)?.parameters || []) as LookerParameter[]);
    }

    async getAvailableFields(modelName: string, exploreName: string): Promise<{
        dimensions: string[];
        measures: string[];
        allFields: string[];
    }> {
        try {
            // Try direct HTTP call first for better field information
            const url = `${this.config.baseUrl}/lookml_models/${encodeURIComponent(modelName)}/explores/${encodeURIComponent(exploreName)}`;

            const data = await this.makeHTTPCall(url, { method: 'GET' }, 'getAvailableFields') as any;

            if (data && data.fields) {
                const dimensions = (data.fields.dimensions || []).map((field: any) => field.name);
                const measures = (data.fields.measures || []).map((field: any) => field.name);
                const allFields = [...dimensions, ...measures];

                this.logger.debug('Available fields retrieved from API', {
                    model: modelName,
                    explore: exploreName,
                    dimensions,
                    measures,
                    allFields
                });

                return { dimensions, measures, allFields };
            }
        } catch (error) {
            this.logger.warn('Direct API call failed, falling back to SDK method', error);
        }

        // Fallback to SDK method
        const explore = await this.makeSDKCall(
            () => this.sdk.ok(this.sdk.lookml_model_explore({
                lookml_model_name: modelName,
                explore_name: exploreName
            })),
            'getAvailableFields (SDK fallback)'
        ) as ILookmlModelExplore;

        const dimensions = ((explore as any).dimensions || (explore as any).fields?.dimensions || []).map((dim: any) => dim.name);
        const measures = ((explore as any).measures || (explore as any).fields?.measures || []).map((measure: any) => measure.name);
        const allFields = [...dimensions, ...measures];

        return { dimensions, measures, allFields };
    }

    async getAllAvailableFields(): Promise<{
        models: Array<{
            name: string;
            explores: Array<{
                name: string;
                dimensions: string[];
                measures: string[];
                allFields: string[];
            }>;
        }>;
        totalModels: number;
        totalExplores: number;
        totalFields: number;
    }> {
        this.logger.info('Fetching all available fields from all models and explores');

        const models = await this.getModels();
        this.logger.debug(`Found ${models.length} models`, { modelNames: models.map(m => m.name) });

        const result = {
            models: [] as Array<{
                name: string;
                explores: Array<{
                    name: string;
                    dimensions: string[];
                    measures: string[];
                    allFields: string[];
                }>;
            }>,
            totalModels: 0,
            totalExplores: 0,
            totalFields: 0
        };

        // Process each model
        for (const model of models) {
            this.logger.debug(`Processing model: ${model.name}`);

            try {
                const explores = await this.getExplores(model.name);
                this.logger.debug(`Found ${explores.length} explores in model ${model.name}`, {
                    exploreNames: explores.map(e => e.name)
                });

                const modelData = {
                    name: model.name,
                    explores: [] as Array<{
                        name: string;
                        dimensions: string[];
                        measures: string[];
                        allFields: string[];
                    }>
                };

                // Process each explore
                for (const explore of explores) {
                    this.logger.debug(`Processing explore: ${model.name}.${explore.name}`);

                    try {
                        const fields = await this.getAvailableFields(model.name, explore.name);

                        modelData.explores.push({
                            name: explore.name,
                            dimensions: fields.dimensions,
                            measures: fields.measures,
                            allFields: fields.allFields
                        });

                        result.totalExplores++;
                        result.totalFields += fields.allFields.length;

                        this.logger.debug(`Retrieved ${fields.allFields.length} fields from ${model.name}.${explore.name}`, {
                            dimensions: fields.dimensions.length,
                            measures: fields.measures.length
                        });
                    } catch (error) {
                        this.logger.warn(`Failed to get fields for explore ${model.name}.${explore.name}`, error);
                        // Continue with other explores even if one fails
                        modelData.explores.push({
                            name: explore.name,
                            dimensions: [],
                            measures: [],
                            allFields: []
                        });
                    }
                }

                result.models.push(modelData);
                result.totalModels++;

            } catch (error) {
                this.logger.warn(`Failed to process model ${model.name}`, error);
                // Continue with other models even if one fails
                result.models.push({
                    name: model.name,
                    explores: []
                });
                result.totalModels++;
            }
        }

        this.logger.info('Successfully retrieved all available fields', {
            totalModels: result.totalModels,
            totalExplores: result.totalExplores,
            totalFields: result.totalFields
        });

        return result;
    }
}
