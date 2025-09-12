/**
 * CSV Export Tool Handlers - Handles CSV export functionality for reports and tables
 */

import { z } from 'zod';
import { IToolHandler } from '../../interfaces/index.js';
import { ILogger } from '../../interfaces/ILogger.js';
import { ILookerService } from '../../interfaces/ILookerService.js';
import { BaseToolHandler } from './BaseToolHandler.js';

export class CsvExportToolHandlers extends BaseToolHandler {
    protected logger: ILogger;
    private lookerService: ILookerService;

    constructor(logger: ILogger, lookerService: ILookerService) {
        super(logger);
        this.logger = logger;
        this.lookerService = lookerService;
    }

    getTools(): IToolHandler[] {
        return [
            this.createExportQueryResultHandler(),
            this.createExportTableHandler(),
            this.createExportElectricityAnalysisHandler(),
            this.createExportLookHandler(),
            this.createExportDashboardHandler()
        ];
    }

    private createExportQueryResultHandler(): IToolHandler {
        return {
            name: 'looker-export-query-csv',
            description: 'Export a Looker query result to CSV format for download or chat reference. Perfect for sharing data analysis results.',
            inputSchema: this.toJsonSchema(z.object({
                model: z.string().describe('The model name (e.g., "metering_data")'),
                explore: z.string().describe('The explore name (e.g., "billing_measurement_latest_v2")'),
                dimensions: z.array(z.string()).optional().describe('Array of fully qualified dimension field names'),
                measures: z.array(z.string()).optional().describe('Array of fully qualified measure field names'),
                filters: z.record(z.string()).optional().describe('Filters as key-value pairs'),
                sorts: z.array(z.string()).optional().describe('Array of sort specifications'),
                limit: z.number().optional().describe('Row limit for the query'),
                title: z.string().optional().describe('Title for the exported CSV file'),
                description: z.string().optional().describe('Description of the export'),
                options: z.object({
                    filename: z.string().optional().describe('Custom filename for the CSV'),
                    includeHeaders: z.boolean().optional().describe('Include column headers (default: true)'),
                    delimiter: z.string().optional().describe('CSV delimiter (default: ",")'),
                    includeMetadata: z.boolean().optional().describe('Include export metadata (default: false)')
                }).optional().describe('CSV export options')
            }).strict()),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    async () => {
                        // First, run the query to get the data
                        const query = {
                            model: args.model,
                            explore: args.explore,
                            dimensions: args.dimensions || [],
                            measures: args.measures || [],
                            filters: args.filters || {},
                            sorts: args.sorts || [],
                            limit: args.limit || 5000
                        };

                        const queryResult = await this.lookerService.query(query);

                        // Then export to CSV
                        const csvResult = await this.lookerService.exportQueryResultToCsv({
                            queryResult,
                            title: args.title || `${args.model}_${args.explore}_export`,
                            description: args.description,
                            options: args.options
                        });

                        // Create chat reference
                        const csvExportService = (this.lookerService as any).getCsvExportService();
                        const chatReference = csvExportService.createChatReference(csvResult);

                        return {
                            query,
                            csvExport: {
                                ...csvResult,
                                chatReference
                            },
                            summary: {
                                rows_exported: csvResult.rowCount,
                                columns_exported: csvResult.columnCount,
                                file_size: csvResult.size,
                                filename: csvResult.filename
                            }
                        };
                    },
                    'exportQueryResultToCsv',
                    `Successfully exported query result to CSV: ${args.title || `${args.model}_${args.explore}_export`}`
                );
            }
        };
    }

    private createExportTableHandler(): IToolHandler {
        return {
            name: 'looker-export-table-csv',
            description: 'Export tabular data to CSV format for download or chat reference. Use this for any structured data that needs to be shared.',
            inputSchema: this.toJsonSchema(z.object({
                data: z.array(z.record(z.any())).describe('Array of objects representing table rows'),
                headers: z.array(z.string()).optional().describe('Array of column headers (if not provided, will use object keys)'),
                title: z.string().optional().describe('Title for the exported CSV file'),
                description: z.string().optional().describe('Description of the export'),
                options: z.object({
                    filename: z.string().optional().describe('Custom filename for the CSV'),
                    includeHeaders: z.boolean().optional().describe('Include column headers (default: true)'),
                    delimiter: z.string().optional().describe('CSV delimiter (default: ",")'),
                    includeMetadata: z.boolean().optional().describe('Include export metadata (default: false)')
                }).optional().describe('CSV export options')
            }).strict()),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    async () => {
                        const csvResult = await this.lookerService.exportTableToCsv({
                            data: args.data,
                            headers: args.headers,
                            title: args.title || 'table_export',
                            description: args.description,
                            options: args.options
                        });

                        // Create chat reference
                        const csvExportService = (this.lookerService as any).getCsvExportService();
                        const chatReference = csvExportService.createChatReference(csvResult);

                        return {
                            csvExport: {
                                ...csvResult,
                                chatReference
                            },
                            summary: {
                                rows_exported: csvResult.rowCount,
                                columns_exported: csvResult.columnCount,
                                file_size: csvResult.size,
                                filename: csvResult.filename
                            }
                        };
                    },
                    'exportTableToCsv',
                    `Successfully exported table to CSV: ${args.title || 'table_export'}`
                );
            }
        };
    }

    private createExportElectricityAnalysisHandler(): IToolHandler {
        return {
            name: 'looker-export-electricity-analysis-csv',
            description: 'Export electricity analysis results to CSV format for download or chat reference. Perfect for sharing energy consumption reports.',
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
                title: z.string().optional().describe('Title for the exported CSV file'),
                options: z.object({
                    filename: z.string().optional().describe('Custom filename for the CSV'),
                    includeHeaders: z.boolean().optional().describe('Include column headers (default: true)'),
                    delimiter: z.string().optional().describe('CSV delimiter (default: ",")'),
                    includeMetadata: z.boolean().optional().describe('Include export metadata (default: false)')
                }).optional().describe('CSV export options')
            }).strict()),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    async () => {
                        // First, run the electricity analysis
                        const analysisRequest = {
                            timeRange: args.time_range,
                            metrics: args.metrics,
                            groupBy: args.group_by,
                            filters: args.filters
                        };

                        const analysisResult = await this.lookerService.analyzeElectricity(analysisRequest);

                        // Then export to CSV
                        const csvResult = await this.lookerService.exportElectricityAnalysisToCsv(
                            analysisResult.data,
                            args.title || `electricity_analysis_${args.time_range.start}_to_${args.time_range.end}`,
                            args.options
                        );

                        // Create chat reference
                        const csvExportService = (this.lookerService as any).getCsvExportService();
                        const chatReference = csvExportService.createChatReference(csvResult);

                        return {
                            analysis: analysisResult,
                            csvExport: {
                                ...csvResult,
                                chatReference
                            },
                            summary: {
                                rows_exported: csvResult.rowCount,
                                columns_exported: csvResult.columnCount,
                                file_size: csvResult.size,
                                filename: csvResult.filename,
                                analysis_summary: {
                                    total_consumption: analysisResult.summary.totalConsumption,
                                    total_generation: analysisResult.summary.totalGeneration,
                                    net_consumption: analysisResult.summary.netConsumption,
                                    peak_demand: analysisResult.summary.peakDemand,
                                    total_cost: analysisResult.summary.totalCost,
                                    total_emissions: analysisResult.summary.totalEmissions
                                }
                            }
                        };
                    },
                    'exportElectricityAnalysisToCsv',
                    `Successfully exported electricity analysis to CSV: ${args.title || `electricity_analysis_${args.time_range.start}_to_${args.time_range.end}`}`
                );
            }
        };
    }

    private createExportLookHandler(): IToolHandler {
        return {
            name: 'looker-export-look-csv',
            description: 'Export a saved Look to CSV format for download or chat reference. Perfect for sharing pre-built reports.',
            inputSchema: this.toJsonSchema(z.object({
                look_id: z.number().describe('The ID of the look to export'),
                title: z.string().optional().describe('Title for the exported CSV file'),
                description: z.string().optional().describe('Description of the export'),
                options: z.object({
                    filename: z.string().optional().describe('Custom filename for the CSV'),
                    includeHeaders: z.boolean().optional().describe('Include column headers (default: true)'),
                    delimiter: z.string().optional().describe('CSV delimiter (default: ",")'),
                    includeMetadata: z.boolean().optional().describe('Include export metadata (default: false)')
                }).optional().describe('CSV export options')
            }).strict()),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    async () => {
                        // First, run the look to get the data
                        const queryResult = await this.lookerService.runLook(args.look_id);

                        // Then export to CSV
                        const csvResult = await this.lookerService.exportQueryResultToCsv({
                            queryResult,
                            title: args.title || `look_${args.look_id}_export`,
                            description: args.description,
                            options: args.options
                        });

                        // Create chat reference
                        const csvExportService = (this.lookerService as any).getCsvExportService();
                        const chatReference = csvExportService.createChatReference(csvResult);

                        return {
                            look_id: args.look_id,
                            csvExport: {
                                ...csvResult,
                                chatReference
                            },
                            summary: {
                                rows_exported: csvResult.rowCount,
                                columns_exported: csvResult.columnCount,
                                file_size: csvResult.size,
                                filename: csvResult.filename
                            }
                        };
                    },
                    'exportLookToCsv',
                    `Successfully exported look ${args.look_id} to CSV: ${args.title || `look_${args.look_id}_export`}`
                );
            }
        };
    }

    private createExportDashboardHandler(): IToolHandler {
        return {
            name: 'looker-export-dashboard-csv',
            description: 'Export dashboard data to CSV format for download or chat reference. Exports all dashboard elements as separate CSV files.',
            inputSchema: this.toJsonSchema(z.object({
                dashboard_id: z.number().describe('The ID of the dashboard to export'),
                title: z.string().optional().describe('Title prefix for the exported CSV files'),
                description: z.string().optional().describe('Description of the export'),
                options: z.object({
                    filename: z.string().optional().describe('Custom filename prefix for the CSV files'),
                    includeHeaders: z.boolean().optional().describe('Include column headers (default: true)'),
                    delimiter: z.string().optional().describe('CSV delimiter (default: ",")'),
                    includeMetadata: z.boolean().optional().describe('Include export metadata (default: false)')
                }).optional().describe('CSV export options')
            }).strict()),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    async () => {
                        // Get dashboard details
                        const dashboards = await this.lookerService.getDashboards();
                        const dashboard = dashboards.find(d => d.id === args.dashboard_id);

                        if (!dashboard) {
                            throw new Error(`Dashboard with ID ${args.dashboard_id} not found`);
                        }

                        const exports = [];
                        const csvExportService = (this.lookerService as any).getCsvExportService();

                        // Export each dashboard element that has a look
                        if (dashboard.elements) {
                            for (const element of dashboard.elements) {
                                if (element.look_id) {
                                    try {
                                        // Run the look to get data
                                        const queryResult = await this.lookerService.runLook(element.look_id);

                                        // Export to CSV
                                        const csvResult = await this.lookerService.exportQueryResultToCsv({
                                            queryResult,
                                            title: `${args.title || dashboard.title || 'dashboard'}_${element.title || element.id}`,
                                            description: args.description,
                                            options: args.options
                                        });

                                        // Create chat reference
                                        const chatReference = csvExportService.createChatReference(csvResult);

                                        exports.push({
                                            element_id: element.id,
                                            element_title: element.title,
                                            look_id: element.look_id,
                                            csvExport: {
                                                ...csvResult,
                                                chatReference
                                            }
                                        });
                                    } catch (error) {
                                        this.logger.warn(`Failed to export dashboard element ${element.id}`, error);
                                        exports.push({
                                            element_id: element.id,
                                            element_title: element.title,
                                            look_id: element.look_id,
                                            error: error instanceof Error ? error.message : String(error)
                                        });
                                    }
                                }
                            }
                        }

                        return {
                            dashboard_id: args.dashboard_id,
                            dashboard_title: dashboard.title,
                            exports,
                            summary: {
                                total_elements: dashboard.elements?.length || 0,
                                exported_elements: exports.filter(e => !e.error).length,
                                failed_elements: exports.filter(e => e.error).length
                            }
                        };
                    },
                    'exportDashboardToCsv',
                    `Successfully exported dashboard ${args.dashboard_id} elements to CSV`
                );
            }
        };
    }
}
