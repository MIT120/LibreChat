/**
 * Looker Tool Handlers - MCP tools for Looker analytics
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { IToolHandler } from '../../interfaces/index.js';
import { ILookerService } from '../../interfaces/ILookerService.js';
import { ILogger } from '../../interfaces/ILogger.js';

export class LookerToolHandlers {
    private logger: ILogger;
    private lookerService: ILookerService;

    constructor(logger: ILogger, lookerService: ILookerService) {
        this.logger = logger;
        this.lookerService = lookerService;
    }

    private toJsonSchema(zodSchema: z.ZodType): any {
        const schema: any = zodToJsonSchema(zodSchema, 'inputSchema');
        // Return the inner schema definition directly to avoid $ref issues with MCP
        if (schema.$ref === '#/definitions/inputSchema' && schema.definitions?.inputSchema) {
            return schema.definitions.inputSchema;
        }
        return schema;
    }

    getTools(): IToolHandler[] {
        return [
            this.createGetModelsHandler(),
            this.createGetExploresHandler(),
            this.createGetDimensionsHandler(),
            this.createGetMeasuresHandler(),
            this.createGetFiltersHandler(),
            this.createGetParametersHandler(),
            this.createGetLooksHandler(),
            this.createRunLookHandler(),
            this.createMakeLookHandler(),
            this.createGetDashboardsHandler(),
            this.createMakeDashboardHandler(),
            this.createAddDashboardElementHandler(),
            this.createQueryHandler(),
            this.createQuerySqlHandler(),
            this.createQueryUrlHandler(),
            this.createAnalyzeElectricityHandler(),
        ];
    }

    private createGetModelsHandler(): IToolHandler {
        return {
            name: 'looker-get-models',
            description: 'Get all models in the Looker source for electricity analytics',
            inputSchema: this.toJsonSchema(z.object({}).strict()),
            handler: async () => {
                this.logger.info('Getting Looker models');
                try {
                    const models = await this.lookerService.getModels();
                    return {
                        success: true,
                        models,
                        count: models.length,
                        message: `Retrieved ${models.length} models from Looker`
                    };
                } catch (error) {
                    this.logger.error('Failed to get models', error);
                    throw error;
                }
            }
        };
    }

    private createGetExploresHandler(): IToolHandler {
        return {
            name: 'looker-get-explores',
            description: 'Get all explores for a given model, focused on electricity data analysis',
            inputSchema: this.toJsonSchema(z.object({
                model: z.string().describe('The model name to get explores from')
            }).strict()),
            handler: async (args: { model: string }) => {
                this.logger.info('Getting explores for model', { model: args.model });
                try {
                    const explores = await this.lookerService.getExplores(args.model);
                    return {
                        success: true,
                        model: args.model,
                        explores,
                        count: explores.length,
                        message: `Retrieved ${explores.length} explores from model '${args.model}'`
                    };
                } catch (error) {
                    this.logger.error('Failed to get explores', error);
                    throw error;
                }
            }
        };
    }

    private createGetDimensionsHandler(): IToolHandler {
        return {
            name: 'looker-get-dimensions',
            description: 'Get all dimensions from a given explore in a model for electricity metrics analysis',
            inputSchema: this.toJsonSchema(z.object({
                model: z.string().describe('The model name'),
                explore: z.string().describe('The explore name to get dimensions from')
            }).strict()),
            handler: async (args: { model: string; explore: string }) => {
                this.logger.info('Getting dimensions', { model: args.model, explore: args.explore });
                try {
                    const dimensions = await this.lookerService.getDimensions(args.model, args.explore);
                    return {
                        success: true,
                        model: args.model,
                        explore: args.explore,
                        dimensions,
                        count: dimensions.length,
                        message: `Retrieved ${dimensions.length} dimensions from '${args.model}.${args.explore}'`
                    };
                } catch (error) {
                    this.logger.error('Failed to get dimensions', error);
                    throw error;
                }
            }
        };
    }

    private createGetMeasuresHandler(): IToolHandler {
        return {
            name: 'looker-get-measures',
            description: 'Get all measures from a given explore in a model for electricity consumption and generation metrics',
            inputSchema: this.toJsonSchema(z.object({
                model: z.string().describe('The model name'),
                explore: z.string().describe('The explore name to get measures from')
            }).strict()),
            handler: async (args: { model: string; explore: string }) => {
                this.logger.info('Getting measures', { model: args.model, explore: args.explore });
                try {
                    const measures = await this.lookerService.getMeasures(args.model, args.explore);
                    return {
                        success: true,
                        model: args.model,
                        explore: args.explore,
                        measures,
                        count: measures.length,
                        message: `Retrieved ${measures.length} measures from '${args.model}.${args.explore}'`
                    };
                } catch (error) {
                    this.logger.error('Failed to get measures', error);
                    throw error;
                }
            }
        };
    }

    private createGetFiltersHandler(): IToolHandler {
        return {
            name: 'looker-get-filters',
            description: 'Get all filters from a given explore in a model for filtering electricity data',
            inputSchema: this.toJsonSchema(z.object({
                model: z.string().describe('The model name'),
                explore: z.string().describe('The explore name to get filters from')
            }).strict()),
            handler: async (args: { model: string; explore: string }) => {
                this.logger.info('Getting filters', { model: args.model, explore: args.explore });
                try {
                    const filters = await this.lookerService.getFilters(args.model, args.explore);
                    return {
                        success: true,
                        model: args.model,
                        explore: args.explore,
                        filters,
                        count: filters.length,
                        message: `Retrieved ${filters.length} filters from '${args.model}.${args.explore}'`
                    };
                } catch (error) {
                    this.logger.error('Failed to get filters', error);
                    throw error;
                }
            }
        };
    }

    private createGetParametersHandler(): IToolHandler {
        return {
            name: 'looker-get-parameters',
            description: 'Get all parameters from a given explore in a model for electricity analysis configuration',
            inputSchema: this.toJsonSchema(z.object({
                model: z.string().describe('The model name'),
                explore: z.string().describe('The explore name to get parameters from')
            }).strict()),
            handler: async (args: { model: string; explore: string }) => {
                this.logger.info('Getting parameters', { model: args.model, explore: args.explore });
                try {
                    const parameters = await this.lookerService.getParameters(args.model, args.explore);
                    return {
                        success: true,
                        model: args.model,
                        explore: args.explore,
                        parameters,
                        count: parameters.length,
                        message: `Retrieved ${parameters.length} parameters from '${args.model}.${args.explore}'`
                    };
                } catch (error) {
                    this.logger.error('Failed to get parameters', error);
                    throw error;
                }
            }
        };
    }

    private createGetLooksHandler(): IToolHandler {
        return {
            name: 'looker-get-looks',
            description: 'Search for saved Looks in Looker for electricity analysis dashboards',
            inputSchema: this.toJsonSchema(z.object({
                search: z.string().optional().describe('Search term to filter looks by title')
            }).strict()),
            handler: async (args: { search?: string }) => {
                this.logger.info('Getting looks', { search: args.search });
                try {
                    const looks = await this.lookerService.getLooks(args.search);
                    return {
                        success: true,
                        looks,
                        count: looks.length,
                        search: args.search,
                        message: args.search
                            ? `Found ${looks.length} looks matching '${args.search}'`
                            : `Retrieved ${looks.length} looks`
                    };
                } catch (error) {
                    this.logger.error('Failed to get looks', error);
                    throw error;
                }
            }
        };
    }

    private createRunLookHandler(): IToolHandler {
        return {
            name: 'looker-run-look',
            description: 'Run the query associated with a saved Look to get electricity data',
            inputSchema: this.toJsonSchema(z.object({
                look_id: z.number().describe('The ID of the look to run')
            }).strict()),
            handler: async (args: { look_id: number }) => {
                this.logger.info('Running look', { lookId: args.look_id });
                try {
                    const result = await this.lookerService.runLook(args.look_id);
                    return {
                        success: true,
                        look_id: args.look_id,
                        result,
                        row_count: result.data?.length || 0,
                        message: `Successfully ran look ${args.look_id}, returned ${result.data?.length || 0} rows`
                    };
                } catch (error) {
                    this.logger.error('Failed to run look', error);
                    throw error;
                }
            }
        };
    }

    private createMakeLookHandler(): IToolHandler {
        return {
            name: 'looker-make-look',
            description: 'Create a new Look in the user\'s personal folder for electricity analysis visualization',
            inputSchema: this.toJsonSchema(z.object({
                title: z.string().describe('The title of the new look'),
                description: z.string().optional().describe('Description of the look'),
                model: z.string().describe('The model name'),
                explore: z.string().describe('The explore name'),
                dimensions: z.array(z.string()).optional().describe('Array of dimension names'),
                measures: z.array(z.string()).optional().describe('Array of measure names'),
                filters: z.record(z.string()).optional().describe('Filters as key-value pairs'),
                sorts: z.array(z.string()).optional().describe('Array of sort specifications'),
                limit: z.number().optional().describe('Row limit for the query')
            }).strict()),
            handler: async (args: any) => {
                this.logger.info('Creating look', { title: args.title });
                try {
                    const query = {
                        model: args.model,
                        explore: args.explore,
                        dimensions: args.dimensions || [],
                        measures: args.measures || [],
                        filters: args.filters || {},
                        sorts: args.sorts || [],
                        limit: args.limit || 5000
                    };

                    const look = await this.lookerService.makeLook(query, args.title, args.description);
                    return {
                        success: true,
                        look,
                        message: `Successfully created look '${args.title}' with ID ${look.id}`
                    };
                } catch (error) {
                    this.logger.error('Failed to create look', error);
                    throw error;
                }
            }
        };
    }

    private createGetDashboardsHandler(): IToolHandler {
        return {
            name: 'looker-get-dashboards',
            description: 'Search for dashboards in Looker for electricity analytics visualization',
            inputSchema: this.toJsonSchema(z.object({
                search: z.string().optional().describe('Search term to filter dashboards by title')
            }).strict()),
            handler: async (args: { search?: string }) => {
                this.logger.info('Getting dashboards', { search: args.search });
                try {
                    const dashboards = await this.lookerService.getDashboards(args.search);
                    return {
                        success: true,
                        dashboards,
                        count: dashboards.length,
                        search: args.search,
                        message: args.search
                            ? `Found ${dashboards.length} dashboards matching '${args.search}'`
                            : `Retrieved ${dashboards.length} dashboards`
                    };
                } catch (error) {
                    this.logger.error('Failed to get dashboards', error);
                    throw error;
                }
            }
        };
    }

    private createMakeDashboardHandler(): IToolHandler {
        return {
            name: 'looker-make-dashboard',
            description: 'Create a new dashboard in the user\'s personal folder for electricity analytics',
            inputSchema: this.toJsonSchema(z.object({
                title: z.string().describe('The title of the new dashboard'),
                description: z.string().optional().describe('Description of the dashboard')
            }).strict()),
            handler: async (args: { title: string; description?: string }) => {
                this.logger.info('Creating dashboard', { title: args.title });
                try {
                    const dashboard = await this.lookerService.makeDashboard(args.title, args.description);
                    return {
                        success: true,
                        dashboard,
                        message: `Successfully created dashboard '${args.title}' with ID ${dashboard.id}`
                    };
                } catch (error) {
                    this.logger.error('Failed to create dashboard', error);
                    throw error;
                }
            }
        };
    }

    private createAddDashboardElementHandler(): IToolHandler {
        return {
            name: 'looker-add-dashboard-element',
            description: 'Add an element (visualization) to an existing dashboard for electricity data display',
            inputSchema: this.toJsonSchema(z.object({
                dashboard_id: z.number().describe('The ID of the dashboard to add element to'),
                title: z.string().describe('Title of the dashboard element'),
                look_id: z.number().optional().describe('ID of look to add as element'),
                query_id: z.number().optional().describe('ID of query to add as element'),
                type: z.string().default('looker_line').describe('Type of visualization (looker_line, looker_bar, etc.)'),
                width: z.number().default(12).describe('Width of the element (1-12)'),
                height: z.number().default(6).describe('Height of the element'),
                col: z.number().default(0).describe('Column position (0-11)'),
                row: z.number().default(0).describe('Row position')
            }).strict()),
            handler: async (args: any) => {
                this.logger.info('Adding dashboard element', {
                    dashboard_id: args.dashboard_id,
                    title: args.title
                });
                try {
                    const element = await this.lookerService.addDashboardElement(args.dashboard_id, {
                        title: args.title,
                        look_id: args.look_id,
                        query_id: args.query_id,
                        type: args.type,
                        width: args.width,
                        height: args.height,
                        col: args.col,
                        row: args.row
                    });

                    return {
                        success: true,
                        element,
                        message: `Successfully added element '${args.title}' to dashboard ${args.dashboard_id}`
                    };
                } catch (error) {
                    this.logger.error('Failed to add dashboard element', error);
                    throw error;
                }
            }
        };
    }

    private createQueryHandler(): IToolHandler {
        return {
            name: 'looker-query',
            description: 'Run an inline query using the Looker semantic model for electricity data analysis',
            inputSchema: this.toJsonSchema(z.object({
                model: z.string().describe('The model name'),
                explore: z.string().describe('The explore name'),
                dimensions: z.array(z.string()).optional().describe('Array of dimension names'),
                measures: z.array(z.string()).optional().describe('Array of measure names'),
                filters: z.record(z.string()).optional().describe('Filters as key-value pairs'),
                sorts: z.array(z.string()).optional().describe('Array of sort specifications'),
                limit: z.number().optional().describe('Row limit for the query'),
                total: z.boolean().optional().describe('Include totals in results')
            }).strict()),
            handler: async (args: any) => {
                this.logger.info('Running inline query', { model: args.model, explore: args.explore });
                try {
                    const query = {
                        model: args.model,
                        explore: args.explore,
                        dimensions: args.dimensions || [],
                        measures: args.measures || [],
                        filters: args.filters || {},
                        sorts: args.sorts || [],
                        limit: args.limit || 5000,
                        total: args.total || false
                    };

                    const result = await this.lookerService.query(query);
                    return {
                        success: true,
                        query,
                        result,
                        row_count: result.data?.length || 0,
                        message: `Successfully executed query, returned ${result.data?.length || 0} rows`
                    };
                } catch (error) {
                    this.logger.error('Failed to run query', error);
                    throw error;
                }
            }
        };
    }

    private createQuerySqlHandler(): IToolHandler {
        return {
            name: 'looker-query-sql',
            description: 'Generate SQL query using the Looker semantic model for electricity data analysis',
            inputSchema: this.toJsonSchema(z.object({
                model: z.string().describe('The model name'),
                explore: z.string().describe('The explore name'),
                dimensions: z.array(z.string()).optional().describe('Array of dimension names'),
                measures: z.array(z.string()).optional().describe('Array of measure names'),
                filters: z.record(z.string()).optional().describe('Filters as key-value pairs'),
                sorts: z.array(z.string()).optional().describe('Array of sort specifications'),
                limit: z.number().optional().describe('Row limit for the query')
            }).strict()),
            handler: async (args: any) => {
                this.logger.info('Generating SQL for query', { model: args.model, explore: args.explore });
                try {
                    const query = {
                        model: args.model,
                        explore: args.explore,
                        dimensions: args.dimensions || [],
                        measures: args.measures || [],
                        filters: args.filters || {},
                        sorts: args.sorts || [],
                        limit: args.limit || 5000
                    };

                    const sql = await this.lookerService.querySQL(query);
                    return {
                        success: true,
                        query,
                        sql,
                        message: 'Successfully generated SQL query'
                    };
                } catch (error) {
                    this.logger.error('Failed to generate SQL', error);
                    throw error;
                }
            }
        };
    }

    private createQueryUrlHandler(): IToolHandler {
        return {
            name: 'looker-query-url',
            description: 'Generate a URL link to a Looker explore for electricity data visualization',
            inputSchema: this.toJsonSchema(z.object({
                model: z.string().describe('The model name'),
                explore: z.string().describe('The explore name'),
                dimensions: z.array(z.string()).optional().describe('Array of dimension names'),
                measures: z.array(z.string()).optional().describe('Array of measure names'),
                filters: z.record(z.string()).optional().describe('Filters as key-value pairs'),
                sorts: z.array(z.string()).optional().describe('Array of sort specifications'),
                limit: z.number().optional().describe('Row limit for the query')
            }).strict()),
            handler: async (args: any) => {
                this.logger.info('Generating URL for query', { model: args.model, explore: args.explore });
                try {
                    const query = {
                        model: args.model,
                        explore: args.explore,
                        dimensions: args.dimensions || [],
                        measures: args.measures || [],
                        filters: args.filters || {},
                        sorts: args.sorts || [],
                        limit: args.limit || 5000
                    };

                    const url = await this.lookerService.queryUrl(query);
                    return {
                        success: true,
                        query,
                        url,
                        message: 'Successfully generated explore URL'
                    };
                } catch (error) {
                    this.logger.error('Failed to generate URL', error);
                    throw error;
                }
            }
        };
    }

    private createAnalyzeElectricityHandler(): IToolHandler {
        return {
            name: 'looker-analyze-electricity',
            description: 'Perform comprehensive electricity data analysis using Looker with advanced analytics for consumption, generation, costs, and efficiency metrics',
            inputSchema: this.toJsonSchema(z.object({
                time_range: z.object({
                    start: z.string().describe('Start date (YYYY-MM-DD or ISO format)'),
                    end: z.string().describe('End date (YYYY-MM-DD or ISO format)')
                }).describe('Time range for analysis'),
                metrics: z.array(z.enum([
                    'consumption_kwh',
                    'generation_kwh',
                    'grid_import_kwh',
                    'grid_export_kwh',
                    'solar_generation_kwh',
                    'wind_generation_kwh',
                    'battery_charge_kwh',
                    'battery_discharge_kwh',
                    'demand_kw',
                    'peak_demand_kw',
                    'cost_eur',
                    'carbon_emissions_kg'
                ])).describe('Metrics to include in analysis'),
                group_by: z.enum(['hour', 'day', 'week', 'month', 'year']).optional().describe('Time grouping for aggregation'),
                filters: z.record(z.any()).optional().describe('Additional filters for the analysis'),
                include_forecasting: z.boolean().optional().describe('Include forecasting analysis'),
                include_comparisons: z.boolean().optional().describe('Include period-over-period comparisons')
            }).strict()),
            handler: async (args: any) => {
                this.logger.info('Analyzing electricity data', {
                    timeRange: args.time_range,
                    metrics: args.metrics
                });
                try {
                    const request = {
                        timeRange: args.time_range,
                        metrics: args.metrics,
                        groupBy: args.group_by,
                        filters: args.filters,
                        includeForecasting: args.include_forecasting,
                        includeComparisons: args.include_comparisons
                    };

                    const analysis = await this.lookerService.analyzeElectricity(request);

                    return {
                        success: true,
                        request,
                        analysis,
                        summary: {
                            data_points: analysis.data.length,
                            time_range: args.time_range,
                            metrics_analyzed: args.metrics.length,
                            total_consumption: analysis.summary.totalConsumption,
                            total_generation: analysis.summary.totalGeneration,
                            net_consumption: analysis.summary.netConsumption,
                            self_sufficiency: `${analysis.summary.selfSufficiency?.toFixed(1)}%`,
                            peak_demand: analysis.summary.peakDemand,
                            total_cost: analysis.summary.totalCost,
                            total_emissions: analysis.summary.totalEmissions
                        },
                        message: `Electricity analysis completed for ${analysis.data.length} data points from ${args.time_range.start} to ${args.time_range.end}`
                    };
                } catch (error) {
                    this.logger.error('Failed to analyze electricity data', error);
                    throw error;
                }
            }
        };
    }
}
