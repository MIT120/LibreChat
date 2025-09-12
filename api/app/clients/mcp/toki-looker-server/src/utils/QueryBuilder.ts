/**
 * Query Builder Utility - Builds Looker queries with validation
 */

import { LookerQuery } from '../../types/index.js';
import { ValidationError } from '../../types/errors.js';

export class QueryBuilder {
    static buildFieldsArray(query: LookerQuery): string[] {
        return [
            ...(query.dimensions || []),
            ...(query.measures || [])
        ];
    }

    static buildSDKQuery(query: LookerQuery, fields: string[]): any {
        return {
            model: query.model!,
            view: query.explore!, // Use explore name as view name
            fields: fields,
            filters: query.filters || {},
            sorts: query.sorts || [],
            limit: (query.limit || 5000).toString(),
            column_limit: (query.column_limit || 50).toString()
        };
    }

    static validateQuery(query: LookerQuery): void {
        const hasDimensions = query.dimensions && query.dimensions.length > 0;
        const hasMeasures = query.measures && query.measures.length > 0;

        if (!hasDimensions && !hasMeasures) {
            throw new ValidationError('Query must include at least one dimension or measure');
        }

        const fields = this.buildFieldsArray(query);
        const invalidFields = fields.filter(field => !field.includes('.'));
        
        if (invalidFields.length > 0) {
            throw new ValidationError(`Field names must be fully qualified (view.field_name). Invalid fields: ${invalidFields.join(', ')}. Use the looker-get-dimensions and looker-get-measures tools to get the correct field names.`);
        }
    }

    static buildElectricityQuery(
        request: any,
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
            measures: request.metrics.map((metric: string) => {
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

    private static findTimestampFields(dimensions: string[]): string[] {
        return dimensions.filter(field =>
            field.toLowerCase().includes('timestamp') ||
            field.toLowerCase().includes('date') ||
            field.toLowerCase().includes('time')
        );
    }
}
