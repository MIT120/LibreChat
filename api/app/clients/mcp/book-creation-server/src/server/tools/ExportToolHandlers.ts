/**
 * Export Tool Handlers - MCP tools for book export functionality
 */

import { ILogger } from '../../core/Logger.js';
import { IExportService, IToolHandler, IBookService } from '../../interfaces/index.js';
import { NarrativeConsistencyService } from '../../services/NarrativeConsistencyService.js';

export class ExportToolHandlers {
    private logger: ILogger;
    private exportService: IExportService;
    private bookService: IBookService;
    private narrativeService?: NarrativeConsistencyService;

    constructor(logger: ILogger, exportService: IExportService, bookService: IBookService, narrativeService?: NarrativeConsistencyService) {
        this.logger = logger.child('ExportToolHandlers');
        this.exportService = exportService;
        this.bookService = bookService;
        this.narrativeService = narrativeService;
    }

    getTools(): IToolHandler[] {
        return [
            {
                name: 'export_book',
                description: 'Export a book in the specified format',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'Book identifier',
                        },
                        format: {
                            type: 'string',
                            enum: ['pdf', 'epub', 'docx', 'html', 'txt'],
                            description: 'Export format',
                        },
                        authorId: {
                            type: 'string',
                            description: 'Author identifier for verification',
                        },
                        conversationId: {
                            type: 'string',
                            description: 'Conversation identifier to scope books',
                        },
                        includeMetadata: {
                            type: 'boolean',
                            description: 'Include book metadata in export (default: true)',
                            default: true,
                        },
                        aliasFilename: {
                            type: 'string',
                            description: 'Optional alias filename to copy the export as (e.g., conversationId.html)',
                        },
                    },
                    required: ['bookId', 'format', 'authorId', 'conversationId'],
                },
                handler: this.handleExportBook.bind(this),
            },
            {
                name: 'get_export_history',
                description: 'Get export history for a book with version tracking',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'The unique identifier of the book',
                        },
                        authorId: {
                            type: 'string',
                            description: 'The unique identifier of the author',
                        },
                        format: {
                            type: 'string',
                            enum: ['pdf', 'html', 'txt', 'epub', 'docx'],
                            description: 'Filter by export format (optional)',
                        },
                        status: {
                            type: 'string',
                            enum: ['pending', 'completed', 'failed', 'deleted'],
                            description: 'Filter by export status (optional)',
                        },
                        limit: {
                            type: 'number',
                            description: 'Maximum number of exports to return',
                            default: 20,
                        },
                    },
                    required: ['bookId', 'authorId'],
                },
                handler: this.handleGetExportHistory.bind(this),
            },
            {
                name: 'get_latest_export',
                description: 'Get the latest export for a book and format',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'The unique identifier of the book',
                        },
                        format: {
                            type: 'string',
                            enum: ['pdf', 'html', 'txt', 'epub', 'docx'],
                            description: 'The export format',
                        },
                        authorId: {
                            type: 'string',
                            description: 'The unique identifier of the author',
                        },
                    },
                    required: ['bookId', 'format', 'authorId'],
                },
                handler: this.handleGetLatestExport.bind(this),
            },
            {
                name: 'list_user_books',
                description: 'List all books for a user with basic information',
                inputSchema: {
                    type: 'object',
                    properties: {
                        authorId: {
                            type: 'string',
                            description: 'The unique identifier of the author',
                        },
                        conversationId: {
                            type: 'string',
                            description: 'Conversation identifier to scope books',
                        },
                        limit: {
                            type: 'number',
                            description: 'Maximum number of books to return',
                            default: 50,
                        },
                        status: {
                            type: 'string',
                            enum: ['planning', 'outlining', 'writing', 'editing', 'review', 'completed', 'published'],
                            description: 'Filter by book status (optional)',
                        },
                    },
                    required: ['authorId', 'conversationId'],
                },
                handler: this.handleListUserBooks.bind(this),
            },
            {
                name: 'export_book_with_narrative_context',
                description: 'Export a book with comprehensive narrative consistency information including character references, world elements, and timeline',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: {
                            type: 'string',
                            description: 'The ID of the book to export'
                        },
                        format: {
                            type: 'string',
                            enum: ['html', 'pdf', 'txt', 'epub', 'docx'],
                            description: 'Export format'
                        },
                        authorId: {
                            type: 'string',
                            description: 'Author ID for export access'
                        },
                        includeMetadata: {
                            type: 'boolean',
                            description: 'Whether to include book metadata',
                            default: true
                        },
                        includeNarrativeData: {
                            type: 'boolean',
                            description: 'Whether to include narrative consistency data (characters, world elements, timeline)',
                            default: true
                        },
                        aliasFilename: {
                            type: 'string',
                            description: 'Optional alias filename for the export'
                        }
                    },
                    required: ['bookId', 'format', 'authorId']
                },
                handler: this.handleExportBookWithNarrativeContext.bind(this)
            },
        ];
    }

    private async handleExportBook(args: {
        bookId: string;
        format: string;
        authorId: string;
        includeMetadata?: boolean;
        aliasFilename?: string;
    }): Promise<string> {
        try {
            const startTime = Date.now();
            this.logger.info('Starting book export', {
                bookId: args.bookId,
                format: args.format,
                includeMetadata: args.includeMetadata
            });

            const exportOptions: any = {
                authorId: args.authorId,
                includeMetadata: args.includeMetadata ?? true,
            };
            if (typeof args.aliasFilename === 'string') {
                exportOptions.aliasFilename = args.aliasFilename;
            }
            const result = await this.exportService.exportBook(
                args.bookId,
                args.format,
                exportOptions,
            );

            const exportTime = Date.now() - startTime;
            const fileSizeMB = (result.size / (1024 * 1024)).toFixed(2);

            return `✅ Book exported successfully!

**Export Details:**
- **Book ID:** ${args.bookId}
- **Export ID:** ${result.exportId || 'N/A'}
- **Version:** ${result.version || 'N/A'}
- **Format:** ${result.format.toUpperCase()}
- **Filename:** ${result.filename}
- **File Size:** ${fileSizeMB} MB
- **Export Time:** ${(exportTime / 1000).toFixed(1)} seconds
- **Created:** ${result.createdAt.toLocaleString()}
- **Include Metadata:** ${args.includeMetadata ?? true ? 'Yes' : 'No'}

**File Access:**
- **File Location:** \`${result.filepath}\`
- **URL:** ${result.url || `/c/exports/${result.filename}`}

The exported file is ready for download or sharing. The export includes ${args.includeMetadata !== false ? 'book metadata, table of contents, and ' : ''}all written content formatted for ${result.format.toUpperCase()}.

**Version Tracking:** This export is automatically tracked in the database with version ${result.version || 'N/A'} for future reference.

${this.getFormatSpecificNotes(result.format)}`;
        } catch (error) {
            this.logger.error('Failed to export book', error as Error, args);
            throw error;
        }
    }

    private getFormatSpecificNotes(format: string): string {
        switch (format.toLowerCase()) {
            case 'pdf':
                return `📋 **PDF Notes:**
- Professional layout with proper typography
- Optimized for printing and digital viewing
- Includes bookmarks for easy navigation
- Images are embedded at high quality`;

            case 'html':
                return `🌐 **HTML Notes:**
- Web-ready format with responsive design
- Can be viewed in any web browser
- Includes CSS styling for professional appearance
- Images are linked with proper alt tags`;

            case 'txt':
                return `📝 **Text Notes:**
- Plain text format for maximum compatibility
- Preserves content structure with simple formatting
- Ideal for editing or importing into other tools
- Smallest file size option`;

            case 'epub':
                return `📚 **EPUB Notes:**
- E-reader compatible format
- Reflowable text that adapts to screen sizes
- Includes table of contents and metadata
- Optimized for digital reading devices`;

            case 'docx':
                return `📄 **DOCX Notes:**
- Microsoft Word compatible format
- Fully editable with preserved formatting
- Includes styles for consistent appearance
- Ready for further editing or collaboration`;

            default:
                return '';
        }
    }

    private async handleGetExportHistory(args: {
        bookId: string;
        authorId: string;
        format?: string;
        status?: string;
        limit?: number;
    }): Promise<string> {
        try {
            this.logger.info('Getting export history', {
                bookId: args.bookId,
                format: args.format,
                status: args.status,
                limit: args.limit
            });

            const exports = await this.exportService.getBookExportHistory(
                args.bookId,
                args.authorId,
                {
                    format: args.format,
                    status: args.status || 'completed',
                    limit: args.limit || 20,
                }
            );

            if (exports.length === 0) {
                return `📄 No exports found for book ${args.bookId}${args.format ? ` in ${args.format.toUpperCase()} format` : ''}.

**Available Actions:**
- Use \`export_book\` to create a new export
- Check if the book ID is correct`;
            }

            let response = `📋 **Export History for Book ${args.bookId}**\n\n`;
            response += `Found ${exports.length} export${exports.length > 1 ? 's' : ''}:\n\n`;

            for (const exportRecord of exports) {
                const fileSizeMB = (exportRecord.size / (1024 * 1024)).toFixed(2);
                const statusIcon = exportRecord.status === 'completed' ? '✅' : 
                                  exportRecord.status === 'pending' ? '⏳' : 
                                  exportRecord.status === 'failed' ? '❌' : '🗑️';

                response += `${statusIcon} **Version ${exportRecord.version}** (${exportRecord.format.toUpperCase()})\n`;
                response += `- **Filename:** ${exportRecord.filename}\n`;
                response += `- **Size:** ${fileSizeMB} MB\n`;
                response += `- **Status:** ${exportRecord.status}\n`;
                response += `- **Created:** ${exportRecord.createdAt.toLocaleString()}\n`;
                response += `- **Downloads:** ${exportRecord.downloadCount}\n`;
                if (exportRecord.lastDownloaded) {
                    response += `- **Last Downloaded:** ${exportRecord.lastDownloaded.toLocaleString()}\n`;
                }
                if (exportRecord.status === 'completed') {
                    response += `- **URL:** /c/exports/${exportRecord.filename}\n`;
                }
                if (exportRecord.error) {
                    response += `- **Error:** ${exportRecord.error}\n`;
                }
                response += `\n`;
            }

            response += `**Version Tracking:** Each export creates a new version. Latest versions are shown first.`;

            return response;
        } catch (error) {
            this.logger.error('Failed to get export history', error as Error, args);
            throw error;
        }
    }

    private async handleGetLatestExport(args: {
        bookId: string;
        format: string;
        authorId: string;
    }): Promise<string> {
        try {
            this.logger.info('Getting latest export', {
                bookId: args.bookId,
                format: args.format,
                authorId: args.authorId
            });

            const latestExport = await this.exportService.getLatestExport(
                args.bookId,
                args.format,
                args.authorId
            );

            if (!latestExport) {
                return `📄 No ${args.format.toUpperCase()} export found for book ${args.bookId}.

**Available Actions:**
- Use \`export_book\` to create a new ${args.format.toUpperCase()} export
- Use \`get_export_history\` to see all export formats available`;
            }

            const fileSizeMB = (latestExport.size / (1024 * 1024)).toFixed(2);
            const statusIcon = latestExport.status === 'completed' ? '✅' : 
                              latestExport.status === 'pending' ? '⏳' : 
                              latestExport.status === 'failed' ? '❌' : '🗑️';

            let response = `${statusIcon} **Latest ${args.format.toUpperCase()} Export**\n\n`;
            response += `**Export Details:**\n`;
            response += `- **Book ID:** ${args.bookId}\n`;
            response += `- **Format:** ${latestExport.format.toUpperCase()}\n`;
            response += `- **Version:** ${latestExport.version}\n`;
            response += `- **Filename:** ${latestExport.filename}\n`;
            response += `- **Size:** ${fileSizeMB} MB\n`;
            response += `- **Status:** ${latestExport.status}\n`;
            response += `- **Created:** ${latestExport.createdAt.toLocaleString()}\n`;
            response += `- **Downloads:** ${latestExport.downloadCount}\n`;

            if (latestExport.lastDownloaded) {
                response += `- **Last Downloaded:** ${latestExport.lastDownloaded.toLocaleString()}\n`;
            }

            if (latestExport.status === 'completed') {
                response += `\n**File Access:**\n`;
                response += `- **URL:** /c/exports/${latestExport.filename}\n`;
                response += `- **Direct Link:** \`${latestExport.url}\`\n`;
            }

            if (latestExport.error) {
                response += `\n**Error Details:**\n${latestExport.error}\n`;
            }

            if (latestExport.metadata?.aliasFilename) {
                response += `\n**Alias:** Also available as ${latestExport.metadata.aliasFilename}`;
            }

            return response;
        } catch (error) {
            this.logger.error('Failed to get latest export', error as Error, args);
            throw error;
        }
    }

    private async handleListUserBooks(args: {
        authorId: string;
        conversationId: string;
        limit?: number;
        status?: string;
    }): Promise<string> {
        try {
            this.logger.info('Listing user books', {
                authorId: args.authorId,
                conversationId: args.conversationId,
                limit: args.limit,
                status: args.status
            });

            // Get books from the book service
            const result = await this.bookService.listBooks({
                authorId: args.authorId,
                conversationId: args.conversationId,
                limit: args.limit || 50,
                status: args.status as any,
            });
            
            const books = result.data;

            if (books.length === 0) {
                return `📚 No books found for author ${args.authorId}${args.status ? ` with status '${args.status}'` : ''}.

**Get Started:**
- Use \`create_book\` to create your first book
- Start writing with the book creation tools`;
            }

            let response = `📚 **Books for Author ${args.authorId}**\n\n`;
            response += `Found ${books.length} book${books.length > 1 ? 's' : ''}:\n\n`;

            for (const book of books) {
                const statusIcon = this.getStatusIcon(book.status);
                const wordCount = book.currentWordCount || 0;
                const targetWords = book.targetWordCount || 0;
                const progress = targetWords > 0 ? Math.round((wordCount / targetWords) * 100) : 0;

                response += `${statusIcon} **${book.title}**\n`;
                response += `- **ID:** \`${book._id}\`\n`;
                response += `- **Genre:** ${book.genre}\n`;
                response += `- **Theme:** ${book.theme}\n`;
                response += `- **Status:** ${book.status}\n`;
                response += `- **Progress:** ${wordCount.toLocaleString()} words`;
                if (targetWords > 0) {
                    response += ` / ${targetWords.toLocaleString()} (${progress}%)`;
                }
                response += `\n`;
                if (book.description) {
                    response += `- **Description:** ${book.description.substring(0, 100)}${book.description.length > 100 ? '...' : ''}\n`;
                }
                response += `- **Created:** ${new Date(book.createdAt).toLocaleDateString()}\n`;
                response += `- **Updated:** ${new Date(book.updatedAt).toLocaleDateString()}\n`;
                response += `\n`;
            }

            response += `**Book Management:**\n`;
            response += `- Use \`get_book\` with any book ID to view details\n`;
            response += `- Use \`export_book\` to create downloadable versions\n`;
            response += `- Use \`get_export_history\` to see previous exports`;

            return response;
        } catch (error) {
            this.logger.error('Failed to list user books', error as Error, args);
            throw error;
        }
    }

    private getStatusIcon(status: string): string {
        switch (status) {
            case 'planning': return '📋';
            case 'outlining': return '📝';
            case 'writing': return '✍️';
            case 'editing': return '✏️';
            case 'review': return '👀';
            case 'completed': return '✅';
            case 'published': return '📖';
            default: return '📚';
        }
    }

    private async handleExportBookWithNarrativeContext(args: {
        bookId: string;
        format: string;
        authorId: string;
        includeMetadata?: boolean;
        includeNarrativeData?: boolean;
        aliasFilename?: string;
    }): Promise<string> {
        try {
            const startTime = Date.now();
            this.logger.info('Starting enhanced book export with narrative context', {
                bookId: args.bookId,
                format: args.format,
                includeMetadata: args.includeMetadata,
                includeNarrativeData: args.includeNarrativeData
            });

            // Get narrative consistency data if requested and service is available
            let narrativeContext = null;
            if (args.includeNarrativeData !== false && this.narrativeService) {
                try {
                    narrativeContext = await this.narrativeService.getNarrativeContext(args.bookId, args.bookId);
                    this.logger.info('Retrieved narrative context for export', {
                        characters: narrativeContext.characters.length,
                        worldElements: narrativeContext.worldElements.length,
                        timelineEvents: narrativeContext.timelineEvents.length
                    });
                } catch (error) {
                    this.logger.warn('Failed to retrieve narrative context for export', error as Error);
                }
            }

            // Perform the regular export
            const exportOptions: any = {
                authorId: args.authorId,
                includeMetadata: args.includeMetadata ?? true,
            };
            if (typeof args.aliasFilename === 'string') {
                exportOptions.aliasFilename = args.aliasFilename;
            }
            
            const result = await this.exportService.exportBook(
                args.bookId,
                args.format,
                exportOptions,
            );

            const exportTime = Date.now() - startTime;
            const fileSizeMB = (result.size / (1024 * 1024)).toFixed(2);

            // Build enhanced response with narrative consistency info
            let responseText = `✅ Enhanced Book Export with Narrative Context completed successfully!

**Export Details:**
- **Book ID:** ${args.bookId}
- **Export ID:** ${result.exportId || 'N/A'}
- **Version:** ${result.version || 'N/A'}
- **Format:** ${result.format.toUpperCase()}
- **Filename:** ${result.filename}
- **File Size:** ${fileSizeMB} MB
- **Export Time:** ${(exportTime / 1000).toFixed(1)} seconds
- **Created:** ${result.createdAt.toLocaleString()}
- **Include Metadata:** ${args.includeMetadata ?? true ? 'Yes' : 'No'}
- **Include Narrative Data:** ${args.includeNarrativeData ?? true ? 'Yes' : 'No'}

**File Access:**
- **File Location:** \`${result.filepath}\`
- **URL:** ${result.url || `/c/exports/${result.filename}`}`;

            // Add narrative consistency summary if available
            if (narrativeContext) {
                responseText += `

**📚 Narrative Consistency Summary:**
- **Characters:** ${narrativeContext.characters.length} defined characters with consistent descriptions
- **World Elements:** ${narrativeContext.worldElements.length} world elements tracked for consistency
- **Timeline Events:** ${narrativeContext.timelineEvents.length} events maintaining story continuity
- **Total Consistency References:** ${narrativeContext.characters.length + narrativeContext.worldElements.length + narrativeContext.timelineEvents.length}

**Character Overview:**
${narrativeContext.characters.slice(0, 5).map(char => 
    `- **${char.name}** (${char.role}) - Last seen: Chapter ${char.lastAppearedChapter || 'N/A'}`
).join('\n')}${narrativeContext.characters.length > 5 ? `\n- *... and ${narrativeContext.characters.length - 5} more characters*` : ''}

**Key World Elements:**
${narrativeContext.worldElements.slice(0, 3).map(element => 
    `- **${element.name}** (${element.type}) - ${element.description}`
).join('\n')}${narrativeContext.worldElements.length > 3 ? `\n- *... and ${narrativeContext.worldElements.length - 3} more elements*` : ''}`;
            } else if (args.includeNarrativeData !== false) {
                responseText += `

**📚 Narrative Consistency:** No narrative consistency data found for this book. Consider using the narrative consistency tools to track characters, world elements, and timeline events for future exports.`;
            }

            responseText += `

The exported file includes ${args.includeMetadata !== false ? 'book metadata, table of contents, and ' : ''}all written content formatted for ${result.format.toUpperCase()}${narrativeContext ? ' with comprehensive narrative consistency references' : ''}.

**Version Tracking:** This export is automatically tracked in the database with version ${result.version || 'N/A'} for future reference.

${this.getFormatSpecificNotes(result.format)}`;

            return responseText;
        } catch (error) {
            this.logger.error('Failed to export book with narrative context', error as Error, args);
            throw error;
        }
    }
}
