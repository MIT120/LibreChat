const ProgressService = require('./ProgressService');
const BookModel = require('../models/Book');
const ChapterModel = require('../models/Chapter');

// Use console for logging in MCP server context
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  debug: (...args) => console.log('[DEBUG]', ...args),
};

/**
 * Service for formatting status messages and progress indicators for the chat interface
 */
class StatusMessageService {
  /**
   * Generate a comprehensive status update for a book
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Formatted status message
   */
  static async generateBookStatusUpdate(bookId, userId) {
    try {
      const progress = await ProgressService.getCurrentProgress(bookId, userId);
      const book = await BookModel.findByIdAndUser(bookId, userId);

      if (!progress || !book) {
        return this.createErrorMessage('Book or progress tracking not found');
      }

      const statusMessage = await ProgressService.generateStatusMessage(bookId, userId);
      const progressIndicator = this.createProgressIndicator(progress);
      const actionButtons = this.createActionButtons(progress, book);

      return {
        ...statusMessage,
        progressIndicator,
        actionButtons,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('[StatusMessageService] Error generating book status update:', error);
      return this.createErrorMessage('Error retrieving book status');
    }
  }

  /**
   * Generate status messages for different workflow stages
   * @param {string} stage - Workflow stage
   * @param {Object} data - Stage-specific data
   * @returns {Object} Formatted status message
   */
  static generateWorkflowStageMessage(stage, data) {
    const messages = {
      book_creation_started: {
        type: 'info',
        icon: '📚',
        title: 'Book Creation Started',
        message: `Starting to create "${data.title}" with ${data.chapterCount} chapters`,
        details: `Theme: ${data.theme} | Genre: ${data.genre}`,
        showProgress: false,
      },

      outline_generating: {
        type: 'progress',
        icon: '⚡',
        title: 'Generating Outline',
        message: 'AI is creating your book outline...',
        details: 'This may take a few moments',
        showProgress: true,
        indeterminate: true,
      },

      outline_ready: {
        type: 'waiting',
        icon: '📝',
        title: 'Outline Ready for Review',
        message: `Generated outline with ${data.chapterCount} chapters`,
        details: 'Please review and approve to begin chapter generation',
        showProgress: false,
        requiresAction: true,
        actionText: 'Review Outline',
      },

      chapter_generating: {
        type: 'progress',
        icon: '✍️',
        title: 'Generating Chapter',
        message: `Creating Chapter ${data.chapterNumber}: "${data.chapterTitle}"`,
        details: `Progress: ${data.completedChapters}/${data.totalChapters} chapters completed`,
        showProgress: true,
        progress: Math.round((data.completedChapters / data.totalChapters) * 100),
      },

      chapter_ready: {
        type: 'waiting',
        icon: '👀',
        title: 'Chapter Ready for Review',
        message: `Chapter ${data.chapterNumber} is ready: "${data.chapterTitle}"`,
        details: `${data.wordCount} words | Est. reading time: ${data.estimatedReadingTime} min`,
        showProgress: false,
        requiresAction: true,
        actionText: 'Review Chapter',
      },

      chapter_approved: {
        type: 'success',
        icon: '✅',
        title: 'Chapter Approved',
        message: `Chapter ${data.chapterNumber} approved and saved`,
        details: `${data.completedChapters}/${data.totalChapters} chapters completed (${data.percentComplete}%)`,
        showProgress: true,
        progress: data.percentComplete,
      },

      chapter_rejected: {
        type: 'warning',
        icon: '❌',
        title: 'Chapter Needs Revision',
        message: `Chapter ${data.chapterNumber} requires changes`,
        details: data.feedback ? `Feedback: ${data.feedback}` : 'Please provide feedback for regeneration',
        showProgress: false,
        requiresAction: true,
        actionText: 'Regenerate Chapter',
      },

      book_completed: {
        type: 'success',
        icon: '🎉',
        title: 'Book Completed!',
        message: `"${data.title}" is now complete`,
        details: `${data.totalChapters} chapters | ${data.totalWords?.toLocaleString()} words | Ready for export`,
        showProgress: true,
        progress: 100,
        celebratory: true,
      },

      export_ready: {
        type: 'info',
        icon: '📤',
        title: 'Export Options Available',
        message: 'Your book is ready for download',
        details: 'Available formats: Markdown, HTML, PDF, EPUB',
        showProgress: false,
        requiresAction: true,
        actionText: 'Export Book',
      },

      error_occurred: {
        type: 'error',
        icon: '⚠️',
        title: 'Error Occurred',
        message: data.message || 'An unexpected error occurred',
        details: data.details || 'Please try again or contact support',
        showProgress: false,
        requiresAction: false,
      },
    };

    const baseMessage = messages[stage] || messages.error_occurred;

    return {
      ...baseMessage,
      stage,
      timestamp: new Date().toISOString(),
      data,
    };
  }

  /**
   * Create a visual progress indicator
   * @param {Object} progress - Progress data
   * @returns {Object} Progress indicator configuration
   */
  static createProgressIndicator(progress) {
    const { percentComplete, completedChapters, totalChapters, currentPhase } = progress;

    // Create visual progress bar
    const barLength = 20;
    const filledLength = Math.round((percentComplete / 100) * barLength);
    const emptyLength = barLength - filledLength;
    const progressBar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);

    // Phase-specific indicators
    const phaseIndicators = {
      outline: '📝 Outline',
      generation: '✍️ Writing',
      review: '👀 Review',
      completed: '✅ Complete',
      cancelled: '❌ Cancelled',
    };

    return {
      bar: progressBar,
      percentage: percentComplete,
      fraction: `${completedChapters}/${totalChapters}`,
      phase: phaseIndicators[currentPhase] || currentPhase,
      text: `${progressBar} ${percentComplete}% (${completedChapters}/${totalChapters})`,
      estimatedTimeRemaining: this.formatTimeRemaining(progress.estimatedTimeRemaining),
    };
  }

  /**
   * Create action buttons based on current state
   * @param {Object} progress - Progress data
   * @param {Object} book - Book data
   * @returns {Array} Array of action button configurations
   */
  static createActionButtons(progress, book) {
    const buttons = [];

    switch (progress.currentPhase) {
      case 'outline':
        if (book.status === 'outline_pending') {
          buttons.push({
            id: 'approve_outline',
            text: 'Approve Outline',
            type: 'primary',
            action: 'approve_outline',
            params: { bookId: book.bookId },
          });
          buttons.push({
            id: 'regenerate_outline',
            text: 'Regenerate Outline',
            type: 'secondary',
            action: 'regenerate_outline',
            params: { bookId: book.bookId },
          });
        }
        break;

      case 'generation':
        if (progress.currentChapter <= progress.totalChapters) {
          buttons.push({
            id: 'generate_next_chapter',
            text: `Generate Chapter ${progress.currentChapter + 1}`,
            type: 'primary',
            action: 'generate_chapter',
            params: { 
              bookId: book.bookId, 
              chapterNumber: progress.currentChapter + 1 
            },
          });
        }
        break;

      case 'review':
        // Find pending chapters that need approval
        buttons.push({
          id: 'view_pending_chapters',
          text: 'Review Pending Chapters',
          type: 'primary',
          action: 'list_chapters',
          params: { bookId: book.bookId, status: 'pending' },
        });
        break;

      case 'completed':
        buttons.push({
          id: 'export_book',
          text: 'Export Book',
          type: 'primary',
          action: 'export_book',
          params: { bookId: book.bookId },
        });
        buttons.push({
          id: 'view_book_details',
          text: 'View Details',
          type: 'secondary',
          action: 'get_book_progress',
          params: { bookId: book.bookId },
        });
        break;
    }

    // Always add progress view button
    buttons.push({
      id: 'view_progress',
      text: 'View Progress',
      type: 'info',
      action: 'get_book_progress',
      params: { bookId: book.bookId },
    });

    return buttons;
  }

  /**
   * Generate completion notification with book summary
   * @param {string} bookId - Book ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Completion notification
   */
  static async generateCompletionNotification(bookId, userId) {
    try {
      const book = await BookModel.findByIdAndUser(bookId, userId);
      const progress = await ProgressService.getCurrentProgress(bookId, userId);
      const chapterStats = await ChapterModel.getBookStatistics(bookId, userId);

      if (!book || !progress) {
        return this.createErrorMessage('Book not found');
      }

      const analytics = await ProgressService.getDetailedAnalytics(bookId, userId);

      return {
        type: 'celebration',
        icon: '🎉',
        title: 'Congratulations! Your Book is Complete!',
        message: `"${book.title}" has been successfully created`,
        summary: {
          title: book.title,
          theme: book.theme,
          genre: book.genre,
          totalChapters: progress.totalChapters,
          totalWords: chapterStats.totalWords,
          estimatedReadingTime: Math.ceil(chapterStats.totalWords / 200),
          creationTime: this.formatDuration(
            new Date() - new Date(book.createdAt)
          ),
        },
        statistics: {
          averageWordsPerChapter: Math.round(chapterStats.totalWords / progress.totalChapters),
          approvalRate: analytics?.statistics?.approvalRate || 100,
          regenerationCount: analytics?.statistics?.regenerationCount || 0,
        },
        exportOptions: [
          { format: 'markdown', label: 'Markdown (.md)' },
          { format: 'html', label: 'HTML (.html)' },
          { format: 'txt', label: 'Plain Text (.txt)' },
          { format: 'json', label: 'JSON (.json)' },
        ],
        actionButtons: [
          {
            id: 'export_book',
            text: 'Export Book',
            type: 'primary',
            action: 'export_book',
            params: { bookId: book.bookId },
          },
          {
            id: 'create_new_book',
            text: 'Create New Book',
            type: 'secondary',
            action: 'create_book_project',
            params: {},
          },
        ],
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('[StatusMessageService] Error generating completion notification:', error);
      return this.createErrorMessage('Error generating completion notification');
    }
  }

  /**
   * Generate error message with user-friendly explanations
   * @param {string} message - Error message
   * @param {Object} details - Additional error details
   * @returns {Object} Formatted error message
   */
  static createErrorMessage(message, details = {}) {
    const commonSolutions = {
      'Book not found': 'The book may have been deleted or you may not have access to it.',
      'Chapter not found': 'The chapter may have been deleted or not yet generated.',
      'Invalid configuration': 'Please check your book settings and try again.',
      'AI generation failed': 'There was an issue with content generation. Please try again.',
      'Database error': 'There was a temporary issue. Please try again in a moment.',
    };

    const solution = commonSolutions[message] || 'Please try again or contact support if the issue persists.';

    return {
      type: 'error',
      icon: '⚠️',
      title: 'Error',
      message,
      details: details.originalError || solution,
      showProgress: false,
      requiresAction: false,
      actionButtons: [
        {
          id: 'retry',
          text: 'Try Again',
          type: 'secondary',
          action: 'retry_last_action',
          params: {},
        },
        {
          id: 'get_help',
          text: 'Get Help',
          type: 'info',
          action: 'show_help',
          params: { topic: 'troubleshooting' },
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Format time remaining in a human-readable format
   * @param {number} minutes - Time in minutes
   * @returns {string} Formatted time string
   */
  static formatTimeRemaining(minutes) {
    if (!minutes || minutes <= 0) {
      return 'Unknown';
    }

    if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);

    if (hours < 24) {
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }

  /**
   * Format duration in a human-readable format
   * @param {number} milliseconds - Duration in milliseconds
   * @returns {string} Formatted duration string
   */
  static formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    }
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    }
    if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
  }

  /**
   * Generate real-time status updates for active books
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of status updates
   */
  static async generateActiveStatusUpdates(userId) {
    try {
      const activeUpdates = await ProgressService.getActiveProgressUpdates(userId);
      
      return activeUpdates.map(update => ({
        ...update,
        progressIndicator: this.createProgressIndicator(update),
        lastUpdated: this.formatTimeRemaining(
          (Date.now() - new Date(update.lastActivity).getTime()) / (1000 * 60)
        ),
      }));
    } catch (error) {
      logger.error('[StatusMessageService] Error generating active status updates:', error);
      return [];
    }
  }

  /**
   * Create a summary of all user's book progress
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Progress summary
   */
  static async generateProgressSummary(userId) {
    try {
      const progressList = await ProgressService.getUserProgressSummary(userId);
      const bookStats = await BookModel.getStatistics(userId);

      const summary = {
        totalBooks: bookStats.total,
        activeBooks: bookStats.in_progress,
        completedBooks: bookStats.completed,
        totalWords: bookStats.totalWords,
        recentActivity: progressList.slice(0, 5).map(progress => ({
          bookId: progress.bookId,
          phase: progress.currentPhase,
          percentComplete: progress.percentComplete,
          lastActivity: progress.lastActivity,
        })),
      };

      return {
        type: 'summary',
        icon: '📊',
        title: 'Your Book Creation Progress',
        message: `You have ${summary.activeBooks} active book${summary.activeBooks !== 1 ? 's' : ''} in progress`,
        summary,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('[StatusMessageService] Error generating progress summary:', error);
      return this.createErrorMessage('Error generating progress summary');
    }
  }

  /**
   * Generate contextual help messages
   * @param {string} context - Current context or phase
   * @param {Object} data - Context-specific data
   * @returns {Object} Help message
   */
  static generateHelpMessage(context, data = {}) {
    const helpMessages = {
      outline_approval: {
        title: 'Reviewing Your Book Outline',
        message: 'Take time to review the generated chapter structure',
        tips: [
          'Check that chapter titles align with your book theme',
          'Ensure the flow and progression make sense',
          'Consider if the chapter count feels appropriate',
          'You can regenerate the outline if needed',
        ],
      },
      chapter_review: {
        title: 'Reviewing Generated Chapters',
        message: 'Carefully review each chapter before approval',
        tips: [
          'Check for consistency with your book theme and style',
          'Ensure the content flows well from previous chapters',
          'Look for any factual errors or inconsistencies',
          'Provide specific feedback if requesting regeneration',
        ],
      },
      book_export: {
        title: 'Exporting Your Completed Book',
        message: 'Choose the best format for your needs',
        tips: [
          'Markdown: Great for further editing and version control',
          'HTML: Perfect for web publishing or conversion',
          'Plain Text: Universal compatibility',
          'JSON: Structured data for custom processing',
        ],
      },
    };

    const help = helpMessages[context] || {
      title: 'Book Creation Help',
      message: 'Here are some general tips for book creation',
      tips: [
        'Be specific with your book theme and requirements',
        'Review each step carefully before proceeding',
        'Provide detailed feedback for better results',
        'Take breaks between chapters to maintain quality',
      ],
    };

    return {
      type: 'help',
      icon: '💡',
      ...help,
      context,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = StatusMessageService;