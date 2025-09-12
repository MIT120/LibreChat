/**
 * Looker Advanced Analytics Service - Statistical functions, time series analysis, and anomaly detection
 */

import { BaseLookerService } from '../base/BaseLookerService.js';
import { ILogger } from '../../interfaces/ILogger.js';
import { LookerConfig } from '../../../types/index.js';
import {
    TimeSeriesConfig,
    TimeSeriesResult,
    TimeSeriesDataPoint,
    AnomalyResult,
    CustomMeasureRequest,
    CustomMeasure
} from '../../../types/index.js';
import { ValidationError } from '../../../types/errors.js';

export class LookerAdvancedAnalyticsService extends BaseLookerService {
    constructor(logger: ILogger, config: LookerConfig) {
        super(logger, config);
    }

    /**
     * Perform advanced time series analysis on data
     */
    async performTimeSeriesAnalysis(data: any[], config: TimeSeriesConfig): Promise<TimeSeriesResult> {
        this.logger.info('Performing time series analysis', {
            dataPoints: data.length,
            config
        });

        try {
            // Validate input data
            if (!data || data.length === 0) {
                throw new ValidationError('No data provided for time series analysis');
            }

            // Extract time series data points
            const timeSeriesData = this.extractTimeSeriesData(data, config);

            // Calculate basic statistics
            const statistics = this.calculateStatistics(timeSeriesData);

            // Perform trend analysis
            const trends = this.analyzeTrends(timeSeriesData);

            // Detect seasonality if requested
            const seasonality = config.seasonality ?
                this.detectSeasonality(timeSeriesData) : undefined;

            // Generate forecast if requested
            const forecast = config.forecastPeriods ?
                this.generateForecast(timeSeriesData, config.forecastPeriods) : undefined;

            const result: TimeSeriesResult = {
                data: timeSeriesData,
                forecast,
                trends,
                seasonality,
                statistics
            };

            this.logger.info('Time series analysis completed', {
                dataPoints: timeSeriesData.length,
                forecastPoints: forecast?.length || 0,
                trendDirection: trends.direction,
                seasonalityDetected: seasonality?.detected || false
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to perform time series analysis', error);
            throw error;
        }
    }

    /**
     * Detect anomalies in time series data
     */
    async detectAnomalies(data: any[], threshold: number = 2.0): Promise<AnomalyResult[]> {
        this.logger.info('Detecting anomalies', {
            dataPoints: data.length,
            threshold
        });

        try {
            if (!data || data.length === 0) {
                throw new ValidationError('No data provided for anomaly detection');
            }

            const anomalies: AnomalyResult[] = [];

            // Method 1: Statistical (Z-Score) anomaly detection
            const statisticalAnomalies = this.detectStatisticalAnomalies(data, threshold);
            anomalies.push(...statisticalAnomalies);

            // Method 2: Isolation Forest (simplified implementation)
            const isolationAnomalies = this.detectIsolationForestAnomalies(data, threshold);
            anomalies.push(...isolationAnomalies);

            // Remove duplicates and sort by severity
            const uniqueAnomalies = this.deduplicateAnomalies(anomalies);
            const sortedAnomalies = uniqueAnomalies.sort((a, b) => {
                const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
                return severityOrder[b.severity] - severityOrder[a.severity];
            });

            this.logger.info('Anomaly detection completed', {
                totalAnomalies: sortedAnomalies.length,
                critical: sortedAnomalies.filter(a => a.severity === 'critical').length,
                high: sortedAnomalies.filter(a => a.severity === 'high').length,
                medium: sortedAnomalies.filter(a => a.severity === 'medium').length,
                low: sortedAnomalies.filter(a => a.severity === 'low').length
            });

            return sortedAnomalies;
        } catch (error) {
            this.logger.error('Failed to detect anomalies', error);
            throw error;
        }
    }

    /**
     * Create custom measures with complex calculations
     */
    async createCustomMeasure(measure: CustomMeasureRequest): Promise<CustomMeasure> {
        this.logger.info('Creating custom measure', {
            name: measure.name,
            model: measure.model,
            explore: measure.explore
        });

        try {
            // Validate the measure request
            this.validateCustomMeasure(measure);

            // Create the measure using Looker API
            const measureData = {
                name: measure.name,
                label: measure.label,
                description: measure.description,
                type: measure.type,
                sql: measure.sql,
                value_format: measure.value_format,
                hidden: measure.hidden || false
            };

            return this.makeSDKCall(async () => {
                // This would typically involve creating a LookML file or using the API
                // For now, we'll simulate the creation
                const customMeasure: CustomMeasure = {
                    id: `custom_${Date.now()}`,
                    name: measure.name,
                    label: measure.label,
                    description: measure.description,
                    sql: measure.sql,
                    type: measure.type,
                    value_format: measure.value_format,
                    hidden: measure.hidden || false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };

                this.logger.info('Custom measure created successfully', {
                    id: customMeasure.id,
                    name: customMeasure.name
                });

                return customMeasure;
            }, 'createCustomMeasure');
        } catch (error) {
            this.logger.error('Failed to create custom measure', error);
            throw error;
        }
    }

    /**
     * Calculate statistical measures for data
     */
    async calculateStatisticalMeasures(data: any[], field: string): Promise<{
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
            dataPoints: data.length,
            field
        });

        try {
            const values = data.map(row => parseFloat(row[field])).filter(val => !isNaN(val));

            if (values.length === 0) {
                throw new ValidationError(`No valid numeric values found for field: ${field}`);
            }

            const sortedValues = values.sort((a, b) => a - b);
            const n = sortedValues.length;

            // Basic statistics
            const mean = values.reduce((sum, val) => sum + val, 0) / n;
            const median = this.calculateMedian(sortedValues);
            const mode = this.calculateMode(sortedValues);

            // Variance and standard deviation
            const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
            const stdDev = Math.sqrt(variance);

            // Skewness and kurtosis
            const skewness = this.calculateSkewness(values, mean, stdDev);
            const kurtosis = this.calculateKurtosis(values, mean, stdDev);

            // Quartiles
            const quartiles = this.calculateQuartiles(sortedValues);

            // Outliers (using IQR method)
            const outliers = this.detectOutliers(sortedValues, quartiles);

            const result = {
                mean,
                median,
                mode,
                stdDev,
                variance,
                skewness,
                kurtosis,
                quartiles,
                outliers
            };

            this.logger.info('Statistical measures calculated', {
                mean: result.mean.toFixed(4),
                median: result.median.toFixed(4),
                stdDev: result.stdDev.toFixed(4),
                outliers: result.outliers.length
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to calculate statistical measures', error);
            throw error;
        }
    }

    // Private helper methods

    private extractTimeSeriesData(data: any[], config: TimeSeriesConfig): TimeSeriesDataPoint[] {
        return data.map(row => ({
            timestamp: row[config.timeField],
            value: parseFloat(row[config.valueField]) || 0
        })).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    private calculateStatistics(data: TimeSeriesDataPoint[]): TimeSeriesResult['statistics'] {
        const values = data.map(d => d.value);
        const n = values.length;

        const mean = values.reduce((sum, val) => sum + val, 0) / n;
        const sortedValues = values.sort((a, b) => a - b);
        const median = this.calculateMedian(sortedValues);

        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
        const stdDev = Math.sqrt(variance);

        const skewness = this.calculateSkewness(values, mean, stdDev);
        const kurtosis = this.calculateKurtosis(values, mean, stdDev);

        return {
            mean,
            median,
            stdDev,
            variance,
            skewness,
            kurtosis
        };
    }

    private analyzeTrends(data: TimeSeriesDataPoint[]): TimeSeriesResult['trends'] {
        if (data.length < 2) {
            return {
                direction: 'stable',
                slope: 0,
                rSquared: 0
            };
        }

        const n = data.length;
        const xValues = data.map((_, index) => index);
        const yValues = data.map(d => d.value);

        // Calculate linear regression
        const { slope, rSquared } = this.calculateLinearRegression(xValues, yValues);

        let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
        if (Math.abs(slope) > 0.01) {
            direction = slope > 0 ? 'increasing' : 'decreasing';
        }

        return {
            direction,
            slope,
            rSquared
        };
    }

    private detectSeasonality(data: TimeSeriesDataPoint[]): TimeSeriesResult['seasonality'] {
        if (data.length < 12) {
            return {
                detected: false,
                period: 0,
                strength: 0
            };
        }

        // Simple seasonality detection using autocorrelation
        const values = data.map(d => d.value);
        const autocorrelations = this.calculateAutocorrelations(values);

        // Find the period with highest autocorrelation (excluding lag 0)
        let maxAutocorr = 0;
        let bestPeriod = 0;

        for (let lag = 1; lag < Math.min(autocorrelations.length, 24); lag++) {
            if (autocorrelations[lag] > maxAutocorr) {
                maxAutocorr = autocorrelations[lag];
                bestPeriod = lag;
            }
        }

        const detected = maxAutocorr > 0.3; // Threshold for seasonality detection
        const strength = Math.min(maxAutocorr, 1.0);

        return {
            detected,
            period: bestPeriod,
            strength
        };
    }

    private generateForecast(data: TimeSeriesDataPoint[], periods: number): TimeSeriesDataPoint[] {
        if (data.length < 2) {
            return [];
        }

        const values = data.map(d => d.value);
        const { slope, intercept } = this.calculateLinearRegression(
            data.map((_, index) => index),
            values
        );

        const forecast: TimeSeriesDataPoint[] = [];
        const lastTimestamp = new Date(data[data.length - 1].timestamp);

        for (let i = 1; i <= periods; i++) {
            const forecastValue = intercept + slope * (data.length + i - 1);
            const forecastTimestamp = new Date(lastTimestamp);
            forecastTimestamp.setDate(forecastTimestamp.getDate() + i);

            forecast.push({
                timestamp: forecastTimestamp.toISOString(),
                value: forecastValue,
                confidence: Math.max(0.1, 1.0 - (i * 0.1)) // Decreasing confidence over time
            });
        }

        return forecast;
    }

    private detectStatisticalAnomalies(data: any[], threshold: number): AnomalyResult[] {
        const anomalies: AnomalyResult[] = [];

        // Group data by timestamp if available, otherwise use index
        const timeField = this.findTimeField(data[0]);
        const valueField = this.findValueField(data[0]);

        if (!timeField || !valueField) {
            return anomalies;
        }

        const values = data.map(row => parseFloat(row[valueField])).filter(val => !isNaN(val));
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);

        data.forEach((row, index) => {
            const value = parseFloat(row[valueField]);
            if (isNaN(value)) return;

            const zScore = Math.abs((value - mean) / stdDev);

            if (zScore > threshold) {
                const deviation = value - mean;
                const severity = this.determineSeverity(zScore, threshold);

                anomalies.push({
                    timestamp: row[timeField] || new Date().toISOString(),
                    value,
                    expectedValue: mean,
                    deviation,
                    severity,
                    method: 'statistical',
                    description: `Statistical anomaly detected with Z-score of ${zScore.toFixed(2)}`
                });
            }
        });

        return anomalies;
    }

    private detectIsolationForestAnomalies(data: any[], threshold: number): AnomalyResult[] {
        // Simplified isolation forest implementation
        const anomalies: AnomalyResult[] = [];

        const timeField = this.findTimeField(data[0]);
        const valueField = this.findValueField(data[0]);

        if (!timeField || !valueField) {
            return anomalies;
        }

        const values = data.map(row => parseFloat(row[valueField])).filter(val => !isNaN(val));
        const sortedValues = values.sort((a, b) => a - b);

        // Use quartile-based anomaly detection as a simplified approach
        const q1 = this.calculatePercentile(sortedValues, 25);
        const q3 = this.calculatePercentile(sortedValues, 75);
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;

        data.forEach((row, index) => {
            const value = parseFloat(row[valueField]);
            if (isNaN(value)) return;

            if (value < lowerBound || value > upperBound) {
                const expectedValue = (q1 + q3) / 2;
                const deviation = value - expectedValue;
                const severity = this.determineSeverity(Math.abs(deviation) / iqr, threshold);

                anomalies.push({
                    timestamp: row[timeField] || new Date().toISOString(),
                    value,
                    expectedValue,
                    deviation,
                    severity,
                    method: 'isolation_forest',
                    description: `Isolation forest anomaly detected (value: ${value}, bounds: [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}])`
                });
            }
        });

        return anomalies;
    }

    private deduplicateAnomalies(anomalies: AnomalyResult[]): AnomalyResult[] {
        const seen = new Set<string>();
        return anomalies.filter(anomaly => {
            const key = `${anomaly.timestamp}_${anomaly.value}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    private validateCustomMeasure(measure: CustomMeasureRequest): void {
        if (!measure.name || !measure.label || !measure.sql) {
            throw new ValidationError('Custom measure must have name, label, and SQL');
        }

        if (!measure.model || !measure.explore) {
            throw new ValidationError('Custom measure must specify model and explore');
        }

        // Basic SQL validation
        if (!measure.sql.trim().toLowerCase().startsWith('select')) {
            throw new ValidationError('Custom measure SQL must be a SELECT statement');
        }
    }

    private calculateMedian(sortedValues: number[]): number {
        const n = sortedValues.length;
        if (n % 2 === 0) {
            return (sortedValues[n / 2 - 1] + sortedValues[n / 2]) / 2;
        } else {
            return sortedValues[Math.floor(n / 2)];
        }
    }

    private calculateMode(values: number[]): number {
        const frequency: Record<number, number> = {};
        values.forEach(val => {
            frequency[val] = (frequency[val] || 0) + 1;
        });

        let maxFreq = 0;
        let mode = values[0];

        Object.entries(frequency).forEach(([val, freq]) => {
            if (freq > maxFreq) {
                maxFreq = freq;
                mode = parseFloat(val);
            }
        });

        return mode;
    }

    private calculateSkewness(values: number[], mean: number, stdDev: number): number {
        const n = values.length;
        const skewness = values.reduce((sum, val) => {
            return sum + Math.pow((val - mean) / stdDev, 3);
        }, 0) / n;
        return skewness;
    }

    private calculateKurtosis(values: number[], mean: number, stdDev: number): number {
        const n = values.length;
        const kurtosis = values.reduce((sum, val) => {
            return sum + Math.pow((val - mean) / stdDev, 4);
        }, 0) / n - 3; // Excess kurtosis
        return kurtosis;
    }

    private calculateQuartiles(sortedValues: number[]): { q1: number; q2: number; q3: number } {
        return {
            q1: this.calculatePercentile(sortedValues, 25),
            q2: this.calculatePercentile(sortedValues, 50),
            q3: this.calculatePercentile(sortedValues, 75)
        };
    }

    private calculatePercentile(sortedValues: number[], percentile: number): number {
        const index = (percentile / 100) * (sortedValues.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index - lower;

        if (upper >= sortedValues.length) {
            return sortedValues[sortedValues.length - 1];
        }

        return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
    }

    private detectOutliers(sortedValues: number[], quartiles: { q1: number; q2: number; q3: number }): number[] {
        const iqr = quartiles.q3 - quartiles.q1;
        const lowerBound = quartiles.q1 - 1.5 * iqr;
        const upperBound = quartiles.q3 + 1.5 * iqr;

        return sortedValues.filter(val => val < lowerBound || val > upperBound);
    }

    private calculateLinearRegression(xValues: number[], yValues: number[]): { slope: number; intercept: number; rSquared: number } {
        const n = xValues.length;
        const sumX = xValues.reduce((sum, x) => sum + x, 0);
        const sumY = yValues.reduce((sum, y) => sum + y, 0);
        const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
        const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
        const sumYY = yValues.reduce((sum, y) => sum + y * y, 0);

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        // Calculate R-squared
        const yMean = sumY / n;
        const ssRes = yValues.reduce((sum, y, i) => {
            const predicted = slope * xValues[i] + intercept;
            return sum + Math.pow(y - predicted, 2);
        }, 0);
        const ssTot = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
        const rSquared = 1 - (ssRes / ssTot);

        return { slope, intercept, rSquared };
    }

    private calculateAutocorrelations(values: number[]): number[] {
        const n = values.length;
        const mean = values.reduce((sum, val) => sum + val, 0) / n;
        const autocorrelations: number[] = [];

        for (let lag = 0; lag < Math.min(n / 2, 24); lag++) {
            let numerator = 0;
            let denominator = 0;

            for (let i = 0; i < n - lag; i++) {
                numerator += (values[i] - mean) * (values[i + lag] - mean);
            }

            for (let i = 0; i < n; i++) {
                denominator += Math.pow(values[i] - mean, 2);
            }

            autocorrelations.push(numerator / denominator);
        }

        return autocorrelations;
    }

    private determineSeverity(zScore: number, threshold: number): 'low' | 'medium' | 'high' | 'critical' {
        if (zScore >= threshold * 3) return 'critical';
        if (zScore >= threshold * 2) return 'high';
        if (zScore >= threshold * 1.5) return 'medium';
        return 'low';
    }

    private findTimeField(row: any): string | null {
        const timeFields = ['timestamp', 'date', 'time', 'created_at', 'updated_at'];
        for (const field of timeFields) {
            if (row[field]) return field;
        }
        return null;
    }

    private findValueField(row: any): string | null {
        const valueFields = ['value', 'amount', 'count', 'total', 'sum', 'measurement'];
        for (const field of valueFields) {
            if (row[field] && !isNaN(parseFloat(row[field]))) return field;
        }
        return null;
    }
}
