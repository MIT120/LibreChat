/**
 * Field Discovery Utility - Helps discover and match fields for electricity analytics
 */

export class FieldDiscovery {
    static findTimestampFields(dimensions: string[]): string[] {
        return dimensions.filter(field =>
            field.toLowerCase().includes('timestamp') ||
            field.toLowerCase().includes('date') ||
            field.toLowerCase().includes('time')
        );
    }

    static findElectricityRelatedModels(models: any[]): any[] {
        return models.filter(m =>
            m.name.toLowerCase().includes('metering') ||
            m.name.toLowerCase().includes('electricity') ||
            m.name.toLowerCase().includes('energy') ||
            m.name.toLowerCase().includes('power')
        );
    }

    static findElectricityRelatedExplores(explores: any[]): any[] {
        return explores.filter(explore =>
            explore.name.toLowerCase().includes('customer') ||
            explore.name.toLowerCase().includes('measurement') ||
            explore.name.toLowerCase().includes('billing') ||
            explore.name.toLowerCase().includes('metering') ||
            explore.name.toLowerCase().includes('electricity') ||
            explore.name.toLowerCase().includes('energy') ||
            explore.name.toLowerCase().includes('power')
        );
    }

    static matchMetricsToFields(metrics: string[], availableMeasures: string[]): string[] {
        return metrics.map(metric => {
            // Try to find matching measure fields
            const matchingMeasures = availableMeasures.filter(field =>
                field.toLowerCase().includes(metric.toLowerCase()) ||
                field.toLowerCase().includes(metric.replace('_kwh', '').replace('_kw', '').replace('_eur', '').replace('_kg', ''))
            );

            if (matchingMeasures.length > 0) {
                return matchingMeasures[0];
            } else {
                // Fallback to constructing field name
                return metric;
            }
        });
    }

    static createNoTimestampFieldsError(modelName: string, exploreName: string, availableFields: any): Error {
        const errorMessage = `No timestamp/date fields found in ${modelName}.${exploreName}. `;
        const availableDims = availableFields.dimensions.length > 0
            ? `Available dimensions: ${availableFields.dimensions.join(', ')}`
            : 'No dimensions found - this might indicate a permission issue or incorrect model/explore name.';
        const availableMeasures = availableFields.measures.length > 0
            ? ` Available measures: ${availableFields.measures.join(', ')}`
            : ' No measures found.';

        return new Error(errorMessage + availableDims + availableMeasures);
    }
}
