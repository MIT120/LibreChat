const { AIClient } = require('../utils/aiClient');

/**
 * Service for generating chapter summaries with configurable options
 * Handles context building from previous summaries and quality validation
 */
class SummaryService {
  constructor(options = {}) {
    this.aiClient = new AIClient(options.aiClient);
    this.defaultOptions = {
      summaryLength: 'brief', // 'brief' or 'detailed'
      maxBriefWords: 200,
      maxDetailedWords: 500,
      contextWindow: 3, // Number of previous summaries to include as context
      qualityThreshold: 0.5, // Minimum quality score (0-1)
      ...options.defaults,
    };

    // Use console for logging in MCP server context
    this.logger = {
      info: (...args) => console.log('[INFO]', ...args),
      warn: (...args) => console.warn('[WARN]', ...args),
      error: (...args) => console.error('[ERROR]', ...args),
      debug: (...args) => console.log('[DEBUG]', ...args),
    };
  }

  /**
   * Generate a chapter summary with configurable length and context
   */
  async generateChapterSummary(chapterContent, options = {}) {
    const config = { ...this.defaultOptions, ...options };

    try {
      this.logger.info('[SummaryService] Generating chapter summary');

      // Validate input
      if (!chapterContent || typeof chapterContent !== 'string') {
        throw new Error('Chapter content must be a non-empty string');
      }

      if (chapterContent.trim().length < 100) {
        throw new Error('Chapter content too short for meaningful summary');
      }

      // Build context from previous summaries if provided
      const contextPrompt = this.buildContextPrompt(config.previousSummaries, config.contextWindow);

      // Generate the summary
      const summaryResult = await this.aiClient.generateChapterSummary(chapterContent, {
        summaryLength: config.summaryLength,
        provider: config.provider,
      });

      // Validate summary quality
      const qualityScore = this.validateSummaryQuality(
        chapterContent,
        summaryResult.summary,
        config,
      );

      if (qualityScore < config.qualityThreshold && !isNaN(qualityScore)) {
        this.logger.warn(`[SummaryService] Summary quality below threshold: ${qualityScore}`);

        // Attempt to regenerate with improved prompt
        const improvedResult = await this.regenerateSummaryWithFeedback(
          chapterContent,
          summaryResult.summary,
          config,
        );

        return {
          ...improvedResult,
          qualityScore: this.validateSummaryQuality(chapterContent, improvedResult.summary, config),
          regenerated: true,
          originalQualityScore: qualityScore,
          context: contextPrompt ? 'included' : 'none',
        };
      }

      return {
        ...summaryResult,
        qualityScore: isNaN(qualityScore) ? 0.7 : qualityScore,
        regenerated: false,
        context: contextPrompt ? 'included' : 'none',
      };
    } catch (error) {
      this.logger.error('[SummaryService] Failed to generate chapter summary:', error);
      throw new Error(`Summary generation failed: ${error.message}`);
    }
  }

  /**
   * Generate summaries for multiple chapters in batch
   */
  async generateBatchSummaries(chapters, options = {}) {
    const config = { ...this.defaultOptions, ...options };
    const results = [];
    const previousSummaries = [];

    try {
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        this.logger.info(`[SummaryService] Processing chapter ${i + 1}/${chapters.length}`);

        const summaryResult = await this.generateChapterSummary(chapter.content, {
          ...config,
          previousSummaries: previousSummaries.slice(-config.contextWindow),
          chapterNumber: chapter.number || i + 1,
          chapterTitle: chapter.title,
        });

        results.push({
          chapterNumber: chapter.number || i + 1,
          chapterTitle: chapter.title,
          ...summaryResult,
        });

        // Add to context for next chapters
        previousSummaries.push(summaryResult.summary);
      }

      return {
        summaries: results,
        totalProcessed: chapters.length,
        averageQuality: results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length,
        regeneratedCount: results.filter((r) => r.regenerated).length,
      };
    } catch (error) {
      this.logger.error('[SummaryService] Batch summary generation failed:', error);
      throw new Error(`Batch summary generation failed: ${error.message}`);
    }
  }

  /**
   * Build context prompt from previous chapter summaries
   */
  buildContextPrompt(previousSummaries, contextWindow) {
    if (!previousSummaries || !Array.isArray(previousSummaries) || previousSummaries.length === 0) {
      return null;
    }

    const relevantSummaries = previousSummaries.slice(-contextWindow);

    return `Previous chapter context:\n${relevantSummaries
      .map((summary, index) => {
        const chapterNum = previousSummaries.length - relevantSummaries.length + index + 1;
        return `Chapter ${chapterNum}: ${summary}`;
      })
      .join('\n')}\n`;
  }

  /**
   * Validate the quality and relevance of generated summary
   */
  validateSummaryQuality(originalContent, summary, config) {
    try {
      // Basic validation metrics
      const metrics = {
        lengthScore: this.validateLength(summary, config),
        contentCoverageScore: this.validateContentCoverage(originalContent, summary),
        coherenceScore: this.validateCoherence(summary),
        relevanceScore: this.validateRelevance(originalContent, summary),
      };

      // Weighted average of quality metrics
      const weights = {
        lengthScore: 0.2,
        contentCoverageScore: 0.3,
        coherenceScore: 0.25,
        relevanceScore: 0.25,
      };

      const qualityScore = Object.keys(metrics).reduce((total, metric) => {
        const metricValue = isNaN(metrics[metric]) ? 0.5 : metrics[metric]; // Default to 0.5 for NaN values
        return total + metricValue * weights[metric];
      }, 0);

      this.logger.debug('[SummaryService] Quality metrics:', { ...metrics, qualityScore });

      return Math.round(qualityScore * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      this.logger.warn('[SummaryService] Quality validation failed:', error);
      return 0.5; // Default moderate score if validation fails
    }
  }

  /**
   * Validate summary length against configuration
   */
  validateLength(summary, config) {
    const wordCount = summary.trim().split(/\s+/).length;
    const targetMax =
      config.summaryLength === 'brief' ? config.maxBriefWords : config.maxDetailedWords;
    const targetMin = Math.floor(targetMax * 0.3); // Minimum 30% of target

    if (wordCount < targetMin) {
      return 0.3; // Too short
    } else if (wordCount > targetMax * 1.2) {
      return 0.6; // Too long
    } else if (wordCount >= targetMin && wordCount <= targetMax) {
      return 1.0; // Perfect length
    } else {
      return 0.8; // Slightly over but acceptable
    }
  }

  /**
   * Validate content coverage by checking key terms presence
   */
  validateContentCoverage(originalContent, summary) {
    try {
      // Extract key terms from original content (simplified approach)
      const originalWords = originalContent
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 4); // Focus on meaningful words

      // Get word frequency
      const wordFreq = {};
      originalWords.forEach((word) => {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      });

      // Get top 20 most frequent meaningful words
      const keyTerms = Object.entries(wordFreq)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20)
        .map(([word]) => word);

      // Check how many key terms appear in summary
      const summaryLower = summary.toLowerCase();
      const coveredTerms = keyTerms.filter((term) => summaryLower.includes(term));

      return keyTerms.length > 0 ? coveredTerms.length / keyTerms.length : 0;
    } catch (error) {
      this.logger.warn('[SummaryService] Content coverage validation failed:', error);
      return 0.7; // Default moderate score
    }
  }

  /**
   * Validate coherence by checking sentence structure and flow
   */
  validateCoherence(summary) {
    try {
      const sentences = summary.split(/[.!?]+/).filter((s) => s.trim().length > 0);

      if (sentences.length < 2) {
        return 0.5; // Too short to assess coherence
      }

      // Check for basic coherence indicators
      let coherenceScore = 0.7; // Base score

      // Check for transition words/phrases
      const transitionWords = [
        'however',
        'therefore',
        'furthermore',
        'additionally',
        'consequently',
        'meanwhile',
        'subsequently',
        'moreover',
      ];
      const hasTransitions = transitionWords.some((word) => summary.toLowerCase().includes(word));
      if (hasTransitions) coherenceScore += 0.1;

      // Check for consistent tense usage (simplified)
      const pastTenseIndicators = summary.match(/\b\w+ed\b/g) || [];
      const presentTenseIndicators = summary.match(/\b\w+s\b/g) || [];
      const tenseConsistency =
        Math.abs(pastTenseIndicators.length - presentTenseIndicators.length) / sentences.length;
      if (tenseConsistency < 2) coherenceScore += 0.1;

      // Check sentence length variation (good coherence has varied sentence lengths)
      const sentenceLengths = sentences.map((s) => s.trim().split(/\s+/).length);
      const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
      const variance =
        sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) /
        sentenceLengths.length;
      if (variance > 10) coherenceScore += 0.1; // Good variation

      return Math.min(coherenceScore, 1.0);
    } catch (error) {
      this.logger.warn('[SummaryService] Coherence validation failed:', error);
      return 0.7; // Default moderate score
    }
  }

  /**
   * Validate relevance by checking topic alignment
   */
  validateRelevance(originalContent, summary) {
    try {
      // Simple relevance check based on shared vocabulary
      const originalWords = new Set(
        originalContent
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter((word) => word.length > 3),
      );

      const summaryWords = new Set(
        summary
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter((word) => word.length > 3),
      );

      const intersection = new Set([...originalWords].filter((word) => summaryWords.has(word)));
      const union = new Set([...originalWords, ...summaryWords]);

      // Jaccard similarity
      const relevanceScore = union.size > 0 ? intersection.size / union.size : 0;

      // Boost score if summary is reasonably relevant
      return Math.min(relevanceScore * 2, 1.0);
    } catch (error) {
      this.logger.warn('[SummaryService] Relevance validation failed:', error);
      return 0.7; // Default moderate score
    }
  }

  /**
   * Regenerate summary with feedback for quality improvement
   */
  async regenerateSummaryWithFeedback(originalContent, previousSummary, config) {
    try {
      this.logger.info('[SummaryService] Regenerating summary with quality feedback');

      // Build feedback prompt
      const feedbackPrompt = this.buildFeedbackPrompt(originalContent, previousSummary, config);

      // Generate improved summary
      const improvedResult = await this.aiClient.generateContent(feedbackPrompt, {
        provider: config.provider,
        maxTokens: config.summaryLength === 'brief' ? 300 : 600,
        temperature: 0.6, // Slightly more creative for improvement
        systemMessage:
          'You are an expert editor focused on creating high-quality, relevant chapter summaries. Improve the given summary based on the feedback provided.',
      });

      return {
        summary: improvedResult,
        length: config.summaryLength,
        wordCount: improvedResult.trim().split(/\s+/).length,
      };
    } catch (error) {
      this.logger.error('[SummaryService] Summary regeneration failed:', error);
      // Return original if regeneration fails
      return {
        summary: previousSummary,
        length: config.summaryLength,
        wordCount: previousSummary.trim().split(/\s+/).length,
      };
    }
  }

  /**
   * Build feedback prompt for summary improvement
   */
  buildFeedbackPrompt(originalContent, previousSummary, config) {
    const targetWords =
      config.summaryLength === 'brief' ? config.maxBriefWords : config.maxDetailedWords;

    return `Please improve the following chapter summary based on the original content:

ORIGINAL CHAPTER CONTENT:
${originalContent.substring(0, 2000)}${originalContent.length > 2000 ? '...' : ''}

CURRENT SUMMARY:
${previousSummary}

IMPROVEMENT REQUIREMENTS:
1. Target length: approximately ${targetWords} words
2. Ensure all key points from the original content are covered
3. Improve coherence and flow between sentences
4. Use clear, concise language
5. Maintain relevance to the original content
6. Include specific details and examples where appropriate

Please provide an improved summary that addresses these requirements:`;
  }

  /**
   * Get summary statistics for analysis
   */
  getSummaryStatistics(summaries) {
    if (!Array.isArray(summaries) || summaries.length === 0) {
      return null;
    }

    const stats = {
      totalSummaries: summaries.length,
      averageWordCount: 0,
      averageQualityScore: 0,
      qualityDistribution: { high: 0, medium: 0, low: 0 },
      regenerationRate: 0,
      lengthDistribution: { brief: 0, detailed: 0 },
    };

    summaries.forEach((summary) => {
      stats.averageWordCount += summary.wordCount || 0;
      stats.averageQualityScore += summary.qualityScore || 0;

      if (summary.regenerated) stats.regenerationRate++;

      if (summary.qualityScore >= 0.8) stats.qualityDistribution.high++;
      else if (summary.qualityScore >= 0.6) stats.qualityDistribution.medium++;
      else stats.qualityDistribution.low++;

      if (summary.length === 'brief') stats.lengthDistribution.brief++;
      else stats.lengthDistribution.detailed++;
    });

    stats.averageWordCount = Math.round(stats.averageWordCount / summaries.length);
    stats.averageQualityScore =
      Math.round((stats.averageQualityScore / summaries.length) * 100) / 100;
    stats.regenerationRate = Math.round((stats.regenerationRate / summaries.length) * 100);

    return stats;
  }
}

module.exports = { SummaryService };
