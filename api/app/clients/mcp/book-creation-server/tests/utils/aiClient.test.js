const { AIClient } = require('../../utils/aiClient');

// Mock AI provider SDKs
const mockOpenAICreate = jest.fn();
const mockAnthropicCreate = jest.fn();
const mockGoogleGenerate = jest.fn();

jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockOpenAICreate,
      },
    },
  })),
}));

jest.mock('@anthropic-ai/sdk', () => ({
  Anthropic: jest.fn().mockImplementation(() => ({
    messages: {
      create: mockAnthropicCreate,
    },
  })),
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGoogleGenerate,
    }),
  })),
}));

describe('AIClient', () => {
  let aiClient;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up environment variables for testing
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.GOOGLE_API_KEY = 'test-google-key';

    aiClient = new AIClient();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_API_KEY;
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(aiClient.defaultProvider).toBe('openai');
      expect(aiClient.retryConfig.maxRetries).toBe(3);
      expect(aiClient.retryConfig.baseDelay).toBe(1000);
    });

    it('should initialize with custom options', () => {
      const customClient = new AIClient({
        defaultProvider: 'anthropic',
        retryConfig: { maxRetries: 5, baseDelay: 2000 },
      });

      expect(customClient.defaultProvider).toBe('anthropic');
      expect(customClient.retryConfig.maxRetries).toBe(5);
      expect(customClient.retryConfig.baseDelay).toBe(2000);
    });

    it('should throw error when no providers are available', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      expect(() => new AIClient()).toThrow('No AI providers available');
    });
  });

  describe('generateBookOutline', () => {
    it('should generate book outline with default configuration', async () => {
      const mockResponse = JSON.stringify({
        title: 'Test Book',
        description: 'A test book description',
        chapters: [
          {
            number: 1,
            title: 'Chapter 1',
            description: 'First chapter description',
            keyTopics: ['topic1', 'topic2'],
          },
        ],
      });

      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }],
      });

      const result = await aiClient.generateBookOutline('Test Theme');

      expect(result.title).toBe('Test Book');
      expect(result.chapters).toHaveLength(1);
      expect(result.chapters[0].title).toBe('Chapter 1');
      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user' }),
          ]),
        }),
      );
    });

    it('should handle custom configuration', async () => {
      const mockResponse = JSON.stringify({
        title: 'Custom Book',
        description: 'Custom description',
        chapters: [],
      });

      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }],
      });

      const config = {
        genre: 'fiction',
        chapterCount: 15,
        targetAudience: 'young adults',
        writingStyle: 'creative',
      };

      const result = await aiClient.generateBookOutline('Fantasy Theme', config);

      expect(result.title).toBe('Custom Book');
      expect(mockOpenAICreate).toHaveBeenCalled();
    });

    it('should handle malformed JSON response with fallback', async () => {
      const mockResponse = `Chapter 1: Introduction
Chapter 2: Getting Started
Chapter 3: Advanced Topics`;

      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }],
      });

      const result = await aiClient.generateBookOutline('Test Theme');

      expect(result.title).toBe('Generated Book');
      expect(result.chapters).toHaveLength(3);
      expect(result.chapters[0].title).toBe('Introduction');
    });

    it('should throw error on AI provider failure', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('API Error'));

      await expect(aiClient.generateBookOutline('Test Theme')).rejects.toThrow(
        'Failed to generate book outline',
      );
    });
  });

  describe('generateChapter', () => {
    it('should generate chapter content', async () => {
      const mockResponse =
        'This is the generated chapter content with detailed information about the topic.';

      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }],
      });

      const chapterInfo = {
        title: 'Test Chapter',
        description: 'A test chapter',
        chapterNumber: 1,
        totalChapters: 10,
      };

      const context = {
        bookTheme: 'Test Theme',
        genre: 'non-fiction',
        previousSummaries: ['Previous chapter summary'],
      };

      const result = await aiClient.generateChapter(chapterInfo, context);

      expect(result.content).toBe(mockResponse);
      expect(result.chapterNumber).toBe(1);
      expect(result.title).toBe('Test Chapter');
      expect(result.wordCount).toBeGreaterThan(0);
      expect(mockOpenAICreate).toHaveBeenCalled();
    });

    it('should handle chapter generation without previous summaries', async () => {
      const mockResponse = 'Chapter content without previous context.';

      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }],
      });

      const chapterInfo = {
        title: 'First Chapter',
        description: 'The first chapter',
        chapterNumber: 1,
        totalChapters: 5,
      };

      const result = await aiClient.generateChapter(chapterInfo);

      expect(result.content).toBe(mockResponse);
      expect(mockOpenAICreate).toHaveBeenCalled();
    });

    it('should throw error on chapter generation failure', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('Generation failed'));

      const chapterInfo = {
        title: 'Test Chapter',
        description: 'A test chapter',
        chapterNumber: 1,
        totalChapters: 10,
      };

      await expect(aiClient.generateChapter(chapterInfo)).rejects.toThrow(
        'Failed to generate chapter',
      );
    });
  });

  describe('generateChapterSummary', () => {
    it('should generate brief chapter summary', async () => {
      const mockResponse = 'This is a brief summary of the chapter content.';

      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }],
      });

      const chapterContent = 'Long chapter content that needs to be summarized...';
      const result = await aiClient.generateChapterSummary(chapterContent);

      expect(result.summary).toBe(mockResponse);
      expect(result.length).toBe('brief');
      expect(result.wordCount).toBeGreaterThan(0);
      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 300,
          temperature: 0.5,
        }),
      );
    });

    it('should generate detailed chapter summary', async () => {
      const mockResponse =
        'This is a detailed summary with more comprehensive information about the chapter.';

      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }],
      });

      const chapterContent = 'Long chapter content...';
      const result = await aiClient.generateChapterSummary(chapterContent, {
        summaryLength: 'detailed',
      });

      expect(result.summary).toBe(mockResponse);
      expect(result.length).toBe('detailed');
    });

    it('should throw error on summary generation failure', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('Summary failed'));

      await expect(aiClient.generateChapterSummary('content')).rejects.toThrow(
        'Failed to generate chapter summary',
      );
    });
  });

  describe('provider-specific generation', () => {
    it('should generate content with Anthropic', async () => {
      const mockResponse = 'Anthropic generated content';

      mockAnthropicCreate.mockResolvedValue({
        content: [{ text: mockResponse }],
      });

      const result = await aiClient.generateContent('test prompt', { provider: 'anthropic' });

      expect(result).toBe(mockResponse);
      expect(mockAnthropicCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-5-sonnet-20241022',
          messages: [{ role: 'user', content: 'test prompt' }],
        }),
      );
    });

    it('should generate content with Google', async () => {
      const mockResponse = 'Google generated content';

      const mockResult = {
        response: {
          text: jest.fn().mockReturnValue(mockResponse),
        },
      };

      mockGoogleGenerate.mockResolvedValue(mockResult);

      const result = await aiClient.generateContent('test prompt', { provider: 'google' });

      expect(result).toBe(mockResponse);
    });

    it('should throw error for unsupported provider', async () => {
      await expect(
        aiClient.generateContent('test prompt', { provider: 'unsupported' }),
      ).rejects.toThrow('Provider unsupported is not available');
    });
  });

  describe('retry mechanism', () => {
    it('should retry on retryable errors', async () => {
      mockOpenAICreate
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          choices: [{ message: { content: 'Success after retries' } }],
        });

      // Mock sleep to speed up tests
      jest.spyOn(aiClient, 'sleep').mockResolvedValue();

      const result = await aiClient.generateContent('test prompt');

      expect(result).toBe('Success after retries');
      expect(mockOpenAICreate).toHaveBeenCalledTimes(3);
      expect(aiClient.sleep).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('invalid_api_key'));

      await expect(aiClient.generateContent('test prompt')).rejects.toThrow('invalid_api_key');
      expect(mockOpenAICreate).toHaveBeenCalledTimes(1);
    });

    it('should throw last error after max retries', async () => {
      const error = new Error('Persistent failure');
      mockOpenAICreate.mockRejectedValue(error);

      // Mock sleep to speed up tests
      jest.spyOn(aiClient, 'sleep').mockResolvedValue();

      await expect(aiClient.generateContent('test prompt')).rejects.toThrow('Persistent failure');
      expect(mockOpenAICreate).toHaveBeenCalledTimes(3);
    });
  });

  describe('utility methods', () => {
    it('should estimate word count correctly', () => {
      const text = 'This is a test sentence with eight words.';
      const wordCount = aiClient.estimateWordCount(text);
      expect(wordCount).toBe(8);
    });

    it('should get available providers', () => {
      const providers = aiClient.getAvailableProviders();
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
      expect(providers).toContain('google');
    });

    it('should check provider availability', () => {
      expect(aiClient.isProviderAvailable('openai')).toBe(true);
      expect(aiClient.isProviderAvailable('nonexistent')).toBe(false);
    });

    it('should set default provider', () => {
      aiClient.setDefaultProvider('anthropic');
      expect(aiClient.defaultProvider).toBe('anthropic');
    });

    it('should throw error when setting unavailable provider as default', () => {
      expect(() => aiClient.setDefaultProvider('nonexistent')).toThrow(
        'Provider nonexistent is not available',
      );
    });
  });

  describe('prompt building', () => {
    it('should build outline prompt correctly', () => {
      const prompt = aiClient.buildOutlinePrompt(
        'AI Technology',
        'technical',
        12,
        'developers',
        'formal',
      );

      expect(prompt).toContain('AI Technology');
      expect(prompt).toContain('technical');
      expect(prompt).toContain('12');
      expect(prompt).toContain('developers');
      expect(prompt).toContain('formal');
      expect(prompt).toContain('JSON');
    });

    it('should build chapter prompt correctly', () => {
      const prompt = aiClient.buildChapterPrompt(
        'Introduction',
        'Chapter about basics',
        1,
        10,
        'AI Technology',
        'technical',
        'formal',
        'developers',
        ['Previous summary'],
        2000,
      );

      expect(prompt).toContain('Introduction');
      expect(prompt).toContain('Chapter 1 of 10');
      expect(prompt).toContain('AI Technology');
      expect(prompt).toContain('Previous summary');
      expect(prompt).toContain('2000 words');
    });

    it('should build summary prompt correctly', () => {
      const prompt = aiClient.buildSummaryPrompt('Chapter content here', 200);

      expect(prompt).toContain('200 words');
      expect(prompt).toContain('Chapter content here');
      expect(prompt).toContain('main points');
    });
  });
});
