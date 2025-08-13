/**
 * Export Service - Book export functionality in multiple formats
 */

import fs from 'fs/promises';
import path from 'path';
import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';
import { ExportFormat } from '../../types/book.js';
import { DatabaseError, ValidationError } from '../../types/errors.js';
import { BaseService, ServiceHealth, ServiceHealthStatus } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';
import { ExportOptions, ExportResult, IBookService, IExportService } from '../interfaces/index.js';
import Export, { IExport, IExportDocument } from '../../models/Export.js';
import { ConfigService } from './ConfigService.js';

interface BookExportData {
    _id: string;
    title: string;
    subtitle?: string;
    theme: string;
    genre: string;
    description?: string;
    authorId: string;
    writingStyle: any;
    targetAudience?: string;
    currentWordCount: number;
    targetWordCount?: number;
    status: string;
    metadata: any;
    createdAt: Date;
    updatedAt: Date;
    chapters?: ChapterExportData[];
    allImages?: any[];
    imagesByChapter?: Record<string, any[]>;
}

interface ChapterExportData {
    _id: string;
    chapterNumber: number;
    title: string;
    description?: string;
    outline?: string;
    wordCount: number;
    pages?: PageExportData[];
}

interface PageExportData {
    pageId: string;
    pageNumber: number;
    title: string;
    content: string;
    wordCount: number;
    notes?: string;
}

export class ExportService extends BaseService implements IExportService {
    private bookService: IBookService;
    private configService: ConfigService;
    private imageService?: any; // Optional dependency

    constructor(
        logger: ILogger,
        bookService: IBookService,
        configService: ConfigService,
        imageService?: any
    ) {
        super(logger);
        this.bookService = bookService;
        this.configService = configService;
        this.imageService = imageService;
    }

    protected async onInitialize(): Promise<void> {
        await this.ensureExportsDirectory();
    }

    protected async onDispose(): Promise<void> {
        // No specific cleanup needed
    }

    protected async performHealthCheck(): Promise<ServiceHealth> {
        try {
            const exportConfig = this.configService.getExportConfig();

            // Check if export directory exists and is writable
            try {
                await fs.access(exportConfig.outputDirectory, fs.constants.W_OK);
            } catch {
                return {
                    status: ServiceHealthStatus.UNHEALTHY,
                    message: 'Export directory not accessible',
                    details: { exportDirectory: exportConfig.outputDirectory },
                    lastCheck: new Date(),
                };
            }

            // Check available disk space (simplified check)
            const stats = await fs.stat(exportConfig.outputDirectory);

            return {
                status: ServiceHealthStatus.HEALTHY,
                message: 'Export service is operational',
                details: {
                    exportDirectory: exportConfig.outputDirectory,
                    maxFileSize: exportConfig.maxFileSize,
                    allowedFormats: exportConfig.allowedFormats,
                    compressionEnabled: exportConfig.compression,
                },
                lastCheck: new Date(),
            };
        } catch (error) {
            return {
                status: ServiceHealthStatus.UNHEALTHY,
                message: `Export service health check failed: ${(error as Error).message}`,
                details: { error: (error as Error).stack },
                lastCheck: new Date(),
            };
        }
    }

    async exportBook(bookId: string, format: string, options: ExportOptions): Promise<ExportResult> {
        return this.executeWithLogging('exportBook', async () => {
            const { includeMetadata = true, authorId } = options;

            // Validate format
            this.validateExportFormat(format);

            // Fetch the complete book data
            const bookData = await this.fetchBookData(bookId, authorId);

            // Get next version number for this book/format combination
            const version = await Export.getNextVersion(bookId, format);
            const exportId = uuidv4();

            // Create export record in database (pending status)
            const exportRecord = new Export({
                _id: exportId,
                bookId,
                authorId,
                format,
                filename: '', // Will be updated after generation
                filepath: '', // Will be updated after generation
                size: 0, // Will be updated after generation
                version,
                metadata: {
                    includeMetadata,
                    aliasFilename: (options as any).aliasFilename,
                    bookTitle: bookData.title,
                    bookTheme: bookData.theme,
                    bookGenre: bookData.genre,
                    exportOptions: options,
                },
                status: 'pending',
            });

            try {
                await exportRecord.save();
                this.logger.info('Export record created', { exportId, bookId, version });

                // Fetch images if available
                if (this.imageService) {
                    this.logger.info(`Export: ImageService is available, fetching images for book ${bookId}`);
                    try {
                        const bookImages = await this.imageService.getBookImages(bookId);
                        bookData.allImages = bookImages;
                        bookData.imagesByChapter = this.organizeImagesByChapter(bookImages);

                        this.logger.info(`Export: Found ${bookImages.length} images for book ${bookId}`, {
                            images: bookImages.map((img: any) => ({
                                id: img.id,
                                pageNumber: img.pageNumber,
                                chapterId: img.chapterId,
                                url: img.url ? img.url.substring(0, 50) + '...' : 'no url'
                            }))
                        });
                    } catch (error) {
                        this.logger.warn('Failed to fetch images for export', { error: (error as Error).message });
                        bookData.allImages = [];
                        bookData.imagesByChapter = {};
                    }
                } else {
                    this.logger.warn('Export: ImageService is not available - images will not be included in export');
                    bookData.allImages = [];
                    bookData.imagesByChapter = {};
                }

                // Generate export based on format
                const result = await this.generateExport(bookData, format as ExportFormat, includeMetadata);

                // Update export record with file details
                exportRecord.filename = result.filename;
                exportRecord.filepath = result.filepath;
                exportRecord.size = result.size;
                exportRecord.status = 'completed';
                await exportRecord.save();

                // Optional alias filename (e.g., copy to conversationId.html for immediate client fetch)
                if (options && (options as any).aliasFilename) {
                    try {
                        const exportConfig = this.configService.getExportConfig();
                        const aliasPath = path.join(exportConfig.outputDirectory, String((options as any).aliasFilename));
                        await fs.copyFile(result.filepath, aliasPath);
                        this.logger.info('Export alias created', { alias: aliasPath });
                    } catch (aliasErr) {
                        this.logger.warn('Failed to create export alias', { error: (aliasErr as Error).message });
                    }
                }

                this.logger.info('Book export completed successfully', {
                    exportId,
                    bookId,
                    format,
                    filename: result.filename,
                    size: result.size,
                    version,
                });

                // Return enhanced result with database info
                return {
                    ...result,
                    exportId,
                    version,
                    url: `/c/exports/${result.filename}`,
                };

            } catch (error) {
                // Mark export as failed
                exportRecord.status = 'failed';
                exportRecord.error = (error as Error).message;
                await exportRecord.save().catch(() => {}); // Don't throw if save fails
                throw error;
            }
        }, { bookId, format, authorId: options.authorId });
    }

    /**
     * Get export history for a book
     */
    async getBookExportHistory(bookId: string, authorId: string, options: {
        format?: string;
        status?: string;
        limit?: number;
        skip?: number;
    } = {}): Promise<IExportDocument[]> {
        return this.executeWithLogging('getBookExportHistory', async () => {
            return await Export.getBookExportHistory(bookId, authorId, options);
        }, { bookId, authorId });
    }

    /**
     * Get latest export for a book and format
     */
    async getLatestExport(bookId: string, format: string, authorId: string): Promise<IExportDocument | null> {
        return this.executeWithLogging('getLatestExport', async () => {
            return await Export.getLatestExport(bookId, format, authorId);
        }, { bookId, format, authorId });
    }

    /**
     * Get export by ID
     */
    async getExportById(exportId: string, authorId: string): Promise<IExportDocument | null> {
        return this.executeWithLogging('getExportById', async () => {
            return await Export.findOne({ _id: exportId, authorId });
        }, { exportId, authorId });
    }

    /**
     * Mark export as downloaded
     */
    async markExportDownloaded(exportId: string, authorId: string): Promise<IExportDocument | null> {
        return this.executeWithLogging('markExportDownloaded', async () => {
            const exportRecord = await Export.findOne({ _id: exportId, authorId });
            if (exportRecord) {
                await exportRecord.markDownloaded();
                return exportRecord;
            }
            return null;
        }, { exportId, authorId });
    }

    /**
     * Delete export (mark as deleted, don't physically remove)
     */
    async deleteExport(exportId: string, authorId: string): Promise<boolean> {
        return this.executeWithLogging('deleteExport', async () => {
            const exportRecord = await Export.findOne({ _id: exportId, authorId });
            if (exportRecord) {
                await exportRecord.markDeleted();
                return true;
            }
            return false;
        }, { exportId, authorId });
    }

    private async fetchBookData(bookId: string, authorId: string): Promise<BookExportData> {
        if (!bookId || !authorId) {
            throw new ValidationError('Book ID and author ID are required', [
                { field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' },
                { field: 'authorId', message: 'Author ID is required', code: 'REQUIRED' }
            ]);
        }

        try {
            const bookData = await this.bookService.getBook(bookId, {
                includeChapters: true,
                includePages: true,
            });

            // Verify author permissions
            if (bookData.authorId !== authorId) {
                throw new ValidationError('Unauthorized: You can only export your own books', [
                    { field: 'authorId', message: 'Unauthorized access', code: 'UNAUTHORIZED' }
                ]);
            }

            return bookData as BookExportData;
        } catch (error) {
            if (error instanceof ValidationError) {
                throw error;
            }
            throw new DatabaseError(`Failed to fetch book data: ${(error as Error).message}`);
        }
    }

    private validateExportFormat(format: string): void {
        const allowedFormats = this.configService.getExportConfig().allowedFormats;

        if (!allowedFormats.includes(format)) {
            throw new ValidationError(`Unsupported export format: ${format}`, [
                {
                    field: 'format',
                    message: `Format must be one of: ${allowedFormats.join(', ')}`,
                    code: 'INVALID_FORMAT'
                }
            ]);
        }
    }

    private async generateExport(
        bookData: BookExportData,
        format: ExportFormat,
        includeMetadata: boolean
    ): Promise<ExportResult> {
        switch (format) {
            case ExportFormat.PDF:
                return this.exportToPDF(bookData, includeMetadata);
            case ExportFormat.HTML:
                return this.exportToHTML(bookData, includeMetadata);
            case ExportFormat.TXT:
                return this.exportToText(bookData, includeMetadata);
            case ExportFormat.EPUB:
                return this.exportToEPUB(bookData, includeMetadata);
            case ExportFormat.DOCX:
                return this.exportToDocx(bookData, includeMetadata);
            default:
                throw new ValidationError(`Unsupported export format: ${format}`, [
                    { field: 'format', message: 'Invalid export format', code: 'INVALID_FORMAT' }
                ]);
        }
    }

    private async exportToPDF(bookData: BookExportData, includeMetadata: boolean): Promise<ExportResult> {
        const filename = this.generateFilename(bookData.title, 'pdf');
        const filepath = await this.getExportPath(filename);

        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    margin: 50,
                    info: includeMetadata ? {
                        Title: bookData.title,
                        Author: bookData.authorId,
                        Subject: bookData.theme,
                        Keywords: bookData.metadata?.keywords?.join(', ') || '',
                    } : {},
                });

                const stream = require('fs').createWriteStream(filepath);
                doc.pipe(stream);

                // Set font based on content
                this.setFont(doc, 'default', bookData.title);

                // Generate title page
                if (includeMetadata) {
                    this.generateTitlePage(doc, bookData);
                    doc.addPage();
                }

                // Generate table of contents
                if (bookData.chapters && bookData.chapters.length > 0) {
                    this.generateTableOfContents(doc, bookData);
                    doc.addPage();
                }

                // Generate book content
                this.generateBookContent(doc, bookData);

                doc.end();

                stream.on('finish', async () => {
                    try {
                        const stats = await fs.stat(filepath);
                        resolve({
                            filename,
                            filepath,
                            format: 'pdf',
                            size: stats.size,
                            createdAt: new Date(),
                        });
                    } catch (error) {
                        reject(error);
                    }
                });

                stream.on('error', reject);
            } catch (error) {
                reject(error);
            }
        });
    }

    private async exportToHTML(bookData: BookExportData, includeMetadata: boolean): Promise<ExportResult> {
        const filename = this.generateFilename(bookData.title, 'html');
        const filepath = await this.getExportPath(filename);

        let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(bookData.title)}</title>
    <style>
        body { font-family: 'Times New Roman', serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        .title-page { text-align: center; page-break-after: always; margin-bottom: 50px; }
        .book-title { font-size: 2.5em; margin-bottom: 20px; font-weight: bold; }
        .book-subtitle { font-size: 1.5em; margin-bottom: 30px; color: #666; }
        .book-meta { margin-top: 50px; font-size: 1.1em; }
        .toc { page-break-after: always; margin-bottom: 50px; }
        .toc h2 { text-align: center; margin-bottom: 30px; }
        .toc-item { margin: 10px 0; }
        .chapter { page-break-before: always; margin-bottom: 40px; }
        .chapter-title { font-size: 1.8em; margin-bottom: 20px; text-align: center; }
        .page { margin-bottom: 30px; }
        .page-title { font-size: 1.3em; margin-bottom: 15px; font-weight: bold; }
        .page-content { text-align: justify; }
        .image { text-align: center; margin: 20px 0; }
        .image img { max-width: 100%; height: auto; }
        .image-caption { font-style: italic; margin-top: 10px; color: #666; }
        @media print { .chapter { page-break-before: always; } }
    </style>
</head>
<body>`;

        // Title page
        if (includeMetadata) {
            htmlContent += `
    <div class="title-page">
        <h1 class="book-title">${this.escapeHtml(bookData.title)}</h1>`;

            if (bookData.subtitle) {
                htmlContent += `<h2 class="book-subtitle">${this.escapeHtml(bookData.subtitle)}</h2>`;
            }

            htmlContent += `
        <div class="book-meta">
            <p><strong>Genre:</strong> ${this.escapeHtml(bookData.genre)}</p>
            <p><strong>Theme:</strong> ${this.escapeHtml(bookData.theme)}</p>`;

            if (bookData.targetAudience) {
                htmlContent += `<p><strong>Target Audience:</strong> ${this.escapeHtml(bookData.targetAudience)}</p>`;
            }

            if (bookData.description) {
                htmlContent += `<p><strong>Description:</strong> ${this.escapeHtml(bookData.description)}</p>`;
            }

            htmlContent += `
            <p><strong>Word Count:</strong> ${bookData.currentWordCount.toLocaleString()}</p>
        </div>
    </div>`;
        }

        // Table of contents
        if (bookData.chapters && bookData.chapters.length > 0) {
            htmlContent += `
    <div class="toc">
        <h2>Table of Contents</h2>`;

            bookData.chapters.forEach((chapter) => {
                htmlContent += `
        <div class="toc-item">
            <a href="#chapter-${chapter.chapterNumber}">
                Chapter ${chapter.chapterNumber}: ${this.escapeHtml(chapter.title)}
            </a>
        </div>`;
            });

            htmlContent += `</div>`;
        }

        // Book content
        if (bookData.chapters) {
            bookData.chapters.forEach((chapter) => {
                htmlContent += `
    <div class="chapter" id="chapter-${chapter.chapterNumber}">
        <h2 class="chapter-title">Chapter ${chapter.chapterNumber}: ${this.escapeHtml(chapter.title)}</h2>`;

                if (chapter.description) {
                    htmlContent += `<p><em>${this.escapeHtml(chapter.description)}</em></p>`;
                }

                // Add images for this chapter
                const chapterImages = bookData.imagesByChapter?.[chapter._id] || [];
                const beforeChapterImages = chapterImages.filter(img =>
                    img.placement?.position === 'before' && !img.targetPageNumber
                );

                beforeChapterImages.forEach(image => {
                    htmlContent += `
        <div class="image">
            <img src="${image.url}" alt="${this.escapeHtml(image.prompt || 'Chapter illustration')}" />
            <div class="image-caption">${this.escapeHtml(image.prompt || 'Chapter illustration')}</div>
        </div>`;
                });

                // Pages
                if (chapter.pages) {
                    chapter.pages.forEach((page) => {
                        htmlContent += `
        <div class="page" id="page-${page.pageId}">
            <h3 class="page-title">${this.escapeHtml(page.title)}</h3>`;

                        // Images before this page
                        const beforePageImages = this.getImagesForPage(chapterImages, page.pageNumber, 'before');
                        beforePageImages.forEach(image => {
                            htmlContent += `
            <div class="image">
                <img src="${image.url}" alt="${this.escapeHtml(image.prompt || 'Illustration')}" />
                <div class="image-caption">${this.escapeHtml(image.prompt || 'Illustration')}</div>
            </div>`;
                        });

                        htmlContent += `
            <div class="page-content">${this.formatTextToHtml(page.content)}</div>`;

                        // Images after this page
                        const afterPageImages = this.getImagesForPage(chapterImages, page.pageNumber, 'after');
                        afterPageImages.forEach(image => {
                            htmlContent += `
            <div class="image">
                <img src="${image.url}" alt="${this.escapeHtml(image.prompt || 'Illustration')}" />
                <div class="image-caption">${this.escapeHtml(image.prompt || 'Illustration')}</div>
            </div>`;
                        });

                        htmlContent += `</div>`;
                    });
                }

                htmlContent += `</div>`;
            });
        }

        htmlContent += `
</body>
</html>`;

        await fs.writeFile(filepath, htmlContent, 'utf-8');
        const stats = await fs.stat(filepath);

        return {
            filename,
            filepath,
            format: 'html',
            size: stats.size,
            createdAt: new Date(),
        };
    }

    private async exportToText(bookData: BookExportData, includeMetadata: boolean): Promise<ExportResult> {
        const filename = this.generateFilename(bookData.title, 'txt');
        const filepath = await this.getExportPath(filename);

        let textContent = '';

        // Title and metadata
        if (includeMetadata) {
            textContent += `${bookData.title.toUpperCase()}\n`;
            textContent += '='.repeat(bookData.title.length) + '\n\n';

            if (bookData.subtitle) {
                textContent += `${bookData.subtitle}\n\n`;
            }

            textContent += `Genre: ${bookData.genre}\n`;
            textContent += `Theme: ${bookData.theme}\n`;
            if (bookData.targetAudience) {
                textContent += `Target Audience: ${bookData.targetAudience}\n`;
            }
            if (bookData.description) {
                textContent += `Description: ${bookData.description}\n`;
            }
            textContent += `Word Count: ${bookData.currentWordCount.toLocaleString()}\n`;
            textContent += '\n' + '='.repeat(50) + '\n\n';
        }

        // Table of contents
        if (bookData.chapters && bookData.chapters.length > 0) {
            textContent += 'TABLE OF CONTENTS\n';
            textContent += '-'.repeat(17) + '\n\n';

            bookData.chapters.forEach((chapter) => {
                textContent += `Chapter ${chapter.chapterNumber}: ${chapter.title}\n`;
            });

            textContent += '\n' + '='.repeat(50) + '\n\n';
        }

        // Book content
        if (bookData.chapters) {
            bookData.chapters.forEach((chapter, index) => {
                if (index > 0) {
                    textContent += '\n\n';
                }

                textContent += `CHAPTER ${chapter.chapterNumber}: ${chapter.title.toUpperCase()}\n`;
                textContent += '-'.repeat(`CHAPTER ${chapter.chapterNumber}: ${chapter.title}`.length) + '\n\n';

                if (chapter.description) {
                    textContent += `${chapter.description}\n\n`;
                }

                if (chapter.pages) {
                    chapter.pages.forEach((page, pageIndex) => {
                        if (pageIndex > 0) {
                            textContent += '\n\n';
                        }

                        textContent += `${page.title}\n`;
                        textContent += '-'.repeat(page.title.length) + '\n\n';
                        textContent += `${page.content}\n`;

                        if (page.notes) {
                            textContent += `\n[Note: ${page.notes}]\n`;
                        }
                    });
                }
            });
        }

        await fs.writeFile(filepath, textContent, 'utf-8');
        const stats = await fs.stat(filepath);

        return {
            filename,
            filepath,
            format: 'txt',
            size: stats.size,
            createdAt: new Date(),
        };
    }

    private async exportToEPUB(bookData: BookExportData, includeMetadata: boolean): Promise<ExportResult> {
        // EPUB export would require additional libraries like epub-gen
        // For now, return HTML as a placeholder
        this.logger.warn('EPUB export not implemented, falling back to HTML');
        return this.exportToHTML(bookData, includeMetadata);
    }

    private async exportToDocx(bookData: BookExportData, includeMetadata: boolean): Promise<ExportResult> {
        // DOCX export would require additional libraries like docx
        // For now, return HTML as a placeholder
        this.logger.warn('DOCX export not implemented, falling back to HTML');
        return this.exportToHTML(bookData, includeMetadata);
    }

    // Helper methods
    private async ensureExportsDirectory(): Promise<void> {
        const exportConfig = this.configService.getExportConfig();

        try {
            await fs.mkdir(exportConfig.outputDirectory, { recursive: true });
            this.logger.info('Export directory ensured', { directory: exportConfig.outputDirectory });
        } catch (error) {
            this.logger.error('Failed to create export directory', error as Error);
            throw error;
        }
    }

    private async getExportPath(filename: string): Promise<string> {
        const exportConfig = this.configService.getExportConfig();
        return path.join(exportConfig.outputDirectory, filename);
    }

    private generateFilename(title: string, format: string): string {
        const sanitizedTitle = title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50);

        const timestamp = new Date().toISOString().split('T')[0];
        return `${sanitizedTitle}_${timestamp}.${format}`;
    }

    private escapeHtml(text: string): string {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    private formatTextToHtml(text: string): string {
        if (!text) return '';
        return text
            .split('\n\n')
            .map(paragraph => `<p>${this.escapeHtml(paragraph.trim())}</p>`)
            .join('\n');
    }

    private organizeImagesByChapter(images: any[]): Record<string, any[]> {
        const organized: Record<string, any[]> = {};

        for (const image of images) {
            if (image.chapterId) {
                if (!organized[image.chapterId]) {
                    organized[image.chapterId] = [];
                }
                organized[image.chapterId]!.push(image);
            }
        }

        return organized;
    }

    private getImagesForPage(chapterImages: any[], pageNumber: number, position: 'before' | 'after'): any[] {
        return chapterImages.filter(image =>
            image.pageNumber === pageNumber &&
            image.placement?.position === position
        );
    }

    private setFont(doc: PDFKit.PDFDocument, fontType: string, text = ''): void {
        // Set font based on content type and whether it contains Cyrillic characters
        const containsCyrillic = this.containsCyrillic(text);

        if (containsCyrillic) {
            // Use built-in fonts for Cyrillic support
            doc.font('Times-Roman');
        } else {
            doc.font('Times-Roman');
        }
    }

    private containsCyrillic(text: string): boolean {
        return /[\u0400-\u04FF]/.test(text);
    }

    private generateTitlePage(doc: PDFKit.PDFDocument, bookData: BookExportData): void {
        const pageWidth = doc.page.width;
        const margin = doc.page.margins.left;
        const centerX = pageWidth / 2;

        // Title
        doc.fontSize(24).font('Times-Bold');
        const titleWidth = doc.widthOfString(bookData.title);
        doc.text(bookData.title, centerX - titleWidth / 2, 150);

        // Subtitle
        if (bookData.subtitle) {
            doc.fontSize(18).font('Times-Roman');
            const subtitleWidth = doc.widthOfString(bookData.subtitle);
            doc.text(bookData.subtitle, centerX - subtitleWidth / 2, 200);
        }

        // Metadata
        let yPosition = 300;
        doc.fontSize(12).font('Times-Roman');

        const metadata = [
            `Genre: ${bookData.genre}`,
            `Theme: ${bookData.theme}`,
            bookData.targetAudience ? `Target Audience: ${bookData.targetAudience}` : null,
            `Word Count: ${bookData.currentWordCount.toLocaleString()}`,
        ].filter(Boolean);

        metadata.forEach(line => {
            if (line) {
                const lineWidth = doc.widthOfString(line);
                doc.text(line, centerX - lineWidth / 2, yPosition);
                yPosition += 20;
            }
        });

        // Description
        if (bookData.description) {
            yPosition += 30;
            doc.fontSize(11);
            doc.text(bookData.description, margin, yPosition, {
                width: pageWidth - 2 * margin,
                align: 'justify',
            });
        }
    }

    private generateTableOfContents(doc: PDFKit.PDFDocument, bookData: BookExportData): void {
        doc.fontSize(18).font('Times-Bold');
        doc.text('Table of Contents', { align: 'center' });
        doc.moveDown(2);

        doc.fontSize(12).font('Times-Roman');

        bookData.chapters?.forEach((chapter) => {
            const chapterLine = `Chapter ${chapter.chapterNumber}: ${chapter.title}`;
            doc.text(chapterLine);
            doc.moveDown(0.5);
        });
    }

    private generateBookContent(doc: PDFKit.PDFDocument, bookData: BookExportData): void {
        bookData.chapters?.forEach((chapter, chapterIndex) => {
            if (chapterIndex > 0) {
                doc.addPage();
            }

            // Chapter title
            doc.fontSize(16).font('Times-Bold');
            doc.text(`Chapter ${chapter.chapterNumber}: ${chapter.title}`, { align: 'center' });
            doc.moveDown(1);

            // Chapter description
            if (chapter.description) {
                doc.fontSize(11).font('Times-Italic');
                doc.text(chapter.description, { align: 'center' });
                doc.moveDown(1);
            }

            // Pages
            chapter.pages?.forEach((page, pageIndex) => {
                if (pageIndex > 0) {
                    doc.moveDown(1);
                }

                // Page title
                doc.fontSize(14).font('Times-Bold');
                doc.text(page.title);
                doc.moveDown(0.5);

                // Page content
                doc.fontSize(11).font('Times-Roman');
                doc.text(page.content, { align: 'justify' });

                // Page notes
                if (page.notes) {
                    doc.moveDown(0.5);
                    doc.fontSize(9).font('Times-Italic');
                    doc.text(`Note: ${page.notes}`);
                }
            });
        });
    }
}
