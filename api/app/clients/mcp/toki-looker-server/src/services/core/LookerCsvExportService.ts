/**
 * Looker CSV Export Service - Handles CSV export functionality for reports and tables
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ILogger } from '../../interfaces/ILogger.js';
import { LookerConfig } from '../../../types/index.js';
import { LookerQueryResult, LookerQuery } from '../../../types/index.js';
import { BaseLookerService } from '../base/BaseLookerService.js';

export interface CsvExportOptions {
    filename?: string;
    includeHeaders?: boolean;
    delimiter?: string;
    encoding?: string;
    dateFormat?: string;
    numberFormat?: string;
    escapeQuotes?: boolean;
    includeMetadata?: boolean;
}

export interface CsvExportResult {
    filename: string;
    content: string;
    size: number;
    rowCount: number;
    columnCount: number;
    filepath: string;
    downloadUrl: string;
    exportId: string;
    metadata?: {
        exportDate: string;
        query?: LookerQuery;
        options: CsvExportOptions;
    };
    chatReference?: string;
}

export interface TableExportRequest {
    data: any[];
    headers?: string[];
    title?: string;
    description?: string;
    options?: CsvExportOptions;
}

export interface ReportExportRequest {
    queryResult: LookerQueryResult;
    title?: string;
    description?: string;
    options?: CsvExportOptions;
}

export class LookerCsvExportService extends BaseLookerService {
    private exportsDirectory: string;

    constructor(logger: ILogger, config: LookerConfig) {
        super(logger, config);
        // Use the same exports directory as the book export system
        this.exportsDirectory = path.join(process.cwd(), 'exports');
    }

    /**
     * Ensure exports directory exists
     */
    private async ensureExportsDirectory(): Promise<void> {
        try {
            await fs.access(this.exportsDirectory);
        } catch {
            await fs.mkdir(this.exportsDirectory, { recursive: true });
            this.logger.info('Created exports directory', { directory: this.exportsDirectory });
        }
    }

    /**
     * Generate a unique filename for CSV export
     */
    private generateFilename(title: string, extension: string = 'csv'): string {
        const sanitizedTitle = title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50);

        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const uuid = uuidv4().substring(0, 8);

        return `${sanitizedTitle}_${timestamp}_${uuid}.${extension}`;
    }

    /**
     * Get the full file path for an export
     */
    private getExportPath(filename: string): string {
        return path.join(this.exportsDirectory, filename);
    }

    /**
     * Save CSV content to file
     */
    private async saveCsvToFile(filename: string, content: string): Promise<{ filepath: string; size: number }> {
        await this.ensureExportsDirectory();
        const filepath = this.getExportPath(filename);

        await fs.writeFile(filepath, content, 'utf-8');
        const stats = await fs.stat(filepath);

        this.logger.info('CSV file saved', {
            filename,
            filepath,
            size: stats.size
        });

        return {
            filepath,
            size: stats.size
        };
    }

    /**
     * Create download URL for the exported file
     */
    private createDownloadUrl(filename: string): string {
        return `/c/exports/${filename}`;
    }

    /**
     * Export query result to CSV format
     */
    async exportQueryResultToCsv(request: ReportExportRequest): Promise<CsvExportResult> {
        try {
            this.logger.info('Exporting query result to CSV', {
                title: request.title,
                rowCount: request.queryResult.data?.length || 0
            });

            const options = this.getDefaultOptions(request.options);
            const filename = this.generateFilename(request.title || 'looker_report');

            // Convert query result to CSV
            const csvContent = this.convertQueryResultToCsv(request.queryResult, options);

            // Save CSV to file
            const { filepath, size } = await this.saveCsvToFile(filename, csvContent);

            // Calculate metadata
            const rowCount = request.queryResult.data?.length || 0;
            const columnCount = request.queryResult.fields?.length || 0;
            const exportId = uuidv4();

            const result: CsvExportResult = {
                filename,
                content: csvContent,
                size,
                rowCount,
                columnCount,
                filepath,
                downloadUrl: this.createDownloadUrl(filename),
                exportId,
                metadata: options.includeMetadata ? {
                    exportDate: new Date().toISOString(),
                    query: request.queryResult as any, // Type assertion for compatibility
                    options
                } : undefined
            };

            this.logger.info('Successfully exported query result to CSV', {
                filename,
                rowCount,
                columnCount,
                size
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to export query result to CSV', error);
            throw error;
        }
    }

    /**
     * Export table data to CSV format
     */
    async exportTableToCsv(request: TableExportRequest): Promise<CsvExportResult> {
        try {
            this.logger.info('Exporting table to CSV', {
                title: request.title,
                rowCount: request.data.length
            });

            const options = this.getDefaultOptions(request.options);
            const filename = this.generateFilename(request.title || 'looker_table');

            // Convert table data to CSV
            const csvContent = this.convertTableToCsv(request.data, request.headers, options);

            // Save CSV to file
            const { filepath, size } = await this.saveCsvToFile(filename, csvContent);

            // Calculate metadata
            const rowCount = request.data.length;
            const columnCount = request.headers?.length || (request.data.length > 0 ? Object.keys(request.data[0]).length : 0);
            const exportId = uuidv4();

            const result: CsvExportResult = {
                filename,
                content: csvContent,
                size,
                rowCount,
                columnCount,
                filepath,
                downloadUrl: this.createDownloadUrl(filename),
                exportId,
                metadata: options.includeMetadata ? {
                    exportDate: new Date().toISOString(),
                    options
                } : undefined
            };

            this.logger.info('Successfully exported table to CSV', {
                filename,
                rowCount,
                columnCount,
                size
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to export table to CSV', error);
            throw error;
        }
    }

    /**
     * Export electricity analysis result to CSV
     */
    async exportElectricityAnalysisToCsv(analysisData: any[], title?: string, options?: CsvExportOptions): Promise<CsvExportResult> {
        try {
            this.logger.info('Exporting electricity analysis to CSV', {
                title,
                rowCount: analysisData.length
            });

            const exportOptions = this.getDefaultOptions(options);
            const filename = this.generateFilename(title || 'electricity_analysis');

            // Convert analysis data to CSV
            const csvContent = this.convertTableToCsv(analysisData, undefined, exportOptions);

            // Save CSV to file
            const { filepath, size } = await this.saveCsvToFile(filename, csvContent);

            // Calculate metadata
            const rowCount = analysisData.length;
            const columnCount = analysisData.length > 0 ? Object.keys(analysisData[0]).length : 0;
            const exportId = uuidv4();

            const result: CsvExportResult = {
                filename,
                content: csvContent,
                size,
                rowCount,
                columnCount,
                filepath,
                downloadUrl: this.createDownloadUrl(filename),
                exportId,
                metadata: exportOptions.includeMetadata ? {
                    exportDate: new Date().toISOString(),
                    options: exportOptions
                } : undefined
            };

            this.logger.info('Successfully exported electricity analysis to CSV', {
                filename,
                rowCount,
                columnCount,
                size
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to export electricity analysis to CSV', error);
            throw error;
        }
    }

    /**
     * Convert Looker query result to CSV format
     */
    private convertQueryResultToCsv(queryResult: LookerQueryResult, options: CsvExportOptions): string {
        if (!queryResult.data || queryResult.data.length === 0) {
            return this.generateEmptyCsv(options);
        }

        const headers = queryResult.fields?.map(field => field.label || field.name) ||
            Object.keys(queryResult.data[0]);

        return this.convertTableToCsv(queryResult.data, headers, options);
    }

    /**
     * Convert table data to CSV format
     */
    private convertTableToCsv(data: any[], headers?: string[], options: CsvExportOptions = {}): string {
        if (!data || data.length === 0) {
            return this.generateEmptyCsv(options);
        }

        const delimiter = options.delimiter || ',';
        const includeHeaders = options.includeHeaders !== false;
        const escapeQuotes = options.escapeQuotes !== false;

        let csv = '';

        // Add headers if requested
        if (includeHeaders) {
            const headerRow = headers || Object.keys(data[0]);
            csv += this.escapeCsvRow(headerRow, delimiter, escapeQuotes) + '\n';
        }

        // Add data rows
        for (const row of data) {
            const values = headers ?
                headers.map(header => this.getValueByHeader(row, header)) :
                Object.values(row);

            csv += this.escapeCsvRow(values, delimiter, escapeQuotes) + '\n';
        }

        return csv;
    }

    /**
     * Escape CSV row values
     */
    private escapeCsvRow(values: any[], delimiter: string, escapeQuotes: boolean): string {
        return values.map(value => this.escapeCsvValue(value, delimiter, escapeQuotes)).join(delimiter);
    }

    /**
     * Escape individual CSV value
     */
    private escapeCsvValue(value: any, delimiter: string, escapeQuotes: boolean): string {
        if (value === null || value === undefined) {
            return '';
        }

        let stringValue = String(value);

        // Format dates if needed
        if (value instanceof Date) {
            stringValue = value.toISOString();
        }

        // Escape quotes and wrap in quotes if necessary
        if (escapeQuotes && (stringValue.includes('"') || stringValue.includes(delimiter) || stringValue.includes('\n'))) {
            stringValue = stringValue.replace(/"/g, '""');
            stringValue = `"${stringValue}"`;
        }

        return stringValue;
    }

    /**
     * Get value by header name (case-insensitive)
     */
    private getValueByHeader(row: any, header: string): any {
        const keys = Object.keys(row);
        const matchingKey = keys.find(key =>
            key.toLowerCase() === header.toLowerCase() ||
            key === header
        );
        return matchingKey ? row[matchingKey] : '';
    }

    /**
     * Generate empty CSV with headers
     */
    private generateEmptyCsv(options: CsvExportOptions): string {
        if (options.includeHeaders !== false) {
            return 'No data available\n';
        }
        return '';
    }


    /**
     * Get default export options
     */
    private getDefaultOptions(options?: CsvExportOptions): CsvExportOptions {
        return {
            includeHeaders: true,
            delimiter: ',',
            encoding: 'utf8',
            dateFormat: 'ISO',
            numberFormat: 'auto',
            escapeQuotes: true,
            includeMetadata: false,
            ...options
        };
    }

    /**
     * Create chat reference for CSV export
     */
    createChatReference(csvResult: CsvExportResult): string {
        return `📊 <strong>CSV Export Ready</strong><br/>` +
            `✅ ${csvResult.rowCount} rows × ${csvResult.columnCount} columns<br/>` +
            `📁 File: ${csvResult.filename}<br/>` +
            `💾 Size: ${this.formatFileSize(csvResult.size)}<br/>` +
            `🔗 <a href="${csvResult.downloadUrl}" download="${csvResult.filename}">Download CSV</a>`;
    }

    /**
     * Format file size in human readable format
     */
    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
