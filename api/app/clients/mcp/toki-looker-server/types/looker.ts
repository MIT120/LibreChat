/**
 * Looker API Types and Interfaces
 */

export interface LookerConfig {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    apiVersion?: string;
}

export interface LookerCredentials {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
}

export interface LookerModel {
    name: string;
    project_name?: string;
    title?: string;
    description?: string;
    explores?: LookerExplore[];
}

export interface LookerExplore {
    name: string;
    title?: string;
    description?: string;
    model_name?: string;
    dimensions?: LookerDimension[];
    measures?: LookerMeasure[];
    filters?: LookerFilter[];
    parameters?: LookerParameter[];
}

// Interface for the actual SDK response from lookml_model_explore
export interface ILookmlModelExplore {
    name: string;
    title?: string;
    description?: string;
    model_name?: string;
    dimensions?: LookerDimension[];
    measures?: LookerMeasure[];
    parameters?: LookerParameter[];
    fields?: {
        dimensions?: LookerDimension[];
        measures?: LookerMeasure[];
    };
}

export interface LookerDimension {
    name: string;
    label?: string;
    description?: string;
    type?: string;
    sql?: string;
    dimension_group?: string;
    view_label?: string;
}

export interface LookerMeasure {
    name: string;
    label?: string;
    description?: string;
    type?: string;
    sql?: string;
    view_label?: string;
}

export interface LookerFilter {
    name: string;
    label?: string;
    description?: string;
    type?: string;
    default_value?: string;
    suggestions?: string[];
}

export interface LookerParameter {
    name: string;
    label?: string;
    description?: string;
    type?: string;
    default_value?: string;
    allowed_values?: LookerParameterValue[];
}

export interface LookerParameterValue {
    label: string;
    value: string;
}

export interface LookerLook {
    id?: number;
    title?: string;
    description?: string;
    user_id?: number;
    space_id?: string;
    public?: boolean;
    query?: LookerQuery;
    dashboard_id?: number;
    created_at?: string;
    updated_at?: string;
    short_url?: string;
    url?: string;
}

export interface LookerDashboard {
    id?: number;
    title?: string;
    description?: string;
    user_id?: number;
    space_id?: string;
    elements?: LookerDashboardElement[];
    filters?: LookerDashboardFilter[];
    created_at?: string;
    updated_at?: string;
    url?: string;
}

export interface LookerDashboardElement {
    id?: string;
    dashboard_id?: number;
    look_id?: number;
    query_id?: number;
    title?: string;
    type?: string;
    subtitle_text?: string;
    body_text?: string;
    body_text_as_html?: string;
    width?: number;
    height?: number;
    col?: number;
    row?: number;
    refresh_interval?: string;
}

export interface LookerDashboardFilter {
    name: string;
    title?: string;
    type?: string;
    default_value?: string;
    model?: string;
    explore?: string;
    dimension?: string;
}

export interface LookerQuery {
    id?: number;
    model?: string;
    explore?: string;
    dimensions?: string[];
    measures?: string[];
    filters?: Record<string, string>;
    sorts?: string[];
    limit?: number;
    column_limit?: number;
    total?: boolean;
    row_total?: string;
    subtotals?: string[];
    vis_config?: Record<string, any>;
    filter_config?: Record<string, any>;
    visible_ui_sections?: string;
    slug?: string;
    dynamic_fields?: string;
    client_id?: string;
    share_url?: string;
    expanded_share_url?: string;
    url?: string;
    query_timezone?: string;
    has_table_calculations?: boolean;
}

export interface LookerQueryResult {
    data?: any[];
    fields?: LookerQueryResultField[];
    truncated?: boolean;
    sql?: string;
    query_run_time?: number;
    applied_filters?: Record<string, string>;
    totals_data?: any[];
    subtotals_data?: any[];
}

export interface LookerQueryResultField {
    name: string;
    label?: string;
    category?: string;
    type?: string;
    description?: string;
    sortable?: boolean;
}

export interface ElectricityMetrics {
    timestamp: string;
    consumption_kwh: number;
    generation_kwh?: number;
    grid_import_kwh?: number;
    grid_export_kwh?: number;
    solar_generation_kwh?: number;
    wind_generation_kwh?: number;
    battery_charge_kwh?: number;
    battery_discharge_kwh?: number;
    demand_kw?: number;
    peak_demand_kw?: number;
    voltage_v?: number;
    frequency_hz?: number;
    power_factor?: number;
    cost_eur?: number;
    carbon_emissions_kg?: number;
}

export interface ElectricityAnalysisRequest {
    timeRange: {
        start: string;
        end: string;
    };
    metrics: (keyof ElectricityMetrics)[];
    groupBy?: 'hour' | 'day' | 'week' | 'month' | 'year';
    filters?: Record<string, any>;
    includeForecasting?: boolean;
    includeComparisons?: boolean;
    model?: string;
    explore?: string;
}

export interface ElectricityAnalysisResult {
    data: ElectricityMetrics[];
    summary: {
        totalConsumption: number;
        totalGeneration?: number;
        netConsumption: number;
        peakDemand: number;
        averageDemand: number;
        totalCost?: number;
        totalEmissions?: number;
        selfSufficiency?: number; // Percentage
        gridDependency?: number; // Percentage
    };
    trends?: {
        consumptionTrend: 'increasing' | 'decreasing' | 'stable';
        generationTrend?: 'increasing' | 'decreasing' | 'stable';
        costTrend?: 'increasing' | 'decreasing' | 'stable';
    };
    forecasting?: {
        nextPeriod: ElectricityMetrics[];
        confidence: number;
        methodology: string;
    };
    comparisons?: {
        previousPeriod: {
            change: number;
            changePercent: number;
        };
        yearOverYear?: {
            change: number;
            changePercent: number;
        };
    };
}

// CSV Export Types
export interface CsvExportOptions {
    filename?: string;
    includeHeaders?: boolean;
    delimiter?: string;
    encoding?: string;
    dateFormat?: string;
    numberFormat?: string;
    escapeQuotes?: boolean;
    includeMetadata?: boolean;
}

export interface CsvExportResult {
    filename: string;
    content: string;
    size: number;
    rowCount: number;
    columnCount: number;
    filepath: string;
    downloadUrl: string;
    exportId: string;
    metadata?: {
        exportDate: string;
        query?: LookerQuery;
        options: CsvExportOptions;
    };
    chatReference?: string;
}

export interface TableExportRequest {
    data: any[];
    headers?: string[];
    title?: string;
    description?: string;
    options?: CsvExportOptions;
}

export interface ReportExportRequest {
    queryResult: LookerQueryResult;
    title?: string;
    description?: string;
    options?: CsvExportOptions;
}

// Advanced Analytics Types
export interface TimeSeriesConfig {
    timeField: string;
    valueField: string;
    aggregationType: 'sum' | 'avg' | 'min' | 'max' | 'count';
    timeGranularity: 'hour' | 'day' | 'week' | 'month' | 'year';
    forecastPeriods?: number;
    seasonality?: boolean;
    trendAnalysis?: boolean;
}

export interface TimeSeriesResult {
    data: TimeSeriesDataPoint[];
    forecast?: TimeSeriesDataPoint[];
    trends: {
        direction: 'increasing' | 'decreasing' | 'stable';
        slope: number;
        rSquared: number;
    };
    seasonality?: {
        detected: boolean;
        period: number;
        strength: number;
    };
    statistics: {
        mean: number;
        median: number;
        stdDev: number;
        variance: number;
        skewness: number;
        kurtosis: number;
    };
}

export interface TimeSeriesDataPoint {
    timestamp: string;
    value: number;
    confidence?: number;
}

export interface AnomalyResult {
    timestamp: string;
    value: number;
    expectedValue: number;
    deviation: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    method: 'statistical' | 'isolation_forest' | 'z_score';
    description: string;
}

export interface CustomMeasureRequest {
    name: string;
    label: string;
    description?: string;
    sql: string;
    type: 'number' | 'string' | 'date' | 'yesno';
    value_format?: string;
    hidden?: boolean;
    model: string;
    explore: string;
}

export interface CustomMeasure {
    id: string;
    name: string;
    label: string;
    description?: string;
    sql: string;
    type: string;
    value_format?: string;
    hidden: boolean;
    created_at: string;
    updated_at: string;
}

// LookML Management Types
export interface LookMLFile {
    name: string;
    path: string;
    content: string;
    size: number;
    last_modified: string;
    project_id: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: LookMLValidationError[];
    warnings: ValidationWarning[];
    suggestions: ValidationSuggestion[];
}

export interface LookMLValidationError {
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
    code?: string;
}

export interface ValidationWarning {
    line: number;
    column: number;
    message: string;
    suggestion?: string;
}

export interface ValidationSuggestion {
    line: number;
    column: number;
    message: string;
    replacement?: string;
}

export interface DeploymentResult {
    success: boolean;
    deployment_id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    errors?: string[];
    warnings?: string[];
    deployed_at?: string;
    duration?: number;
}

// Embed & API Management Types
export interface EmbedConfig {
    user_id?: number;
    external_user_id?: string;
    first_name?: string;
    last_name?: string;
    force_logout_login?: boolean;
    session_length?: number;
    permissions?: string[];
    models?: string[];
    group_ids?: number[];
    external_group_id?: string;
    user_attributes?: Record<string, any>;
    access_filters?: Record<string, any>;
}

export interface ApiKey {
    id: string;
    name: string;
    key: string;
    user_id: number;
    permissions: string[];
    created_at: string;
    expires_at?: string;
    last_used_at?: string;
    is_active: boolean;
}

export interface ApiKeyPermissions {
    models: string[];
    explores: string[];
    actions: string[];
    admin_access: boolean;
}

export interface ApiUsageMetrics {
    total_requests: number;
    requests_today: number;
    requests_this_month: number;
    average_response_time: number;
    error_rate: number;
    rate_limit_remaining: number;
    rate_limit_reset: string;
    top_endpoints: Array<{
        endpoint: string;
        count: number;
        avg_response_time: number;
    }>;
}

// Advanced Export Types
export interface PDFTemplate {
    title: string;
    subtitle?: string;
    header?: string;
    footer?: string;
    page_size: 'A4' | 'Letter' | 'Legal';
    orientation: 'portrait' | 'landscape';
    margins: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    include_charts: boolean;
    chart_config?: {
        width: number;
        height: number;
        format: 'png' | 'svg';
    };
    styling?: {
        font_family: string;
        font_size: number;
        color_scheme: string;
    };
}

export interface PDFExportResult {
    filename: string;
    content: Buffer;
    size: number;
    page_count: number;
    filepath: string;
    downloadUrl: string;
    exportId: string;
    metadata?: {
        exportDate: string;
        template: PDFTemplate;
        query?: LookerQuery;
    };
}

export interface ExcelSheet {
    name: string;
    data: any[];
    headers?: string[];
    chart_config?: {
        type: 'line' | 'bar' | 'pie' | 'scatter';
        title: string;
        data_range: string;
        position: { row: number; col: number };
    };
}

export interface ExcelExportResult {
    filename: string;
    content: Buffer;
    size: number;
    sheet_count: number;
    filepath: string;
    downloadUrl: string;
    exportId: string;
    metadata?: {
        exportDate: string;
        sheets: string[];
        query?: LookerQuery;
    };
}

export interface ImageFormat {
    type: 'png' | 'svg' | 'jpeg';
    width?: number;
    height?: number;
    dpi?: number;
    quality?: number;
}

export interface ImageExportResult {
    filename: string;
    content: Buffer;
    size: number;
    width: number;
    height: number;
    format: string;
    filepath: string;
    downloadUrl: string;
    exportId: string;
    metadata?: {
        exportDate: string;
        format: ImageFormat;
        query?: LookerQuery;
    };
}
