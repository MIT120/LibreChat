/**
 * Export Tool Handlers - MCP tools for book export functionality
 */

import { ILogger } from '../../core/Logger.js';
import { IExportService, IToolHandler } from '../../interfaces/index.js';

export class ExportToolHandlers {
    private logger: ILogger;
    private exportService: IExportService;

    constructor(logger: ILogger, exportService: IExportService) {
        this.logger = logger.child('ExportToolHandlers');
        this.exportService = exportService;
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
                        includeMetadata: {
                            type: 'boolean',
                            description: 'Include book metadata in export (default: true)',
                            default: true,
                        },
                    },
                    required: ['bookId', 'format', 'authorId'],
                },
                handler: this.handleExportBook.bind(this),
            },
        ];
    }

    private async handleExportBook(args: {
        bookId: string;
        format: string;
        authorId: string;
        includeMetadata?: boolean;
    }): Promise<string> {
        try {
            const startTime = Date.now();
            this.logger.info('Starting book export', {
                bookId: args.bookId,
                format: args.format,
                includeMetadata: args.includeMetadata
            });

            const result = await this.exportService.exportBook(args.bookId, args.format, {
                authorId: args.authorId,
                includeMetadata: args.includeMetadata ?? true,
            });

            const exportTime = Date.now() - startTime;
            const fileSizeMB = (result.size / (1024 * 1024)).toFixed(2);

            return `✅ Book exported successfully!

**Export Details:**
- **Book ID:** ${args.bookId}
- **Format:** ${result.format.toUpperCase()}
- **Filename:** ${result.filename}
- **File Size:** ${fileSizeMB} MB
- **Export Time:** ${(exportTime / 1000).toFixed(1)} seconds
- **Created:** ${result.createdAt.toLocaleString()}
- **Include Metadata:** ${args.includeMetadata ?? true ? 'Yes' : 'No'}

**File Location:**
\`${result.filepath}\`

The exported file is ready for download or sharing. The export includes ${args.includeMetadata !== false ? 'book metadata, table of contents, and ' : ''}all written content formatted for ${result.format.toUpperCase()}.

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
}
