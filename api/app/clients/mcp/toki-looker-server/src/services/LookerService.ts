/**
 * Looker Service - Uses composition pattern for better maintainability
 */

import { ILookerService } from '../interfaces/ILookerService.js';
import { ILogger } from '../interfaces/ILogger.js';
import { LookerConfig } from '../../types/index.js';
import {
    LookerModel,
    LookerExplore,
    LookerDimension,
    LookerMeasure,
    LookerFilter,
    LookerParameter,
    LookerLook,
    LookerDashboard,
    LookerDashboardElement,
    LookerQuery,
    LookerQueryResult,
    ElectricityAnalysisRequest,
    ElectricityAnalysisResult,
    CsvExportResult,
    TableExportRequest,
    ReportExportRequest
} from '../../types/index.js';

// Import specialized services
import { LookerMetadataService } from './core/LookerMetadataService.js';
import { LookerQueryService } from './core/LookerQueryService.js';
import { LookerContentService } from './core/LookerContentService.js';
import { LookerCsvExportService } from './core/LookerCsvExportService.js';
import { LookerAdvancedExportService } from './core/LookerAdvancedExportService.js';
import { LookerLookMLService } from './core/LookerLookMLService.js';
import { LookerEmbedService } from './core/LookerEmbedService.js';
import { ElectricityAnalyticsService } from './analytics/ElectricityAnalyticsService.js';
import { LookerAdvancedAnalyticsService } from './analytics/LookerAdvancedAnalyticsService.js';
import { LookerDiagnosticsService } from './diagnostics/LookerDiagnosticsService.js';

export class LookerService implements ILookerService {
    private logger: ILogger;
    private config: LookerConfig;

    // Specialized services
    private metadataService: LookerMetadataService;
    private queryService: LookerQueryService;
    private contentService: LookerContentService;
    private csvExportService: LookerCsvExportService;
    private advancedExportService: LookerAdvancedExportService;
    private lookmlService: LookerLookMLService;
    private embedService: LookerEmbedService;
    private analyticsService: ElectricityAnalyticsService;
    private advancedAnalyticsService: LookerAdvancedAnalyticsService;
    private diagnosticsService: LookerDiagnosticsService;

    constructor(logger: ILogger, config: LookerConfig) {
        this.logger = logger;
        this.config = config;

        // Initialize specialized services
        this.metadataService = new LookerMetadataService(logger, config);
        this.queryService = new LookerQueryService(logger, config);
        this.contentService = new LookerContentService(logger, config);
        this.csvExportService = new LookerCsvExportService(logger, config);
        this.advancedExportService = new LookerAdvancedExportService(logger, config);
        this.lookmlService = new LookerLookMLService(logger, config);
        this.embedService = new LookerEmbedService(logger, config);
        this.analyticsService = new ElectricityAnalyticsService(logger, config, this.queryService, this.metadataService);
        this.advancedAnalyticsService = new LookerAdvancedAnalyticsService(logger, config);
        this.diagnosticsService = new LookerDiagnosticsService(logger, config);

        this.logger.info('Initialized Looker service with specialized components');
    }

    // Authentication - delegate to any service (they all extend BaseLookerService)
    async authenticate(): Promise<void> {
        return this.metadataService.authenticate();
    }

    isAuthenticated(): boolean {
        return this.metadataService.isAuthenticated();
    }

    // Metadata operations - delegate to metadata service
    async getModels(): Promise<LookerModel[]> {
        return this.metadataService.getModels();
    }

    async getExplores(modelName: string): Promise<LookerExplore[]> {
        return this.metadataService.getExplores(modelName);
    }

    async getDimensions(modelName: string, exploreName: string): Promise<LookerDimension[]> {
        return this.metadataService.getDimensions(modelName, exploreName);
    }

    async getMeasures(modelName: string, exploreName: string): Promise<LookerMeasure[]> {
        return this.metadataService.getMeasures(modelName, exploreName);
    }

    async getFilters(modelName: string, exploreName: string): Promise<LookerFilter[]> {
        return this.metadataService.getFilters(modelName, exploreName);
    }

    async getParameters(modelName: string, exploreName: string): Promise<LookerParameter[]> {
        return this.metadataService.getParameters(modelName, exploreName);
    }

    async getAvailableFields(modelName: string, exploreName: string): Promise<{
        dimensions: string[];
        measures: string[];
        allFields: string[];
    }> {
        return this.metadataService.getAvailableFields(modelName, exploreName);
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
        return this.metadataService.getAllAvailableFields();
    }

    // Content operations - delegate to content service
    async getLooks(search?: string): Promise<LookerLook[]> {
        return this.contentService.getLooks(search);
    }

    async runLook(lookId: number): Promise<LookerQueryResult> {
        return this.contentService.runLook(lookId);
    }

    async makeLook(query: LookerQuery, title: string, description?: string): Promise<LookerLook> {
        return this.contentService.makeLook(query, title, description);
    }

    async getDashboards(search?: string): Promise<LookerDashboard[]> {
        return this.contentService.getDashboards(search);
    }

    async makeDashboard(title: string, description?: string): Promise<LookerDashboard> {
        return this.contentService.makeDashboard(title, description);
    }

    async addDashboardElement(dashboardId: number, element: Partial<LookerDashboardElement>): Promise<LookerDashboardElement> {
        return this.contentService.addDashboardElement(dashboardId, element);
    }

    // Query operations - delegate to query service
    async query(query: LookerQuery): Promise<LookerQueryResult> {
        return this.queryService.query(query);
    }

    async querySQL(query: LookerQuery): Promise<string> {
        return this.queryService.querySQL(query);
    }

    async queryUrl(query: LookerQuery): Promise<string> {
        return this.queryService.queryUrl(query);
    }

    // Analytics operations - delegate to analytics service
    async analyzeElectricity(request: ElectricityAnalysisRequest): Promise<ElectricityAnalysisResult> {
        return this.analyticsService.analyzeElectricity(request);
    }

    // Diagnostics operations - delegate to diagnostics service
    async diagnostics(): Promise<{
        config: {
            baseUrl: string;
            timeout: number;
            clientIdConfigured: boolean;
            clientSecretConfigured: boolean;
        };
        connection: {
            canReachServer: boolean;
            canAuthenticate: boolean;
            responseTime?: number;
        };
        status: 'healthy' | 'degraded' | 'unhealthy';
        errors: string[];
    }> {
        return this.diagnosticsService.diagnostics();
    }

    // CSV Export operations - delegate to CSV export service
    async exportQueryResultToCsv(request: ReportExportRequest): Promise<CsvExportResult> {
        return this.csvExportService.exportQueryResultToCsv(request);
    }

    async exportTableToCsv(request: TableExportRequest): Promise<CsvExportResult> {
        return this.csvExportService.exportTableToCsv(request);
    }

    async exportElectricityAnalysisToCsv(analysisData: any[], title?: string, options?: any): Promise<CsvExportResult> {
        return this.csvExportService.exportElectricityAnalysisToCsv(analysisData, title, options);
    }

    // Utility methods for accessing specialized services directly if needed
    getMetadataService(): LookerMetadataService {
        return this.metadataService;
    }

    getQueryService(): LookerQueryService {
        return this.queryService;
    }

    getContentService(): LookerContentService {
        return this.contentService;
    }

    getAnalyticsService(): ElectricityAnalyticsService {
        return this.analyticsService;
    }

    getDiagnosticsService(): LookerDiagnosticsService {
        return this.diagnosticsService;
    }

    getCsvExportService(): LookerCsvExportService {
        return this.csvExportService;
    }

    // Helper method to validate and suggest field names
    async validateAndSuggestFields(modelName: string, exploreName: string, fields: string[]): Promise<{
        validFields: string[];
        invalidFields: string[];
        suggestions: Record<string, string[]>;
    }> {
        try {
            const availableFields = await this.getAvailableFields(modelName, exploreName);
            const validFields: string[] = [];
            const invalidFields: string[] = [];
            const suggestions: Record<string, string[]> = {};

            for (const field of fields) {
                // Check if field exists in available fields (exact match)
                if (availableFields.allFields.includes(field)) {
                    validFields.push(field);
                } else {
                    invalidFields.push(field);

                    // Find similar field names
                    const similarFields = availableFields.allFields.filter(availableField =>
                        availableField.toLowerCase().includes(field.toLowerCase()) ||
                        field.toLowerCase().includes(availableField.toLowerCase())
                    );

                    if (similarFields.length > 0) {
                        suggestions[field] = similarFields.slice(0, 5); // Limit to 5 suggestions
                    }
                }
            }

            return {
                validFields,
                invalidFields,
                suggestions
            };
        } catch (error) {
            this.logger.error('Failed to validate fields', { modelName, exploreName, fields, error });
            return {
                validFields: [],
                invalidFields: fields,
                suggestions: {}
            };
        }
    }

    // Getters for specialized services
    get metadata(): LookerMetadataService { return this.metadataService; }
    get queryHandler(): LookerQueryService { return this.queryService; }
    get content(): LookerContentService { return this.contentService; }
    get csvExport(): LookerCsvExportService { return this.csvExportService; }
    get advancedExport(): LookerAdvancedExportService { return this.advancedExportService; }
    get lookml(): LookerLookMLService { return this.lookmlService; }
    get embed(): LookerEmbedService { return this.embedService; }
    get analytics(): ElectricityAnalyticsService { return this.analyticsService; }
    get advancedAnalytics(): LookerAdvancedAnalyticsService { return this.advancedAnalyticsService; }
    get diagnosticsHandler(): LookerDiagnosticsService { return this.diagnosticsService; }
}
