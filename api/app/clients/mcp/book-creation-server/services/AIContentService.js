import { BookService } from './BookService.js';

/**
 * AI Content Generation Service
 * Handles AI-powered content generation for books, chapters, and pages
 */
export class AIContentService {
  constructor() {
    this.bookService = new BookService();
  }

  /**
   * Generates chapter content using AI
   * @param {Object} params - Generation parameters
   * @returns {Promise<Object>} Generated content result
   */
  async generateChapterContent(params) {
    const {
      chapterId,
      contentType = 'full_chapter',
      wordCount = 1500,
      prompt,
      includeDialogue = true,
      mood,
    } = params;

    // Get chapter and book context
    const chapter = await this.bookService.getChapter(chapterId, { includePages: true });
    const book = await this.bookService.getBook(chapter.bookId, { includeChapters: false });

    // Build context for AI generation
    const context = this._buildContentContext(book, chapter, {
      contentType,
      wordCount,
      prompt,
      includeDialogue,
      mood,
    });

    // Generate content prompt for AI
    const generationPrompt = this._createChapterContentPrompt(context);

    return {
      success: true,
      context,
      prompt: generationPrompt,
      instructions: {
        wordCount,
        contentType,
        mood,
        includeDialogue,
        writingStyle: book.writingStyle,
      },
      message: `Content generation context prepared for chapter "${chapter.title}". Use this prompt with your AI model to generate the content, then use create_page to save the generated content.`,
    };
  }

  /**
   * Generates page content using AI
   * @param {Object} params - Generation parameters
   * @returns {Promise<Object>} Generated content result
   */
  async generatePageContent(params) {
    const {
      chapterId,
      pageTitle,
      contentPrompt,
      wordCount = 500,
      continuePrevious = false,
      pageNumber,
    } = params;

    // Get chapter and book context
    const chapter = await this.bookService.getChapter(chapterId, { includePages: true });
    const book = await this.bookService.getBook(chapter.bookId, { includeChapters: false });

    // Get previous page content if continuing
    let previousContent = '';
    if (continuePrevious && chapter.pages && chapter.pages.length > 0) {
      const lastPage = chapter.pages[chapter.pages.length - 1];
      previousContent = lastPage.content || '';
    }

    // Build context for page generation
    const context = this._buildContentContext(book, chapter, {
      pageTitle,
      contentPrompt,
      wordCount,
      previousContent,
      continuePrevious,
    });

    // Generate content prompt for AI
    const generationPrompt = this._createPageContentPrompt(context);

    return {
      success: true,
      context,
      prompt: generationPrompt,
      pageInfo: {
        title: pageTitle,
        wordCount,
        pageNumber: pageNumber || (chapter.pages ? chapter.pages.length + 1 : 1),
        continuePrevious,
      },
      instructions: {
        writingStyle: book.writingStyle,
        chapterContext: chapter.description || chapter.outline,
      },
      message: `Page content generation context prepared for "${pageTitle}". Use this prompt with your AI model to generate the content, then use create_page to save the generated content.`,
    };
  }

  /**
   * Analyzes and provides improvement suggestions for existing content
   * @param {Object} params - Improvement parameters
   * @returns {Promise<Object>} Improvement analysis and suggestions
   */
  async improveContent(params) {
    const {
      contentId,
      contentType = 'page',
      improvementType = 'comprehensive',
      preserveLength = true,
      specificInstructions,
    } = params;

    let content, context;

    if (contentType === 'page') {
      const page = await this.bookService.getPage(contentId);
      const chapter = await this.bookService.getChapter(page.chapterId);
      const book = await this.bookService.getBook(chapter.bookId);

      content = page.content;
      context = this._buildContentContext(book, chapter, { pageContext: page });
    } else {
      const chapter = await this.bookService.getChapter(contentId, { includePages: true });
      const book = await this.bookService.getBook(chapter.bookId);

      // Combine all page content for chapter improvement
      content = chapter.pages ? chapter.pages.map((p) => p.content).join('\n\n') : '';
      context = this._buildContentContext(book, chapter);
    }

    if (!content || content.trim().length === 0) {
      throw new Error('No content found to improve');
    }

    // Create improvement prompt
    const improvementPrompt = this._createImprovementPrompt(content, context, {
      improvementType,
      preserveLength,
      specificInstructions,
    });

    return {
      success: true,
      originalContent: content,
      originalWordCount: this._countWords(content),
      context,
      prompt: improvementPrompt,
      improvementType,
      preserveLength,
      instructions: {
        writingStyle: context.book.writingStyle,
        targetLength: preserveLength ? this._countWords(content) : null,
      },
      message: `Content improvement context prepared. Use this prompt with your AI model to improve the content, then use update_${contentType} to save the improved version.`,
    };
  }

  /**
   * Generates a detailed chapter outline
   * @param {Object} params - Outline generation parameters
   * @returns {Promise<Object>} Generated outline
   */
  async generateChapterOutline(params) {
    const {
      bookId,
      chapterTitle,
      chapterGoals,
      previousChapterSummary,
      keyEvents = [],
      targetWordCount = 3000,
    } = params;

    // Get book context
    const book = await this.bookService.getBook(bookId, { includeChapters: true });

    // Get existing chapters for context
    const existingChapters = book.chapters || [];
    const chapterNumber = existingChapters.length + 1;

    // Build outline generation context
    const context = {
      book: {
        title: book.title,
        theme: book.theme,
        genre: book.genre,
        writingStyle: book.writingStyle,
        targetAudience: book.targetAudience,
        description: book.description,
      },
      existingChapters: existingChapters.map((ch) => ({
        number: ch.chapterNumber,
        title: ch.title,
        description: ch.description,
      })),
      newChapter: {
        number: chapterNumber,
        title: chapterTitle,
        goals: chapterGoals,
        keyEvents,
        targetWordCount,
      },
      previousChapterSummary,
    };

    // Generate outline prompt
    const outlinePrompt = this._createOutlinePrompt(context);

    return {
      success: true,
      context,
      prompt: outlinePrompt,
      chapterInfo: {
        title: chapterTitle,
        number: chapterNumber,
        targetWordCount,
        keyEvents,
      },
      message: `Chapter outline generation context prepared for "${chapterTitle}". Use this prompt with your AI model to generate a detailed outline, then use create_chapter to save the chapter with the generated outline.`,
    };
  }

  /**
   * Builds comprehensive context for content generation
   * @private
   */
  _buildContentContext(book, chapter, additionalContext = {}) {
    return {
      book: {
        title: book.title,
        subtitle: book.subtitle,
        theme: book.theme,
        genre: book.genre,
        writingStyle: book.writingStyle,
        targetAudience: book.targetAudience,
        description: book.description,
        targetWordCount: book.targetWordCount,
      },
      chapter: {
        title: chapter.title,
        number: chapter.chapterNumber,
        description: chapter.description,
        outline: chapter.outline,
        targetWordCount: chapter.targetWordCount,
        currentWordCount: chapter.currentWordCount || 0,
        pageCount: chapter.pages ? chapter.pages.length : 0,
      },
      ...additionalContext,
    };
  }

  /**
   * Creates AI prompt for chapter content generation
   * @private
   */
  _createChapterContentPrompt(context) {
    const { book, chapter, contentType, wordCount, prompt, includeDialogue, mood } = context;

    return `You are a professional writer tasked with creating ${contentType} content for a chapter in the book "${book.title}".

**Book Context:**
- Title: ${book.title}
- Theme: ${book.theme}
- Genre: ${book.genre}
- Target Audience: ${book.targetAudience}
- Description: ${book.description}

**Writing Style Requirements:**
- Tone: ${book.writingStyle.tone}
- Voice: ${book.writingStyle.voice}
- Vocabulary Level: ${book.writingStyle.vocabulary}
- Sentence Structure: ${book.writingStyle.sentenceStructure}
${book.writingStyle.specialInstructions ? `- Special Instructions: ${book.writingStyle.specialInstructions}` : ''}

**Chapter Details:**
- Chapter ${chapter.number}: "${chapter.title}"
- Chapter Description: ${chapter.description || 'Not provided'}
- Chapter Outline: ${chapter.outline || 'Not provided'}
- Target Word Count: ${wordCount} words

**Content Requirements:**
- Content Type: ${contentType}
- Include Dialogue: ${includeDialogue ? 'Yes' : 'No'}
${mood ? `- Desired Mood: ${mood}` : ''}
${prompt ? `- Additional Instructions: ${prompt}` : ''}

Please generate engaging, well-structured content that:
1. Matches the established writing style and tone
2. Fits seamlessly within the book's theme and genre
3. Advances the chapter's purpose and goals
4. Maintains consistency with the book's voice and perspective
5. Meets the target word count of approximately ${wordCount} words

Generate the content now:`;
  }

  /**
   * Creates AI prompt for page content generation
   * @private
   */
  _createPageContentPrompt(context) {
    const {
      book,
      chapter,
      pageTitle,
      contentPrompt,
      wordCount,
      previousContent,
      continuePrevious,
    } = context;

    return `You are a professional writer creating content for a specific page within a chapter.

**Book Context:**
- Title: ${book.title}
- Theme: ${book.theme}
- Genre: ${book.genre}
- Writing Style: ${book.writingStyle.tone} tone, ${book.writingStyle.voice} voice, ${book.writingStyle.vocabulary} vocabulary

**Chapter Context:**
- Chapter ${chapter.number}: "${chapter.title}"
- Chapter Description: ${chapter.description || 'Not provided'}

**Page Requirements:**
- Page Title: "${pageTitle}"
- Content Focus: ${contentPrompt}
- Target Word Count: ${wordCount} words
${continuePrevious ? `- Continue from previous content: Yes` : '- Standalone page content'}

${
  continuePrevious && previousContent
    ? `**Previous Content to Continue From:**
${previousContent.slice(-500)}...`
    : ''
}

Please generate content that:
1. Matches the book's established writing style
2. Fulfills the specific content prompt
3. Flows naturally within the chapter context
4. Meets the target word count of approximately ${wordCount} words
${continuePrevious ? '5. Continues smoothly from the previous content' : ''}

Generate the page content now:`;
  }

  /**
   * Creates AI prompt for content improvement
   * @private
   */
  _createImprovementPrompt(content, context, options) {
    const { improvementType, preserveLength, specificInstructions } = options;

    const improvementFocus = {
      grammar: 'grammar, punctuation, and spelling errors',
      style: 'writing style consistency and voice',
      flow: 'narrative flow and transitions between paragraphs',
      clarity: 'clarity of expression and readability',
      engagement: 'reader engagement and compelling prose',
      comprehensive: 'overall quality including grammar, style, flow, clarity, and engagement',
    };

    return `You are a professional editor improving the following content from "${context.book.title}".

**Original Content:**
${content}

**Improvement Focus:** ${improvementFocus[improvementType]}

**Book Context & Style Requirements:**
- Writing Style: ${context.book.writingStyle.tone} tone, ${context.book.writingStyle.voice} voice
- Vocabulary Level: ${context.book.writingStyle.vocabulary}
- Genre: ${context.book.genre}
${preserveLength ? `- Maintain approximately the same length (${this._countWords(content)} words)` : ''}

${specificInstructions ? `**Specific Instructions:** ${specificInstructions}` : ''}

Please improve the content while:
1. Maintaining the original intent and meaning
2. Preserving the established writing style and voice
3. Ensuring consistency with the book's tone and genre
${preserveLength ? '4. Keeping approximately the same word count' : '4. Improving length as needed for better flow'}
5. Focusing specifically on ${improvementType} improvements

Provide the improved version:`;
  }

  /**
   * Creates AI prompt for chapter outline generation
   * @private
   */
  _createOutlinePrompt(context) {
    const { book, existingChapters, newChapter, previousChapterSummary } = context;

    return `You are creating a detailed outline for Chapter ${newChapter.number} of the book "${book.title}".

**Book Overview:**
- Title: ${book.title}
- Theme: ${book.theme}
- Genre: ${book.genre}
- Target Audience: ${book.targetAudience}
- Writing Style: ${book.writingStyle.tone} tone, ${book.writingStyle.voice} voice

${
  existingChapters.length > 0
    ? `**Existing Chapters:**
${existingChapters.map((ch) => `Chapter ${ch.number}: ${ch.title} - ${ch.description || 'No description'}`).join('\n')}`
    : ''
}

${
  previousChapterSummary
    ? `**Previous Chapter Summary:**
${previousChapterSummary}`
    : ''
}

**New Chapter Requirements:**
- Chapter ${newChapter.number}: "${newChapter.title}"
- Goals: ${newChapter.goals}
- Target Word Count: ${newChapter.targetWordCount} words
${newChapter.keyEvents.length > 0 ? `- Key Events: ${newChapter.keyEvents.join(', ')}` : ''}

Please create a detailed chapter outline that includes:
1. Chapter summary (2-3 sentences)
2. Main scenes or sections (3-6 major beats)
3. Character development points (if applicable)
4. Plot advancement (if applicable)
5. Key dialogue or interaction points
6. Estimated word count breakdown for each section
7. Transition notes to next chapter

Generate a comprehensive chapter outline:`;
  }

  /**
   * Counts words in text
   * @private
   */
  _countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }
}
