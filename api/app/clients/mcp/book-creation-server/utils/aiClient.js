const { OpenAI } = require('openai');
const { Anthropic } = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const {
  AIError,
  RateLimitError,
  TimeoutError,
  ConfigurationError,
  ERROR_CODES,
  isRetryableError,
} = require('./errors');

// Use console for logging in MCP server context
const logger = {
  info: (...args) => console.log('[AI-INFO]', ...args),
  warn: (...args) => console.warn('[AI-WARN]', ...args),
  error: (...args) => console.error('[AI-ERROR]', ...args),
  debug: (...args) => console.log('[AI-DEBUG]', ...args),
};

/**
 * AI Client for Book Creation MCP Server
 * Provides a unified interface for content generation across multiple AI providers
 * with comprehensive error handling, retry logic, and fallback mechanisms
 */
class AIClient {
  constructor(options = {}) {
    this.defaultProvider = options.defaultProvider || 'openai';
    this.providers = {};
    this.providerPriority = options.providerPriority || ['openai', 'anthropic', 'google'];
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      exponentialBase: 2,
      jitter: true,
      ...options.retryConfig,
    };

    // Token limit handling
    this.tokenLimits = {
      openai: { input: 8000, output: 4000 },
      anthropic: { input: 100000, output: 4000 },
      google: { input: 30000, output: 2000 },
      ...options.tokenLimits,
    };

    // Timeout configuration
    this.timeouts = {
      default: 60000,
      outline: 90000,
      chapter: 120000,
      summary: 30000,
      ...options.timeouts,
    };

    // Rate limiting tracking
    this.rateLimitTracker = new Map();

    // Fallback configuration
    this.fallbackConfig = {
      enableFallback: options.enableFallback !== false,
      maxFallbackAttempts: options.maxFallbackAttempts || 2,
      fallbackDelay: options.fallbackDelay || 5000,
    };

    this.initializeProviders(options);
  }

  /**
   * Initialize AI providers based on available API keys with error handling
   */
  initializeProviders(options) {
    const initializationErrors = [];

    // OpenAI
    if (process.env.OPENAI_API_KEY || options.openaiApiKey) {
      try {
        this.providers.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY || options.openaiApiKey,
          timeout: this.timeouts.default,
          maxRetries: 0, // We handle retries ourselves
        });
        logger.info('[AIClient] OpenAI provider initialized');
      } catch (error) {
        const initError = `Failed to initialize OpenAI provider: ${error.message}`;
        logger.error('[AIClient]', initError);
        initializationErrors.push({ provider: 'openai', error: initError });
      }
    }

    // Anthropic
    if (process.env.ANTHROPIC_API_KEY || options.anthropicApiKey) {
      try {
        this.providers.anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY || options.anthropicApiKey,
          timeout: this.timeouts.default,
          maxRetries: 0, // We handle retries ourselves
        });
        logger.info('[AIClient] Anthropic provider initialized');
      } catch (error) {
        const initError = `Failed to initialize Anthropic provider: ${error.message}`;
        logger.error('[AIClient]', initError);
        initializationErrors.push({ provider: 'anthropic', error: initError });
      }
    }

    // Google
    if (process.env.GOOGLE_API_KEY || options.googleApiKey) {
      try {
        this.providers.google = new GoogleGenerativeAI(
          process.env.GOOGLE_API_KEY || options.googleApiKey,
        );
        logger.info('[AIClient] Google provider initialized');
      } catch (error) {
        const initError = `Failed to initialize Google provider: ${error.message}`;
        logger.error('[AIClient]', initError);
        initializationErrors.push({ provider: 'google', error: initError });
      }
    }

    // Validate at least one provider is available
    const availableProviders = Object.keys(this.providers);
    if (availableProviders.length === 0) {
      throw new ConfigurationError(
        'No AI providers available. Please configure at least one API key.',
        'ai_providers',
        {
          initializationErrors,
          requiredEnvVars: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY'],
        },
      );
    }

    // Set default provider to first available if specified provider is not available
    if (!this.providers[this.defaultProvider]) {
      const newDefault =
        this.providerPriority.find((p) => this.providers[p]) || availableProviders[0];
      logger.warn(
        `[AIClient] Default provider '${this.defaultProvider}' not available, using '${newDefault}'`,
      );
      this.defaultProvider = newDefault;
    }

    logger.info(`[AIClient] Initialized with providers: ${availableProviders.join(', ')}`);
    logger.info(`[AIClient] Default provider: ${this.defaultProvider}`);
  }

  /**
   * Generate book outline based on theme and configuration with fallback support
   */
  async generateBookOutline(theme, config = {}) {
    const {
      genre = 'non-fiction',
      chapterCount = 10,
      targetAudience = 'general audience',
      writingStyle = 'casual',
      provider = this.defaultProvider,
    } = config;

    const prompt = this.buildOutlinePrompt(
      theme,
      genre,
      chapterCount,
      targetAudience,
      writingStyle,
    );

    const operation = async (selectedProvider) => {
      const response = await this.generateContent(prompt, {
        provider: selectedProvider,
        maxTokens: 2000,
        temperature: 0.7,
        timeout: this.timeouts.outline,
        systemMessage:
          'You are an expert book outline creator. Generate structured, engaging book outlines that provide clear chapter progression and comprehensive coverage of the topic.',
      });

      return this.parseOutlineResponse(response);
    };

    try {
      return await this.executeWithFallback(operation, provider, 'generateBookOutline');
    } catch (error) {
      throw new AIError(`Failed to generate book outline: ${error.message}`, provider, {
        operation: 'generateBookOutline',
        theme,
        genre,
        chapterCount,
        originalError: error.message,
      });
    }
  }

  /**
   * Generate chapter content with context from previous chapters and content chunking
   */
  async generateChapter(chapterInfo, context = {}) {
    const { title, description, chapterNumber, totalChapters } = chapterInfo;

    const {
      bookTheme,
      genre = 'non-fiction',
      writingStyle = 'casual',
      targetAudience = 'general audience',
      previousSummaries = [],
      targetWordCount = 2000,
      provider = this.defaultProvider,
    } = context;

    // Handle token limits by chunking content if necessary
    const { prompt, needsChunking } = this.buildChapterPromptWithTokenHandling(
      title,
      description,
      chapterNumber,
      totalChapters,
      bookTheme,
      genre,
      writingStyle,
      targetAudience,
      previousSummaries,
      targetWordCount,
      provider,
    );

    const operation = async (selectedProvider) => {
      if (needsChunking) {
        return await this.generateChapterWithChunking(chapterInfo, context, selectedProvider);
      }

      const response = await this.generateContent(prompt, {
        provider: selectedProvider,
        maxTokens: 4000,
        temperature: 0.8,
        timeout: this.timeouts.chapter,
        systemMessage:
          'You are an expert book writer. Create engaging, well-structured chapters that flow naturally and provide valuable content to readers.',
      });

      return {
        content: response,
        wordCount: this.estimateWordCount(response),
        chapterNumber,
        title,
      };
    };

    try {
      return await this.executeWithFallback(operation, provider, 'generateChapter');
    } catch (error) {
      throw new AIError(`Failed to generate chapter: ${error.message}`, provider, {
        operation: 'generateChapter',
        chapterNumber,
        title,
        originalError: error.message,
      });
    }
  }

  /**
   * Generate chapter summary for context in future chapters with content truncation
   */
  async generateChapterSummary(chapterContent, options = {}) {
    const { summaryLength = 'brief', provider = this.defaultProvider } = options;

    const maxLength = summaryLength === 'brief' ? 200 : 500;

    // Truncate content if it's too long for the provider's token limit
    const truncatedContent = this.truncateContentForProvider(chapterContent, provider, 'summary');
    const prompt = this.buildSummaryPrompt(truncatedContent, maxLength);

    const operation = async (selectedProvider) => {
      const response = await this.generateContent(prompt, {
        provider: selectedProvider,
        maxTokens: 300,
        temperature: 0.5,
        timeout: this.timeouts.summary,
        systemMessage:
          'You are an expert at creating concise, informative chapter summaries that capture key points and maintain narrative flow.',
      });

      return {
        summary: response,
        length: summaryLength,
        wordCount: this.estimateWordCount(response),
      };
    };

    try {
      return await this.executeWithFallback(operation, provider, 'generateChapterSummary');
    } catch (error) {
      throw new AIError(`Failed to generate chapter summary: ${error.message}`, provider, {
        operation: 'generateChapterSummary',
        summaryLength,
        originalError: error.message,
      });
    }
  }

  /**
   * Core content generation method with comprehensive error handling
   */
  async generateContent(prompt, options = {}) {
    const {
      provider = this.defaultProvider,
      maxTokens = 2000,
      temperature = 0.7,
      timeout = this.timeouts.default,
      systemMessage = 'You are a helpful AI assistant.',
    } = options;

    if (!this.providers[provider]) {
      throw new AIError(`Provider ${provider} is not available`, provider, {
        availableProviders: Object.keys(this.providers),
      });
    }

    // Check rate limiting
    if (this.isRateLimited(provider)) {
      const resetTime = this.getRateLimitResetTime(provider);
      throw new RateLimitError(`Rate limit exceeded for provider ${provider}`, resetTime, {
        provider,
      });
    }

    const operation = async () => {
      const startTime = Date.now();

      try {
        // Set up timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(
              new TimeoutError(`AI generation timed out after ${timeout}ms`, timeout, {
                provider,
                operation: 'generateContent',
              }),
            );
          }, timeout);
        });

        const generationPromise = this.executeProviderGeneration(
          provider,
          prompt,
          systemMessage,
          maxTokens,
          temperature,
        );

        const result = await Promise.race([generationPromise, timeoutPromise]);

        const duration = Date.now() - startTime;
        logger.debug(`[AIClient] Generation completed in ${duration}ms with ${provider}`);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(
          `[AIClient] Generation failed after ${duration}ms with ${provider}:`,
          error.message,
        );

        // Handle rate limiting
        if (this.isRateLimitError(error)) {
          this.handleRateLimit(provider, error);
          throw new RateLimitError(
            `Rate limit exceeded for provider ${provider}`,
            this.extractRetryAfter(error),
            { provider, originalError: error.message },
          );
        }

        // Handle token limit errors
        if (this.isTokenLimitError(error)) {
          throw new AIError(`Token limit exceeded for provider ${provider}`, provider, {
            code: ERROR_CODES.TOKEN_LIMIT_EXCEEDED,
            originalError: error.message,
            suggestion: 'Try reducing content length or using content chunking',
          });
        }

        // Transform other errors
        throw this.transformProviderError(error, provider);
      }
    };

    return await this.withRetry(operation, provider);
  }

  /**
   * Generate content using OpenAI
   */
  async generateWithOpenAI(prompt, systemMessage, maxTokens, temperature) {
    const response = await this.providers.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: temperature,
    });

    return response.choices[0].message.content;
  }

  /**
   * Generate content using Anthropic
   */
  async generateWithAnthropic(prompt, systemMessage, maxTokens, temperature) {
    const response = await this.providers.anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: maxTokens,
      temperature: temperature,
      system: systemMessage,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.content[0].text;
  }

  /**
   * Generate content using Google
   */
  async generateWithGoogle(prompt, systemMessage, maxTokens, temperature) {
    const model = this.providers.google.getGenerativeModel({
      model: 'gemini-pro',
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: temperature,
      },
    });

    const fullPrompt = `${systemMessage}\n\n${prompt}`;
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;

    return response.text();
  }

  /**
   * Build prompt for book outline generation
   */
  buildOutlinePrompt(theme, genre, chapterCount, targetAudience, writingStyle) {
    return `Create a detailed book outline for a ${genre} book with the following specifications:

Theme: ${theme}
Number of chapters: ${chapterCount}
Target audience: ${targetAudience}
Writing style: ${writingStyle}

Please provide:
1. A compelling book title
2. A brief book description (2-3 sentences)
3. Chapter-by-chapter breakdown with:
   - Chapter number and title
   - 2-3 sentence description of chapter content
   - Key topics or points to cover

Format the response as JSON with the following structure:
{
  "title": "Book Title",
  "description": "Book description",
  "chapters": [
    {
      "number": 1,
      "title": "Chapter Title",
      "description": "Chapter description",
      "keyTopics": ["topic1", "topic2", "topic3"]
    }
  ]
}`;
  }

  /**
   * Build prompt for chapter content generation
   */
  buildChapterPrompt(
    title,
    description,
    chapterNumber,
    totalChapters,
    bookTheme,
    genre,
    writingStyle,
    targetAudience,
    previousSummaries,
    targetWordCount,
  ) {
    let contextSection = '';
    if (previousSummaries.length > 0) {
      contextSection = `\nPrevious chapters context:\n${previousSummaries
        .map((summary, index) => `Chapter ${index + 1}: ${summary}`)
        .join('\n')}\n`;
    }

    return `Write Chapter ${chapterNumber} of ${totalChapters} for a ${genre} book about "${bookTheme}".

Chapter Details:
- Title: ${title}
- Description: ${description}
- Target word count: ${targetWordCount} words
- Writing style: ${writingStyle}
- Target audience: ${targetAudience}
${contextSection}
Instructions:
1. Write engaging, well-structured content that flows naturally
2. Include relevant examples, anecdotes, or case studies where appropriate
3. Maintain consistency with the book's theme and previous chapters
4. Use clear headings and subheadings to organize content
5. End with a smooth transition that connects to the next chapter
6. Write in ${writingStyle} style appropriate for ${targetAudience}

Please write the complete chapter content:`;
  }

  /**
   * Build prompt for chapter summary generation
   */
  buildSummaryPrompt(chapterContent, maxLength) {
    return `Create a concise summary of the following chapter content. The summary should:
1. Capture the main points and key takeaways
2. Be approximately ${maxLength} words or less
3. Maintain the narrative flow for context in future chapters
4. Focus on actionable insights and important concepts

Chapter content:
${chapterContent}

Summary:`;
  }

  /**
   * Build prompt for chapter section generation (used in chunking)
   */
  buildChapterSectionPrompt(chapterInfo, context, sectionNumber, totalSections) {
    const { title, description, chapterNumber } = chapterInfo;
    const {
      bookTheme,
      genre = 'non-fiction',
      writingStyle = 'casual',
      targetAudience = 'general audience',
    } = context;

    return `Write section ${sectionNumber} of ${totalSections} for Chapter ${chapterNumber}: "${title}".

Chapter Description: ${description}
Book Theme: ${bookTheme}
Genre: ${genre}
Writing Style: ${writingStyle}
Target Audience: ${targetAudience}

Instructions for this section:
1. Write approximately 600-800 words
2. Focus on one main aspect of the chapter topic
3. Ensure smooth flow ${sectionNumber > 1 ? 'from the previous section' : 'as the opening section'}
4. ${sectionNumber < totalSections ? 'End with a transition to the next section' : 'Provide a strong conclusion for the chapter'}
5. Use clear subheadings if appropriate
6. Include relevant examples or illustrations

Write section ${sectionNumber}:`;
  }

  /**
   * Parse outline response and validate structure
   */
  parseOutlineResponse(response) {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(response);

      // Validate required fields
      if (!parsed.title || !parsed.description || !Array.isArray(parsed.chapters)) {
        throw new Error('Invalid outline structure');
      }

      // Validate chapters
      parsed.chapters.forEach((chapter, index) => {
        if (!chapter.title || !chapter.description || typeof chapter.number !== 'number') {
          throw new Error(`Invalid chapter structure at index ${index}`);
        }
      });

      return parsed;
    } catch (error) {
      logger.error('[AIClient] Failed to parse outline response:', error);

      // Fallback: try to extract outline from text response
      return this.extractOutlineFromText(response);
    }
  }

  /**
   * Fallback method to extract outline from text response
   */
  extractOutlineFromText(text) {
    // This is a simplified fallback - in production, you might want more sophisticated parsing
    const lines = text.split('\n').filter((line) => line.trim());
    const outline = {
      title: 'Generated Book',
      description: 'A book generated based on your theme',
      chapters: [],
    };

    let chapterNumber = 1;
    for (const line of lines) {
      if (line.toLowerCase().includes('chapter') || /^\d+\./.test(line.trim())) {
        outline.chapters.push({
          number: chapterNumber++,
          title: line
            .replace(/^\d+\.?\s*/, '')
            .replace(/chapter\s*\d*:?\s*/i, '')
            .trim(),
          description: 'Chapter content to be generated',
          keyTopics: [],
        });
      }
    }

    return outline;
  }

  /**
   * Estimate word count from text
   */
  estimateWordCount(text) {
    return text.trim().split(/\s+/).length;
  }

  /**
   * Execute operation with fallback to other providers
   */
  async executeWithFallback(operation, preferredProvider, operationName) {
    const providers = this.getProviderFallbackOrder(preferredProvider);
    let lastError;

    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];

      try {
        logger.debug(`[AIClient] Attempting ${operationName} with provider: ${provider}`);
        const result = await operation(provider);

        if (i > 0) {
          logger.info(`[AIClient] ${operationName} succeeded with fallback provider: ${provider}`);
        }

        return result;
      } catch (error) {
        lastError = error;

        logger.warn(`[AIClient] ${operationName} failed with provider ${provider}:`, error.message);

        // Don't try fallback for certain errors
        if (!this.shouldTryFallback(error)) {
          throw error;
        }

        // If this is the last provider, throw the error
        if (i === providers.length - 1) {
          break;
        }

        // Wait before trying next provider
        if (this.fallbackConfig.fallbackDelay > 0) {
          await this.sleep(this.fallbackConfig.fallbackDelay);
        }
      }
    }

    throw new AIError(`All providers failed for ${operationName}`, 'all', {
      attemptedProviders: providers,
      lastError: lastError.message,
      operation: operationName,
    });
  }

  /**
   * Get provider fallback order based on preference and availability
   */
  getProviderFallbackOrder(preferredProvider) {
    const availableProviders = Object.keys(this.providers);

    if (!this.fallbackConfig.enableFallback) {
      return availableProviders.includes(preferredProvider) ? [preferredProvider] : [];
    }

    // Start with preferred provider if available
    const providers = [];
    if (availableProviders.includes(preferredProvider)) {
      providers.push(preferredProvider);
    }

    // Add other providers in priority order
    for (const provider of this.providerPriority) {
      if (provider !== preferredProvider && availableProviders.includes(provider)) {
        providers.push(provider);
      }
    }

    // Add any remaining providers
    for (const provider of availableProviders) {
      if (!providers.includes(provider)) {
        providers.push(provider);
      }
    }

    return providers.slice(0, this.fallbackConfig.maxFallbackAttempts + 1);
  }

  /**
   * Check if we should try fallback for this error
   */
  shouldTryFallback(error) {
    // Don't fallback for authentication errors
    if (
      error.message?.toLowerCase().includes('api key') ||
      error.message?.toLowerCase().includes('authentication')
    ) {
      return false;
    }

    // Don't fallback for validation errors
    if (error.message?.toLowerCase().includes('invalid request')) {
      return false;
    }

    // Fallback for rate limits, timeouts, and server errors
    return (
      error instanceof RateLimitError ||
      error instanceof TimeoutError ||
      error.message?.toLowerCase().includes('rate limit') ||
      error.message?.toLowerCase().includes('timeout') ||
      error.message?.toLowerCase().includes('server error') ||
      (error.status && error.status >= 500)
    );
  }

  /**
   * Enhanced retry mechanism with exponential backoff and jitter
   */
  async withRetry(operation, provider) {
    let lastError;

    for (let attempt = 1; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry on certain types of errors
        if (!this.isRetryableError(error)) {
          throw error;
        }

        if (attempt === this.retryConfig.maxRetries) {
          break;
        }

        const baseDelay =
          this.retryConfig.baseDelay * Math.pow(this.retryConfig.exponentialBase, attempt - 1);

        // Add jitter to prevent thundering herd
        const jitter = this.retryConfig.jitter ? Math.random() * baseDelay * 0.1 : 0;

        const delay = Math.min(baseDelay + jitter, this.retryConfig.maxDelay);

        logger.warn(
          `[AIClient] Attempt ${attempt} failed with ${provider}, retrying in ${Math.round(delay)}ms:`,
          error.message,
        );
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Check if an error is retryable
   */
  isRetryableError(error) {
    // Use the error utility function
    if (isRetryableError(error)) {
      return true;
    }

    // AI-specific retryable errors
    const retryableMessages = [
      'rate limit',
      'timeout',
      'server error',
      'service unavailable',
      'internal error',
      'temporary failure',
      'connection error',
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return (
      retryableMessages.some((msg) => errorMessage.includes(msg)) ||
      (error.status && error.status >= 500 && error.status < 600)
    );
  }

  /**
   * Execute provider-specific generation with error handling
   */
  async executeProviderGeneration(provider, prompt, systemMessage, maxTokens, temperature) {
    switch (provider) {
      case 'openai':
        return await this.generateWithOpenAI(prompt, systemMessage, maxTokens, temperature);
      case 'anthropic':
        return await this.generateWithAnthropic(prompt, systemMessage, maxTokens, temperature);
      case 'google':
        return await this.generateWithGoogle(prompt, systemMessage, maxTokens, temperature);
      default:
        throw new AIError(`Unsupported provider: ${provider}`, provider, {
          availableProviders: Object.keys(this.providers),
        });
    }
  }

  /**
   * Handle content chunking for large inputs
   */
  buildChapterPromptWithTokenHandling(
    title,
    description,
    chapterNumber,
    totalChapters,
    bookTheme,
    genre,
    writingStyle,
    targetAudience,
    previousSummaries,
    targetWordCount,
    provider,
  ) {
    const basePrompt = this.buildChapterPrompt(
      title,
      description,
      chapterNumber,
      totalChapters,
      bookTheme,
      genre,
      writingStyle,
      targetAudience,
      previousSummaries,
      targetWordCount,
    );

    const estimatedTokens = this.estimateTokenCount(basePrompt);
    const providerLimit = this.tokenLimits[provider]?.input || 8000;

    if (estimatedTokens > providerLimit * 0.8) {
      // Use 80% of limit as safety margin
      // Truncate previous summaries if needed
      const truncatedSummaries = this.truncatePreviousSummaries(
        previousSummaries,
        providerLimit * 0.3, // Use 30% of limit for summaries
      );

      const truncatedPrompt = this.buildChapterPrompt(
        title,
        description,
        chapterNumber,
        totalChapters,
        bookTheme,
        genre,
        writingStyle,
        targetAudience,
        truncatedSummaries,
        targetWordCount,
      );

      return {
        prompt: truncatedPrompt,
        needsChunking: this.estimateTokenCount(truncatedPrompt) > providerLimit * 0.8,
      };
    }

    return { prompt: basePrompt, needsChunking: false };
  }

  /**
   * Generate chapter with content chunking for very large contexts
   */
  async generateChapterWithChunking(chapterInfo, context, provider) {
    const { title, chapterNumber } = chapterInfo;
    const { targetWordCount = 2000 } = context;

    // Split into smaller sections
    const sectionsCount = Math.ceil(targetWordCount / 800); // ~800 words per section
    const sections = [];

    for (let i = 1; i <= sectionsCount; i++) {
      const sectionPrompt = this.buildChapterSectionPrompt(chapterInfo, context, i, sectionsCount);

      const sectionResponse = await this.generateContent(sectionPrompt, {
        provider,
        maxTokens: 1200,
        temperature: 0.8,
        timeout: this.timeouts.chapter / sectionsCount,
        systemMessage: 'You are an expert book writer creating a section of a chapter.',
      });

      sections.push(sectionResponse);
    }

    // Combine sections
    const combinedContent = sections.join('\n\n');

    return {
      content: combinedContent,
      wordCount: this.estimateWordCount(combinedContent),
      chapterNumber,
      title,
      chunked: true,
      sectionsCount,
    };
  }

  /**
   * Truncate content for provider token limits
   */
  truncateContentForProvider(content, provider, operation = 'default') {
    const limit = this.tokenLimits[provider]?.input || 8000;
    const reservedTokens = operation === 'summary' ? 500 : 1000; // Reserve tokens for prompt
    const maxContentTokens = limit - reservedTokens;

    const estimatedTokens = this.estimateTokenCount(content);

    if (estimatedTokens <= maxContentTokens) {
      return content;
    }

    // Truncate to fit within limits (rough approximation: 4 chars per token)
    const maxChars = maxContentTokens * 4;
    const truncated = content.substring(0, maxChars);

    // Try to end at a sentence boundary
    const lastSentence = truncated.lastIndexOf('.');
    if (lastSentence > maxChars * 0.8) {
      return truncated.substring(0, lastSentence + 1);
    }

    return truncated + '...';
  }

  /**
   * Truncate previous summaries to fit token limits
   */
  truncatePreviousSummaries(summaries, maxTokens) {
    if (!summaries || summaries.length === 0) return [];

    let totalTokens = 0;
    const truncatedSummaries = [];

    // Start from most recent summaries
    for (let i = summaries.length - 1; i >= 0; i--) {
      const summaryTokens = this.estimateTokenCount(summaries[i]);

      if (totalTokens + summaryTokens <= maxTokens) {
        truncatedSummaries.unshift(summaries[i]);
        totalTokens += summaryTokens;
      } else {
        break;
      }
    }

    return truncatedSummaries;
  }

  /**
   * Estimate token count (rough approximation)
   */
  estimateTokenCount(text) {
    if (!text) return 0;
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Rate limiting management
   */
  isRateLimited(provider) {
    const rateLimitInfo = this.rateLimitTracker.get(provider);
    if (!rateLimitInfo) return false;

    return Date.now() < rateLimitInfo.resetTime;
  }

  getRateLimitResetTime(provider) {
    const rateLimitInfo = this.rateLimitTracker.get(provider);
    return rateLimitInfo?.resetTime || Date.now();
  }

  handleRateLimit(provider, error) {
    const retryAfter = this.extractRetryAfter(error);
    const resetTime = Date.now() + retryAfter * 1000;

    this.rateLimitTracker.set(provider, {
      resetTime,
      retryAfter,
    });

    logger.warn(`[AIClient] Rate limit hit for ${provider}, reset at ${new Date(resetTime)}`);
  }

  extractRetryAfter(error) {
    // Try to extract retry-after from error
    if (error.headers?.['retry-after']) {
      return parseInt(error.headers['retry-after']);
    }

    if (error.message?.includes('retry after')) {
      const match = error.message.match(/retry after (\d+)/i);
      if (match) return parseInt(match[1]);
    }

    // Default retry after 60 seconds
    return 60;
  }

  /**
   * Check if error is a rate limit error
   */
  isRateLimitError(error) {
    const rateLimitIndicators = [
      'rate limit',
      'too many requests',
      'quota exceeded',
      'rate_limit_exceeded',
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return (
      rateLimitIndicators.some((indicator) => errorMessage.includes(indicator)) ||
      error.status === 429
    );
  }

  /**
   * Check if error is a token limit error
   */
  isTokenLimitError(error) {
    const tokenLimitIndicators = [
      'token limit',
      'context length',
      'maximum context',
      'input too long',
      'context_length_exceeded',
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return tokenLimitIndicators.some((indicator) => errorMessage.includes(indicator));
  }

  /**
   * Transform provider-specific errors to standardized errors
   */
  transformProviderError(error, provider) {
    // Authentication errors
    if (
      error.message?.toLowerCase().includes('api key') ||
      error.message?.toLowerCase().includes('authentication') ||
      error.status === 401
    ) {
      return new AIError(`Authentication failed for ${provider}`, provider, {
        code: ERROR_CODES.UNAUTHORIZED,
        originalError: error.message,
        suggestion: 'Check your API key configuration',
      });
    }

    // Model not found errors
    if (
      error.message?.toLowerCase().includes('model not found') ||
      error.message?.toLowerCase().includes('model does not exist')
    ) {
      return new AIError(`Model not available for ${provider}`, provider, {
        code: ERROR_CODES.AI_ERROR,
        originalError: error.message,
        suggestion: 'Try a different model or provider',
      });
    }

    // Generic AI error
    return new AIError(error.message || `AI generation failed with ${provider}`, provider, {
      originalError: error.name || 'Error',
      status: error.status,
    });
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    return Object.keys(this.providers);
  }

  /**
   * Check if a specific provider is available
   */
  isProviderAvailable(provider) {
    return !!this.providers[provider];
  }

  /**
   * Set default provider
   */
  setDefaultProvider(provider) {
    if (!this.providers[provider]) {
      throw new Error(`Provider ${provider} is not available`);
    }
    this.defaultProvider = provider;
  }
}

module.exports = { AIClient };
