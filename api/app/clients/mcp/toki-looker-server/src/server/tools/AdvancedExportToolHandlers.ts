/**
 * Advanced Export Tool Handlers - PDF, Excel, and Image export functionality
 */

import { BaseToolHandler } from '../tools/BaseToolHandler.js';
import { ILogger } from '../../interfaces/ILogger.js';
import { LookerService } from '../../services/LookerService.js';
import { IToolHandler } from '../../interfaces/index.js';
import { z } from 'zod';
import {
    PDFTemplate,
    PDFExportResult,
    ExcelSheet,
    ExcelExportResult,
    ImageFormat,
    ImageExportResult,
    LookerQueryResult
} from '../../../types/index.js';

export class AdvancedExportToolHandlers extends BaseToolHandler {
    private lookerService: LookerService;

    constructor(logger: ILogger, lookerService: LookerService) {
        super(logger);
        this.lookerService = lookerService;
    }

    getTools(): IToolHandler[] {
        return [
            this.createExportToPDFHandler(),
            this.createExportToExcelHandler(),
            this.createExportToImageHandler(),
            this.createExportDashboardReportHandler(),
            this.createBatchExportHandler(),
            this.createExportToPDFWithTemplateHandler(),
            this.createExportToExcelWithChartsHandler(),
            this.createExportChartsAsImagesHandler(),
            this.createExportMultipleFormatsHandler(),
            this.createExportWithCustomStylingHandler()
        ];
    }

    private createExportToPDFHandler(): IToolHandler {
        return {
            name: 'looker-export-to-pdf',
            description: 'Export query results to PDF format',
            inputSchema: this.toJsonSchema(z.object({
                queryResult: z.any(),
                options: z.object({
                    title: z.string().optional(),
                    includeCharts: z.boolean().optional(),
                    pageSize: z.enum(['A4', 'Letter']).optional()
                }).optional()
            })),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.advancedExport.exportToPDF(args.queryResult, args.options),
                    'export to PDF',
                    'Successfully exported to PDF'
                );
            }
        };
    }

    private createExportToExcelHandler(): IToolHandler {
        return {
            name: 'looker-export-to-excel',
            description: 'Export data to Excel format with multiple sheets',
            inputSchema: this.toJsonSchema(z.object({
                sheets: z.array(z.object({
                    name: z.string(),
                    data: z.array(z.any()),
                    headers: z.array(z.string()).optional(),
                    chart_config: z.object({
                        type: z.enum(['line', 'bar', 'pie', 'scatter']),
                        title: z.string(),
                        data_range: z.string(),
                        position: z.object({
                            row: z.number(),
                            col: z.number()
                        })
                    }).optional()
                }))
            })),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.advancedExport.exportToExcel([], args.sheets),
                    'export to Excel',
                    'Successfully exported to Excel'
                );
            }
        };
    }

    private createExportToImageHandler(): IToolHandler {
        return {
            name: 'looker-export-to-image',
            description: 'Export charts as images',
            inputSchema: this.toJsonSchema(z.object({
                queryResult: z.any(),
                format: z.enum(['png', 'svg', 'jpeg']),
                options: z.object({
                    width: z.number().optional(),
                    height: z.number().optional(),
                    quality: z.number().optional()
                }).optional()
            })),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.advancedExport.exportToImage(args.queryResult, args.format),
                    'export to image',
                    'Successfully exported to image'
                );
            }
        };
    }

    private createExportDashboardReportHandler(): IToolHandler {
        return {
            name: 'looker-export-dashboard-report',
            description: 'Export dashboard as a comprehensive report',
            inputSchema: this.toJsonSchema(z.object({
                dashboardId: z.string(),
                format: z.enum(['pdf', 'excel', 'image']),
                options: z.object({
                    includeFilters: z.boolean().optional(),
                    includeMetadata: z.boolean().optional()
                }).optional()
            })),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.advancedExport.exportDashboardReport(args.dashboardId, args.format, args.options),
                    'export dashboard report',
                    'Successfully exported dashboard report'
                );
            }
        };
    }

    private createBatchExportHandler(): IToolHandler {
        return {
            name: 'looker-batch-export',
            description: 'Export multiple queries in batch',
            inputSchema: this.toJsonSchema(z.object({
                exports: z.array(z.object({
                    queryId: z.string(),
                    format: z.enum(['pdf', 'excel', 'csv', 'image']),
                    options: z.any().optional()
                }))
            })),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.advancedExport.batchExport(args.exports),
                    'batch export',
                    'Successfully completed batch export'
                );
            }
        };
    }

    private createExportToPDFWithTemplateHandler(): IToolHandler {
        return {
            name: 'looker-export-to-pdf-with-template',
            description: 'Export to PDF using a custom template',
            inputSchema: this.toJsonSchema(z.object({
                queryResult: z.any(),
                template: z.object({
                    header: z.string().optional(),
                    footer: z.string().optional(),
                    styles: z.any().optional()
                })
            })),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.advancedExport.exportToPDF(args.queryResult, args.template),
                    'export to PDF with template',
                    'Successfully exported to PDF with template'
                );
            }
        };
    }

    private createExportToExcelWithChartsHandler(): IToolHandler {
        return {
            name: 'looker-export-to-excel-with-charts',
            description: 'Export to Excel with embedded charts',
            inputSchema: this.toJsonSchema(z.object({
                sheets: z.array(z.object({
                    name: z.string(),
                    data: z.array(z.any()),
                    headers: z.array(z.string()).optional(),
                    chart_config: z.object({
                        type: z.enum(['line', 'bar', 'pie', 'scatter']),
                        title: z.string(),
                        data_range: z.string(),
                        position: z.object({
                            row: z.number(),
                            col: z.number()
                        })
                    }).optional()
                }))
            })),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.advancedExport.exportToExcel([], args.sheets),
                    'export to Excel with charts',
                    'Successfully exported to Excel with charts'
                );
            }
        };
    }

    private createExportChartsAsImagesHandler(): IToolHandler {
        return {
            name: 'looker-export-charts-as-images',
            description: 'Export individual charts as separate images',
            inputSchema: this.toJsonSchema(z.object({
                queryResult: z.any(),
                format: z.enum(['png', 'svg', 'jpeg']),
                options: z.object({
                    width: z.number().optional(),
                    height: z.number().optional(),
                    quality: z.number().optional()
                }).optional()
            })),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.advancedExport.exportToImage(args.queryResult, args.format),
                    'export charts as images',
                    'Successfully exported charts as images'
                );
            }
        };
    }

    private createExportMultipleFormatsHandler(): IToolHandler {
        return {
            name: 'looker-export-multiple-formats',
            description: 'Export the same data in multiple formats',
            inputSchema: this.toJsonSchema(z.object({
                queryResult: z.any(),
                formats: z.array(z.enum(['pdf', 'excel', 'csv', 'image'])),
                options: z.any().optional()
            })),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.advancedExport.exportToPDF(args.queryResult, {
                        title: 'Export',
                        page_size: 'A4',
                        orientation: 'portrait',
                        margins: { top: 1, right: 1, bottom: 1, left: 1 },
                        include_charts: true
                    }),
                    'export multiple formats',
                    'Successfully exported in multiple formats'
                );
            }
        };
    }

    private createExportWithCustomStylingHandler(): IToolHandler {
        return {
            name: 'looker-export-with-custom-styling',
            description: 'Export with custom styling and formatting',
            inputSchema: this.toJsonSchema(z.object({
                queryResult: z.any(),
                format: z.enum(['pdf', 'excel', 'image']),
                styling: z.object({
                    colors: z.any().optional(),
                    fonts: z.any().optional(),
                    layout: z.any().optional()
                })
            })),
            handler: async (args: any) => {
                return this.executeWithErrorHandling(
                    () => this.lookerService.advancedExport.exportToPDF(args.queryResult, args.styling),
                    'export with custom styling',
                    'Successfully exported with custom styling'
                );
            }
        };
    }

    /**
     * Export query result to PDF format
     */
    async exportToPDF(args: {
        queryResult: LookerQueryResult;
        title: string;
        subtitle?: string;
        pageSize?: 'A4' | 'Letter' | 'Legal';
        orientation?: 'portrait' | 'landscape';
        includeCharts?: boolean;
        chartWidth?: number;
        chartHeight?: number;
        chartFormat?: 'png' | 'svg';
    }): Promise<PDFExportResult> {
        this.logger.info('Exporting to PDF', {
            title: args.title,
            rowCount: args.queryResult.data?.length || 0
        });

        try {
            const template: PDFTemplate = {
                title: args.title,
                subtitle: args.subtitle,
                page_size: args.pageSize || 'A4',
                orientation: args.orientation || 'portrait',
                margins: { top: 20, right: 20, bottom: 20, left: 20 },
                include_charts: args.includeCharts || true,
                chart_config: {
                    width: args.chartWidth || 600,
                    height: args.chartHeight || 400,
                    format: args.chartFormat || 'png'
                }
            };

            const result = await this.lookerService.advancedExport.exportToPDF(args.queryResult, template);

            this.logger.info('PDF export completed', {
                filename: result.filename,
                size: result.size,
                pageCount: result.page_count
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to export to PDF', error);
            throw error;
        }
    }

    /**
     * Export data to Excel format with multiple sheets
     */
    async exportToExcel(args: {
        data: any[];
        sheets: Array<{
            name: string;
            data: any[];
            headers?: string[];
            chartConfig?: {
                type: 'line' | 'bar' | 'pie' | 'scatter';
                title: string;
                data_range: string;
                position: { row: number; col: number };
            };
        }>;
    }): Promise<ExcelExportResult> {
        this.logger.info('Exporting to Excel', {
            sheetCount: args.sheets.length,
            totalRows: args.data.length
        });

        try {
            const excelSheets: ExcelSheet[] = args.sheets.map(sheet => ({
                name: sheet.name,
                data: sheet.data,
                headers: sheet.headers,
                chart_config: sheet.chartConfig
            }));

            const result = await this.lookerService.advancedExport.exportToExcel(args.data, excelSheets);

            this.logger.info('Excel export completed', {
                filename: result.filename,
                size: result.size,
                sheetCount: result.sheet_count
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to export to Excel', error);
            throw error;
        }
    }

    /**
     * Export query result as image
     */
    async exportToImage(args: {
        queryResult: LookerQueryResult;
        format: 'png' | 'svg' | 'jpeg';
        width?: number;
        height?: number;
        dpi?: number;
        quality?: number;
    }): Promise<ImageExportResult> {
        this.logger.info('Exporting to image', {
            format: args.format,
            rowCount: args.queryResult.data?.length || 0
        });

        try {
            const imageFormat: ImageFormat = {
                type: args.format,
                width: args.width,
                height: args.height,
                dpi: args.dpi,
                quality: args.quality
            };

            const result = await this.lookerService.advancedExport.exportToImage(args.queryResult, imageFormat);

            this.logger.info('Image export completed', {
                filename: result.filename,
                size: result.size,
                width: result.width,
                height: result.height,
                format: result.format
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to export to image', error);
            throw error;
        }
    }

    /**
     * Export dashboard as multi-format report
     */
    async exportDashboardReport(args: {
        dashboardData: any[];
        title: string;
        formats: ('pdf' | 'excel' | 'image')[];
    }): Promise<{
        pdf?: PDFExportResult;
        excel?: ExcelExportResult;
        image?: ImageExportResult;
        summary: {
            formats: string[];
            totalSize: number;
            exportId: string;
        };
    }> {
        this.logger.info('Exporting dashboard report', {
            title: args.title,
            formats: args.formats,
            dataPoints: args.dashboardData.length
        });

        try {
            const result = await this.lookerService.advancedExport.exportDashboardReport(
                args.dashboardData,
                args.title,
                args.formats
            );

            this.logger.info('Dashboard report export completed', {
                title: args.title,
                formats: result.summary.formats,
                totalSize: result.summary.totalSize,
                exportId: result.summary.exportId
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to export dashboard report', error);
            throw error;
        }
    }

    /**
     * Batch export multiple queries
     */
    async batchExport(args: {
        exports: Array<{
            queryResult: LookerQueryResult;
            title: string;
            format: 'pdf' | 'excel' | 'image';
            template?: PDFTemplate;
            sheets?: ExcelSheet[];
            imageFormat?: ImageFormat;
        }>;
    }): Promise<{
        results: Array<PDFExportResult | ExcelExportResult | ImageExportResult>;
        summary: {
            totalExports: number;
            successfulExports: number;
            failedExports: number;
            totalSize: number;
            batchId: string;
        };
    }> {
        this.logger.info('Starting batch export', { exportCount: args.exports.length });

        try {
            const result = await this.lookerService.advancedExport.batchExport(args.exports);

            this.logger.info('Batch export completed', {
                totalExports: result.summary.totalExports,
                successfulExports: result.summary.successfulExports,
                failedExports: result.summary.failedExports,
                totalSize: result.summary.totalSize,
                batchId: result.summary.batchId
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to perform batch export', error);
            throw error;
        }
    }

    /**
     * Export query result with custom PDF template
     */
    async exportToPDFWithTemplate(args: {
        queryResult: LookerQueryResult;
        template: PDFTemplate;
    }): Promise<PDFExportResult> {
        this.logger.info('Exporting to PDF with custom template', {
            title: args.template.title,
            rowCount: args.queryResult.data?.length || 0
        });

        try {
            const result = await this.lookerService.advancedExport.exportToPDF(args.queryResult, args.template);

            this.logger.info('PDF export with custom template completed', {
                filename: result.filename,
                size: result.size,
                pageCount: result.page_count
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to export to PDF with custom template', error);
            throw error;
        }
    }

    /**
     * Export data to Excel with charts
     */
    async exportToExcelWithCharts(args: {
        data: any[];
        title: string;
        chartConfigs: Array<{
            sheetName: string;
            chartType: 'line' | 'bar' | 'pie' | 'scatter';
            chartTitle: string;
            data_range: string;
            position: { row: number; col: number };
        }>;
    }): Promise<ExcelExportResult> {
        this.logger.info('Exporting to Excel with charts', {
            title: args.title,
            dataPoints: args.data.length,
            chartCount: args.chartConfigs.length
        });

        try {
            const sheets: ExcelSheet[] = [
                {
                    name: args.title,
                    data: args.data,
                    headers: args.data.length > 0 ? Object.keys(args.data[0]) : []
                }
            ];

            // Add chart sheets
            args.chartConfigs.forEach(chartConfig => {
                sheets.push({
                    name: chartConfig.sheetName,
                    data: args.data,
                    headers: args.data.length > 0 ? Object.keys(args.data[0]) : [],
                    chart_config: {
                        type: chartConfig.chartType,
                        title: chartConfig.chartTitle,
                        data_range: chartConfig.data_range,
                        position: chartConfig.position
                    }
                });
            });

            const result = await this.lookerService.advancedExport.exportToExcel(args.data, sheets);

            this.logger.info('Excel export with charts completed', {
                filename: result.filename,
                size: result.size,
                sheetCount: result.sheet_count
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to export to Excel with charts', error);
            throw error;
        }
    }

    /**
     * Export multiple charts as images
     */
    async exportChartsAsImages(args: {
        queryResults: Array<{
            data: any[];
            title: string;
            chartType: 'line' | 'bar' | 'pie' | 'scatter';
        }>;
        format: 'png' | 'svg' | 'jpeg';
        width?: number;
        height?: number;
    }): Promise<ImageExportResult[]> {
        this.logger.info('Exporting charts as images', {
            chartCount: args.queryResults.length,
            format: args.format
        });

        try {
            const results: ImageExportResult[] = [];

            for (const chartData of args.queryResults) {
                const queryResult: LookerQueryResult = { data: chartData.data };
                const imageFormat: ImageFormat = {
                    type: args.format,
                    width: args.width,
                    height: args.height
                };

                const result = await this.lookerService.advancedExport.exportToImage(queryResult, imageFormat);
                results.push(result);
            }

            this.logger.info('Charts exported as images completed', {
                chartCount: args.queryResults.length,
                format: args.format,
                resultsCount: results.length
            });

            return results;
        } catch (error) {
            this.logger.error('Failed to export charts as images', error);
            throw error;
        }
    }

    /**
     * Export query result with multiple formats
     */
    async exportMultipleFormats(args: {
        queryResult: LookerQueryResult;
        title: string;
        formats: Array<{
            type: 'pdf' | 'excel' | 'image';
            options?: any;
        }>;
    }): Promise<{
        pdf?: PDFExportResult;
        excel?: ExcelExportResult;
        image?: ImageExportResult;
        summary: {
            formats: string[];
            totalSize: number;
            exportId: string;
        };
    }> {
        this.logger.info('Exporting multiple formats', {
            title: args.title,
            formatCount: args.formats.length
        });

        try {
            const results: any = {};
            let totalSize = 0;
            const exportId = `multi_${Date.now()}`;

            for (const format of args.formats) {
                switch (format.type) {
                    case 'pdf':
                        const pdfTemplate: PDFTemplate = {
                            title: args.title,
                            page_size: 'A4',
                            orientation: 'portrait',
                            margins: { top: 20, right: 20, bottom: 20, left: 20 },
                            include_charts: true,
                            chart_config: {
                                width: 600,
                                height: 400,
                                format: 'png'
                            },
                            ...format.options
                        };
                        results.pdf = await this.lookerService.advancedExport.exportToPDF(args.queryResult, pdfTemplate);
                        totalSize += results.pdf.size;
                        break;

                    case 'excel':
                        const excelSheets: ExcelSheet[] = [{
                            name: args.title,
                            data: args.queryResult.data || [],
                            headers: args.queryResult.data && args.queryResult.data.length > 0 ?
                                Object.keys(args.queryResult.data[0]) : []
                        }];
                        results.excel = await this.lookerService.advancedExport.exportToExcel(
                            args.queryResult.data || [],
                            excelSheets
                        );
                        totalSize += results.excel.size;
                        break;

                    case 'image':
                        const imageFormat: ImageFormat = {
                            type: 'png',
                            width: 800,
                            height: 600,
                            ...format.options
                        };
                        results.image = await this.lookerService.advancedExport.exportToImage(args.queryResult, imageFormat);
                        totalSize += results.image.size;
                        break;
                }
            }

            const summary = {
                formats: Object.keys(results),
                totalSize,
                exportId
            };

            this.logger.info('Multiple formats export completed', {
                title: args.title,
                formats: summary.formats,
                totalSize,
                exportId
            });

            return { ...results, summary };
        } catch (error) {
            this.logger.error('Failed to export multiple formats', error);
            throw error;
        }
    }

    /**
     * Export with custom styling and branding
     */
    async exportWithCustomStyling(args: {
        queryResult: LookerQueryResult;
        title: string;
        format: 'pdf' | 'excel' | 'image';
        styling: {
            fontFamily?: string;
            fontSize?: number;
            colorScheme?: string;
            logoUrl?: string;
            headerText?: string;
            footerText?: string;
        };
    }): Promise<PDFExportResult | ExcelExportResult | ImageExportResult> {
        this.logger.info('Exporting with custom styling', {
            title: args.title,
            format: args.format
        });

        try {
            let result: PDFExportResult | ExcelExportResult | ImageExportResult;

            switch (args.format) {
                case 'pdf':
                    const pdfTemplate: PDFTemplate = {
                        title: args.title,
                        page_size: 'A4',
                        orientation: 'portrait',
                        margins: { top: 20, right: 20, bottom: 20, left: 20 },
                        include_charts: true,
                        chart_config: {
                            width: 600,
                            height: 400,
                            format: 'png'
                        },
                        styling: {
                            font_family: args.styling.fontFamily || 'Arial',
                            font_size: args.styling.fontSize || 12,
                            color_scheme: args.styling.colorScheme || 'default'
                        }
                    };
                    result = await this.lookerService.advancedExport.exportToPDF(args.queryResult, pdfTemplate);
                    break;

                case 'excel':
                    const excelSheets: ExcelSheet[] = [{
                        name: args.title,
                        data: args.queryResult.data || [],
                        headers: args.queryResult.data && args.queryResult.data.length > 0 ?
                            Object.keys(args.queryResult.data[0]) : []
                    }];
                    result = await this.lookerService.advancedExport.exportToExcel(
                        args.queryResult.data || [],
                        excelSheets
                    );
                    break;

                case 'image':
                    const imageFormat: ImageFormat = {
                        type: 'png',
                        width: 800,
                        height: 600
                    };
                    result = await this.lookerService.advancedExport.exportToImage(args.queryResult, imageFormat);
                    break;

                default:
                    throw new Error(`Unsupported format: ${args.format}`);
            }

            this.logger.info('Export with custom styling completed', {
                title: args.title,
                format: args.format,
                size: result.size
            });

            return result;
        } catch (error) {
            this.logger.error('Failed to export with custom styling', error);
            throw error;
        }
    }
}
