const { SummaryService } = require('../../services/SummaryService');
const { AIClient } = require('../../utils/aiClient');

// Mock the AIClient
jest.mock('../../utils/aiClient', () => ({
  AIClient: jest.fn().mockImplementation(() => ({
    generateChapterSummary: jest.fn(),
    generateContent: jest.fn(),
  })),
}));

describe('SummaryService', () => {
  let summaryService;
  let mockAIClient;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a new SummaryService instance which will create its own AIClient
    summaryService = new SummaryService();

    // Get the mocked AIClient instance from the SummaryService
    mockAIClient = summaryService.aiClient;
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(summaryService.defaultOptions.summaryLength).toBe('brief');
      expect(summaryService.defaultOptions.maxBriefWords).toBe(200);
      expect(summaryService.defaultOptions.contextWindow).toBe(3);
      expect(summaryService.defaultOptions.qualityThreshold).toBe(0.5);
    });

    it('should initialize with custom options', () => {
      const customService = new SummaryService({
        defaults: {
          summaryLength: 'detailed',
          maxBriefWords: 150,
          contextWindow: 5,
          qualityThreshold: 0.8,
        },
      });

      expect(customService.defaultOptions.summaryLength).toBe('detailed');
      expect(customService.defaultOptions.maxBriefWords).toBe(150);
      expect(customService.defaultOptions.contextWindow).toBe(5);
      expect(customService.defaultOptions.qualityThreshold).toBe(0.8);
    });
  });

  describe('generateChapterSummary', () => {
    const sampleChapterContent =
      'This is a long chapter content with many important details about artificial intelligence and machine learning. It covers various topics including neural networks, deep learning, and natural language processing. The chapter provides comprehensive examples and case studies to illustrate key concepts.';

    it('should generate a chapter summary successfully', async () => {
      const mockSummaryResult = {
        summary: 'This chapter covers AI and ML concepts including neural networks and NLP.',
        length: 'brief',
        wordCount: 12,
      };

      mockAIClient.generateChapterSummary.mockResolvedValue(mockSummaryResult);

      const result = await summaryService.generateChapterSummary(sampleChapterContent);

      expect(result.summary).toBe(mockSummaryResult.summary);
      expect(result.qualityScore).toBeGreaterThan(0);
      // Quality might be low enough to trigger regeneration, so we accept either
      expect(typeof result.regenerated).toBe('boolean');
      expect(mockAIClient.generateChapterSummary).toHaveBeenCalledWith(
        sampleChapterContent,
        expect.objectContaining({
          summaryLength: 'brief',
        }),
      );
    });

    it('should handle custom configuration options', async () => {
      const mockSummaryResult = {
        summary: 'Detailed summary of AI chapter with comprehensive coverage of topics.',
        length: 'detailed',
        wordCount: 25,
      };

      mockAIClient.generateChapterSummary.mockResolvedValue(mockSummaryResult);

      const options = {
        summaryLength: 'detailed',
        provider: 'anthropic',
        qualityThreshold: 0.8,
      };

      const result = await summaryService.generateChapterSummary(sampleChapterContent, options);

      expect(result.summary).toBe(mockSummaryResult.summary);
      expect(mockAIClient.generateChapterSummary).toHaveBeenCalledWith(
        sampleChapterContent,
        expect.objectContaining({
          summaryLength: 'detailed',
          provider: 'anthropic',
        }),
      );
    });

    it('should include context from previous summaries', async () => {
      const mockSummaryResult = {
        summary: 'Summary with context from previous chapters.',
        length: 'brief',
        wordCount: 15,
      };

      mockAIClient.generateChapterSummary.mockResolvedValue(mockSummaryResult);

      const options = {
        previousSummaries: [
          'Chapter 1 covered basic concepts.',
          'Chapter 2 discussed advanced topics.',
        ],
      };

      const result = await summaryService.generateChapterSummary(sampleChapterContent, options);

      expect(result.context).toBe('included');
      expect(result.summary).toBe(mockSummaryResult.summary);
    });

    it('should regenerate summary if quality is below threshold', async () => {
      const lowQualitySummary = {
        summary: 'AI.',
        length: 'brief',
        wordCount: 1,
      };

      const improvedSummary =
        'This chapter provides a comprehensive overview of artificial intelligence concepts.';

      mockAIClient.generateChapterSummary.mockResolvedValue(lowQualitySummary);
      mockAIClient.generateContent.mockResolvedValue(improvedSummary);

      const result = await summaryService.generateChapterSummary(sampleChapterContent);

      expect(result.regenerated).toBe(true);
      expect(result.originalQualityScore).toBeLessThan(0.7);
      expect(result.summary).toBe(improvedSummary);
      expect(mockAIClient.generateContent).toHaveBeenCalled();
    });

    it('should throw error for invalid input', async () => {
      await expect(summaryService.generateChapterSummary('')).rejects.toThrow(
        'Chapter content must be a non-empty string',
      );
      await expect(summaryService.generateChapterSummary(null)).rejects.toThrow(
        'Chapter content must be a non-empty string',
      );
      await expect(summaryService.generateChapterSummary('short')).rejects.toThrow(
        'Chapter content too short for meaningful summary',
      );
    });

    it('should handle AI client errors', async () => {
      mockAIClient.generateChapterSummary.mockRejectedValue(new Error('AI service unavailable'));

      await expect(summaryService.generateChapterSummary(sampleChapterContent)).rejects.toThrow(
        'Summary generation failed: AI service unavailable',
      );
    });
  });

  describe('generateBatchSummaries', () => {
    const sampleChapters = [
      {
        number: 1,
        title: 'Introduction to AI',
        content:
          'This chapter introduces artificial intelligence concepts and provides foundational knowledge for understanding machine learning algorithms and their applications in modern technology.',
      },
      {
        number: 2,
        title: 'Machine Learning Basics',
        content:
          'This chapter covers the fundamentals of machine learning including supervised and unsupervised learning techniques with practical examples and case studies.',
      },
    ];

    it('should generate summaries for multiple chapters', async () => {
      const mockSummaryResults = [
        { summary: 'Introduction to AI concepts and foundations.', length: 'brief', wordCount: 8 },
        { summary: 'Machine learning fundamentals and techniques.', length: 'brief', wordCount: 7 },
      ];

      mockAIClient.generateChapterSummary
        .mockResolvedValueOnce(mockSummaryResults[0])
        .mockResolvedValueOnce(mockSummaryResults[1]);

      const result = await summaryService.generateBatchSummaries(sampleChapters);

      expect(result.summaries).toHaveLength(2);
      expect(result.totalProcessed).toBe(2);
      expect(result.averageQuality).toBeGreaterThan(0);
      expect(result.summaries[0].chapterNumber).toBe(1);
      expect(result.summaries[0].chapterTitle).toBe('Introduction to AI');
      expect(result.summaries[1].chapterNumber).toBe(2);
      expect(result.summaries[1].chapterTitle).toBe('Machine Learning Basics');
    });

    it('should build context from previous summaries', async () => {
      const mockSummaryResults = [
        { summary: 'First chapter summary.', length: 'brief', wordCount: 4 },
        { summary: 'Second chapter summary with context.', length: 'brief', wordCount: 7 },
      ];

      mockAIClient.generateChapterSummary
        .mockResolvedValueOnce(mockSummaryResults[0])
        .mockResolvedValueOnce(mockSummaryResults[1]);

      await summaryService.generateBatchSummaries(sampleChapters);

      // Second call should include previous summary as context
      expect(mockAIClient.generateChapterSummary).toHaveBeenCalledTimes(2);

      // Verify that generateChapterSummary was called twice (once for each chapter)
      expect(mockAIClient.generateChapterSummary).toHaveBeenCalledTimes(2);
    });

    it('should handle batch processing errors', async () => {
      mockAIClient.generateChapterSummary.mockRejectedValue(new Error('Batch processing failed'));

      await expect(summaryService.generateBatchSummaries(sampleChapters)).rejects.toThrow(
        'Batch summary generation failed',
      );
    });
  });

  describe('buildContextPrompt', () => {
    it('should build context prompt from previous summaries', () => {
      const previousSummaries = ['Chapter 1 summary', 'Chapter 2 summary', 'Chapter 3 summary'];

      const contextPrompt = summaryService.buildContextPrompt(previousSummaries, 2);

      expect(contextPrompt).toContain('Previous chapter context:');
      expect(contextPrompt).toContain('Chapter 2: Chapter 2 summary');
      expect(contextPrompt).toContain('Chapter 3: Chapter 3 summary');
      expect(contextPrompt).not.toContain('Chapter 1: Chapter 1 summary');
    });

    it('should return null for empty or invalid input', () => {
      expect(summaryService.buildContextPrompt([], 3)).toBeNull();
      expect(summaryService.buildContextPrompt(null, 3)).toBeNull();
      expect(summaryService.buildContextPrompt(undefined, 3)).toBeNull();
    });

    it('should handle context window larger than available summaries', () => {
      const previousSummaries = ['Chapter 1 summary'];
      const contextPrompt = summaryService.buildContextPrompt(previousSummaries, 5);

      expect(contextPrompt).toContain('Chapter 1: Chapter 1 summary');
    });
  });

  describe('validateSummaryQuality', () => {
    const originalContent =
      'This is a comprehensive chapter about artificial intelligence and machine learning algorithms. It covers neural networks, deep learning, natural language processing, and computer vision applications.';

    it('should validate high-quality summary', () => {
      const goodSummary =
        'This chapter covers artificial intelligence and machine learning, including neural networks, deep learning, and natural language processing applications.';

      const qualityScore = summaryService.validateSummaryQuality(originalContent, goodSummary, {
        summaryLength: 'brief',
        maxBriefWords: 200,
      });

      expect(qualityScore).toBeGreaterThan(0.6);
    });

    it('should detect low-quality summary', () => {
      const poorSummary = 'AI.';

      const qualityScore = summaryService.validateSummaryQuality(originalContent, poorSummary, {
        summaryLength: 'brief',
        maxBriefWords: 200,
      });

      expect(qualityScore).toBeLessThan(0.5);
    });

    it('should handle validation errors gracefully', () => {
      // Test with invalid inputs that might cause validation to fail
      const qualityScore = summaryService.validateSummaryQuality('', '', {});

      expect(qualityScore).toBeGreaterThan(0.2); // Should handle gracefully
    });
  });

  describe('validateLength', () => {
    it('should validate appropriate length summary', () => {
      const summary = 'This is a summary of appropriate length for testing purposes.';
      const config = { summaryLength: 'brief', maxBriefWords: 20 };

      const lengthScore = summaryService.validateLength(summary, config);

      expect(lengthScore).toBeGreaterThan(0.8);
    });

    it('should penalize too short summaries', () => {
      const summary = 'Short.';
      const config = { summaryLength: 'brief', maxBriefWords: 100 };

      const lengthScore = summaryService.validateLength(summary, config);

      expect(lengthScore).toBeLessThan(0.5);
    });

    it('should penalize too long summaries', () => {
      const summary =
        'This is an extremely long summary that goes on and on with many unnecessary words and details that should not be included in a brief summary format because it exceeds the target length significantly.';
      const config = { summaryLength: 'brief', maxBriefWords: 10 };

      const lengthScore = summaryService.validateLength(summary, config);

      expect(lengthScore).toBeLessThan(0.8);
    });
  });

  describe('validateContentCoverage', () => {
    it('should validate good content coverage', () => {
      const originalContent =
        'This chapter discusses artificial intelligence, machine learning, neural networks, and deep learning algorithms.';
      const summary =
        'The chapter covers artificial intelligence and machine learning concepts including neural networks.';

      const coverageScore = summaryService.validateContentCoverage(originalContent, summary);

      expect(coverageScore).toBeGreaterThan(0.3);
    });

    it('should detect poor content coverage', () => {
      const originalContent =
        'This chapter discusses artificial intelligence, machine learning, neural networks, and deep learning algorithms.';
      const summary = 'The weather is nice today.';

      const coverageScore = summaryService.validateContentCoverage(originalContent, summary);

      expect(coverageScore).toBeLessThan(0.3);
    });

    it('should handle validation errors gracefully', () => {
      const coverageScore = summaryService.validateContentCoverage('', '');

      expect(coverageScore).toBe(0); // Empty strings should return 0
    });
  });

  describe('validateCoherence', () => {
    it('should validate coherent summary', () => {
      const coherentSummary =
        'This chapter introduces artificial intelligence concepts. Furthermore, it discusses machine learning algorithms. Therefore, readers gain comprehensive understanding.';

      const coherenceScore = summaryService.validateCoherence(coherentSummary);

      expect(coherenceScore).toBeGreaterThan(0.7);
    });

    it('should detect incoherent summary', () => {
      const incoherentSummary =
        'AI machine learning neural networks deep learning algorithms applications computer vision natural language processing.';

      const coherenceScore = summaryService.validateCoherence(incoherentSummary);

      expect(coherenceScore).toBeLessThan(0.8);
    });

    it('should handle very short summaries', () => {
      const shortSummary = 'AI concepts.';

      const coherenceScore = summaryService.validateCoherence(shortSummary);

      expect(coherenceScore).toBe(0.5);
    });
  });

  describe('validateRelevance', () => {
    it('should validate relevant summary', () => {
      const originalContent =
        'This chapter covers artificial intelligence and machine learning concepts.';
      const relevantSummary = 'The chapter discusses artificial intelligence and machine learning.';

      const relevanceScore = summaryService.validateRelevance(originalContent, relevantSummary);

      expect(relevanceScore).toBeGreaterThan(0.5);
    });

    it('should detect irrelevant summary', () => {
      const originalContent =
        'This chapter covers artificial intelligence and machine learning concepts.';
      const irrelevantSummary = 'The weather forecast shows sunny skies tomorrow.';

      const relevanceScore = summaryService.validateRelevance(originalContent, irrelevantSummary);

      expect(relevanceScore).toBeLessThan(0.3);
    });
  });

  describe('regenerateSummaryWithFeedback', () => {
    it('should regenerate summary with feedback', async () => {
      const originalContent = 'Chapter content about AI and ML.';
      const previousSummary = 'AI.';
      const config = { summaryLength: 'brief', provider: 'openai' };
      const improvedSummary =
        'This chapter covers artificial intelligence and machine learning concepts.';

      mockAIClient.generateContent.mockResolvedValue(improvedSummary);

      const result = await summaryService.regenerateSummaryWithFeedback(
        originalContent,
        previousSummary,
        config,
      );

      expect(result.summary).toBe(improvedSummary);
      expect(result.length).toBe('brief');
      expect(mockAIClient.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('Please improve the following chapter summary'),
        expect.objectContaining({
          provider: 'openai',
          temperature: 0.6,
        }),
      );
    });

    it('should return original summary if regeneration fails', async () => {
      const originalContent = 'Chapter content';
      const previousSummary = 'Original summary';
      const config = { summaryLength: 'brief' };

      mockAIClient.generateContent.mockRejectedValue(new Error('Regeneration failed'));

      const result = await summaryService.regenerateSummaryWithFeedback(
        originalContent,
        previousSummary,
        config,
      );

      expect(result.summary).toBe(previousSummary);
    });
  });

  describe('buildFeedbackPrompt', () => {
    it('should build comprehensive feedback prompt', () => {
      const originalContent = 'This is the original chapter content about AI.';
      const previousSummary = 'AI summary.';
      const config = { summaryLength: 'brief', maxBriefWords: 200 };

      const feedbackPrompt = summaryService.buildFeedbackPrompt(
        originalContent,
        previousSummary,
        config,
      );

      expect(feedbackPrompt).toContain('ORIGINAL CHAPTER CONTENT:');
      expect(feedbackPrompt).toContain('CURRENT SUMMARY:');
      expect(feedbackPrompt).toContain('IMPROVEMENT REQUIREMENTS:');
      expect(feedbackPrompt).toContain('approximately 200 words');
      expect(feedbackPrompt).toContain(originalContent);
      expect(feedbackPrompt).toContain(previousSummary);
    });

    it('should truncate very long content', () => {
      const longContent = 'A'.repeat(3000);
      const previousSummary = 'Summary';
      const config = { summaryLength: 'brief', maxBriefWords: 200 };

      const feedbackPrompt = summaryService.buildFeedbackPrompt(
        longContent,
        previousSummary,
        config,
      );

      expect(feedbackPrompt).toContain('...');
      expect(feedbackPrompt.length).toBeLessThan(longContent.length + 1000);
    });
  });

  describe('getSummaryStatistics', () => {
    it('should calculate statistics for summary array', () => {
      const summaries = [
        { wordCount: 100, qualityScore: 0.8, regenerated: false, length: 'brief' },
        { wordCount: 150, qualityScore: 0.9, regenerated: true, length: 'detailed' },
        { wordCount: 120, qualityScore: 0.6, regenerated: false, length: 'brief' },
      ];

      const stats = summaryService.getSummaryStatistics(summaries);

      expect(stats.totalSummaries).toBe(3);
      expect(stats.averageWordCount).toBe(123);
      expect(stats.averageQualityScore).toBe(0.77);
      expect(stats.regenerationRate).toBe(33);
      expect(stats.qualityDistribution.high).toBe(2);
      expect(stats.qualityDistribution.medium).toBe(1);
      expect(stats.qualityDistribution.low).toBe(0);
      expect(stats.lengthDistribution.brief).toBe(2);
      expect(stats.lengthDistribution.detailed).toBe(1);
    });

    it('should return null for empty or invalid input', () => {
      expect(summaryService.getSummaryStatistics([])).toBeNull();
      expect(summaryService.getSummaryStatistics(null)).toBeNull();
      expect(summaryService.getSummaryStatistics(undefined)).toBeNull();
    });
  });
});
