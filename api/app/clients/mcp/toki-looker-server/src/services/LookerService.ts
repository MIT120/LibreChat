/**
 * Looker Service Implementation
 * Handles all interactions with Looker API
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { ILookerService } from '../interfaces/ILookerService.js';
import { ILogger } from '../interfaces/ILogger.js';
import {
    LookerConfig,
    LookerCredentials,
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
    ElectricityMetrics
} from '../../types/index.js';
import {
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ValidationError,
    RateLimitError,
    NetworkError,
    LookerError
} from '../../types/errors.js';

export class LookerService implements ILookerService {
    private logger: ILogger;
    private config: LookerConfig;
    private credentials?: LookerCredentials;
    private client: AxiosInstance;
    private authTime?: Date;

    constructor(logger: ILogger, config: LookerConfig) {
        this.logger = logger;
        this.config = config;

        this.client = axios.create({
            baseURL: config.baseUrl,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        this.setupInterceptors();
    }

    private setupInterceptors(): void {
        // Request interceptor to add auth token
        this.client.interceptors.request.use(
            (config) => {
                if (this.credentials?.access_token && config.url !== '/login') {
                    config.headers.Authorization = `Bearer ${this.credentials.access_token}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // Response interceptor to handle errors
        this.client.interceptors.response.use(
            (response) => response,
            async (error: AxiosError) => {
                if (error.response?.status === 401) {
                    // Token expired, try to reauthenticate
                    try {
                        await this.authenticate();
                        // Retry the original request
                        return this.client.request(error.config!);
                    } catch (authError) {
                        throw new AuthenticationError('Authentication failed');
                    }
                }
                return Promise.reject(this.handleAxiosError(error));
            }
        );
    }

    private handleAxiosError(error: AxiosError): Error {
        if (error.response) {
            const status = error.response.status;
            const message = error.response.data || error.message;

            switch (status) {
                case 401:
                    return new AuthenticationError('Authentication failed', message);
                case 403:
                    return new AuthorizationError('Access forbidden', message);
                case 404:
                    return new NotFoundError('Resource', 'not found');
                case 400:
                    return new ValidationError('Invalid request', message);
                case 429:
                    return new RateLimitError('Rate limit exceeded');
                default:
                    return new LookerError(`HTTP ${status}: ${error.message}`, status, message);
            }
        } else if (error.request) {
            return new NetworkError('Network error: No response received');
        } else {
            return new NetworkError(`Request setup error: ${error.message}`);
        }
    }

    async authenticate(): Promise<void> {
        try {
            this.logger.info('Authenticating with Looker API');

            const response = await this.client.post('/login', {
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
            });

            this.credentials = response.data;
            this.authTime = new Date();

            this.logger.info('Successfully authenticated with Looker API');
        } catch (error) {
            this.logger.error('Failed to authenticate with Looker API', error);
            throw new AuthenticationError('Failed to authenticate with Looker API');
        }
    }

    isAuthenticated(): boolean {
        if (!this.credentials || !this.authTime) {
            return false;
        }

        const now = new Date();
        const expiresAt = new Date(this.authTime.getTime() + (this.credentials.expires_in * 1000));

        return now < expiresAt;
    }

    private async ensureAuthenticated(): Promise<void> {
        if (!this.isAuthenticated()) {
            try {
                await this.authenticate();
            } catch (error) {
                this.logger.error('Failed to authenticate with Looker. Please check your credentials.', error);
                throw new AuthenticationError(
                    'Looker authentication failed. Please verify LOOKER_BASE_URL, LOOKER_CLIENT_ID, and LOOKER_CLIENT_SECRET environment variables are set correctly.'
                );
            }
        }
    }

    async getModels(): Promise<LookerModel[]> {
        await this.ensureAuthenticated();

        try {
            this.logger.debug('Fetching Looker models');
            const response = await this.client.get('/lookml_models');
            return response.data || [];
        } catch (error) {
            this.logger.error('Failed to fetch models', error);
            throw error;
        }
    }

    async getExplores(modelName: string): Promise<LookerExplore[]> {
        await this.ensureAuthenticated();

        try {
            this.logger.debug('Fetching explores for model', { model: modelName });
            const response = await this.client.get(`/lookml_models/${modelName}/explores`);
            return response.data || [];
        } catch (error) {
            this.logger.error('Failed to fetch explores', error);
            throw error;
        }
    }

    async getDimensions(modelName: string, exploreName: string): Promise<LookerDimension[]> {
        await this.ensureAuthenticated();

        try {
            this.logger.debug('Fetching dimensions', { model: modelName, explore: exploreName });
            const response = await this.client.get(`/lookml_models/${modelName}/explores/${exploreName}`);
            return response.data?.dimensions || [];
        } catch (error) {
            this.logger.error('Failed to fetch dimensions', error);
            throw error;
        }
    }

    async getMeasures(modelName: string, exploreName: string): Promise<LookerMeasure[]> {
        await this.ensureAuthenticated();

        try {
            this.logger.debug('Fetching measures', { model: modelName, explore: exploreName });
            const response = await this.client.get(`/lookml_models/${modelName}/explores/${exploreName}`);
            return response.data?.measures || [];
        } catch (error) {
            this.logger.error('Failed to fetch measures', error);
            throw error;
        }
    }

    async getFilters(modelName: string, exploreName: string): Promise<LookerFilter[]> {
        await this.ensureAuthenticated();

        try {
            this.logger.debug('Fetching filters', { model: modelName, explore: exploreName });
            const response = await this.client.get(`/lookml_models/${modelName}/explores/${exploreName}`);
            const explore = response.data;

            // Filters can come from dimensions that are filterable
            const filters: LookerFilter[] = [];
            if (explore?.dimensions) {
                explore.dimensions.forEach((dim: any) => {
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
        } catch (error) {
            this.logger.error('Failed to fetch filters', error);
            throw error;
        }
    }

    async getParameters(modelName: string, exploreName: string): Promise<LookerParameter[]> {
        await this.ensureAuthenticated();

        try {
            this.logger.debug('Fetching parameters', { model: modelName, explore: exploreName });
            const response = await this.client.get(`/lookml_models/${modelName}/explores/${exploreName}`);
            return response.data?.parameters || [];
        } catch (error) {
            this.logger.error('Failed to fetch parameters', error);
            throw error;
        }
    }

    async getLooks(search?: string): Promise<LookerLook[]> {
        await this.ensureAuthenticated();

        try {
            this.logger.debug('Fetching looks', { search });
            const params = search ? { title: search } : {};
            const response = await this.client.get('/looks/search', { params });
            return response.data || [];
        } catch (error) {
            this.logger.error('Failed to fetch looks', error);
            throw error;
        }
    }

    async runLook(lookId: number): Promise<LookerQueryResult> {
        await this.ensureAuthenticated();

        try {
            this.logger.debug('Running look', { lookId });
            const response = await this.client.get(`/looks/${lookId}/run/json`);
            return {
                data: response.data || [],
                fields: [], // Would need additional API call to get field metadata
                truncated: false,
                query_run_time: 0
            };
        } catch (error) {
            this.logger.error('Failed to run look', error);
            throw error;
        }
    }

    async makeLook(query: LookerQuery, title: string, description?: string): Promise<LookerLook> {
        await this.ensureAuthenticated();

        try {
            this.logger.debug('Creating look', { title, query });

            // First create the query
            const queryResponse = await this.client.post('/queries', query);
            const queryId = queryResponse.data.id;

            // Then create the look
            const lookData = {
                title,
                description,
                query_id: queryId,
                public: false
            };

            const response = await this.client.post('/looks', lookData);
            return response.data;
        } catch (error) {
            this.logger.error('Failed to create look', error);
            throw error;
        }
    }

    async getDashboards(search?: string): Promise<LookerDashboard[]> {
        await this.ensureAuthenticated();

        try {
            this.logger.debug('Fetching dashboards', { search });
            const params = search ? { title: search } : {};
            const response = await this.client.get('/dashboards/search', { params });
            return response.data || [];
        } catch (error) {
            this.logger.error('Failed to fetch dashboards', error);
            throw error;
        }
    }

    async makeDashboard(title: string, description?: string): Promise<LookerDashboard> {
        await this.ensureAuthenticated();

        try {
            this.logger.debug('Creating dashboard', { title });

            const dashboardData = {
                title,
                description,
                hidden: false,
                elements: []
            };

            const response = await this.client.post('/dashboards', dashboardData);
            return response.data;
        } catch (error) {
            this.logger.error('Failed to create dashboard', error);
            throw error;
        }
    }

    async addDashboardElement(dashboardId: number, element: Partial<LookerDashboardElement>): Promise<LookerDashboardElement> {
        await this.ensureAuthenticated();

        try {
            this.logger.debug('Adding dashboard element', { dashboardId, element });

            const elementData = {
                dashboard_id: dashboardId,
                ...element
            };

            const response = await this.client.post(`/dashboard_elements`, elementData);
            return response.data;
        } catch (error) {
            this.logger.error('Failed to add dashboard element', error);
            throw error;
        }
    }

    async query(query: LookerQuery): Promise<LookerQueryResult> {
        await this.ensureAuthenticated();

        try {
            this.logger.debug('Running query', { query });

            const response = await this.client.post('/queries/run/json', query);

            return {
                data: response.data || [],
                fields: [], // Would need additional processing to extract field metadata
                truncated: false,
                sql: '',
                query_run_time: 0,
                applied_filters: query.filters || {}
            };
        } catch (error) {
            this.logger.error('Failed to run query', error);
            throw error;
        }
    }

    async querySQL(query: LookerQuery): Promise<string> {
        await this.ensureAuthenticated();

        try {
            this.logger.debug('Generating SQL for query', { query });

            const response = await this.client.post('/queries/run/sql', query);
            return response.data || '';
        } catch (error) {
            this.logger.error('Failed to generate SQL', error);
            throw error;
        }
    }

    async queryUrl(query: LookerQuery): Promise<string> {
        await this.ensureAuthenticated();

        try {
            this.logger.debug('Generating URL for query', { query });

            // First create the query to get an ID
            const queryResponse = await this.client.post('/queries', query);
            const queryId = queryResponse.data.id;

            // Generate explore URL
            const baseUrl = this.config.baseUrl.replace('/api/4.0', '');
            return `${baseUrl}/explore/${query.model}/${query.explore}?qid=${queryId}`;
        } catch (error) {
            this.logger.error('Failed to generate query URL', error);
            throw error;
        }
    }

    async analyzeElectricity(request: ElectricityAnalysisRequest): Promise<ElectricityAnalysisResult> {
        this.logger.debug('Analyzing electricity data', { request });

        try {
            // Build Looker query for electricity analysis
            const query: LookerQuery = {
                model: 'electricity',
                explore: 'electricity_metrics',
                dimensions: [
                    'electricity_metrics.timestamp_date',
                    ...(request.groupBy ? [`electricity_metrics.timestamp_${request.groupBy}`] : [])
                ],
                measures: request.metrics.map(metric => `electricity_metrics.${metric}`),
                filters: {
                    'electricity_metrics.timestamp_date': `${request.timeRange.start} to ${request.timeRange.end}`,
                    ...request.filters
                },
                sorts: ['electricity_metrics.timestamp_date'],
                limit: 10000
            };

            // Execute the query
            const result = await this.query(query);

            // Process the results into electricity metrics format
            const electricityData: ElectricityMetrics[] = result.data?.map((row: any) => ({
                timestamp: row['electricity_metrics.timestamp_date'] || '',
                consumption_kwh: parseFloat(row['electricity_metrics.consumption_kwh'] || 0),
                generation_kwh: parseFloat(row['electricity_metrics.generation_kwh'] || 0),
                grid_import_kwh: parseFloat(row['electricity_metrics.grid_import_kwh'] || 0),
                grid_export_kwh: parseFloat(row['electricity_metrics.grid_export_kwh'] || 0),
                solar_generation_kwh: parseFloat(row['electricity_metrics.solar_generation_kwh'] || 0),
                wind_generation_kwh: parseFloat(row['electricity_metrics.wind_generation_kwh'] || 0),
                battery_charge_kwh: parseFloat(row['electricity_metrics.battery_charge_kwh'] || 0),
                battery_discharge_kwh: parseFloat(row['electricity_metrics.battery_discharge_kwh'] || 0),
                demand_kw: parseFloat(row['electricity_metrics.demand_kw'] || 0),
                peak_demand_kw: parseFloat(row['electricity_metrics.peak_demand_kw'] || 0),
                voltage_v: parseFloat(row['electricity_metrics.voltage_v'] || 0),
                frequency_hz: parseFloat(row['electricity_metrics.frequency_hz'] || 0),
                power_factor: parseFloat(row['electricity_metrics.power_factor'] || 0),
                cost_eur: parseFloat(row['electricity_metrics.cost_eur'] || 0),
                carbon_emissions_kg: parseFloat(row['electricity_metrics.carbon_emissions_kg'] || 0),
            })) || [];

            // Calculate summary statistics
            const summary = this.calculateElectricitySummary(electricityData);
            const trends = this.calculateElectricityTrends(electricityData);

            return {
                data: electricityData,
                summary,
                trends,
                // Note: Forecasting and comparisons would require additional queries or ML models
                ...(request.includeForecasting && { forecasting: await this.generateForecasting(electricityData) }),
                ...(request.includeComparisons && { comparisons: await this.generateComparisons(request, electricityData) })
            };
        } catch (error) {
            this.logger.error('Failed to analyze electricity data', error);
            throw error;
        }
    }

    private calculateElectricitySummary(data: ElectricityMetrics[]) {
        if (data.length === 0) {
            return {
                totalConsumption: 0,
                totalGeneration: 0,
                netConsumption: 0,
                peakDemand: 0,
                averageDemand: 0,
                totalCost: 0,
                totalEmissions: 0,
                selfSufficiency: 0,
                gridDependency: 0
            };
        }

        const totalConsumption = data.reduce((sum, d) => sum + d.consumption_kwh, 0);
        const totalGeneration = data.reduce((sum, d) => sum + (d.generation_kwh || 0), 0);
        const netConsumption = totalConsumption - totalGeneration;
        const peakDemand = Math.max(...data.map(d => d.demand_kw || 0));
        const averageDemand = data.reduce((sum, d) => sum + (d.demand_kw || 0), 0) / data.length;
        const totalCost = data.reduce((sum, d) => sum + (d.cost_eur || 0), 0);
        const totalEmissions = data.reduce((sum, d) => sum + (d.carbon_emissions_kg || 0), 0);

        const selfSufficiency = totalGeneration > 0 ? Math.min(100, (totalGeneration / totalConsumption) * 100) : 0;
        const gridDependency = totalConsumption > 0 ? Math.max(0, ((totalConsumption - totalGeneration) / totalConsumption) * 100) : 0;

        return {
            totalConsumption,
            totalGeneration,
            netConsumption,
            peakDemand,
            averageDemand,
            totalCost,
            totalEmissions,
            selfSufficiency,
            gridDependency
        };
    }

    private calculateElectricityTrends(data: ElectricityMetrics[]): {
        consumptionTrend: 'increasing' | 'decreasing' | 'stable';
        generationTrend?: 'increasing' | 'decreasing' | 'stable';
        costTrend?: 'increasing' | 'decreasing' | 'stable';
    } {
        if (data.length < 2) {
            return {
                consumptionTrend: 'stable',
                generationTrend: 'stable',
                costTrend: 'stable'
            };
        }

        const midpoint = Math.floor(data.length / 2);
        const firstHalf = data.slice(0, midpoint);
        const secondHalf = data.slice(midpoint);

        const firstHalfConsumption = firstHalf.reduce((sum, d) => sum + d.consumption_kwh, 0) / firstHalf.length;
        const secondHalfConsumption = secondHalf.reduce((sum, d) => sum + d.consumption_kwh, 0) / secondHalf.length;

        const firstHalfGeneration = firstHalf.reduce((sum, d) => sum + (d.generation_kwh || 0), 0) / firstHalf.length;
        const secondHalfGeneration = secondHalf.reduce((sum, d) => sum + (d.generation_kwh || 0), 0) / secondHalf.length;

        const firstHalfCost = firstHalf.reduce((sum, d) => sum + (d.cost_eur || 0), 0) / firstHalf.length;
        const secondHalfCost = secondHalf.reduce((sum, d) => sum + (d.cost_eur || 0), 0) / secondHalf.length;

        const getTrend = (first: number, second: number): 'increasing' | 'decreasing' | 'stable' => {
            const change = ((second - first) / first) * 100;
            if (change > 5) return 'increasing';
            if (change < -5) return 'decreasing';
            return 'stable';
        };

        return {
            consumptionTrend: getTrend(firstHalfConsumption, secondHalfConsumption),
            generationTrend: getTrend(firstHalfGeneration, secondHalfGeneration),
            costTrend: getTrend(firstHalfCost, secondHalfCost)
        };
    }

    private async generateForecasting(data: ElectricityMetrics[]) {
        // Simple linear trend forecasting (in production, would use proper ML models)
        if (data.length < 3) {
            return {
                nextPeriod: [],
                confidence: 0,
                methodology: 'Insufficient data for forecasting'
            };
        }

        // For demo purposes, return a simple projection
        return {
            nextPeriod: [],
            confidence: 0.7,
            methodology: 'Linear trend projection (demo)'
        };
    }

    private async generateComparisons(request: ElectricityAnalysisRequest, currentData: ElectricityMetrics[]) {
        // Would implement period-over-period comparisons
        return {
            previousPeriod: {
                change: 0,
                changePercent: 0
            },
            yearOverYear: {
                change: 0,
                changePercent: 0
            }
        };
    }
}
