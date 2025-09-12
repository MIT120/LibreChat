/**
 * Looker Query Service - Handles query execution, SQL generation, and URL creation
 */

import { BaseLookerService } from '../base/BaseLookerService.js';
import { ILogger } from '../../interfaces/ILogger.js';
import { LookerConfig, LookerQuery, LookerQueryResult } from '../../../types/index.js';
import { ValidationError } from '../../../types/errors.js';

export class LookerQueryService extends BaseLookerService {
    constructor(logger: ILogger, config: LookerConfig) {
        super(logger, config);
    }

    async query(query: LookerQuery): Promise<LookerQueryResult> {
        this.validateQuery(query);

        const fields = this.buildFieldsArray(query);
        const sdkQuery = this.buildSDKQuery(query, fields);

        this.logger.debug('Query fields being sent to SDK', {
            originalDimensions: query.dimensions,
            originalMeasures: query.measures,
            combinedFields: fields,
            model: query.model,
            explore: query.explore
        });

        return this.makeSDKCall(async () => {
            try {
                // First create the query to get an ID
                this.logger.debug('Creating query with SDK', { sdkQuery });
                const createdQuery = await this.sdk.ok(this.sdk.create_query(sdkQuery));
                const queryId = createdQuery.id;

                this.logger.debug('Query created successfully', {
                    queryId,
                    createdQuery: {
                        id: createdQuery.id,
                        model: createdQuery.model,
                        view: createdQuery.view,
                        fields: createdQuery.fields
                    }
                });

                if (!queryId) {
                    throw new ValidationError('Failed to create query - no query ID returned');
                }

                // Then run the query to get results
                this.logger.debug('Running query', { queryId });
                const response = await this.sdk.ok(this.sdk.run_query({
                    query_id: queryId,
                    result_format: 'json'
                }));

                // Parse the response since it comes as a string for JSON format
                const data = typeof response === 'string'
                    ? JSON.parse(response)
                    : response || [];

                this.logger.debug('Query executed successfully', {
                    queryId,
                    dataLength: Array.isArray(data) ? data.length : 0,
                    dataType: typeof data
                });

                // Get field metadata from the created query
                const fields_metadata = createdQuery.fields || [];

                return {
                    data: Array.isArray(data) ? data : [],
                    fields: fields_metadata.map((field: any) => ({
                        name: field.name,
                        label: field.label,
                        category: field.category,
                        type: field.type,
                        description: field.description,
                        sortable: field.sortable
                    })),
                    truncated: false,
                    sql: (createdQuery as any).sql || '',
                    query_run_time: 0,
                    applied_filters: query.filters || {}
                };
            } catch (error: any) {
                this.logger.error('Query execution failed', {
                    error: error.message,
                    sdkQuery,
                    originalQuery: query
                });

                // Provide more helpful error messages
                if (error.message?.includes('Must query at least one dimension or measure')) {
                    throw new ValidationError('Query must include at least one dimension or measure. Please check your field names and ensure they exist in the explore.');
                }

                if (error.message?.includes('No matching signature for operator')) {
                    throw new ValidationError(`Filter type mismatch: ${error.message}. This usually happens when comparing incompatible data types (e.g., DATETIME vs TIMESTAMP). Try using a different date format or field.`);
                }

                if (error.message?.includes('Query execution failed')) {
                    throw new ValidationError(`Query execution failed: ${error.message}. Please check your field names, filters, and explore configuration.`);
                }

                // Re-throw the original error if we can't provide a better message
                throw error;
            }
        }, 'query');
    }

    async querySQL(query: LookerQuery): Promise<string> {
        this.validateQuery(query);

        const fields = this.buildFieldsArray(query);
        const sdkQuery = this.buildSDKQuery(query, fields);

        return this.makeSDKCall(async () => {
            // First create the query to get an ID
            const createdQuery = await this.sdk.ok(this.sdk.create_query(sdkQuery));
            const queryId = createdQuery.id;

            if (!queryId) {
                throw new ValidationError('Failed to create query - no query ID returned');
            }

            // Then run the query to get SQL
            const response = await this.sdk.ok(this.sdk.run_query({
                query_id: queryId,
                result_format: 'sql'
            }));

            return (response as string) || '';
        }, 'querySQL');
    }

    async queryUrl(query: LookerQuery): Promise<string> {
        this.validateQuery(query);

        const fields = this.buildFieldsArray(query);
        const sdkQuery = this.buildSDKQuery(query, fields);

        return this.makeSDKCall(async () => {
            // First create the query to get an ID using SDK
            const createdQuery = await this.sdk.ok(this.sdk.create_query(sdkQuery));
            const queryId = createdQuery.id;

            // Generate explore URL
            const baseUrl = this.config.baseUrl.replace('/api/4.0', '').replace('/api/3.1', '');
            return `${baseUrl}/explore/${query.model}/${query.explore}?qid=${queryId}`;
        }, 'queryUrl');
    }

    private validateQuery(query: LookerQuery): void {
        const hasDimensions = query.dimensions && query.dimensions.length > 0;
        const hasMeasures = query.measures && query.measures.length > 0;

        if (!hasDimensions && !hasMeasures) {
            throw new ValidationError('Query must include at least one dimension or measure');
        }

        // More lenient field validation - allow both qualified and unqualified field names
        const fields = this.buildFieldsArray(query);
        if (fields.length === 0) {
            throw new ValidationError('Query must include at least one field (dimension or measure)');
        }

        // Log field validation for debugging
        this.logger.debug('Field validation', {
            fields,
            allQualified: fields.every(field => field.includes('.')),
            hasUnqualified: fields.some(field => !field.includes('.'))
        });
    }

    private buildFieldsArray(query: LookerQuery): string[] {
        return [
            ...(query.dimensions || []),
            ...(query.measures || [])
        ];
    }

    private buildSDKQuery(query: LookerQuery, fields: string[]): any {
        // Clean up filters to handle date format issues
        const cleanedFilters = this.cleanFilters(query.filters || {});

        const sdkQuery = {
            model: query.model!,
            view: query.explore!, // Use explore name as view name
            fields: fields,
            filters: cleanedFilters,
            sorts: query.sorts || [],
            limit: (query.limit || 5000).toString(),
            column_limit: (query.column_limit || 50).toString()
        };

        this.logger.debug('Built SDK query', {
            model: sdkQuery.model,
            view: sdkQuery.view,
            fields: sdkQuery.fields,
            filters: sdkQuery.filters,
            sorts: sdkQuery.sorts
        });

        return sdkQuery;
    }

    private cleanFilters(filters: Record<string, string>): Record<string, string> {
        const cleaned: Record<string, string> = {};

        for (const [key, value] of Object.entries(filters)) {
            // Handle common date filter patterns that cause SQL issues
            if (value.includes('days ago') || value.includes('for')) {
                // Convert relative date filters to absolute dates
                try {
                    const cleanedValue = this.convertRelativeDateFilter(value);
                    cleaned[key] = cleanedValue;
                    this.logger.debug('Converted relative date filter', { key, original: value, converted: cleanedValue });
                } catch (error) {
                    this.logger.warn('Failed to convert relative date filter, using original', { key, value, error });
                    cleaned[key] = value;
                }
            } else {
                cleaned[key] = value;
            }
        }

        return cleaned;
    }

    private convertRelativeDateFilter(value: string): string {
        // Handle common patterns like "7 days ago for 7 days"
        if (value.includes('days ago for')) {
            const match = value.match(/(\d+)\s+days\s+ago\s+for\s+(\d+)\s+days/);
            if (match) {
                const daysAgo = parseInt(match[1]);
                const duration = parseInt(match[2]);
                const endDate = new Date();
                endDate.setDate(endDate.getDate() - daysAgo);
                const startDate = new Date(endDate);
                startDate.setDate(startDate.getDate() - duration);

                return `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`;
            }
        }

        // Handle simple "X days ago" patterns
        if (value.includes('days ago')) {
            const match = value.match(/(\d+)\s+days\s+ago/);
            if (match) {
                const daysAgo = parseInt(match[1]);
                const date = new Date();
                date.setDate(date.getDate() - daysAgo);
                return date.toISOString().split('T')[0];
            }
        }

        // Return original if we can't convert
        return value;
    }
}
