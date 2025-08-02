import { WritingAnalytics } from '../models/WritingAnalytics.js';
import { WritingSession } from '../models/WritingSession.js';
import { BookService } from './BookService.js';

/**
 * Writing Analytics Service
 * Handles writing progress tracking, style analysis, and reporting
 */
export class WritingAnalyticsService {
  constructor() {
    this.bookService = new BookService();
  }

  // ============ PROGRESS TRACKING ============

  /**
   * Records a writing session
   * @param {Object} sessionData - Writing session data
   * @returns {Promise<Object>} Created writing session
   */
  async recordWritingSession(sessionData) {
    const {
      bookId,
      chapterId,
      authorId,
      sessionDate = new Date(),
      startTime = new Date(),
      endTime,
      wordsWritten = 0,
      wordsBefore = 0,
      wordsAfter,
      sessionType = 'writing',
      mood = 'okay',
      productivity = 'medium',
      goals = {},
      notes,
      challenges = [],
      accomplishments = [],
      tags = [],
      location,
      device,
      interruptions = 0,
      flowState = false,
    } = sessionData;

    const session = new WritingSession({
      bookId,
      chapterId,
      authorId,
      sessionDate,
      startTime,
      endTime,
      wordsWritten,
      wordsBefore,
      wordsAfter: wordsAfter || wordsBefore + wordsWritten,
      sessionType,
      mood,
      productivity,
      goals,
      notes,
      challenges,
      accomplishments,
      tags,
      location,
      device,
      interruptions,
      flowState,
    });

    await session.save();
    return session;
  }

  /**
   * Gets writing sessions with filtering
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Sessions and metadata
   */
  async getWritingSessions(params) {
    const {
      authorId,
      bookId,
      chapterId,
      startDate,
      endDate,
      sessionType,
      limit = 50,
      offset = 0,
    } = params;

    let query = { authorId };

    if (bookId) query.bookId = bookId;
    if (chapterId) query.chapterId = chapterId;
    if (sessionType) query.sessionType = sessionType;

    if (startDate || endDate) {
      query.sessionDate = {};
      if (startDate) query.sessionDate.$gte = new Date(startDate);
      if (endDate) query.sessionDate.$lte = new Date(endDate);
    }

    const [sessions, total] = await Promise.all([
      WritingSession.find(query)
        .sort({ sessionDate: -1 })
        .limit(limit)
        .skip(offset)
        .populate('bookId', 'title')
        .populate('chapterId', 'title chapterNumber'),
      WritingSession.countDocuments(query),
    ]);

    return {
      sessions,
      total,
      limit,
      offset,
      hasMore: total > offset + limit,
    };
  }

  /**
   * Gets daily writing statistics
   * @param {string} authorId - Author ID
   * @param {Date} date - Date to get stats for
   * @param {string} bookId - Optional book ID filter
   * @returns {Promise<Object>} Daily statistics
   */
  async getDailyStats(authorId, date, bookId = null) {
    const stats = await WritingSession.getDailyStats(authorId, date, bookId);
    const dailyStats = stats[0] || {
      totalWords: 0,
      totalTime: 0,
      sessionCount: 0,
      avgWordsPerMinute: 0,
      goalsAchieved: 0,
      sessionTypes: [],
      moods: [],
    };

    // Calculate mode for mood and session types
    const moodCounts = {};
    const sessionTypeCounts = {};

    dailyStats.moods.forEach((mood) => {
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    });

    dailyStats.sessionTypes.forEach((type) => {
      sessionTypeCounts[type] = (sessionTypeCounts[type] || 0) + 1;
    });

    const dominantMood = Object.keys(moodCounts).reduce((a, b) =>
      moodCounts[a] > moodCounts[b] ? a : b,
    );
    const dominantSessionType = Object.keys(sessionTypeCounts).reduce((a, b) =>
      sessionTypeCounts[a] > sessionTypeCounts[b] ? a : b,
    );

    return {
      date: date,
      ...dailyStats,
      dominantMood: dominantMood || 'okay',
      dominantSessionType: dominantSessionType || 'writing',
      efficiency: dailyStats.totalTime > 0 ? dailyStats.totalWords / dailyStats.totalTime : 0,
    };
  }

  /**
   * Gets writing statistics for a date range
   * @param {Object} params - Parameters
   * @returns {Promise<Object>} Statistics summary
   */
  async getWritingStatistics(params) {
    const { authorId, bookId, startDate, endDate, period = 'week' } = params;

    // Calculate date range if not provided
    const end = endDate ? new Date(endDate) : new Date();
    let start;

    switch (period) {
      case 'day':
        start = new Date(end);
        start.setDate(start.getDate() - 1);
        break;
      case 'week':
        start = new Date(end);
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start = new Date(end);
        start.setMonth(start.getMonth() - 1);
        break;
      case 'year':
        start = new Date(end);
        start.setFullYear(start.getFullYear() - 1);
        break;
      default:
        start = startDate ? new Date(startDate) : new Date(end.setDate(end.getDate() - 7));
    }

    const sessions = await WritingSession.findByDateRange(authorId, start, end, { bookId });

    // Calculate comprehensive statistics
    const stats = {
      period: {
        start,
        end,
        days: Math.ceil((end - start) / (1000 * 60 * 60 * 24)),
      },
      totals: {
        sessions: sessions.length,
        wordsWritten: sessions.reduce((sum, s) => sum + s.wordsWritten, 0),
        timeSpent: sessions.reduce((sum, s) => sum + s.duration, 0),
        goalsAchieved: sessions.filter((s) => s.goals.achieved).length,
      },
      averages: {
        wordsPerSession: 0,
        minutesPerSession: 0,
        wordsPerMinute: 0,
        sessionsPerDay: 0,
        wordsPerDay: 0,
      },
      trends: {
        productivity: this._calculateProductivityTrend(sessions),
        consistency: this._calculateConsistency(sessions, start, end),
        improvement: this._calculateImprovement(sessions),
      },
      breakdown: {
        bySessionType: this._groupBy(sessions, 'sessionType'),
        byMood: this._groupBy(sessions, 'mood'),
        byProductivity: this._groupBy(sessions, 'productivity'),
        byDay: this._groupSessionsByDay(sessions, start, end),
      },
    };

    // Calculate averages
    if (stats.totals.sessions > 0) {
      stats.averages.wordsPerSession = Math.round(
        stats.totals.wordsWritten / stats.totals.sessions,
      );
      stats.averages.minutesPerSession = Math.round(stats.totals.timeSpent / stats.totals.sessions);
      stats.averages.sessionsPerDay =
        Math.round((stats.totals.sessions / stats.period.days) * 100) / 100;
      stats.averages.wordsPerDay = Math.round(stats.totals.wordsWritten / stats.period.days);
    }

    if (stats.totals.timeSpent > 0) {
      stats.averages.wordsPerMinute =
        Math.round((stats.totals.wordsWritten / stats.totals.timeSpent) * 100) / 100;
    }

    return stats;
  }

  // ============ STYLE ANALYSIS ============

  /**
   * Analyzes writing style for a book
   * @param {Object} params - Analysis parameters
   * @returns {Promise<Object>} Style analysis
   */
  async analyzeWritingStyle(params) {
    const { bookId, authorId, includeChapters = true, forceReanalysis = false } = params;

    // Check if recent analysis exists
    if (!forceReanalysis) {
      const recent = await WritingAnalytics.findLatest(bookId, authorId);
      if (recent && this._isRecentAnalysis(recent.analysisDate)) {
        return recent;
      }
    }

    // Get book content
    const book = await this.bookService.getBook(bookId, {
      includeChapters,
      includePages: true,
    });

    if (!book) {
      throw new Error('Book not found');
    }

    // Extract all text content
    const content = this._extractBookContent(book);

    // Perform comprehensive analysis
    const analysis = await this._performStyleAnalysis(content, book);

    // Save analysis
    const writingAnalytics = new WritingAnalytics({
      bookId,
      authorId,
      ...analysis,
    });

    await writingAnalytics.save();
    return writingAnalytics;
  }

  /**
   * Generates a comprehensive writing report
   * @param {Object} params - Report parameters
   * @returns {Promise<Object>} Writing report
   */
  async generateWritingReport(params) {
    const { authorId, bookId, reportType = 'comprehensive', period = 'month' } = params;

    const [progressStats, latestAnalysis, recentSessions] = await Promise.all([
      this.getWritingStatistics({ authorId, bookId, period }),
      WritingAnalytics.findLatest(bookId, authorId),
      this.getWritingSessions({
        authorId,
        bookId,
        limit: 10,
      }),
    ]);

    const report = {
      reportType,
      period,
      generatedAt: new Date(),
      bookInfo: bookId ? await this.bookService.getBook(bookId, { includeChapters: false }) : null,
      progressSummary: {
        ...progressStats,
        streak: await this._calculateWritingStreak(authorId, bookId),
        goals: await this._getGoalProgress(authorId, bookId),
      },
      styleAnalysis: latestAnalysis
        ? {
            lastAnalyzed: latestAnalysis.analysisDate,
            overallScore: latestAnalysis.overallScore,
            improvements: latestAnalysis.improvementSummary,
            readability: latestAnalysis.readabilitySummary,
            topIssues: latestAnalysis.improvements
              .filter((imp) => imp.priority === 'high')
              .slice(0, 5),
          }
        : null,
      recentActivity: {
        sessions: recentSessions.sessions.slice(0, 5),
        totalSessions: recentSessions.total,
      },
      recommendations: this._generateRecommendations(progressStats, latestAnalysis),
    };

    return report;
  }

  // ============ HELPER METHODS ============

  /**
   * Extracts text content from book
   * @private
   */
  _extractBookContent(book) {
    let allText = '';

    if (book.chapters && book.chapters.length > 0) {
      book.chapters.forEach((chapter) => {
        if (chapter.pages && chapter.pages.length > 0) {
          chapter.pages.forEach((page) => {
            if (page.content) {
              allText += page.content + '\n\n';
            }
          });
        }
      });
    }

    return allText.trim();
  }

  /**
   * Performs comprehensive style analysis
   * @private
   */
  _performStyleAnalysis(content, book) {
    if (!content || content.length === 0) {
      return this._getEmptyAnalysis();
    }

    const sentences = this._splitIntoSentences(content);
    const paragraphs = this._splitIntoParagraphs(content);
    const words = this._extractWords(content);

    const analysis = {
      analysisDate: new Date(),
      contentAnalyzed: {
        totalWordCount: words.length,
        chapterCount: book.chapters ? book.chapters.length : 0,
        pageCount: book.chapters
          ? book.chapters.reduce((sum, ch) => sum + (ch.pages ? ch.pages.length : 0), 0)
          : 0,
      },
      styleMetrics: this._calculateStyleMetrics(sentences, paragraphs, words),
      vocabularyAnalysis: this._analyzeVocabulary(words),
      sentenceAnalysis: this._analyzeSentences(sentences),
      dialogueAnalysis: this._analyzeDialogue(content),
      paceAndRhythm: this._analyzePaceAndRhythm(sentences, paragraphs),
      consistencyMetrics: this._analyzeConsistency(content, book),
      improvements: this._generateImprovements(sentences, paragraphs, words),
      overallScore: {
        styleScore: 75, // Placeholder - would use actual scoring algorithm
        readabilityScore: 70,
        consistencyScore: 80,
        overallRating: 75,
        gradeLevel: 'High School',
      },
    };

    return analysis;
  }

  /**
   * Calculates basic style metrics
   * @private
   */
  _calculateStyleMetrics(sentences, paragraphs, words) {
    const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
    const avgSentencesPerParagraph =
      paragraphs.length > 0 ? sentences.length / paragraphs.length : 0;
    const avgWordsPerParagraph = paragraphs.length > 0 ? words.length / paragraphs.length : 0;

    return {
      averageWordsPerSentence: Math.round(avgWordsPerSentence * 100) / 100,
      averageSentencesPerParagraph: Math.round(avgSentencesPerParagraph * 100) / 100,
      averageWordsPerParagraph: Math.round(avgWordsPerParagraph * 100) / 100,
      vocabularyDiversity: this._calculateVocabularyDiversity(words),
      readabilityScore: this._calculateReadabilityScores(sentences, words),
    };
  }

  /**
   * Analyzes vocabulary usage
   * @private
   */
  _analyzeVocabulary(words) {
    const wordCounts = {};
    words.forEach((word) => {
      const lowerWord = word.toLowerCase();
      wordCounts[lowerWord] = (wordCounts[lowerWord] || 0) + 1;
    });

    const uniqueWords = Object.keys(wordCounts);
    const mostFrequent = Object.entries(wordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([word, count]) => ({
        word,
        count,
        frequency: Math.round((count / words.length) * 10000) / 100,
      }));

    return {
      totalUniqueWords: uniqueWords.length,
      mostFrequentWords: mostFrequent,
      averageWordLength: words.reduce((sum, word) => sum + word.length, 0) / words.length,
      complexWordsCount: words.filter((word) => word.length > 6).length,
    };
  }

  /**
   * Analyzes sentence structure
   * @private
   */
  _analyzeSentences(sentences) {
    const lengths = sentences.map((s) => s.split(' ').length);
    const lengthDistribution = {
      short: lengths.filter((l) => l <= 10).length,
      medium: lengths.filter((l) => l > 10 && l <= 20).length,
      long: lengths.filter((l) => l > 20 && l <= 30).length,
      veryLong: lengths.filter((l) => l > 30).length,
    };

    return {
      totalSentences: sentences.length,
      sentenceLengthDistribution: lengthDistribution,
      complexityScore: this._calculateSentenceComplexity(sentences),
    };
  }

  /**
   * Basic text processing helpers
   * @private
   */
  _splitIntoSentences(text) {
    return text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  }

  _splitIntoParagraphs(text) {
    return text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  }

  _extractWords(text) {
    return text.toLowerCase().match(/\b[a-zA-Z]+\b/g) || [];
  }

  _calculateVocabularyDiversity(words) {
    const unique = new Set(words.map((w) => w.toLowerCase()));
    return Math.round((unique.size / words.length) * 10000) / 100;
  }

  _calculateReadabilityScores(sentences, words) {
    // Simplified readability calculation
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = 1.5; // Approximation

    const fleschKincaid = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
    const fleschReading = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;

    return {
      fleschKincaid: Math.round(fleschKincaid * 100) / 100,
      fleschReading: Math.round(fleschReading * 100) / 100,
      averageGradeLevel: Math.max(1, Math.round(fleschKincaid)),
    };
  }

  _calculateSentenceComplexity(sentences) {
    // Basic complexity based on length and punctuation
    let complexity = 0;
    sentences.forEach((sentence) => {
      const wordCount = sentence.split(' ').length;
      const commas = (sentence.match(/,/g) || []).length;
      const semicolons = (sentence.match(/;/g) || []).length;

      complexity += wordCount * 0.1 + commas * 0.2 + semicolons * 0.3;
    });

    return Math.round((complexity / sentences.length) * 100) / 100;
  }

  _analyzeDialogue(content) {
    const dialogueRegex = /"[^"]*"/g;
    const dialogueMatches = content.match(dialogueRegex) || [];

    return {
      dialoguePercentage:
        Math.round((dialogueMatches.join('').length / content.length) * 10000) / 100,
      averageDialogueLength:
        dialogueMatches.length > 0
          ? Math.round(
              dialogueMatches.reduce((sum, d) => sum + d.length, 0) / dialogueMatches.length,
            )
          : 0,
    };
  }

  _analyzePaceAndRhythm(sentences, paragraphs) {
    const sentenceLengths = sentences.map((s) => s.split(' ').length);
    const paragraphLengths = paragraphs.map((p) => p.split(' ').length);

    return {
      sentenceVariation: this._calculateVariation(sentenceLengths),
      paragraphVariation: this._calculateVariation(paragraphLengths),
      rhythmScore: 75, // Placeholder
    };
  }

  _analyzeConsistency(content, book) {
    // Basic consistency analysis
    return {
      styleConsistency: 80,
      toneConsistency: 75,
      characterVoiceConsistency: 70,
      pacingConsistency: 85,
    };
  }

  _generateImprovements(sentences, paragraphs, words) {
    const improvements = [];

    // Check sentence variety
    const sentenceLengths = sentences.map((s) => s.split(' ').length);
    const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;

    if (avgLength > 25) {
      improvements.push({
        category: 'sentence_variety',
        issue: 'Sentences are too long on average',
        suggestion: 'Consider breaking up long sentences for better readability',
        priority: 'medium',
        examples: [],
      });
    }

    return improvements;
  }

  _calculateVariation(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    return Math.round((stdDev / mean) * 10000) / 100; // Coefficient of variation
  }

  _getEmptyAnalysis() {
    return {
      analysisDate: new Date(),
      contentAnalyzed: {
        totalWordCount: 0,
        chapterCount: 0,
        pageCount: 0,
      },
      styleMetrics: {},
      vocabularyAnalysis: {},
      sentenceAnalysis: {},
      dialogueAnalysis: {},
      paceAndRhythm: {},
      consistencyMetrics: {},
      improvements: [],
      overallScore: {
        styleScore: 0,
        readabilityScore: 0,
        consistencyScore: 0,
        overallRating: 0,
        gradeLevel: 'Not analyzed',
      },
    };
  }

  _isRecentAnalysis(date) {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    return date > oneDayAgo;
  }

  _calculateProductivityTrend(sessions) {
    if (sessions.length < 2) return 'insufficient_data';

    const recent = sessions.slice(0, Math.ceil(sessions.length / 2));
    const older = sessions.slice(Math.ceil(sessions.length / 2));

    const recentAvg = recent.reduce((sum, s) => sum + s.wordsWritten, 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + s.wordsWritten, 0) / older.length;

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (change > 10) return 'improving';
    if (change < -10) return 'declining';
    return 'stable';
  }

  _calculateConsistency(sessions, startDate, endDate) {
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const activeDays = new Set(sessions.map((s) => s.sessionDate.toDateString())).size;

    return Math.round((activeDays / totalDays) * 100);
  }

  _calculateImprovement(sessions) {
    if (sessions.length < 5) return 'insufficient_data';

    const firstFive = sessions.slice(-5);
    const lastFive = sessions.slice(0, 5);

    const firstAvg = firstFive.reduce((sum, s) => sum + s.wordsPerMinute, 0) / firstFive.length;
    const lastAvg = lastFive.reduce((sum, s) => sum + s.wordsPerMinute, 0) / lastFive.length;

    return lastAvg > firstAvg ? 'improving' : lastAvg < firstAvg ? 'declining' : 'stable';
  }

  _groupBy(sessions, field) {
    return sessions.reduce((groups, session) => {
      const key = session[field];
      groups[key] = (groups[key] || 0) + 1;
      return groups;
    }, {});
  }

  _groupSessionsByDay(sessions, startDate, endDate) {
    const days = {};
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateString = currentDate.toISOString().split('T')[0];
      days[dateString] = {
        date: dateString,
        sessions: 0,
        words: 0,
        time: 0,
      };
      currentDate.setDate(currentDate.getDate() + 1);
    }

    sessions.forEach((session) => {
      const dateString = session.sessionDate.toISOString().split('T')[0];
      if (days[dateString]) {
        days[dateString].sessions++;
        days[dateString].words += session.wordsWritten;
        days[dateString].time += session.duration;
      }
    });

    return Object.values(days);
  }

  async _calculateWritingStreak(authorId, bookId) {
    const sessions = await WritingSession.find({
      authorId,
      ...(bookId && { bookId }),
    })
      .sort({ sessionDate: -1 })
      .limit(365);

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (const session of sessions) {
      const sessionDate = new Date(session.sessionDate);
      sessionDate.setHours(0, 0, 0, 0);

      if (sessionDate.getTime() === currentDate.getTime()) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else if (sessionDate.getTime() < currentDate.getTime()) {
        break;
      }
    }

    return streak;
  }

  async _getGoalProgress(authorId, bookId) {
    // Placeholder for goal tracking
    return {
      dailyWordGoal: 500,
      weeklyWordGoal: 3500,
      monthlyWordGoal: 15000,
      currentProgress: 0,
    };
  }

  _generateRecommendations(progressStats, styleAnalysis) {
    const recommendations = [];

    if (progressStats.averages.wordsPerDay < 200) {
      recommendations.push({
        type: 'productivity',
        priority: 'high',
        title: 'Increase Daily Output',
        description:
          'Your daily word count is below recommended levels. Try setting small, achievable daily goals.',
      });
    }

    if (progressStats.trends.consistency < 50) {
      recommendations.push({
        type: 'consistency',
        priority: 'high',
        title: 'Improve Writing Consistency',
        description: 'Try to write a little bit every day rather than large amounts sporadically.',
      });
    }

    if (styleAnalysis && styleAnalysis.improvements.length > 5) {
      recommendations.push({
        type: 'style',
        priority: 'medium',
        title: 'Focus on Writing Style',
        description:
          'Consider addressing the style improvement suggestions from your latest analysis.',
      });
    }

    return recommendations;
  }
}
