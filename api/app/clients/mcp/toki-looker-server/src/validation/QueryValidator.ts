/**
 * Query Validator - Validates Looker queries and parameters
 */

import { LookerQuery } from '../../types/index.js';
import { ValidationError } from '../../types/errors.js';

export class QueryValidator {
    static validateQuery(query: LookerQuery): void {
        this.validateRequiredFields(query);
        this.validateFieldNames(query);
        this.validateFilters(query);
        this.validateSorts(query);
        this.validateLimits(query);
    }

    static validateRequiredFields(query: LookerQuery): void {
        if (!query.model) {
            throw new ValidationError('Query model is required');
        }

        if (!query.explore) {
            throw new ValidationError('Query explore is required');
        }

        const hasDimensions = query.dimensions && query.dimensions.length > 0;
        const hasMeasures = query.measures && query.measures.length > 0;

        if (!hasDimensions && !hasMeasures) {
            throw new ValidationError('Query must include at least one dimension or measure');
        }
    }

    static validateFieldNames(query: LookerQuery): void {
        const fields = [
            ...(query.dimensions || []),
            ...(query.measures || [])
        ];

        // More lenient validation - allow both qualified and unqualified field names
        // The Looker API can handle both formats
        if (fields.length === 0) {
            throw new ValidationError('Query must include at least one field (dimension or measure)');
        }

        // Log field validation for debugging
        console.log('Field validation:', {
            fields,
            allQualified: fields.every(field => field.includes('.')),
            hasUnqualified: fields.some(field => !field.includes('.'))
        });
    }

    static validateFilters(query: LookerQuery): void {
        if (query.filters) {
            for (const [key, value] of Object.entries(query.filters)) {
                if (!key) {
                    throw new ValidationError(`Invalid filter: key cannot be empty. Value: ${value}`);
                }
                // Allow empty values for some filter types (like "is null")
                if (value === null || value === undefined) {
                    throw new ValidationError(`Invalid filter: ${key} = ${value}. Value cannot be null or undefined.`);
                }
            }
        }
    }

    static validateSorts(query: LookerQuery): void {
        if (query.sorts) {
            for (const sort of query.sorts) {
                if (!sort || typeof sort !== 'string') {
                    throw new ValidationError(`Invalid sort specification: ${sort}. Must be a non-empty string.`);
                }
            }
        }
    }

    static validateLimits(query: LookerQuery): void {
        if (query.limit !== undefined) {
            if (query.limit < 1 || query.limit > 50000) {
                throw new ValidationError(`Invalid limit: ${query.limit}. Must be between 1 and 50000.`);
            }
        }

        if (query.column_limit !== undefined) {
            if (query.column_limit < 1 || query.column_limit > 100) {
                throw new ValidationError(`Invalid column_limit: ${query.column_limit}. Must be between 1 and 100.`);
            }
        }
    }

    static validateElectricityAnalysisRequest(request: any): void {
        if (!request.timeRange) {
            throw new ValidationError('Time range is required for electricity analysis');
        }

        if (!request.timeRange.start || !request.timeRange.end) {
            throw new ValidationError('Both start and end dates are required in time range');
        }

        if (!request.metrics || !Array.isArray(request.metrics) || request.metrics.length === 0) {
            throw new ValidationError('At least one metric is required for electricity analysis');
        }

        // Validate date format
        const startDate = new Date(request.timeRange.start);
        const endDate = new Date(request.timeRange.end);

        if (isNaN(startDate.getTime())) {
            throw new ValidationError(`Invalid start date format: ${request.timeRange.start}`);
        }

        if (isNaN(endDate.getTime())) {
            throw new ValidationError(`Invalid end date format: ${request.timeRange.end}`);
        }

        if (startDate >= endDate) {
            throw new ValidationError('Start date must be before end date');
        }
    }
}
