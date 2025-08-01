/**
 * Export Book MCP Tool
 *
 * Implements the export_book MCP tool for generating downloadable content.
 * Supports multiple export formats with customizable options.
 */

const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { FileSources } = require('librechat-data-provider');
const { createFile } = require('~/models');
const { getStrategyFunctions } = require('~/server/services/Files/strategies');
const BookService = require('../services/BookService');
const {
  validateExportBookParams,
  sanitizeAndValidate,
  formatValidationErrors,
} = require('../utils/validators');

/**
 * MCP Tool Definition for export_book
 */
const exportBookTool = {
  name: 'export_book',
  description:
    'Export a completed book in various formats (markdown, html, txt, json). Generates downloadable content with customizable formatting options.',
  inputSchema: {
    type: 'object',
    properties: {
      bookId: {
        type: 'string',
        description: 'The unique identifier of the book project to export',
      },
      format: {
        type: 'string',
        enum: ['markdown', 'html', 'txt', 'json', 'pdf'],
        default: 'markdown',
        description: 'Export format for the book content',
      },
      options: {
        type: 'object',
        description: 'Export formatting options',
        properties: {
          includeMetadata: {
            type: 'boolean',
            default: true,
            description: 'Include book metadata (title, author, creation date, etc.)',
          },
          includeTableOfContents: {
            type: 'boolean',
            default: true,
            description: 'Include a table of contents with chapter links',
          },
          includePageNumbers: {
            type: 'boolean',
            default: false,
            description: 'Include page numbers (for HTML and PDF formats)',
          },
          includeChapterSummaries: {
            type: 'boolean',
            default: false,
            description: 'Include chapter summaries in the export',
          },
          customTitle: {
            type: 'string',
            description: 'Override the book title for export',
          },
          authorName: {
            type: 'string',
            description: 'Author name to include in metadata',
          },
          includeGenerationInfo: {
            type: 'boolean',
            default: false,
            description: 'Include information about AI generation process',
          },
          chapterRange: {
            type: 'object',
            description: 'Export only specific chapters',
            properties: {
              start: {
                type: 'number',
                minimum: 1,
                description: 'Starting chapter number',
              },
              end: {
                type: 'number',
                minimum: 1,
                description: 'Ending chapter number',
              },
            },
          },
        },
      },
    },
    required: ['bookId'],
  },

  /**
   * Execute the export_book tool
   * @param {Object} params - Tool parameters
   * @param {Object} context - Execution context with user information
   * @returns {Promise<Object>} Tool execution result
   */
  async execute(params, context) {
    try {
      // Extract user ID from context
      const userId = context?.user?.id || context?.userId;
      if (!userId) {
        return {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required to export books',
          },
        };
      }

      // Sanitize and validate input parameters
      const validationResult = sanitizeAndValidate(params, validateExportBookParams);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: formatValidationErrors(validationResult.errors, 'Export book parameters'),
            details: {
              errors: validationResult.errors,
              receivedParams: Object.keys(params),
            },
          },
        };
      }

      const sanitizedParams = validationResult.params;

      // Validate export options
      const exportOptions = sanitizedParams.options || {};

      // Validate chapter range if provided
      if (exportOptions.chapterRange) {
        const { start, end } = exportOptions.chapterRange;
        if (start && end && start > end) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Chapter range start must be less than or equal to end',
              details: {
                providedRange: { start, end },
              },
            },
          };
        }
      }

      // Create book service instance
      const bookService = new BookService({
        models: context.serverModels || context.models,
      });

      // Export the book
      const exportResult = await bookService.exportBook(
        userId,
        sanitizedParams.bookId,
        sanitizedParams.format || 'markdown',
        {
          includeMetadata: exportOptions.includeMetadata !== false,
          includeTableOfContents: exportOptions.includeTableOfContents !== false,
          includePageNumbers: exportOptions.includePageNumbers || false,
          includeChapterSummaries: exportOptions.includeChapterSummaries || false,
          customTitle: exportOptions.customTitle,
          authorName: exportOptions.authorName,
          includeGenerationInfo: exportOptions.includeGenerationInfo || false,
          chapterRange: exportOptions.chapterRange,
        },
      );

      // Calculate export statistics
      const exportStats = this.calculateExportStatistics(exportResult);

      // Generate download instructions
      const downloadInstructions = this.generateDownloadInstructions(
        exportResult.format,
        exportResult.downloadInfo,
      );

      // Prepare export preview (first 500 characters)
      const contentPreview =
        exportResult.content.length > 500
          ? exportResult.content.substring(0, 500) + '...\n\n[Content truncated for preview]'
          : exportResult.content;

      // Save exported content as a downloadable file
      let fileInfo = null;
      try {
        fileInfo = await this.saveExportedFile({
          content: exportResult.content,
          filename: exportResult.downloadInfo.filename,
          mimeType: exportResult.downloadInfo.mimeType,
          userId,
          conversationId: context?.conversationId,
          bookTitle: exportResult.title,
          format: exportResult.format,
        });
      } catch (fileError) {
        console.warn('[ExportBookTool] Failed to save file to chat:', fileError);
        // Continue with export even if file saving fails
      }

      const responseData = {
        export: {
          bookId: exportResult.bookId,
          title: exportResult.title,
          format: exportResult.format,
          contentLength: exportResult.content.length,
          contentPreview: contentPreview,
          downloadInfo: {
            filename: exportResult.downloadInfo.filename,
            mimeType: exportResult.downloadInfo.mimeType,
            fileSize: exportResult.metadata.fileSize,
            estimatedDownloadTime: this.estimateDownloadTime(exportResult.metadata.fileSize),
          },
        },
        statistics: exportStats,
        metadata: {
          exportedAt: exportResult.metadata.exportedAt,
          originalWordCount: exportResult.metadata.wordCount,
          estimatedReadingTime: exportResult.metadata.estimatedReadingTime,
          exportOptions: exportOptions,
          processingTime: exportStats.processingTime,
        },
        downloadInstructions: downloadInstructions,
        alternativeFormats: this.suggestAlternativeFormats(sanitizedParams.format),
        content: exportResult.content, // Full content for download
      };

      // Add file information if file was successfully saved
      if (fileInfo) {
        responseData.file = {
          file_id: fileInfo.file_id,
          filename: fileInfo.filename,
          filepath: fileInfo.filepath,
          fileSize: fileInfo.bytes,
          mimeType: fileInfo.type,
          downloadUrl: fileInfo.filepath,
        };
        responseData.export.savedToChat = true;
      } else {
        responseData.export.savedToChat = false;
      }

      let message = `Book "${exportResult.title}" successfully exported as ${exportResult.format.toUpperCase()} format. File size: ${this.formatFileSize(exportResult.metadata.fileSize)}.`;

      if (fileInfo) {
        message += ` The exported file has been added to the chat and is available for download.`;
      }

      return {
        success: true,
        data: responseData,
        message: message,
      };
    } catch (error) {
      // Handle different types of errors
      if (error.name === 'BookServiceError') {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        };
      }

      // Handle specific export errors
      // Note: Completion requirement has been removed - books can be exported at any time

      if (error.message.includes('format not supported')) {
        return {
          success: false,
          error: {
            code: 'UNSUPPORTED_FORMAT',
            message: 'The requested export format is not supported',
            details: {
              supportedFormats: ['markdown', 'html', 'txt', 'json', 'pdf'],
            },
          },
        };
      }

      // Handle unexpected errors
      console.error('[ExportBookTool] Unexpected error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while exporting the book',
          details: {
            error: error.message,
          },
        },
      };
    }
  },

  /**
   * Calculate export statistics
   * @param {Object} exportResult - Export result from BookService
   * @returns {Object} Export statistics
   */
  calculateExportStatistics(exportResult) {
    const content = exportResult.content;
    const lines = content.split('\n');
    const words = content.split(/\s+/).filter((word) => word.length > 0);
    const characters = content.length;
    const charactersNoSpaces = content.replace(/\s/g, '').length;

    // Estimate reading time (average 200 words per minute)
    const estimatedReadingTime = Math.ceil(words.length / 200);

    // Count chapters (rough estimate based on format)
    let chapterCount = 0;
    if (exportResult.format === 'markdown') {
      chapterCount = (content.match(/^##\s+Chapter\s+\d+/gm) || []).length;
    } else if (exportResult.format === 'html') {
      chapterCount = (content.match(/<h2[^>]*>Chapter\s+\d+/gi) || []).length;
    } else {
      chapterCount = (content.match(/Chapter\s+\d+/gi) || []).length;
    }

    return {
      content: {
        totalWords: words.length,
        totalCharacters: characters,
        totalCharactersNoSpaces: charactersNoSpaces,
        totalLines: lines.length,
        averageWordsPerLine: Math.round(words.length / lines.length),
        chapterCount: chapterCount,
        averageWordsPerChapter: chapterCount > 0 ? Math.round(words.length / chapterCount) : 0,
      },
      readability: {
        estimatedReadingTime: estimatedReadingTime,
        averageWordsPerSentence: this.calculateAverageWordsPerSentence(content),
        readabilityScore: this.calculateSimpleReadabilityScore(words, content),
      },
      format: {
        formatSpecificElements: this.countFormatSpecificElements(content, exportResult.format),
        compressionRatio: this.calculateCompressionRatio(content, exportResult.format),
      },
      processingTime:
        Date.now() -
        (exportResult.metadata.exportedAt
          ? new Date(exportResult.metadata.exportedAt).getTime()
          : Date.now()),
    };
  },

  /**
   * Generate download instructions based on format
   * @param {string} format - Export format
   * @param {Object} downloadInfo - Download information
   * @returns {Object} Download instructions
   */
  generateDownloadInstructions(format, downloadInfo) {
    const instructions = {
      format: format,
      filename: downloadInfo.filename,
      steps: [],
      recommendations: [],
    };

    switch (format) {
      case 'markdown':
        instructions.steps = [
          'Copy the content from the response',
          `Save it as "${downloadInfo.filename}"`,
          'Open with any text editor or Markdown viewer',
        ];
        instructions.recommendations = [
          'Use Typora, Mark Text, or VS Code for best viewing experience',
          'Convert to PDF using Pandoc if needed',
          'Compatible with GitHub, GitLab, and most documentation platforms',
        ];
        break;

      case 'html':
        instructions.steps = [
          'Copy the HTML content from the response',
          `Save it as "${downloadInfo.filename}"`,
          'Open with any web browser',
        ];
        instructions.recommendations = [
          'Print to PDF from browser for physical copies',
          'Customize CSS styling if needed',
          'Compatible with all web browsers',
        ];
        break;

      case 'txt':
        instructions.steps = [
          'Copy the plain text content',
          `Save it as "${downloadInfo.filename}"`,
          'Open with any text editor',
        ];
        instructions.recommendations = [
          'Universal compatibility with all devices',
          'Easy to import into word processors',
          'Smallest file size for sharing',
        ];
        break;

      case 'json':
        instructions.steps = [
          'Copy the JSON data from the response',
          `Save it as "${downloadInfo.filename}"`,
          'Use for programmatic access or data analysis',
        ];
        instructions.recommendations = [
          'Use JSON viewers for better formatting',
          'Import into databases or applications',
          'Preserve all metadata and structure',
        ];
        break;

      case 'pdf':
        instructions.steps = [
          'The PDF content is provided as base64 encoded data',
          'Decode the base64 content to binary',
          `Save the binary data as "${downloadInfo.filename}"`,
          'Open with any PDF viewer',
        ];
        instructions.recommendations = [
          'Professional document format ideal for printing',
          'Preserves formatting and layout perfectly',
          'Can be easily shared and viewed on any device',
          'Includes automatic page numbering and table of contents',
        ];
        break;
    }

    return instructions;
  },

  /**
   * Suggest alternative export formats
   * @param {string} currentFormat - Current export format
   * @returns {Array} Alternative format suggestions
   */
  suggestAlternativeFormats(currentFormat) {
    const allFormats = {
      markdown: {
        name: 'Markdown',
        description: 'Best for documentation and web publishing',
        useCase: 'GitHub, blogs, technical documentation',
      },
      html: {
        name: 'HTML',
        description: 'Best for web viewing and printing',
        useCase: 'Web browsers, PDF conversion, styling',
      },
      txt: {
        name: 'Plain Text',
        description: 'Universal compatibility and smallest size',
        useCase: 'Simple sharing, email, basic editing',
      },
      json: {
        name: 'JSON',
        description: 'Structured data with all metadata',
        useCase: 'Programming, data analysis, backup',
      },
      pdf: {
        name: 'PDF',
        description: 'Professional document format with formatting',
        useCase: 'Printing, sharing, professional presentation',
      },
    };

    return Object.entries(allFormats)
      .filter(([format]) => format !== currentFormat)
      .map(([format, info]) => ({
        format,
        ...info,
      }));
  },

  /**
   * Calculate average words per sentence
   * @param {string} content - Content to analyze
   * @returns {number} Average words per sentence
   */
  calculateAverageWordsPerSentence(content) {
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const words = content.split(/\s+/).filter((word) => word.length > 0);
    return sentences.length > 0 ? Math.round(words.length / sentences.length) : 0;
  },

  /**
   * Calculate simple readability score
   * @param {Array} words - Array of words
   * @param {string} content - Full content
   * @returns {string} Readability level
   */
  calculateSimpleReadabilityScore(words, content) {
    const avgWordsPerSentence = this.calculateAverageWordsPerSentence(content);
    const avgSyllablesPerWord = this.estimateAverageSyllables(words);

    // Simple readability estimate
    const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;

    if (score >= 90) return 'Very Easy';
    if (score >= 80) return 'Easy';
    if (score >= 70) return 'Fairly Easy';
    if (score >= 60) return 'Standard';
    if (score >= 50) return 'Fairly Difficult';
    if (score >= 30) return 'Difficult';
    return 'Very Difficult';
  },

  /**
   * Estimate average syllables per word
   * @param {Array} words - Array of words
   * @returns {number} Average syllables per word
   */
  estimateAverageSyllables(words) {
    const totalSyllables = words.reduce((sum, word) => {
      return sum + this.countSyllables(word);
    }, 0);
    return words.length > 0 ? totalSyllables / words.length : 0;
  },

  /**
   * Count syllables in a word (simple estimation)
   * @param {string} word - Word to count syllables for
   * @returns {number} Estimated syllable count
   */
  countSyllables(word) {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;

    const vowels = 'aeiouy';
    let syllableCount = 0;
    let previousWasVowel = false;

    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i]);
      if (isVowel && !previousWasVowel) {
        syllableCount++;
      }
      previousWasVowel = isVowel;
    }

    // Handle silent 'e'
    if (word.endsWith('e')) {
      syllableCount--;
    }

    return Math.max(1, syllableCount);
  },

  /**
   * Count format-specific elements
   * @param {string} content - Content to analyze
   * @param {string} format - Export format
   * @returns {Object} Element counts
   */
  countFormatSpecificElements(content, format) {
    const elements = {};

    switch (format) {
      case 'markdown':
        elements.headers = (content.match(/^#+\s/gm) || []).length;
        elements.links = (content.match(/\[.*?\]\(.*?\)/g) || []).length;
        elements.codeBlocks = (content.match(/```[\s\S]*?```/g) || []).length;
        elements.emphasis = (content.match(/\*.*?\*/g) || []).length;
        break;

      case 'html':
        elements.tags = (content.match(/<[^>]+>/g) || []).length;
        elements.paragraphs = (content.match(/<p[^>]*>/g) || []).length;
        elements.headers = (content.match(/<h[1-6][^>]*>/g) || []).length;
        elements.links = (content.match(/<a[^>]*>/g) || []).length;
        break;

      case 'txt':
        elements.paragraphs = content.split('\n\n').length;
        elements.lines = content.split('\n').length;
        break;

      case 'json':
        try {
          const parsed = JSON.parse(content);
          elements.objects = this.countJsonObjects(parsed);
          elements.arrays = this.countJsonArrays(parsed);
          elements.properties = this.countJsonProperties(parsed);
        } catch (e) {
          elements.parseError = true;
        }
        break;
    }

    return elements;
  },

  /**
   * Calculate compression ratio for different formats
   * @param {string} content - Content to analyze
   * @param {string} format - Export format
   * @returns {number} Compression ratio
   */
  calculateCompressionRatio(content, format) {
    const baseSize = content.length;

    // Estimate compressed size based on format characteristics
    let estimatedCompressedSize = baseSize;

    switch (format) {
      case 'html':
        // HTML has more markup overhead
        estimatedCompressedSize = baseSize * 0.7; // Assuming 30% compression
        break;
      case 'json':
        // JSON has structural overhead but compresses well
        estimatedCompressedSize = baseSize * 0.6; // Assuming 40% compression
        break;
      case 'markdown':
        // Markdown is already fairly compact
        estimatedCompressedSize = baseSize * 0.8; // Assuming 20% compression
        break;
      case 'txt':
        // Plain text compresses best
        estimatedCompressedSize = baseSize * 0.5; // Assuming 50% compression
        break;
    }

    return baseSize > 0 ? estimatedCompressedSize / baseSize : 1;
  },

  /**
   * Count JSON objects recursively
   * @param {any} obj - Object to count
   * @returns {number} Object count
   */
  countJsonObjects(obj) {
    if (typeof obj !== 'object' || obj === null) return 0;
    if (Array.isArray(obj)) {
      return obj.reduce((sum, item) => sum + this.countJsonObjects(item), 0);
    }
    return 1 + Object.values(obj).reduce((sum, value) => sum + this.countJsonObjects(value), 0);
  },

  /**
   * Count JSON arrays recursively
   * @param {any} obj - Object to count
   * @returns {number} Array count
   */
  countJsonArrays(obj) {
    if (typeof obj !== 'object' || obj === null) return 0;
    if (Array.isArray(obj)) {
      return 1 + obj.reduce((sum, item) => sum + this.countJsonArrays(item), 0);
    }
    return Object.values(obj).reduce((sum, value) => sum + this.countJsonArrays(value), 0);
  },

  /**
   * Count JSON properties recursively
   * @param {any} obj - Object to count
   * @returns {number} Property count
   */
  countJsonProperties(obj) {
    if (typeof obj !== 'object' || obj === null) return 0;
    if (Array.isArray(obj)) {
      return obj.reduce((sum, item) => sum + this.countJsonProperties(item), 0);
    }
    return (
      Object.keys(obj).length +
      Object.values(obj).reduce((sum, value) => sum + this.countJsonProperties(value), 0)
    );
  },

  /**
   * Estimate download time based on file size
   * @param {number} fileSize - File size in bytes
   * @returns {string} Estimated download time
   */
  estimateDownloadTime(fileSize) {
    // Assume average broadband speed of 25 Mbps (3.125 MB/s)
    const speedMBps = 3.125;
    const timeSecs = fileSize / (speedMBps * 1024 * 1024);

    if (timeSecs < 1) return 'Instant';
    if (timeSecs < 60) return `${Math.ceil(timeSecs)} seconds`;
    return `${Math.ceil(timeSecs / 60)} minutes`;
  },

  /**
   * Format file size for display
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * Save exported content as a downloadable file in LibreChat
   * @param {Object} params - File save parameters
   * @param {string} params.content - File content to save
   * @param {string} params.filename - Original filename
   * @param {string} params.mimeType - MIME type of the file
   * @param {string} params.userId - User ID
   * @param {string} params.conversationId - Conversation ID (optional)
   * @param {string} params.bookTitle - Book title for display
   * @param {string} params.format - Export format
   * @returns {Promise<Object>} File metadata
   */
  async saveExportedFile({
    content,
    filename,
    mimeType,
    userId,
    conversationId,
    bookTitle,
    format,
  }) {
    try {
      // Get the current file strategy from the global app context
      // Default to local if not specified
      const fileStrategy = global.app?.locals?.fileStrategy || FileSources.local;
      const { saveBuffer } = getStrategyFunctions(fileStrategy);

      if (!saveBuffer) {
        throw new Error(`File saving not supported for strategy: ${fileStrategy}`);
      }

      // Convert content to buffer
      const buffer = Buffer.from(content, 'utf8');

      // Generate unique file ID
      const file_id = uuidv4();

      // Create a safe filename by removing/replacing problematic characters
      const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

      // Save the file using the current strategy
      const filepath = await saveBuffer({
        userId,
        buffer,
        fileName: safeFilename,
        basePath: 'uploads', // Use uploads directory for book exports
      });

      // Create file entry in database
      const fileData = {
        user: userId,
        conversationId: conversationId || null,
        file_id: file_id,
        bytes: buffer.length,
        filename: safeFilename,
        filepath: filepath,
        object: 'file',
        type: mimeType,
        source: fileStrategy,
        context: `Book export: ${bookTitle} (${format.toUpperCase()})`,
        usage: 1, // Initial usage count
      };

      // Save to database without TTL (permanent file)
      const dbFile = await createFile(fileData, true);

      return {
        file_id: dbFile.file_id,
        filename: dbFile.filename,
        filepath: dbFile.filepath,
        bytes: dbFile.bytes,
        type: dbFile.type,
        source: dbFile.source,
      };
    } catch (error) {
      console.error('[ExportBookTool] Error saving exported file:', error);
      throw error;
    }
  },
};

module.exports = exportBookTool;
