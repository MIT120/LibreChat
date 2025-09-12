/**
 * Looker Service Interface
 */

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

export interface ILookerService {
    // Authentication
    authenticate(): Promise<void>;
    isAuthenticated(): boolean;

    // Models
    getModels(): Promise<LookerModel[]>;

    // Explores
    getExplores(modelName: string): Promise<LookerExplore[]>;

    // Dimensions, Measures, Filters, Parameters
    getDimensions(modelName: string, exploreName: string): Promise<LookerDimension[]>;
    getMeasures(modelName: string, exploreName: string): Promise<LookerMeasure[]>;
    getFilters(modelName: string, exploreName: string): Promise<LookerFilter[]>;
    getParameters(modelName: string, exploreName: string): Promise<LookerParameter[]>;
    getAvailableFields(modelName: string, exploreName: string): Promise<{
        dimensions: string[];
        measures: string[];
        allFields: string[];
    }>;
    getAllAvailableFields(): Promise<{
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
    }>;

    // Looks
    getLooks(search?: string): Promise<LookerLook[]>;
    runLook(lookId: number): Promise<LookerQueryResult>;
    makeLook(query: LookerQuery, title: string, description?: string): Promise<LookerLook>;

    // Dashboards
    getDashboards(search?: string): Promise<LookerDashboard[]>;
    makeDashboard(title: string, description?: string): Promise<LookerDashboard>;
    addDashboardElement(dashboardId: number, element: Partial<LookerDashboardElement>): Promise<LookerDashboardElement>;

    // Queries
    query(query: LookerQuery): Promise<LookerQueryResult>;
    querySQL(query: LookerQuery): Promise<string>;
    queryUrl(query: LookerQuery): Promise<string>;

    // Electricity Analytics
    analyzeElectricity(request: ElectricityAnalysisRequest): Promise<ElectricityAnalysisResult>;

    // Diagnostics
    diagnostics(): Promise<{
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
    }>;

    // CSV Export
    exportQueryResultToCsv(request: ReportExportRequest): Promise<CsvExportResult>;
    exportTableToCsv(request: TableExportRequest): Promise<CsvExportResult>;
    exportElectricityAnalysisToCsv(analysisData: any[], title?: string, options?: any): Promise<CsvExportResult>;
    getCsvExportService(): any; // Return the CSV export service instance
}
