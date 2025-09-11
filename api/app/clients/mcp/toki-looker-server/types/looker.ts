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
