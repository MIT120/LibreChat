/**
 * Looker Tool Handlers - Uses composition pattern for better maintainability
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { IToolHandler } from '../../interfaces/index.js';
import { ILogger } from '../../interfaces/ILogger.js';
import { ILookerService } from '../../interfaces/ILookerService.js';
import { BaseToolHandler } from './BaseToolHandler.js';
import { MetadataToolHandlers } from './MetadataToolHandlers.js';
import { CsvExportToolHandlers } from './CsvExportToolHandlers.js';
import { AdvancedAnalyticsToolHandlers } from './AdvancedAnalyticsToolHandlers.js';
import { LookMLToolHandlers } from './LookMLToolHandlers.js';
import { EmbedToolHandlers } from './EmbedToolHandlers.js';
import { AdvancedExportToolHandlers } from './AdvancedExportToolHandlers.js';
import { LookerServiceFactory } from '../../factories/LookerServiceFactory.js';
import { LookerConfig } from '../../../types/index.js';

export class LookerToolHandlers {
    private logger: ILogger;
    private lookerService: ILookerService;
    private metadataHandlers: MetadataToolHandlers;
    private csvExportHandlers: CsvExportToolHandlers;
    private advancedAnalyticsHandlers: AdvancedAnalyticsToolHandlers;
    private lookmlHandlers: LookMLToolHandlers;
    private embedHandlers: EmbedToolHandlers;
    private advancedExportHandlers: AdvancedExportToolHandlers;

    constructor(logger: ILogger, lookerService: ILookerService) {
        this.logger = logger;
        this.lookerService = lookerService;
        this.metadataHandlers = new MetadataToolHandlers(logger, this.lookerService);
        this.csvExportHandlers = new CsvExportToolHandlers(logger, this.lookerService);
        this.advancedAnalyticsHandlers = new AdvancedAnalyticsToolHandlers(logger, this.lookerService as any);
        this.lookmlHandlers = new LookMLToolHandlers(logger, this.lookerService as any);
        this.embedHandlers = new EmbedToolHandlers(logger, this.lookerService as any);
        this.advancedExportHandlers = new AdvancedExportToolHandlers(logger, this.lookerService as any);
    }

    getTools(): IToolHandler[] {
        return [
            // Diagnostics
            this.createDiagnosticsHandler(),

            // Metadata tools
            ...this.metadataHandlers.getTools(),

            // Content tools
            this.createGetLooksHandler(),
            this.createRunLookHandler(),
            this.createMakeLookHandler(),
            this.createGetDashboardsHandler(),
            this.createMakeDashboardHandler(),
            this.createAddDashboardElementHandler(),

            // Query tools
            this.createQueryHandler(),
            this.createQuerySqlHandler(),
            this.createQueryUrlHandler(),

            // Analytics tools
            this.createAnalyzeElectricityHandler(),

            // CSV Export tools
            ...this.csvExportHandlers.getTools(),

            // Advanced Analytics tools
            ...this.advancedAnalyticsHandlers.getTools(),

            // LookML Management tools
            ...this.lookmlHandlers.getTools(),

            // Embed & API Management tools
            ...this.embedHandlers.getTools(),

            // Advanced Export tools
            ...this.advancedExportHandlers.getTools(),
        ];
    }

    private createDiagnosticsHandler(): IToolHandler {
        return {
            name: 'looker-diagnostics',
            description: 'Test Looker API connectivity and configuration to diagnose connection issues',
            inputSchema: this.toJsonSchema(z.object({}).strict()),
            handler: async () => {
                this.logger.info('Running Looker diagnostics');
                try {
                    const diagnostics = await this.lookerService.diagnostics();
                    return {
                        success: true,
                        diagnostics,
                        message: `Looker API status: ${diagnostics.status}`,
                        recommendations: this.getDiagnosticRecommendations(diagnostics)
                    };
                } catch (error) {
                    this.logger.error('Failed to run diagnostics', error);
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : String(error),
                        message: 'Diagnostics failed - check server logs for details'
                    };
                }
            }
        };
    }

    private getDiagnosticRecommendations(diagnostics: any): string[] {
        const recommendations: string[] = [];

        if (diagnostics.status === 'unhealthy') {
            recommendations.push('Check your Looker server connection and credentials');
            recommendations.push('Verify that the Looker server is running and accessible');
        }

        if (diagnostics.connection && !diagnostics.connection.canReachServer) {
            recommendations.push('Check your network connection to the Looker server');
            recommendations.push('Verify the baseUrl configuration is correct');
        }

        if (diagnostics.connection && !diagnostics.connection.canAuthenticate) {
            recommendations.push('Check your client ID and client secret configuration');
            recommendations.push('Verify that your Looker user has the necessary permissions');
        }

        if (diagnostics.errors && diagnostics.errors.length > 0) {
            recommendations.push('Review the error messages for specific issues');
        }

        return recommendations;
    }

    private createGetLooksHandler(): IToolHandler {
        return {
            name: 'looker-get-looks',
            description: 'Search for saved Looks in Looker for electricity analysis dashboards',
            inputSchema: this.toJsonSchema(z.object({
                search: z.string().optional().describe('Search term to filter looks by title')
            }).strict()),
            handler: async (args: { search?: string }) => {
                return this.executeWithErrorHandling(
                    async () => {
                        const looks = await this.lookerService.getLooks(args.search);
                        return {
                            looks,
                            count: looks.length,
                            search: args.search
                        };
                    },
                    'getLooks',
                    args.search
                        ? `Found ${(await this.lookerService.getLooks(args.search)).length} looks matching '${args.search}'`
                        : `Retrieved ${(await this.lookerService.getLooks()).length} looks`
                );
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
                return this.executeWithErrorHandling(
                    async () => {
                        const result = await this.lookerService.runLook(args.look_id);
                        return {
                            look_id: args.look_id,
                            result,
                            row_count: result.data?.length || 0
                        };
                    },
                    'runLook',
                    `Successfully ran look ${args.look_id}, returned ${(await this.lookerService.runLook(args.look_id)).data?.length || 0} rows`
                );
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
                return this.executeWithErrorHandling(
                    async () => {
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
                        return { look };
                    },
                    'makeLook',
                    `Successfully created look '${args.title}' with ID ${(await this.lookerService.makeLook({
                        model: args.model,
                        explore: args.explore,
                        dimensions: args.dimensions || [],
                        measures: args.measures || [],
                        filters: args.filters || {},
                        sorts: args.sorts || [],
                        limit: args.limit || 5000
                    }, args.title, args.description)).id}`
                );
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
                return this.executeWithErrorHandling(
                    async () => {
                        const dashboards = await this.lookerService.getDashboards(args.search);
                        return {
                            dashboards,
                            count: dashboards.length,
                            search: args.search
                        };
                    },
                    'getDashboards',
                    args.search
                        ? `Found ${(await this.lookerService.getDashboards(args.search)).length} dashboards matching '${args.search}'`
                        : `Retrieved ${(await this.lookerService.getDashboards()).length} dashboards`
                );
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
                return this.executeWithErrorHandling(
                    async () => {
                        const dashboard = await this.lookerService.makeDashboard(args.title, args.description);
                        return { dashboard };
                    },
                    'makeDashboard',
                    `Successfully created dashboard '${args.title}' with ID ${(await this.lookerService.makeDashboard(args.title, args.description)).id}`
                );
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
                return this.executeWithErrorHandling(
                    async () => {
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

                        return { element };
                    },
                    'addDashboardElement',
                    `Successfully added element '${args.title}' to dashboard ${args.dashboard_id}`
                );
            }
        };
    }

    private createQueryHandler(): IToolHandler {
        return {
            name: 'looker-query',
            description: 'Run an inline query using the Looker semantic model for electricity data analysis. Field names must be fully qualified (view.field_name). Use looker-get-dimensions and looker-get-measures to get correct field names.',
            inputSchema: this.toJsonSchema(z.object({
                model: z.string().describe('The model name (e.g., "metering_data")'),
                explore: z.string().describe('The explore name (e.g., "billing_measurement_latest_v2")'),
                dimensions: z.array(z.string()).optional().describe('Array of fully qualified dimension field names (e.g., ["billing_measurement_latest_v2.timestamp_hour"])'),
                measures: z.array(z.string()).optional().describe('Array of fully qualified measure field names (e.g., ["billing_measurement_latest_v2.total_measurement"])'),
                filters: z.record(z.string()).optional().describe('Filters as key-value pairs'),
                sorts: z.array(z.string()).optional().describe('Array of sort specifications'),
                limit: z.number().optional().describe('Row limit for the query'),
                total: z.boolean().optional().describe('Include totals in results')
            }).strict()),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    async () => {
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
                            query,
                            result,
                            row_count: result.data?.length || 0
                        };
                    },
                    'query',
                    `Successfully executed query, returned ${(await this.lookerService.query({
                        model: args.model,
                        explore: args.explore,
                        dimensions: args.dimensions || [],
                        measures: args.measures || [],
                        filters: args.filters || {},
                        sorts: args.sorts || [],
                        limit: args.limit || 5000,
                        total: args.total || false
                    })).data?.length || 0} rows`
                );
            }
        };
    }

    private createQuerySqlHandler(): IToolHandler {
        return {
            name: 'looker-query-sql',
            description: 'Generate SQL query using the Looker semantic model for electricity data analysis. Field names must be fully qualified (view.field_name). Use looker-get-dimensions and looker-get-measures to get correct field names.',
            inputSchema: this.toJsonSchema(z.object({
                model: z.string().describe('The model name (e.g., "metering_data")'),
                explore: z.string().describe('The explore name (e.g., "billing_measurement_latest_v2")'),
                dimensions: z.array(z.string()).optional().describe('Array of fully qualified dimension field names (e.g., ["billing_measurement_latest_v2.timestamp_hour"])'),
                measures: z.array(z.string()).optional().describe('Array of fully qualified measure field names (e.g., ["billing_measurement_latest_v2.total_measurement"])'),
                filters: z.record(z.string()).optional().describe('Filters as key-value pairs'),
                sorts: z.array(z.string()).optional().describe('Array of sort specifications'),
                limit: z.number().optional().describe('Row limit for the query')
            }).strict()),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    async () => {
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
                        return { query, sql };
                    },
                    'querySQL',
                    'Successfully generated SQL query'
                );
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
                return this.executeWithErrorHandling(
                    async () => {
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
                        return { query, url };
                    },
                    'queryUrl',
                    'Successfully generated explore URL'
                );
            }
        };
    }

    private createAnalyzeElectricityHandler(): IToolHandler {
        return {
            name: 'looker-analyze-electricity',
            description: 'Perform comprehensive electricity data analysis using Looker with advanced analytics for consumption, generation, costs, and efficiency metrics. If model and explore are not specified, the system will auto-detect appropriate models and explores.',
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
                include_comparisons: z.boolean().optional().describe('Include period-over-period comparisons'),
                model: z.string().optional().describe('Specific model name to use (e.g., "metering_data_v1"). If not specified, will auto-detect.'),
                explore: z.string().optional().describe('Specific explore name to use (e.g., "public_customers"). If not specified, will auto-detect.')
            }).strict()),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    async () => {
                        const request = {
                            timeRange: args.time_range,
                            metrics: args.metrics,
                            groupBy: args.group_by,
                            filters: args.filters,
                            includeForecasting: args.include_forecasting,
                            includeComparisons: args.include_comparisons,
                            model: args.model,
                            explore: args.explore
                        };

                        const analysis = await this.lookerService.analyzeElectricity(request);

                        return {
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
                            }
                        };
                    },
                    'analyzeElectricity',
                    `Electricity analysis completed for ${(await this.lookerService.analyzeElectricity({
                        timeRange: args.time_range,
                        metrics: args.metrics,
                        groupBy: args.group_by,
                        filters: args.filters,
                        includeForecasting: args.include_forecasting,
                        includeComparisons: args.include_comparisons,
                        model: args.model,
                        explore: args.explore
                    })).data.length} data points from ${args.time_range.start} to ${args.time_range.end}`
                );
            }
        };
    }

    // Helper methods from BaseToolHandler
    private toJsonSchema(zodSchema: z.ZodType): any {
        const schema: any = zodToJsonSchema(zodSchema, 'inputSchema');
        if (schema.$ref === '#/definitions/inputSchema' && schema.definitions?.inputSchema) {
            return schema.definitions.inputSchema;
        }
        return schema;
    }

    private async executeWithErrorHandling<T>(
        operation: () => Promise<T>,
        operationName: string,
        successMessage: string
    ): Promise<any> {
        try {
            this.logger.info(`Executing ${operationName}`);
            const result = await operation();
            return {
                success: true,
                ...result,
                message: successMessage
            };
        } catch (error) {
            this.logger.error(`Failed to execute ${operationName}`, error);
            throw error;
        }
    }
}
