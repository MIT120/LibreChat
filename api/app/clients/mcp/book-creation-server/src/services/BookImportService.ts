/**
 * Book Import Service - Import and analyze EPUB, PDF, and other book formats
 */

import fs from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createReadStream } from 'fs';
import { ILogger } from '../core/Logger.js';
import { BaseService } from '../core/BaseService.js';
import { ValidationError } from '../../types/errors.js';

// Third-party libraries for book parsing
// Note: These would need to be added to package.json
// npm install epub-parser pdf-parse docx-parser

export interface BookMetadata {
    title: string;
    author?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    language?: string;
    isbn?: string;
    subjects?: string[];
    genre?: string;
    pageCount?: number;
    wordCount?: number;
    chapters?: ChapterMetadata[];
    tableOfContents?: TOCEntry[];
    coverImage?: string; // base64 or path
}

export interface ChapterMetadata {
    title: string;
    content: string;
    pageNumber?: number;
    startPage?: number;
    endPage?: number;
    wordCount: number;
    order: number;
}

export interface TOCEntry {
    title: string;
    level: number;
    page?: number;
    anchor?: string;
    children?: TOCEntry[];
}

export interface ImportResult {
    success: boolean;
    metadata: BookMetadata;
    content: {
        fullText: string;
        chapters: ChapterMetadata[];
    };
    format: string;
    fileSize: number;
    processingTime: number;
    errors?: string[];
    warnings?: string[];
}

export interface ImportOptions {
    extractImages?: boolean;
    preserveFormatting?: boolean;
    chunkByChapters?: boolean;
    generateTOC?: boolean;
    detectGenre?: boolean;
    analyzeContent?: boolean;
    maxFileSize?: number; // in bytes
}

export class BookImportService extends BaseService {
    private readonly SUPPORTED_FORMATS = ['.epub', '.pdf', '.txt', '.docx', '.mobi'];
    private readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB default

    constructor(logger: ILogger) {
        super(logger);
    }

    protected async onInitialize(): Promise<void> {
        // Verify import directory exists
        await this.ensureImportDirectory();
    }

    protected async onDispose(): Promise<void> {
        // Cleanup temporary files
        await this.cleanupTempFiles();
    }

    protected async performHealthCheck() {
        return {
            status: 'healthy' as const,
            message: 'Book Import Service operational',
            lastCheck: new Date(),
        };
    }

    /**
     * Import a book from file path or buffer
     */
    async importBook(
        filePath: string,
        options: ImportOptions = {}
    ): Promise<ImportResult> {
        return this.executeWithLogging('importBook', async () => {
            const startTime = Date.now();
            const errors: string[] = [];
            const warnings: string[] = [];

            try {
                // Validate file
                const fileStats = await fs.stat(filePath);
                const maxSize = options.maxFileSize || this.MAX_FILE_SIZE;

                if (fileStats.size > maxSize) {
                    throw new ValidationError(`File too large: ${fileStats.size} bytes (max: ${maxSize})`, [
                        { field: 'fileSize', message: 'File exceeds maximum size limit', code: 'FILE_TOO_LARGE' }
                    ]);
                }

                const fileExtension = path.extname(filePath).toLowerCase();
                if (!this.SUPPORTED_FORMATS.includes(fileExtension)) {
                    throw new ValidationError(`Unsupported format: ${fileExtension}`, [
                        { field: 'format', message: 'File format not supported', code: 'UNSUPPORTED_FORMAT' }
                    ]);
                }

                let result: ImportResult;

                // Import based on format
                switch (fileExtension) {
                    case '.epub':
                        result = await this.importEPUB(filePath, options);
                        break;
                    case '.pdf':
                        result = await this.importPDF(filePath, options);
                        break;
                    case '.docx':
                        result = await this.importDOCX(filePath, options);
                        break;
                    case '.txt':
                        result = await this.importTXT(filePath, options);
                        break;
                    case '.mobi':
                        result = await this.importMOBI(filePath, options);
                        break;
                    default:
                        throw new ValidationError(`Format handler not implemented: ${fileExtension}`, []);
                }

                // Post-processing
                if (options.detectGenre) {
                    result.metadata.genre = await this.detectGenre(result.metadata, result.content.fullText);
                }

                if (options.analyzeContent) {
                    const analysis = await this.analyzeContent(result.content.fullText);
                    result.metadata.wordCount = analysis.wordCount;
                    result.metadata.subjects = analysis.subjects;
                }

                result.processingTime = Date.now() - startTime;
                result.fileSize = fileStats.size;
                result.errors = errors;
                result.warnings = warnings;

                this.logger.info('Book import completed', {
                    format: fileExtension,
                    title: result.metadata.title,
                    chapters: result.content.chapters.length,
                    wordCount: result.metadata.wordCount,
                    processingTime: result.processingTime
                });

                return result;
            } catch (error) {
                this.logger.error('Book import failed', { error: error as Error, filePath });
                throw error;
            }
        }, { filePath });
    }

    /**
     * Import EPUB file
     */
    private async importEPUB(filePath: string, options: ImportOptions): Promise<ImportResult> {
        try {
            // Mock implementation - in reality would use epub-parser
            const fileBuffer = await fs.readFile(filePath);

            // Simulated EPUB parsing
            const metadata: BookMetadata = {
                title: "Imported EPUB Book",
                author: ["Unknown Author"],
                language: "en",
                chapters: [],
                tableOfContents: []
            };

            const content = {
                fullText: "Mock EPUB content would be extracted here...",
                chapters: [
                    {
                        title: "Chapter 1",
                        content: "Mock chapter content...",
                        wordCount: 500,
                        order: 1
                    }
                ]
            };

            return {
                success: true,
                metadata,
                content,
                format: 'epub',
                fileSize: fileBuffer.length,
                processingTime: 0
            };
        } catch (error) {
            throw new Error(`EPUB import failed: ${(error as Error).message}`);
        }
    }

    /**
     * Import PDF file
     */
    private async importPDF(filePath: string, options: ImportOptions): Promise<ImportResult> {
        try {
            // Mock implementation - in reality would use pdf-parse
            const fileBuffer = await fs.readFile(filePath);

            // Simulated PDF parsing
            const metadata: BookMetadata = {
                title: "Imported PDF Book",
                author: ["Unknown Author"],
                language: "en",
                pageCount: 100,
                chapters: [],
                tableOfContents: []
            };

            const content = {
                fullText: "Mock PDF content would be extracted here...",
                chapters: [
                    {
                        title: "Chapter 1",
                        content: "Mock chapter content...",
                        wordCount: 500,
                        order: 1,
                        startPage: 1,
                        endPage: 10
                    }
                ]
            };

            return {
                success: true,
                metadata,
                content,
                format: 'pdf',
                fileSize: fileBuffer.length,
                processingTime: 0
            };
        } catch (error) {
            throw new Error(`PDF import failed: ${(error as Error).message}`);
        }
    }

    /**
     * Import DOCX file
     */
    private async importDOCX(filePath: string, options: ImportOptions): Promise<ImportResult> {
        try {
            // Mock implementation - in reality would use docx-parser
            const fileBuffer = await fs.readFile(filePath);

            const metadata: BookMetadata = {
                title: "Imported DOCX Document",
                author: ["Unknown Author"],
                language: "en",
                chapters: [],
                tableOfContents: []
            };

            const content = {
                fullText: "Mock DOCX content would be extracted here...",
                chapters: [
                    {
                        title: "Section 1",
                        content: "Mock section content...",
                        wordCount: 300,
                        order: 1
                    }
                ]
            };

            return {
                success: true,
                metadata,
                content,
                format: 'docx',
                fileSize: fileBuffer.length,
                processingTime: 0
            };
        } catch (error) {
            throw new Error(`DOCX import failed: ${(error as Error).message}`);
        }
    }

    /**
     * Import TXT file
     */
    private async importTXT(filePath: string, options: ImportOptions): Promise<ImportResult> {
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const fileStats = await fs.stat(filePath);

            // Basic text analysis
            const lines = fileContent.split('\n');
            const chapters = this.extractChaptersFromText(fileContent);

            const metadata: BookMetadata = {
                title: path.basename(filePath, '.txt'),
                language: "en",
                wordCount: fileContent.split(/\s+/).length,
                chapters: chapters.map((ch, i) => ({
                    title: ch.title,
                    content: ch.content,
                    wordCount: ch.content.split(/\s+/).length,
                    order: i + 1
                }))
            };

            return {
                success: true,
                metadata,
                content: {
                    fullText: fileContent,
                    chapters: metadata.chapters!
                },
                format: 'txt',
                fileSize: fileStats.size,
                processingTime: 0
            };
        } catch (error) {
            throw new Error(`TXT import failed: ${(error as Error).message}`);
        }
    }

    /**
     * Import MOBI file (basic support)
     */
    private async importMOBI(filePath: string, options: ImportOptions): Promise<ImportResult> {
        try {
            const fileBuffer = await fs.readFile(filePath);

            // Mock implementation - MOBI is complex format
            const metadata: BookMetadata = {
                title: "Imported MOBI Book",
                author: ["Unknown Author"],
                language: "en",
                chapters: []
            };

            const content = {
                fullText: "MOBI format support is limited. Consider converting to EPUB or PDF.",
                chapters: []
            };

            return {
                success: true,
                metadata,
                content,
                format: 'mobi',
                fileSize: fileBuffer.length,
                processingTime: 0,
                warnings: ['MOBI format has limited support. Consider using EPUB or PDF instead.']
            };
        } catch (error) {
            throw new Error(`MOBI import failed: ${(error as Error).message}`);
        }
    }

    /**
     * Extract chapters from plain text using common patterns
     */
    private extractChaptersFromText(text: string): Array<{ title: string; content: string }> {
        const chapters: Array<{ title: string; content: string }> = [];

        // Common chapter patterns
        const chapterPatterns = [
            /^Chapter\s+\d+/gmi,
            /^CHAPTER\s+\d+/gmi,
            /^Chapter\s+[IVXLCDM]+/gmi, // Roman numerals
            /^\d+\.\s/gmi, // Numbered sections
            /^Section\s+\d+/gmi
        ];

        let chapterSplits: number[] = [0];

        for (const pattern of chapterPatterns) {
            const matches = Array.from(text.matchAll(pattern));
            if (matches.length > 1) {
                chapterSplits = matches.map(match => match.index!);
                break;
            }
        }

        // If no chapters found, treat as single chapter
        if (chapterSplits.length <= 1) {
            chapters.push({
                title: "Full Content",
                content: text
            });
            return chapters;
        }

        // Extract chapters
        for (let i = 0; i < chapterSplits.length; i++) {
            const start = chapterSplits[i];
            const end = i < chapterSplits.length - 1 ? chapterSplits[i + 1] : text.length;
            const chapterText = text.substring(start, end).trim();

            if (chapterText.length > 50) { // Minimum chapter length
                const firstLine = chapterText.split('\n')[0].trim();
                const title = firstLine.length > 0 && firstLine.length < 100 ? firstLine : `Chapter ${i + 1}`;

                chapters.push({
                    title,
                    content: chapterText
                });
            }
        }

        return chapters;
    }

    /**
     * Detect genre from metadata and content
     */
    private async detectGenre(metadata: BookMetadata, content: string): Promise<string> {
        // Simple genre detection based on keywords
        const genreKeywords = {
            'romance': ['love', 'heart', 'kiss', 'romantic', 'relationship', 'passion'],
            'mystery': ['murder', 'detective', 'investigation', 'clue', 'suspect', 'crime'],
            'fantasy': ['magic', 'wizard', 'dragon', 'quest', 'realm', 'spell'],
            'science fiction': ['space', 'alien', 'technology', 'future', 'robot', 'planet'],
            'horror': ['fear', 'dark', 'ghost', 'monster', 'terror', 'nightmare'],
            'thriller': ['danger', 'chase', 'escape', 'threat', 'suspense', 'action']
        };

        const contentLower = content.toLowerCase();
        const titleLower = (metadata.title || '').toLowerCase();
        const descriptionLower = (metadata.description || '').toLowerCase();
        const allText = `${contentLower} ${titleLower} ${descriptionLower}`;

        let bestGenre = 'fiction';
        let maxScore = 0;

        for (const [genre, keywords] of Object.entries(genreKeywords)) {
            const score = keywords.reduce((sum, keyword) => {
                const matches = (allText.match(new RegExp(keyword, 'gi')) || []).length;
                return sum + matches;
            }, 0);

            if (score > maxScore) {
                maxScore = score;
                bestGenre = genre;
            }
        }

        return bestGenre;
    }

    /**
     * Analyze content for metadata
     */
    private async analyzeContent(content: string): Promise<{ wordCount: number; subjects: string[] }> {
        const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;

        // Extract subjects/themes from content
        const subjects: string[] = [];
        const contentLower = content.toLowerCase();

        // Common subject patterns
        if (contentLower.includes('love') || contentLower.includes('relationship')) {
            subjects.push('relationships');
        }
        if (contentLower.includes('adventure') || contentLower.includes('journey')) {
            subjects.push('adventure');
        }
        if (contentLower.includes('family') || contentLower.includes('parent')) {
            subjects.push('family');
        }
        if (contentLower.includes('history') || contentLower.includes('historical')) {
            subjects.push('history');
        }

        return { wordCount, subjects };
    }

    /**
     * Create a book from imported content
     */
    async createBookFromImport(
        importResult: ImportResult,
        authorId: string,
        additionalMetadata?: Partial<BookMetadata>
    ): Promise<string> {
        return this.executeWithLogging('createBookFromImport', async () => {
            // This would integrate with BookService to create a new book
            // using the imported content and metadata

            const bookData = {
                title: additionalMetadata?.title || importResult.metadata.title,
                subtitle: additionalMetadata?.description || importResult.metadata.description,
                theme: importResult.metadata.subjects?.[0] || 'General',
                genre: additionalMetadata?.genre || importResult.metadata.genre || 'Fiction',
                targetAudience: additionalMetadata?.language || importResult.metadata.language || 'General',
                writingStyle: {
                    tone: 'conversational',
                    voice: 'third_person',
                    vocabulary: 'intermediate',
                    sentenceStructure: 'varied'
                },
                description: importResult.metadata.description,
                targetWordCount: importResult.metadata.wordCount,
                authorId
            };

            // Mock book creation - would use actual BookService
            const bookId = `imported_${Date.now()}`;

            this.logger.info('Book created from import', {
                bookId,
                title: bookData.title,
                chapters: importResult.content.chapters.length
            });

            return bookId;
        }, { title: importResult.metadata.title, authorId });
    }

    /**
     * Get supported formats
     */
    getSupportedFormats(): string[] {
        return [...this.SUPPORTED_FORMATS];
    }

    /**
     * Validate import file
     */
    async validateImportFile(filePath: string): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = [];

        try {
            const stats = await fs.stat(filePath);

            if (!stats.isFile()) {
                errors.push('Path is not a file');
            }

            if (stats.size === 0) {
                errors.push('File is empty');
            }

            if (stats.size > this.MAX_FILE_SIZE) {
                errors.push(`File too large: ${stats.size} bytes (max: ${this.MAX_FILE_SIZE})`);
            }

            const extension = path.extname(filePath).toLowerCase();
            if (!this.SUPPORTED_FORMATS.includes(extension)) {
                errors.push(`Unsupported format: ${extension}`);
            }

        } catch (error) {
            errors.push(`File access error: ${(error as Error).message}`);
        }

        return { valid: errors.length === 0, errors };
    }

    private async ensureImportDirectory(): Promise<void> {
        const importDir = path.join(process.cwd(), 'temp', 'imports');
        try {
            await fs.mkdir(importDir, { recursive: true });
        } catch (error) {
            this.logger.warn('Failed to create import directory', { error: error as Error, importDir });
        }
    }

    private async cleanupTempFiles(): Promise<void> {
        const tempDir = path.join(process.cwd(), 'temp', 'imports');
        try {
            const files = await fs.readdir(tempDir);
            const oldFiles = [];

            for (const file of files) {
                const filePath = path.join(tempDir, file);
                try {
                    // Remove files older than 1 hour
                    const stats = await fs.stat(filePath);
                    if (Date.now() - stats.mtime.getTime() > 3600000) {
                        oldFiles.push(file);
                    }
                } catch (error) {
                    // Skip files that can't be accessed
                    continue;
                }
            }

            for (const file of oldFiles) {
                await fs.unlink(path.join(tempDir, file));
            }
        } catch (error) {
            this.logger.debug('Cleanup temp files failed', error as Error);
        }
    }
}

export default BookImportService;
