/**
 * Electricity Analytics Service - Specialized service for electricity data analysis
 */

import { BaseLookerService } from '../base/BaseLookerService.js';
import { ILogger } from '../../interfaces/ILogger.js';
import { LookerConfig } from '../../../types/index.js';
import {
    ElectricityAnalysisRequest,
    ElectricityAnalysisResult,
    ElectricityMetrics,
    LookerQuery
} from '../../../types/index.js';
import { ValidationError } from '../../../types/errors.js';
import { LookerMetadataService } from '../core/LookerMetadataService.js';
import { LookerQueryService } from '../core/LookerQueryService.js';

export class ElectricityAnalyticsService extends BaseLookerService {
    private metadataService: LookerMetadataService;
    private queryService: LookerQueryService;

    constructor(logger: ILogger, config: LookerConfig, queryService: LookerQueryService, metadataService: LookerMetadataService) {
        super(logger, config);
        this.queryService = queryService;
        this.metadataService = metadataService;
    }

    async analyzeElectricity(request: ElectricityAnalysisRequest): Promise<ElectricityAnalysisResult> {
        this.logger.debug('Analyzing electricity data', { request });

        try {
            // Determine model and explore to use
            const { modelName, exploreName } = await this.determineModelAndExplore(request);

            this.logger.info(`Using model: ${modelName}, explore: ${exploreName} for electricity analysis`);

            // Get available fields to build proper field names
            const availableFields = await this.metadataService.getAvailableFields(modelName, exploreName);
            this.logger.debug('Available fields for electricity analysis', {
                dimensions: availableFields.dimensions,
                measures: availableFields.measures
            });

            // Find timestamp/date fields
            const timestampFields = this.findTimestampFields(availableFields.dimensions);
            if (timestampFields.length === 0) {
                throw this.createNoTimestampFieldsError(modelName, exploreName, availableFields);
            }

            const primaryTimestampField = timestampFields[0];
            this.logger.debug(`Using timestamp field: ${primaryTimestampField}`);

            // Build and execute the query
            const query = this.buildElectricityQuery(request, modelName, exploreName, primaryTimestampField, availableFields);
            const result = await this.queryService.query(query);

            // Process the results
            const electricityData = this.processElectricityData(result.data || []);
            const summary = this.calculateElectricitySummary(electricityData);
            const trends = this.calculateElectricityTrends(electricityData);

            const analysisResult: ElectricityAnalysisResult = {
                data: electricityData,
                summary,
                trends
            };

            // Add optional features
            if (request.includeForecasting) {
                analysisResult.forecasting = await this.generateForecasting(electricityData);
            }

            if (request.includeComparisons) {
                analysisResult.comparisons = await this.generateComparisons(request, electricityData);
            }

            return analysisResult;
        } catch (error) {
            this.logger.error('Failed to analyze electricity data', error);
            throw error;
        }
    }

    private async determineModelAndExplore(request: ElectricityAnalysisRequest): Promise<{
        modelName: string;
        exploreName: string;
    }> {
        let modelName = request.model;
        let exploreName = request.explore;

        // If not specified, try to auto-detect from available models
        if (!modelName || !exploreName) {
            this.logger.debug('Model or explore not specified, attempting auto-detection');

            const models = await this.metadataService.getModels();
            this.logger.debug(`Found ${models.length} models for auto-detection`, {
                modelNames: models.map(m => m.name)
            });

            // Look for models that might contain electricity/metering data
            const candidateModels = models.filter(m =>
                m.name.toLowerCase().includes('metering') ||
                m.name.toLowerCase().includes('electricity') ||
                m.name.toLowerCase().includes('energy') ||
                m.name.toLowerCase().includes('power')
            );

            if (candidateModels.length > 0) {
                modelName = candidateModels[0].name;
                this.logger.debug(`Auto-selected model: ${modelName}`);

                // Get explores for this model
                const explores = await this.metadataService.getExplores(modelName);
                const candidateExplores = explores.filter(e =>
                    e.name.toLowerCase().includes('customer') ||
                    e.name.toLowerCase().includes('measurement') ||
                    e.name.toLowerCase().includes('billing') ||
                    e.name.toLowerCase().includes('metering')
                );

                if (candidateExplores.length > 0) {
                    exploreName = candidateExplores[0].name;
                    this.logger.debug(`Auto-selected explore: ${exploreName}`);
                } else if (explores.length > 0) {
                    exploreName = explores[0].name;
                    this.logger.debug(`Using first available explore: ${exploreName}`);
                }
            }
        }

        if (!modelName || !exploreName) {
            throw new ValidationError('Could not determine model and explore for electricity analysis. Please specify model and explore parameters or ensure your Looker instance has models with electricity/metering data.');
        }

        return { modelName, exploreName };
    }

    private findTimestampFields(dimensions: string[]): string[] {
        return dimensions.filter(field =>
            field.toLowerCase().includes('timestamp') ||
            field.toLowerCase().includes('date') ||
            field.toLowerCase().includes('time')
        );
    }

    private createNoTimestampFieldsError(modelName: string, exploreName: string, availableFields: any): ValidationError {
        const errorMessage = `No timestamp/date fields found in ${modelName}.${exploreName}. `;
        const availableDims = availableFields.dimensions.length > 0
            ? `Available dimensions: ${availableFields.dimensions.join(', ')}`
            : 'No dimensions found - this might indicate a permission issue or incorrect model/explore name.';
        const availableMeasures = availableFields.measures.length > 0
            ? ` Available measures: ${availableFields.measures.join(', ')}`
            : ' No measures found.';

        return new ValidationError(errorMessage + availableDims + availableMeasures);
    }

    private buildElectricityQuery(
        request: ElectricityAnalysisRequest,
        modelName: string,
        exploreName: string,
        primaryTimestampField: string,
        availableFields: any
    ): LookerQuery {
        return {
            model: modelName,
            explore: exploreName,
            dimensions: [
                primaryTimestampField,
                ...(request.groupBy && this.findTimestampFields(availableFields.dimensions).some(f => f.includes(request.groupBy!))
                    ? [this.findTimestampFields(availableFields.dimensions).find(f => f.includes(request.groupBy!))!]
                    : [])
            ],
            measures: request.metrics.map(metric => {
                // Try to find matching measure fields
                const matchingMeasures = availableFields.measures.filter((field: string) =>
                    field.toLowerCase().includes(metric.toLowerCase()) ||
                    field.toLowerCase().includes(metric.replace('_kwh', '').replace('_kw', '').replace('_eur', '').replace('_kg', ''))
                );

                if (matchingMeasures.length > 0) {
                    return matchingMeasures[0];
                } else {
                    // Fallback to constructing field name
                    return `${exploreName}.${metric}`;
                }
            }),
            filters: {
                [primaryTimestampField]: `${request.timeRange.start} to ${request.timeRange.end}`,
                ...request.filters
            },
            sorts: [primaryTimestampField],
            limit: 10000
        };
    }

    private processElectricityData(data: any[]): ElectricityMetrics[] {
        return data?.map((row: any) => ({
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
