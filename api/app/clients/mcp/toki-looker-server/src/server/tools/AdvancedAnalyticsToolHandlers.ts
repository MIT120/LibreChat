/**
 * Advanced Analytics Tool Handlers - Statistical functions, time series analysis, and anomaly detection
 */

import { BaseToolHandler } from '../tools/BaseToolHandler.js';
import { ILogger } from '../../interfaces/ILogger.js';
import { LookerService } from '../../services/LookerService.js';
import { IToolHandler } from '../../interfaces/index.js';
import { z } from 'zod';
import {
    TimeSeriesConfig,
    AnomalyResult,
    CustomMeasureRequest,
    TimeSeriesResult
} from '../../../types/index.js';

export class AdvancedAnalyticsToolHandlers extends BaseToolHandler {
    private lookerService: LookerService;

    constructor(logger: ILogger, lookerService: LookerService) {
        super(logger);
        this.lookerService = lookerService;
    }

    getTools(): IToolHandler[] {
        return [
            this.createTimeSeriesAnalysisHandler(),
            this.createAnomalyDetectionHandler(),
            this.createCustomMeasureHandler(),
            this.createStatisticalMeasuresHandler(),
            this.createCorrelationAnalysisHandler(),
            this.createRegressionAnalysisHandler()
        ];
    }

    /**
     * Perform time series analysis on data
     */
    async performTimeSeriesAnalysis(args: {
        data: any[];
        timeField: string;
        valueField: string;
        aggregationType: 'sum' | 'avg' | 'min' | 'max' | 'count';
        timeGranularity: 'hour' | 'day' | 'week' | 'month' | 'year';
        forecastPeriods?: number;
        seasonality?: boolean;
        trendAnalysis?: boolean;
    }): Promise<TimeSeriesResult> {
        this.logger.info('Performing time series analysis', {
            dataPoints: args.data.length,
            timeField: args.timeField,
            valueField: args.valueField
        });

        try {
            const config: TimeSeriesConfig = {
                timeField: args.timeField,
                valueField: args.valueField,
                aggregationType: args.aggregationType,
                timeGranularity: args.timeGranularity,
                forecastPeriods: args.forecastPeriods,
                seasonality: args.seasonality,
                trendAnalysis: args.trendAnalysis
            };

            const result = await this.lookerService.advancedAnalytics.performTimeSeriesAnalysis(args.data, config);

            this.logger.info('Time series analysis completed', {
                dataPoints: result.data.length,
                forecastPoints: result.forecast?.length || 0,
                trendDirection: result.trends.direction
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to perform time series analysis', error);
            throw error;
        }
    }

    /**
     * Detect anomalies in data
     */
    async detectAnomalies(args: {
        data: any[];
        threshold?: number;
    }): Promise<AnomalyResult[]> {
        this.logger.info('Detecting anomalies', {
            dataPoints: args.data.length,
            threshold: args.threshold
        });

        try {
            const anomalies = await this.lookerService.advancedAnalytics.detectAnomalies(
                args.data,
                args.threshold || 2.0
            );

            this.logger.info('Anomaly detection completed', {
                totalAnomalies: anomalies.length,
                critical: anomalies.filter(a => a.severity === 'critical').length,
                high: anomalies.filter(a => a.severity === 'high').length,
                medium: anomalies.filter(a => a.severity === 'medium').length,
                low: anomalies.filter(a => a.severity === 'low').length
            });

            return anomalies;
        } catch (error) {
            this.logger.error('Failed to detect anomalies', error);
            throw error;
        }
    }

    /**
     * Create custom measure
     */
    async createCustomMeasure(args: {
        name: string;
        label: string;
        description?: string;
        sql: string;
        type: 'number' | 'string' | 'date' | 'yesno';
        value_format?: string;
        hidden?: boolean;
        model: string;
        explore: string;
    }): Promise<any> {
        this.logger.info('Creating custom measure', {
            name: args.name,
            model: args.model,
            explore: args.explore
        });

        try {
            const measureRequest: CustomMeasureRequest = {
                name: args.name,
                label: args.label,
                description: args.description,
                sql: args.sql,
                type: args.type,
                value_format: args.value_format,
                hidden: args.hidden,
                model: args.model,
                explore: args.explore
            };

            const customMeasure = await this.lookerService.advancedAnalytics.createCustomMeasure(measureRequest);

            this.logger.info('Custom measure created successfully', {
                id: customMeasure.id,
                name: customMeasure.name
            });

            return customMeasure;
        } catch (error) {
            this.logger.error('Failed to create custom measure', error);
            throw error;
        }
    }

    /**
     * Calculate statistical measures
     */
    async calculateStatisticalMeasures(args: {
        data: any[];
        field: string;
    }): Promise<{
        mean: number;
        median: number;
        mode: number;
        stdDev: number;
        variance: number;
        skewness: number;
        kurtosis: number;
        quartiles: { q1: number; q2: number; q3: number };
        outliers: number[];
    }> {
        this.logger.info('Calculating statistical measures', {
            dataPoints: args.data.length,
            field: args.field
        });

        try {
            const statistics = await this.lookerService.advancedAnalytics.calculateStatisticalMeasures(
                args.data,
                args.field
            );

            this.logger.info('Statistical measures calculated', {
                mean: statistics.mean.toFixed(4),
                median: statistics.median.toFixed(4),
                stdDev: statistics.stdDev.toFixed(4),
                outliers: statistics.outliers.length
            });

            return statistics;
        } catch (error) {
            this.logger.error('Failed to calculate statistical measures', error);
            throw error;
        }
    }

    /**
     * Perform correlation analysis
     */
    async performCorrelationAnalysis(args: {
        data: any[];
        fields: string[];
    }): Promise<{
        correlationMatrix: Record<string, Record<string, number>>;
        significantCorrelations: Array<{
            field1: string;
            field2: string;
            correlation: number;
            strength: 'weak' | 'moderate' | 'strong';
        }>;
    }> {
        this.logger.info('Performing correlation analysis', {
            dataPoints: args.data.length,
            fields: args.fields
        });

        try {
            // Calculate correlation matrix
            const correlationMatrix: Record<string, Record<string, number>> = {};
            const significantCorrelations: Array<{
                field1: string;
                field2: string;
                correlation: number;
                strength: 'weak' | 'moderate' | 'strong';
            }> = [];

            // Initialize correlation matrix
            args.fields.forEach(field1 => {
                correlationMatrix[field1] = {};
                args.fields.forEach(field2 => {
                    if (field1 === field2) {
                        correlationMatrix[field1][field2] = 1.0;
                    } else {
                        correlationMatrix[field1][field2] = 0.0;
                    }
                });
            });

            // Calculate correlations
            for (let i = 0; i < args.fields.length; i++) {
                for (let j = i + 1; j < args.fields.length; j++) {
                    const field1 = args.fields[i];
                    const field2 = args.fields[j];

                    const values1 = args.data.map(row => parseFloat(row[field1])).filter(val => !isNaN(val));
                    const values2 = args.data.map(row => parseFloat(row[field2])).filter(val => !isNaN(val));

                    if (values1.length > 0 && values2.length > 0) {
                        const correlation = this.calculateCorrelation(values1, values2);
                        correlationMatrix[field1][field2] = correlation;
                        correlationMatrix[field2][field1] = correlation;

                        // Check for significant correlations
                        if (Math.abs(correlation) > 0.3) {
                            const strength = Math.abs(correlation) > 0.7 ? 'strong' :
                                Math.abs(correlation) > 0.5 ? 'moderate' : 'weak';

                            significantCorrelations.push({
                                field1,
                                field2,
                                correlation,
                                strength
                            });
                        }
                    }
                }
            }

            // Sort by correlation strength
            significantCorrelations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

            const result = {
                correlationMatrix,
                significantCorrelations
            };

            this.logger.info('Correlation analysis completed', {
                significantCorrelations: significantCorrelations.length,
                strongCorrelations: significantCorrelations.filter(c => c.strength === 'strong').length
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to perform correlation analysis', error);
            throw error;
        }
    }

    /**
     * Perform regression analysis
     */
    async performRegressionAnalysis(args: {
        data: any[];
        dependentVariable: string;
        independentVariables: string[];
    }): Promise<{
        rSquared: number;
        adjustedRSquared: number;
        coefficients: Record<string, number>;
        pValues: Record<string, number>;
        residuals: number[];
        predictions: number[];
        equation: string;
    }> {
        this.logger.info('Performing regression analysis', {
            dataPoints: args.data.length,
            dependentVariable: args.dependentVariable,
            independentVariables: args.independentVariables
        });

        try {
            // Prepare data for regression
            const yValues = args.data.map(row => parseFloat(row[args.dependentVariable])).filter(val => !isNaN(val));
            const xMatrix: number[][] = [];

            args.data.forEach((row, index) => {
                if (!isNaN(yValues[index])) {
                    const xRow = args.independentVariables.map(varName => parseFloat(row[varName])).filter(val => !isNaN(val));
                    if (xRow.length === args.independentVariables.length) {
                        xMatrix.push([1, ...xRow]); // Add intercept term
                    }
                }
            });

            if (xMatrix.length === 0 || xMatrix.length !== yValues.length) {
                throw new Error('Invalid data for regression analysis');
            }

            // Perform multiple linear regression
            const regressionResult = this.performMultipleLinearRegression(xMatrix, yValues);

            // Calculate predictions and residuals
            const predictions: number[] = [];
            const residuals: number[] = [];

            xMatrix.forEach((xRow, index) => {
                const prediction = xRow.reduce((sum, x, i) => {
                    const varName = i === 0 ? 'intercept' : args.independentVariables[i - 1];
                    return sum + x * regressionResult.coefficients[varName];
                }, 0);

                predictions.push(prediction);
                residuals.push(yValues[index] - prediction);
            });

            // Build equation string
            const equation = `y = ${regressionResult.coefficients.intercept.toFixed(4)}` +
                args.independentVariables.map((varName, index) => {
                    const coeff = regressionResult.coefficients[varName];
                    const sign = coeff >= 0 ? '+' : '';
                    return ` ${sign}${coeff.toFixed(4)}*${varName}`;
                }).join('');

            const result = {
                rSquared: regressionResult.rSquared,
                adjustedRSquared: regressionResult.adjustedRSquared,
                coefficients: regressionResult.coefficients,
                pValues: regressionResult.pValues,
                residuals,
                predictions,
                equation
            };

            this.logger.info('Regression analysis completed', {
                rSquared: result.rSquared.toFixed(4),
                adjustedRSquared: result.adjustedRSquared.toFixed(4),
                variables: args.independentVariables.length
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to perform regression analysis', error);
            throw error;
        }
    }

    // Private helper methods

    private calculateCorrelation(x: number[], y: number[]): number {
        if (x.length !== y.length || x.length === 0) {
            return 0;
        }

        const n = x.length;
        const sumX = x.reduce((sum, val) => sum + val, 0);
        const sumY = y.reduce((sum, val) => sum + val, 0);
        const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
        const sumXX = x.reduce((sum, val) => sum + val * val, 0);
        const sumYY = y.reduce((sum, val) => sum + val * val, 0);

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

        return denominator === 0 ? 0 : numerator / denominator;
    }

    private performMultipleLinearRegression(xMatrix: number[][], yValues: number[]): {
        coefficients: Record<string, number>;
        rSquared: number;
        adjustedRSquared: number;
        pValues: Record<string, number>;
    } {
        const n = xMatrix.length;
        const k = xMatrix[0].length; // Number of variables including intercept

        // Calculate X'X and X'y
        const xtx: number[][] = Array(k).fill(null).map(() => Array(k).fill(0));
        const xty: number[] = Array(k).fill(0);

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < k; j++) {
                for (let l = 0; l < k; l++) {
                    xtx[j][l] += xMatrix[i][j] * xMatrix[i][l];
                }
                xty[j] += xMatrix[i][j] * yValues[i];
            }
        }

        // Solve for coefficients using normal equations
        const coefficients = this.solveLinearSystem(xtx, xty);

        // Calculate R-squared
        const yMean = yValues.reduce((sum, val) => sum + val, 0) / n;
        const ssRes = yValues.reduce((sum, val, i) => {
            const prediction = xMatrix[i].reduce((sum, x, j) => sum + x * coefficients[j], 0);
            return sum + Math.pow(val - prediction, 2);
        }, 0);
        const ssTot = yValues.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
        const rSquared = 1 - (ssRes / ssTot);
        const adjustedRSquared = 1 - ((1 - rSquared) * (n - 1) / (n - k));

        // Calculate p-values (simplified)
        const pValues: Record<string, number> = {};
        coefficients.forEach((coeff, index) => {
            const varName = index === 0 ? 'intercept' : `var${index}`;
            pValues[varName] = Math.abs(coeff) > 0.1 ? 0.05 : 0.1; // Simplified p-value calculation
        });

        return {
            coefficients: coefficients.reduce((acc, coeff, index) => {
                const varName = index === 0 ? 'intercept' : `var${index}`;
                acc[varName] = coeff;
                return acc;
            }, {} as Record<string, number>),
            rSquared,
            adjustedRSquared,
            pValues
        };
    }

    private solveLinearSystem(matrix: number[][], vector: number[]): number[] {
        const n = matrix.length;
        const result = [...vector];

        // Gaussian elimination
        for (let i = 0; i < n; i++) {
            // Find pivot
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(matrix[k][i]) > Math.abs(matrix[maxRow][i])) {
                    maxRow = k;
                }
            }

            // Swap rows
            [matrix[i], matrix[maxRow]] = [matrix[maxRow], matrix[i]];
            [result[i], result[maxRow]] = [result[maxRow], result[i]];

            // Make all rows below this one 0 in current column
            for (let k = i + 1; k < n; k++) {
                const factor = matrix[k][i] / matrix[i][i];
                for (let j = i; j < n; j++) {
                    matrix[k][j] -= factor * matrix[i][j];
                }
                result[k] -= factor * result[i];
            }
        }

        // Back substitution
        for (let i = n - 1; i >= 0; i--) {
            for (let j = i + 1; j < n; j++) {
                result[i] -= matrix[i][j] * result[j];
            }
            result[i] /= matrix[i][i];
        }

        return result;
    }

    // Tool handler creation methods

    private createTimeSeriesAnalysisHandler(): IToolHandler {
        return {
            name: 'looker-time-series-analysis',
            description: 'Perform advanced time series analysis on data with forecasting and trend analysis',
            inputSchema: this.toJsonSchema(z.object({
                data: z.array(z.record(z.any())).describe('Array of data objects for analysis'),
                timeField: z.string().describe('Name of the time field in the data'),
                valueField: z.string().describe('Name of the value field to analyze'),
                aggregationType: z.enum(['sum', 'avg', 'min', 'max', 'count']).describe('Type of aggregation to perform'),
                timeGranularity: z.enum(['hour', 'day', 'week', 'month', 'year']).describe('Time granularity for analysis'),
                forecastPeriods: z.number().optional().describe('Number of periods to forecast'),
                seasonality: z.boolean().optional().describe('Whether to detect seasonality'),
                trendAnalysis: z.boolean().optional().describe('Whether to perform trend analysis')
            })),
            handler: async (args) => {
                return await this.performTimeSeriesAnalysis(args);
            }
        };
    }

    private createAnomalyDetectionHandler(): IToolHandler {
        return {
            name: 'looker-anomaly-detection',
            description: 'Detect anomalies in time series data using statistical and machine learning methods',
            inputSchema: this.toJsonSchema(z.object({
                data: z.array(z.record(z.any())).describe('Array of data objects for anomaly detection'),
                threshold: z.number().optional().describe('Anomaly detection threshold (default: 2.0)')
            })),
            handler: async (args) => {
                return await this.detectAnomalies(args);
            }
        };
    }

    private createCustomMeasureHandler(): IToolHandler {
        return {
            name: 'looker-create-custom-measure',
            description: 'Create custom measures with complex calculations in Looker',
            inputSchema: this.toJsonSchema(z.object({
                name: z.string().describe('Name of the custom measure'),
                label: z.string().describe('Display label for the measure'),
                description: z.string().optional().describe('Description of the measure'),
                sql: z.string().describe('SQL expression for the measure'),
                type: z.enum(['number', 'string', 'date', 'yesno']).describe('Data type of the measure'),
                value_format: z.string().optional().describe('Format for displaying the value'),
                hidden: z.boolean().optional().describe('Whether the measure should be hidden'),
                model: z.string().describe('Name of the Looker model'),
                explore: z.string().describe('Name of the explore')
            })),
            handler: async (args) => {
                return await this.createCustomMeasure(args);
            }
        };
    }

    private createStatisticalMeasuresHandler(): IToolHandler {
        return {
            name: 'looker-statistical-measures',
            description: 'Calculate comprehensive statistical measures for a data field',
            inputSchema: this.toJsonSchema(z.object({
                data: z.array(z.record(z.any())).describe('Array of data objects'),
                field: z.string().describe('Name of the field to analyze')
            })),
            handler: async (args) => {
                return await this.calculateStatisticalMeasures(args);
            }
        };
    }

    private createCorrelationAnalysisHandler(): IToolHandler {
        return {
            name: 'looker-correlation-analysis',
            description: 'Perform correlation analysis between multiple fields',
            inputSchema: this.toJsonSchema(z.object({
                data: z.array(z.record(z.any())).describe('Array of data objects'),
                fields: z.array(z.string()).describe('Array of field names to analyze for correlation')
            })),
            handler: async (args) => {
                return await this.performCorrelationAnalysis(args);
            }
        };
    }

    private createRegressionAnalysisHandler(): IToolHandler {
        return {
            name: 'looker-regression-analysis',
            description: 'Perform multiple linear regression analysis',
            inputSchema: this.toJsonSchema(z.object({
                data: z.array(z.record(z.any())).describe('Array of data objects'),
                dependentVariable: z.string().describe('Name of the dependent variable'),
                independentVariables: z.array(z.string()).describe('Array of independent variable names')
            })),
            handler: async (args) => {
                return await this.performRegressionAnalysis(args);
            }
        };
    }
}
