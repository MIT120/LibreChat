/**
 * Response Parser Utility - Handles parsing of different Looker API response formats
 */

import { ILogger } from '../interfaces/ILogger.js';
import { LookerLook, LookerDashboard } from '../../types/index.js';

export class ResponseParser {
    private logger: ILogger;

    constructor(logger: ILogger) {
        this.logger = logger;
    }

    parseLooksResponse(looks: any): LookerLook[] {
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
            this.logger.warn('Unexpected looks response structure', { looks });
            return [];
        }
    }

    parseDashboardsResponse(dashboards: any): LookerDashboard[] {
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
            this.logger.warn('Unexpected dashboards response structure', { dashboards });
            return [];
        }
    }

    parseHTTPResponse<T>(data: any, type: string): T[] {
        this.logger.debug(`Parsing HTTP response for ${type}`, {
            dataType: typeof data,
            dataLength: Array.isArray(data) ? data.length : 'not array',
            dataKeys: data && typeof data === 'object' ? Object.keys(data) : 'not object'
        });

        if (Array.isArray(data)) {
            return data as T[];
        } else if (data && Array.isArray(data[type])) {
            return data[type] as T[];
        } else {
            return [];
        }
    }
}
