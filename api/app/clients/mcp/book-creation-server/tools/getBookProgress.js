/**
 * Get Book Progress MCP Tool
 * 
 * Implements the get_book_progress MCP tool for detailed progress information.
 * Provides comprehensive progress tracking, analytics, and next steps guidance.
 */

const BookService = require('../services/BookService');
const ChapterService = require('../services/ChapterService');
const { validateGetBookProgressParams, sanitizeAndValidate, formatValidationErrors } = require('../utils/validators');

/**
 * MCP Tool Definition for get_book_progress
 */
const getBookProgressTool = {
  name: 'get_book_progress',
  description: 'Get detailed progress information for a specific book project. Includes completion metrics, chapter status, timeline, and next steps.',
  inputSchema: {
    type: 'object',
    properties: {
      bookId: {
        type: 'string',
        description: 'The unique identifier of the book project'
      },
      includeChapterDetails: {
        type: 'boolean',
        default: false,
        description: 'Include detailed information about each chapter'
      },
      includeTimeline: {
        type: 'boolean',
        default: true,
        description: 'Include timeline of book creation milestones'
      },
      includeAnalytics: {
        type: 'boolean',
        default: true,
        description: 'Include progress analytics and insights'
      }
    },
    required: ['bookId']
  },

  /**
   * Execute the get_book_progress tool
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
            message: 'User authentication required to get book progress'
          }
        };
      }

      // Sanitize and validate input parameters
      const validationResult = sanitizeAndValidate(params, validateGetBookProgressParams);
      if (!validationResult.isValid) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: formatValidationErrors(validationResult.errors, 'Get book progress parameters'),
            details: {
              errors: validationResult.errors,
              receivedParams: Object.keys(params)
            }
          }
        };
      }

      const sanitizedParams = validationResult.params;

      // Create service instances
      const bookService = new BookService();
      const chapterService = new ChapterService();

      // Get detailed book progress
      const progressData = await bookService.getBookProgress(userId, sanitizedParams.bookId);

      // Get chapter details if requested
      let chapterDetails = null;
      if (sanitizedParams.includeChapterDetails) {
        try {
          chapterDetails = await chapterService.getChaptersByBook(sanitizedParams.bookId, userId);
        } catch (chapterError) {
          console.warn('[GetBookProgressTool] Could not fetch chapter details:', chapterError.message);
          // Continue without chapter details
        }
      }

      // Calculate advanced analytics
      const analytics = sanitizedParams.includeAnalytics ? 
        this.calculateProgressAnalytics(progressData, chapterDetails) : null;

      // Generate timeline if requested
      const timeline = sanitizedParams.includeTimeline ? 
        this.generateProgressTimeline(progressData, chapterDetails) : null;

      // Determine next steps and recommendations
      const nextSteps = this.generateNextSteps(progressData, chapterDetails);

      // Format chapter details for response
      const formattedChapterDetails = chapterDetails ? chapterDetails.map(chapter => ({
        chapterId: chapter.chapterId,
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        status: chapter.status,
        wordCount: chapter.wordCount,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
        approvedAt: chapter.approvedAt,
        summary: chapter.summary ? chapter.summary.substring(0, 150) + '...' : null,
        hasContent: !!chapter.content,
        contentPreview: chapter.content ? chapter.content.substring(0, 100) + '...' : null
      })) : null;

      // Prepare comprehensive response
      return {
        success: true,
        data: {
          bookInfo: {
            bookId: progressData.bookId,
            title: progressData.title,
            status: progressData.status,
            lastUpdated: progressData.lastUpdated
          },
          progress: {
            overall: {
              completionPercentage: progressData.progress.completionPercentage,
              currentPhase: progressData.progress.currentPhase,
              estimatedTimeRemaining: progressData.progress.estimatedTimeRemaining,
              nextAction: progressData.progress.nextAction
            },
            chapters: {
              current: progressData.progress.currentChapter,
              completed: progressData.progress.completedChapters,
              total: progressData.progress.totalChapters,
              remaining: progressData.progress.totalChapters - progressData.progress.completedChapters
            },
            content: {
              totalWordCount: progressData.metadata.wordCount,
              averageWordsPerChapter: progressData.metadata.averageWordsPerChapter,
              chaptersRemaining: progressData.metadata.chaptersRemaining,
              estimatedFinalWordCount: progressData.metadata.averageWordsPerChapter * progressData.progress.totalChapters
            }
          },
          chapterDetails: formattedChapterDetails,
          analytics: analytics,
          timeline: timeline,
          nextSteps: nextSteps,
          insights: this.generateProgressInsights(progressData, analytics)
        },
        message: `Book "${progressData.title}" is ${progressData.progress.completionPercentage}% complete with ${progressData.progress.completedChapters} of ${progressData.progress.totalChapters} chapters finished.`
      };

    } catch (error) {
      // Handle different types of errors
      if (error.name === 'BookServiceError') {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }
        };
      }

      // Handle unexpected errors
      console.error('[GetBookProgressTool] Unexpected error:', error);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while getting book progress',
          details: {
            error: error.message
          }
        }
      };
    }
  },

  /**
   * Calculate advanced progress analytics
   * @param {Object} progressData - Book progress data
   * @param {Array} chapterDetails - Chapter details array
   * @returns {Object} Analytics data
   */
  calculateProgressAnalytics(progressData, chapterDetails) {
    const analytics = {
      productivity: {},
      quality: {},
      timeline: {},
      predictions: {}
    };

    // Productivity metrics
    if (chapterDetails && chapterDetails.length > 0) {
      const approvedChapters = chapterDetails.filter(ch => ch.status === 'approved');
      const totalDays = approvedChapters.length > 0 ? 
        (Date.now() - new Date(approvedChapters[0].createdAt)) / (1000 * 60 * 60 * 24) : 0;
      
      analytics.productivity = {
        chaptersPerWeek: totalDays > 0 ? (approvedChapters.length / totalDays) * 7 : 0,
        averageChapterTime: totalDays > 0 ? totalDays / approvedChapters.length : 0,
        consistencyScore: this.calculateConsistencyScore(approvedChapters),
        mostProductivePhase: this.identifyMostProductivePhase(approvedChapters)
      };

      // Quality metrics
      analytics.quality = {
        averageWordCount: approvedChapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0) / approvedChapters.length || 0,
        wordCountConsistency: this.calculateWordCountConsistency(approvedChapters),
        revisionRate: this.calculateRevisionRate(chapterDetails),
        qualityTrend: this.calculateQualityTrend(approvedChapters)
      };
    }

    // Timeline predictions
    const remainingChapters = progressData.progress.totalChapters - progressData.progress.completedChapters;
    if (analytics.productivity.averageChapterTime > 0) {
      analytics.predictions = {
        estimatedCompletionDate: new Date(Date.now() + (remainingChapters * analytics.productivity.averageChapterTime * 24 * 60 * 60 * 1000)),
        estimatedDaysRemaining: Math.ceil(remainingChapters * analytics.productivity.averageChapterTime),
        confidenceLevel: this.calculatePredictionConfidence(analytics.productivity.consistencyScore)
      };
    }

    return analytics;
  },

  /**
   * Generate progress timeline
   * @param {Object} progressData - Book progress data
   * @param {Array} chapterDetails - Chapter details array
   * @returns {Array} Timeline events
   */
  generateProgressTimeline(progressData, chapterDetails) {
    const timeline = [];

    // Add book creation event
    timeline.push({
      date: progressData.bookInfo?.createdAt || new Date(),
      event: 'book_created',
      title: 'Book Project Created',
      description: `Started working on "${progressData.title}"`,
      milestone: true
    });

    // Add outline approval if available
    if (progressData.status !== 'outline_pending') {
      timeline.push({
        date: progressData.outline?.approvedAt || progressData.bookInfo?.createdAt,
        event: 'outline_approved',
        title: 'Outline Approved',
        description: 'Book outline approved and chapter generation began',
        milestone: true
      });
    }

    // Add chapter events
    if (chapterDetails) {
      chapterDetails.forEach(chapter => {
        if (chapter.status === 'approved' && chapter.approvedAt) {
          timeline.push({
            date: chapter.approvedAt,
            event: 'chapter_approved',
            title: `Chapter ${chapter.chapterNumber} Approved`,
            description: `"${chapter.title}" - ${chapter.wordCount} words`,
            chapterNumber: chapter.chapterNumber,
            wordCount: chapter.wordCount
          });
        }
      });
    }

    // Add completion event if book is completed
    if (progressData.status === 'completed') {
      timeline.push({
        date: progressData.lastUpdated,
        event: 'book_completed',
        title: 'Book Completed',
        description: `Finished all ${progressData.progress.totalChapters} chapters`,
        milestone: true
      });
    }

    // Sort timeline by date
    return timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
  },

  /**
   * Generate next steps and recommendations
   * @param {Object} progressData - Book progress data
   * @param {Array} chapterDetails - Chapter details array
   * @returns {Object} Next steps information
   */
  generateNextSteps(progressData, chapterDetails) {
    const nextSteps = {
      immediate: [],
      upcoming: [],
      longTerm: []
    };

    switch (progressData.status) {
      case 'outline_pending':
        nextSteps.immediate.push({
          action: 'approve_outline',
          title: 'Approve Book Outline',
          description: 'Review and approve the generated outline to begin chapter creation',
          priority: 'high',
          estimatedTime: '5-10 minutes'
        });
        break;

      case 'in_progress':
        // Find pending chapters
        const pendingChapters = chapterDetails ? 
          chapterDetails.filter(ch => ch.status === 'pending') : [];
        
        if (pendingChapters.length > 0) {
          const nextChapter = pendingChapters[0];
          nextSteps.immediate.push({
            action: 'approve_chapter',
            title: `Review Chapter ${nextChapter.chapterNumber}`,
            description: `"${nextChapter.title}" is ready for review and approval`,
            priority: 'high',
            chapterId: nextChapter.chapterId,
            estimatedTime: '10-15 minutes'
          });
        } else if (progressData.progress.currentChapter <= progressData.progress.totalChapters) {
          nextSteps.immediate.push({
            action: 'generate_chapter',
            title: `Generate Chapter ${progressData.progress.currentChapter}`,
            description: 'Generate the next chapter in the sequence',
            priority: 'high',
            chapterNumber: progressData.progress.currentChapter,
            estimatedTime: '2-5 minutes'
          });
        }

        // Upcoming chapters
        const remainingChapters = progressData.progress.totalChapters - progressData.progress.completedChapters;
        if (remainingChapters > 1) {
          nextSteps.upcoming.push({
            action: 'continue_chapters',
            title: `Complete Remaining ${remainingChapters - 1} Chapters`,
            description: 'Continue the chapter generation and approval process',
            priority: 'medium',
            estimatedTime: `${(remainingChapters - 1) * 15} minutes`
          });
        }

        nextSteps.longTerm.push({
          action: 'prepare_export',
          title: 'Prepare for Export',
          description: 'Consider export format and final review process',
          priority: 'low'
        });
        break;

      case 'completed':
        nextSteps.immediate.push({
          action: 'export_book',
          title: 'Export Completed Book',
          description: 'Download your completed book in your preferred format',
          priority: 'medium',
          estimatedTime: '2-5 minutes'
        });

        nextSteps.upcoming.push({
          action: 'share_or_publish',
          title: 'Share or Publish',
          description: 'Consider sharing your completed work or preparing for publication',
          priority: 'low'
        });
        break;
    }

    return nextSteps;
  },

  /**
   * Generate progress insights
   * @param {Object} progressData - Book progress data
   * @param {Object} analytics - Analytics data
   * @returns {Array} Array of insights
   */
  generateProgressInsights(progressData, analytics) {
    const insights = [];

    // Progress insights
    if (progressData.progress.completionPercentage > 50) {
      insights.push({
        type: 'milestone',
        message: `Great progress! You're more than halfway done with your book.`,
        positive: true
      });
    }

    // Productivity insights
    if (analytics?.productivity?.chaptersPerWeek > 2) {
      insights.push({
        type: 'productivity',
        message: `Excellent pace! You're completing ${Math.round(analytics.productivity.chaptersPerWeek * 10) / 10} chapters per week.`,
        positive: true
      });
    } else if (analytics?.productivity?.chaptersPerWeek < 0.5) {
      insights.push({
        type: 'productivity',
        message: 'Consider setting aside regular time for writing to maintain momentum.',
        positive: false,
        suggestion: 'Try scheduling 30 minutes daily for book work'
      });
    }

    // Quality insights
    if (analytics?.quality?.wordCountConsistency > 0.8) {
      insights.push({
        type: 'quality',
        message: 'Your chapters have consistent length, which creates a good reading experience.',
        positive: true
      });
    }

    // Timeline insights
    if (analytics?.predictions?.estimatedDaysRemaining) {
      const days = analytics.predictions.estimatedDaysRemaining;
      if (days < 30) {
        insights.push({
          type: 'timeline',
          message: `You're in the final stretch! Estimated completion in ${days} days.`,
          positive: true
        });
      }
    }

    return insights;
  },

  /**
   * Calculate consistency score for chapter completion
   * @param {Array} chapters - Approved chapters
   * @returns {number} Consistency score (0-1)
   */
  calculateConsistencyScore(chapters) {
    if (chapters.length < 2) return 1;

    const intervals = [];
    for (let i = 1; i < chapters.length; i++) {
      const interval = new Date(chapters[i].approvedAt) - new Date(chapters[i-1].approvedAt);
      intervals.push(interval);
    }

    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // Lower standard deviation relative to mean indicates higher consistency
    return Math.max(0, 1 - (stdDev / avgInterval));
  },

  /**
   * Calculate word count consistency
   * @param {Array} chapters - Approved chapters
   * @returns {number} Consistency score (0-1)
   */
  calculateWordCountConsistency(chapters) {
    if (chapters.length < 2) return 1;

    const wordCounts = chapters.map(ch => ch.wordCount || 0).filter(wc => wc > 0);
    if (wordCounts.length < 2) return 1;

    const avgWordCount = wordCounts.reduce((sum, wc) => sum + wc, 0) / wordCounts.length;
    const variance = wordCounts.reduce((sum, wc) => sum + Math.pow(wc - avgWordCount, 2), 0) / wordCounts.length;
    const stdDev = Math.sqrt(variance);

    return Math.max(0, 1 - (stdDev / avgWordCount));
  },

  /**
   * Calculate revision rate
   * @param {Array} chapters - All chapters
   * @returns {number} Revision rate (0-1)
   */
  calculateRevisionRate(chapters) {
    if (chapters.length === 0) return 0;

    const revisedChapters = chapters.filter(ch => ch.version && ch.version > 1).length;
    return revisedChapters / chapters.length;
  },

  /**
   * Calculate quality trend
   * @param {Array} chapters - Approved chapters
   * @returns {string} Trend direction
   */
  calculateQualityTrend(chapters) {
    if (chapters.length < 3) return 'stable';

    const recentChapters = chapters.slice(-3);
    const earlierChapters = chapters.slice(0, 3);

    const recentAvgWords = recentChapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0) / recentChapters.length;
    const earlierAvgWords = earlierChapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0) / earlierChapters.length;

    const difference = (recentAvgWords - earlierAvgWords) / earlierAvgWords;

    if (difference > 0.1) return 'improving';
    if (difference < -0.1) return 'declining';
    return 'stable';
  },

  /**
   * Identify most productive phase
   * @param {Array} chapters - Approved chapters
   * @returns {string} Most productive phase
   */
  identifyMostProductivePhase(chapters) {
    if (chapters.length < 3) return 'beginning';

    const third = Math.floor(chapters.length / 3);
    const beginning = chapters.slice(0, third);
    const middle = chapters.slice(third, third * 2);
    const end = chapters.slice(third * 2);

    const phases = [
      { name: 'beginning', chapters: beginning },
      { name: 'middle', chapters: middle },
      { name: 'end', chapters: end }
    ];

    // Calculate productivity based on time between chapters
    let mostProductive = phases[0];
    let bestScore = 0;

    phases.forEach(phase => {
      if (phase.chapters.length > 1) {
        const totalTime = new Date(phase.chapters[phase.chapters.length - 1].approvedAt) - 
                         new Date(phase.chapters[0].approvedAt);
        const score = phase.chapters.length / (totalTime / (1000 * 60 * 60 * 24)); // chapters per day
        
        if (score > bestScore) {
          bestScore = score;
          mostProductive = phase;
        }
      }
    });

    return mostProductive.name;
  },

  /**
   * Calculate prediction confidence
   * @param {number} consistencyScore - Consistency score
   * @returns {string} Confidence level
   */
  calculatePredictionConfidence(consistencyScore) {
    if (consistencyScore > 0.8) return 'high';
    if (consistencyScore > 0.5) return 'medium';
    return 'low';
  }
};

module.exports = getBookProgressTool;