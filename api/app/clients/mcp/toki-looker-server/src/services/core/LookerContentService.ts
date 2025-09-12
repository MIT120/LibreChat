/**
 * Looker Content Service - Handles looks, dashboards, and content management
 */

import { BaseLookerService } from '../base/BaseLookerService.js';
import { ILogger } from '../../interfaces/ILogger.js';
import { LookerConfig } from '../../../types/index.js';
import {
    LookerLook,
    LookerDashboard,
    LookerDashboardElement,
    LookerQuery,
    LookerQueryResult
} from '../../../types/index.js';
import { ValidationError } from '../../../types/errors.js';

export class LookerContentService extends BaseLookerService {
    constructor(logger: ILogger, config: LookerConfig) {
        super(logger, config);
    }

    async getLooks(search?: string): Promise<LookerLook[]> {
        return this.makeSDKCall(async () => {
            let looks;
            if (search) {
                this.logger.debug('Searching looks with title filter', { search });
                looks = await this.sdk.ok(this.sdk.search_looks({ title: search }));
            } else {
                this.logger.debug('Fetching all looks');
                looks = await this.sdk.ok(this.sdk.all_looks());
            }

            return this.parseLooksResponse(looks);
        }, 'getLooks');
    }

    async runLook(lookId: number): Promise<LookerQueryResult> {
        return this.makeSDKCall(async () => {
            const response = await this.sdk.ok(this.sdk.run_look({
                look_id: lookId.toString(),
                result_format: 'json'
            }));

            // Parse the response since it comes as a string for JSON format
            const data = typeof response === 'string'
                ? JSON.parse(response)
                : response || [];

            return {
                data: Array.isArray(data) ? data : [],
                fields: [], // Would need additional API call to get field metadata
                truncated: false,
                query_run_time: 0
            };
        }, 'runLook');
    }

    async makeLook(query: LookerQuery, title: string, description?: string): Promise<LookerLook> {
        this.validateLookQuery(query);

        const fields = this.buildFieldsArray(query);
        const sdkQuery = this.buildSDKQuery(query, fields);

        return this.makeSDKCall(async () => {
            // First create the query using the SDK
            const createdQuery = await this.sdk.ok(this.sdk.create_query(sdkQuery));
            const queryId = createdQuery.id;

            // Then create the look
            const lookData = {
                title,
                description,
                query_id: queryId,
                public: false
            };

            return await this.sdk.ok(this.sdk.create_look(lookData)) as LookerLook;
        }, 'makeLook');
    }

    async getDashboards(search?: string): Promise<LookerDashboard[]> {
        return this.makeSDKCall(async () => {
            let dashboards;
            if (search) {
                this.logger.debug('Searching dashboards with title filter', { search });
                dashboards = await this.sdk.ok(this.sdk.search_dashboards({ title: search }));
            } else {
                this.logger.debug('Fetching all dashboards');
                dashboards = await this.sdk.ok(this.sdk.all_dashboards());
            }

            return this.parseDashboardsResponse(dashboards);
        }, 'getDashboards');
    }

    async makeDashboard(title: string, description?: string): Promise<LookerDashboard> {
        return this.makeSDKCall(async () => {
            const dashboardData = {
                title,
                description,
                hidden: false
            };

            return await this.sdk.ok(this.sdk.create_dashboard(dashboardData)) as LookerDashboard;
        }, 'makeDashboard');
    }

    async addDashboardElement(dashboardId: number, element: Partial<LookerDashboardElement>): Promise<LookerDashboardElement> {
        return this.makeSDKCall(async () => {
            const elementData = {
                dashboard_id: dashboardId,
                body: {}, // Required body property
                ...element
            };

            return await this.sdk.ok(this.sdk.create_dashboard_element(elementData)) as LookerDashboardElement;
        }, 'addDashboardElement');
    }

    private parseLooksResponse(looks: any): LookerLook[] {
        this.logger.debug('Raw looks response from SDK', {
            looksType: typeof looks,
            looksLength: Array.isArray(looks) ? looks.length : 'not array',
            looksKeys: looks && typeof looks === 'object' ? Object.keys(looks) : 'not object',
            looksSample: Array.isArray(looks) && looks.length > 0 ? looks[0] : looks
        });

        // Handle different response structures
        if (Array.isArray(looks)) {
            this.logger.debug(`Successfully fetched ${looks.length} looks`);
            return looks as LookerLook[];
        } else if (looks && typeof looks === 'object' && (looks as any).looks) {
            const looksData = (looks as any).looks;
            this.logger.debug(`Successfully fetched ${looksData.length} looks from nested structure`);
            return looksData as LookerLook[];
        } else if (looks && typeof looks === 'object' && (looks as any).data) {
            const dataArray = (looks as any).data;
            this.logger.debug(`Successfully fetched ${dataArray.length} looks from data structure`);
            return dataArray as LookerLook[];
        } else {
            this.logger.warn('Unexpected looks response structure, trying direct HTTP call', { looks });
            return this.fallbackToHTTPCall('looks') as any;
        }
    }

    private parseDashboardsResponse(dashboards: any): LookerDashboard[] {
        this.logger.debug('Raw dashboards response from SDK', {
            dashboardsType: typeof dashboards,
            dashboardsLength: Array.isArray(dashboards) ? dashboards.length : 'not array',
            dashboardsKeys: dashboards && typeof dashboards === 'object' ? Object.keys(dashboards) : 'not object',
            dashboardsSample: Array.isArray(dashboards) && dashboards.length > 0 ? dashboards[0] : dashboards
        });

        // Handle different response structures
        if (Array.isArray(dashboards)) {
            this.logger.debug(`Successfully fetched ${dashboards.length} dashboards`);
            return dashboards as LookerDashboard[];
        } else if (dashboards && typeof dashboards === 'object' && (dashboards as any).dashboards) {
            const dashboardsData = (dashboards as any).dashboards;
            this.logger.debug(`Successfully fetched ${dashboardsData.length} dashboards from nested structure`);
            return dashboardsData as LookerDashboard[];
        } else if (dashboards && typeof dashboards === 'object' && (dashboards as any).data) {
            const dataArray = (dashboards as any).data;
            this.logger.debug(`Successfully fetched ${dataArray.length} dashboards from data structure`);
            return dataArray as LookerDashboard[];
        } else {
            this.logger.warn('Unexpected dashboards response structure, trying direct HTTP call', { dashboards });
            return this.fallbackToHTTPCall('dashboards') as any;
        }
    }

    private async fallbackToHTTPCall(type: 'looks' | 'dashboards'): Promise<LookerLook[] | LookerDashboard[]> {
        try {
            const url = `${this.config.baseUrl}/${type}`;
            this.logger.debug(`Trying direct HTTP call for ${type}`, { url });

            const httpData = await this.makeHTTPCall(url, { method: 'GET' }, `get${type}`) as any;

            if (Array.isArray(httpData)) {
                return httpData as LookerLook[] | LookerDashboard[];
            } else if (httpData && Array.isArray(httpData[type])) {
                return httpData[type] as LookerLook[] | LookerDashboard[];
            } else {
                return [] as LookerLook[] | LookerDashboard[];
            }
        } catch (httpError) {
            this.logger.error(`Direct HTTP call also failed for ${type}`, httpError);
            return [] as LookerLook[] | LookerDashboard[];
        }
    }

    private validateLookQuery(query: LookerQuery): void {
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

    private buildFieldsArray(query: LookerQuery): string[] {
        return [
            ...(query.dimensions || []),
            ...(query.measures || [])
        ];
    }

    private buildSDKQuery(query: LookerQuery, fields: string[]): any {
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
}
