/**
 * Standardized response formatters to reduce code duplication across tool handlers
 */

import { BookResponse, ChapterResponse, PageResponse } from '../../types/book.js';

/**
 * Configuration for formatting responses
 */
export interface FormatConfig {
    includeTimestamps?: boolean;
    includeWordCounts?: boolean;
    includeProgress?: boolean;
    maxDescriptionLength?: number;
}

/**
 * Default format configuration
 */
const DEFAULT_CONFIG: FormatConfig = {
    includeTimestamps: true,
    includeWordCounts: true,
    includeProgress: true,
    maxDescriptionLength: 200,
};

/**
 * Utility functions for common formatting tasks
 */
export class FormatUtils {
    /**
     * Format a date consistently
     */
    static formatDate(date: string | Date): string {
        return new Date(date).toLocaleDateString();
    }

    /**
     * Format a number with thousand separators
     */
    static formatNumber(num: number): string {
        return num.toLocaleString();
    }

    /**
     * Calculate progress percentage
     */
    static calculateProgress(current: number, target: number): number {
        if (target <= 0) return 0;
        return Math.round((current / target) * 100);
    }

    /**
     * Truncate text to specified length
     */
    static truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    /**
     * Format word count with optional target
     */
    static formatWordCount(current: number, target?: number): string {
        const currentFormatted = this.formatNumber(current);
        if (!target) return `${currentFormatted} words`;
        
        const targetFormatted = this.formatNumber(target);
        const progress = this.calculateProgress(current, target);
        return `${currentFormatted} / ${targetFormatted} words (${progress}%)`;
    }

    /**
     * Create a status badge
     */
    static formatStatus(status: string): string {
        const statusEmojis: Record<string, string> = {
            'planning': '📋',
            'outlining': '📝',
            'writing': '✍️',
            'editing': '✏️',
            'review': '👀',
            'completed': '✅',
            'published': '🚀',
            'planned': '📋',
            'in_progress': '⏳',
            'draft': '📝',
            'approved': '✅',
        };
        
        const emoji = statusEmojis[status] || '📄';
        return `${emoji} ${status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}`;
    }
}

/**
 * Book response formatters
 */
export class BookFormatters {
    /**
     * Format a book creation success response
     */
    static created(book: BookResponse, config: FormatConfig = DEFAULT_CONFIG): string {
        let response = `✅ Book created successfully!\n\n`;
        response += `**Book Details:**\n`;
        response += `- **ID:** ${book._id}\n`;
        response += `- **Title:** ${book.title}`;
        
        if (book.subtitle) {
            response += `\n- **Subtitle:** ${book.subtitle}`;
        }
        
        response += `\n- **Theme:** ${book.theme}`;
        response += `\n- **Genre:** ${book.genre}`;
        response += `\n- **Target Audience:** ${book.targetAudience || 'Not specified'}`;
        
        if (book.writingStyle) {
            response += `\n- **Writing Style:** ${book.writingStyle.tone} tone, ${book.writingStyle.voice} voice`;
        }
        
        if (config.includeWordCounts && book.targetWordCount) {
            response += `\n- **Target Word Count:** ${FormatUtils.formatNumber(book.targetWordCount)}`;
        }
        
        response += `\n- **Status:** ${FormatUtils.formatStatus(book.status)}`;
        
        if (config.includeTimestamps) {
            response += `\n- **Created:** ${FormatUtils.formatDate(book.createdAt)}`;
        }
        
        response += `\n\nThe book is ready for chapter creation and content development!`;
        
        return response;
    }

    /**
     * Format a book detail response
     */
    static detail(book: BookResponse, config: FormatConfig = DEFAULT_CONFIG): string {
        let response = `📖 **${book.title}**`;
        
        if (book.subtitle) {
            response += `\n*${book.subtitle}*`;
        }
        
        response += `\n\n**Book Information:**\n`;
        response += `- **ID:** ${book._id}\n`;
        response += `- **Theme:** ${book.theme}\n`;
        response += `- **Genre:** ${book.genre}\n`;
        response += `- **Target Audience:** ${book.targetAudience || 'Not specified'}\n`;
        response += `- **Status:** ${FormatUtils.formatStatus(book.status)}\n`;
        
        if (config.includeWordCounts) {
            response += `- **Word Count:** ${FormatUtils.formatWordCount(book.currentWordCount, book.targetWordCount)}\n`;
        }
        
        if (config.includeTimestamps) {
            response += `- **Created:** ${FormatUtils.formatDate(book.createdAt)}\n`;
            response += `- **Last Updated:** ${FormatUtils.formatDate(book.updatedAt)}\n`;
        }
        
        if (book.writingStyle) {
            response += `\n**Writing Style:**\n`;
            response += `- **Tone:** ${book.writingStyle.tone}\n`;
            response += `- **Voice:** ${book.writingStyle.voice}\n`;
            response += `- **Vocabulary:** ${book.writingStyle.vocabulary}\n`;
            response += `- **Sentence Structure:** ${book.writingStyle.sentenceStructure}\n`;
            
            if (book.writingStyle.specialInstructions) {
                response += `- **Special Instructions:** ${book.writingStyle.specialInstructions}\n`;
            }
        }
        
        if (book.description) {
            const description = config.maxDescriptionLength 
                ? FormatUtils.truncateText(book.description, config.maxDescriptionLength)
                : book.description;
            response += `\n**Description:**\n${description}\n`;
        }
        
        return response;
    }

    /**
     * Format a book list item
     */
    static listItem(book: BookResponse, index: number, config: FormatConfig = DEFAULT_CONFIG): string {
        let response = `**${index + 1}. ${book.title}**\n`;
        response += `- ID: ${book._id}\n`;
        response += `- Genre: ${book.genre}\n`;
        response += `- Status: ${FormatUtils.formatStatus(book.status)}\n`;
        
        if (config.includeWordCounts) {
            response += `- Progress: ${FormatUtils.formatWordCount(book.currentWordCount, book.targetWordCount)}\n`;
        }
        
        if (config.includeTimestamps) {
            response += `- Last Updated: ${FormatUtils.formatDate(book.updatedAt)}\n`;
        }
        
        return response;
    }

    /**
     * Format book update success response
     */
    static updated(book: BookResponse, updatedFields: string[], config: FormatConfig = DEFAULT_CONFIG): string {
        let response = `✅ Book updated successfully!\n\n`;
        response += `**Updated Book: ${book.title}**\n`;
        response += `- **ID:** ${book._id}\n`;
        response += `- **Updated Fields:** ${updatedFields.join(', ')}\n`;
        response += `- **Status:** ${FormatUtils.formatStatus(book.status)}\n`;
        
        if (config.includeWordCounts) {
            response += `- **Word Count:** ${FormatUtils.formatNumber(book.currentWordCount)}\n`;
        }
        
        if (config.includeTimestamps) {
            response += `- **Last Updated:** ${FormatUtils.formatDate(book.updatedAt)}\n`;
        }
        
        response += `\nThe book information has been updated with the new values.`;
        
        return response;
    }
}

/**
 * Chapter response formatters
 */
export class ChapterFormatters {
    /**
     * Format a chapter creation success response
     */
    static created(chapter: ChapterResponse, config: FormatConfig = DEFAULT_CONFIG): string {
        let response = `✅ Chapter created successfully!\n\n`;
        response += `**Chapter Details:**\n`;
        response += `- **ID:** ${chapter._id}\n`;
        response += `- **Book ID:** ${chapter.bookId}\n`;
        response += `- **Chapter Number:** ${chapter.chapterNumber}\n`;
        response += `- **Title:** ${chapter.title}\n`;
        response += `- **Description:** ${chapter.description || 'Not provided'}\n`;
        
        if (config.includeWordCounts && chapter.targetWordCount) {
            response += `- **Target Word Count:** ${FormatUtils.formatNumber(chapter.targetWordCount)}\n`;
        }
        
        response += `- **Status:** ${FormatUtils.formatStatus(chapter.status)}\n`;
        
        if (config.includeTimestamps) {
            response += `- **Created:** ${FormatUtils.formatDate(chapter.createdAt)}\n`;
        }
        
        response += `\nThe chapter is ready for page creation and content development!`;
        
        return response;
    }

    /**
     * Format a chapter detail response
     */
    static detail(chapter: ChapterResponse, config: FormatConfig = DEFAULT_CONFIG): string {
        let response = `📝 **Chapter ${chapter.chapterNumber}: ${chapter.title}**\n\n`;
        response += `**Chapter Information:**\n`;
        response += `- **ID:** ${chapter._id}\n`;
        response += `- **Book ID:** ${chapter.bookId}\n`;
        response += `- **Status:** ${FormatUtils.formatStatus(chapter.status)}\n`;
        
        if (config.includeWordCounts) {
            response += `- **Word Count:** ${FormatUtils.formatWordCount(chapter.wordCount, chapter.targetWordCount)}\n`;
        }
        
        if (config.includeTimestamps) {
            response += `- **Created:** ${FormatUtils.formatDate(chapter.createdAt)}\n`;
            response += `- **Last Updated:** ${FormatUtils.formatDate(chapter.updatedAt)}\n`;
        }
        
        if (chapter.description) {
            const description = config.maxDescriptionLength 
                ? FormatUtils.truncateText(chapter.description, config.maxDescriptionLength)
                : chapter.description;
            response += `\n**Description:**\n${description}\n`;
        }
        
        return response;
    }

    /**
     * Format a chapter list item
     */
    static listItem(chapter: ChapterResponse, index: number, config: FormatConfig = DEFAULT_CONFIG): string {
        let response = `- Chapter ${chapter.chapterNumber}: ${chapter.title}`;
        
        if (config.includeWordCounts) {
            response += ` (${FormatUtils.formatWordCount(chapter.wordCount, chapter.targetWordCount)})`;
        }
        
        response += ` - ${FormatUtils.formatStatus(chapter.status)}`;
        
        return response;
    }
}

/**
 * Page response formatters
 */
export class PageFormatters {
    /**
     * Format a page creation success response
     */
    static created(page: PageResponse, config: FormatConfig = DEFAULT_CONFIG): string {
        let response = `✅ Page created successfully!\n\n`;
        response += `**Page Details:**\n`;
        response += `- **ID:** ${page._id}\n`;
        response += `- **Chapter ID:** ${page.chapterId}\n`;
        response += `- **Page Number:** ${page.pageNumber}\n`;
        response += `- **Title:** ${page.title}\n`;
        
        if (config.includeWordCounts) {
            response += `- **Word Count:** ${FormatUtils.formatNumber(page.wordCount)}\n`;
        }
        
        response += `- **Status:** ${FormatUtils.formatStatus(page.status)}\n`;
        
        if (config.includeTimestamps) {
            response += `- **Created:** ${FormatUtils.formatDate(page.createdAt)}\n`;
        }
        
        response += `\nThe page is ready for content development!`;
        
        return response;
    }

    /**
     * Format a page detail response
     */
    static detail(page: PageResponse, config: FormatConfig = DEFAULT_CONFIG): string {
        let response = `📄 **Page ${page.pageNumber}: ${page.title}**\n\n`;
        response += `**Page Information:**\n`;
        response += `- **ID:** ${page._id}\n`;
        response += `- **Chapter ID:** ${page.chapterId}\n`;
        response += `- **Status:** ${FormatUtils.formatStatus(page.status)}\n`;
        
        if (config.includeWordCounts) {
            response += `- **Word Count:** ${FormatUtils.formatNumber(page.wordCount)}\n`;
        }
        
        if (config.includeTimestamps) {
            response += `- **Created:** ${FormatUtils.formatDate(page.createdAt)}\n`;
            response += `- **Last Updated:** ${FormatUtils.formatDate(page.updatedAt)}\n`;
        }
        
        return response;
    }

    /**
     * Format a page list item
     */
    static listItem(page: PageResponse, index: number, config: FormatConfig = DEFAULT_CONFIG): string {
        let response = `  - Page ${page.pageNumber}: ${page.title}`;
        
        if (config.includeWordCounts) {
            response += ` (${FormatUtils.formatNumber(page.wordCount)} words)`;
        }
        
        response += ` - ${FormatUtils.formatStatus(page.status)}`;
        
        return response;
    }
}

/**
 * Statistics and analytics formatters
 */
export class StatisticsFormatters {
    /**
     * Format book statistics response
     */
    static bookStatistics(stats: any): string {
        let response = `📊 **Statistics for "${stats.bookInfo.title}"**\n\n`;
        
        // Basic info
        response += `**Book Information:**\n`;
        response += `- **ID:** ${stats.bookInfo.id}\n`;
        response += `- **Genre:** ${stats.bookInfo.genre}\n`;
        response += `- **Theme:** ${stats.bookInfo.theme}\n`;
        response += `- **Status:** ${FormatUtils.formatStatus(stats.bookInfo.status)}\n\n`;
        
        // Progress
        response += `**Progress:**\n`;
        response += `- **Completion:** ${stats.progress.completionPercentage}%\n`;
        response += `- **Current Words:** ${FormatUtils.formatNumber(stats.progress.currentWordCount)}\n`;
        response += `- **Target Words:** ${FormatUtils.formatNumber(stats.progress.targetWordCount)}\n`;
        response += `- **Words Remaining:** ${FormatUtils.formatNumber(stats.progress.wordsRemaining)}\n\n`;
        
        // Chapters
        response += `**Chapters:**\n`;
        response += `- **Total:** ${stats.chapters.total}\n`;
        response += `- **Completed:** ${stats.chapters.completed}\n`;
        response += `- **Status Breakdown:**\n`;
        Object.entries(stats.chapters.statusBreakdown).forEach(([status, count]) => {
            response += `  - ${FormatUtils.formatStatus(status)}: ${count}\n`;
        });
        response += `\n`;
        
        // Pages
        response += `**Pages:**\n`;
        response += `- **Total:** ${stats.pages.total}\n`;
        response += `- **Completed:** ${stats.pages.completed}\n`;
        response += `- **Status Breakdown:**\n`;
        Object.entries(stats.pages.statusBreakdown).forEach(([status, count]) => {
            response += `  - ${FormatUtils.formatStatus(status)}: ${count}\n`;
        });
        
        response += `\n**Last Updated:** ${new Date(stats.lastUpdated).toLocaleString()}`;
        
        return response;
    }
}

/**
 * Generic formatters for common operations
 */
export class GenericFormatters {
    /**
     * Format a creation success response
     */
    static created(entityType: string, entity: any): string {
        const timestamp = new Date().toLocaleDateString();
        let response = `✅ ${entityType} created successfully!\n\n`;
        
        if (entity._id) {
            response += `**${entityType} ID:** ${entity._id}\n`;
        }
        
        if (entity.title || entity.name) {
            response += `**Title:** ${entity.title || entity.name}\n`;
        }
        
        response += `**Created:** ${timestamp}\n`;
        
        return response;
    }

    /**
     * Format an update success response
     */
    static updated(entityType: string, entity: any): string {
        const timestamp = new Date().toLocaleDateString();
        let response = `✅ ${entityType} updated successfully!\n\n`;
        
        if (entity._id) {
            response += `**${entityType} ID:** ${entity._id}\n`;
        }
        
        if (entity.title || entity.name) {
            response += `**Title:** ${entity.title || entity.name}\n`;
        }
        
        response += `**Updated:** ${timestamp}\n`;
        
        return response;
    }

    /**
     * Format a deletion success response
     */
    static deleted(entityType: string, entityId: string): string {
        return `✅ ${entityType} deleted successfully!\n\n` +
               `**Deleted ${entityType} ID:** ${entityId}\n\n` +
               `The ${entityType.toLowerCase()} and all associated content have been permanently removed from the system.`;
    }

    /**
     * Format an error response
     */
    static error(operation: string, error: Error): string {
        return `❌ Failed to ${operation}\n\n` +
               `**Error:** ${error.message}\n\n` +
               `Please check your input and try again.`;
    }

    /**
     * Format a not found response
     */
    static notFound(entityType: string, entityId: string): string {
        return `❌ ${entityType} not found\n\n` +
               `No ${entityType.toLowerCase()} found with ID: ${entityId}\n\n` +
               `Please verify the ID and try again.`;
    }

    /**
     * Format a validation error response
     */
    static validationError(errors: Array<{ field: string; message: string }>): string {
        let response = `❌ Validation failed\n\n**Issues found:**\n`;
        errors.forEach(error => {
            response += `- **${error.field}:** ${error.message}\n`;
        });
        response += `\nPlease correct these issues and try again.`;
        return response;
    }
}
