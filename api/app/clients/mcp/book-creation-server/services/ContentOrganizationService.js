import { BookService } from './BookService.js';

/**
 * Content Organization Service
 * Handles book structure, outlines, chapter organization, and table of contents generation
 */
export class ContentOrganizationService {
  constructor() {
    this.bookService = new BookService();
  }

  // ============ OUTLINE METHODS ============

  /**
   * Creates or updates a comprehensive book outline
   * @param {Object} params - Outline parameters
   * @returns {Promise<Object>} Updated book with outline
   */
  async createBookOutline(params) {
    const {
      bookId,
      authorId,
      outline,
      outlineType = 'structured', // 'structured', 'three_act', 'hero_journey', 'custom'
      includeCharacterArcs = false,
      includePlotPoints = false,
      autoGenerateChapters = false,
    } = params;

    // Get existing book
    const book = await this.bookService.getBook(bookId, { includeChapters: true });
    if (!book) {
      throw new Error('Book not found');
    }

    // Structure the outline based on type
    const structuredOutline = this._structureOutline(outline, outlineType);

    // Update book with outline
    const updatedBook = await this.bookService.updateBook(bookId, {
      outline: structuredOutline,
      outlineType,
      lastOutlineUpdate: new Date(),
    });

    // Auto-generate chapters if requested
    if (autoGenerateChapters && structuredOutline.chapters) {
      await this._generateChaptersFromOutline(bookId, authorId, structuredOutline.chapters);
    }

    return {
      book: updatedBook,
      outline: structuredOutline,
      chaptersGenerated: autoGenerateChapters ? structuredOutline.chapters?.length || 0 : 0,
    };
  }

  /**
   * Generates a table of contents for a book
   * @param {Object} params - TOC parameters
   * @returns {Promise<Object>} Generated table of contents
   */
  async generateTableOfContents(params) {
    const {
      bookId,
      includePageNumbers = false,
      includeWordCounts = true,
      includeSubsections = true,
      format = 'standard', // 'standard', 'detailed', 'simple'
      numbering = 'numeric', // 'numeric', 'roman', 'none'
    } = params;

    const book = await this.bookService.getBook(bookId, {
      includeChapters: true,
      includePages: true,
    });

    if (!book) {
      throw new Error('Book not found');
    }

    const toc = {
      bookTitle: book.title,
      generatedAt: new Date(),
      format,
      numbering,
      entries: [],
      statistics: {
        totalChapters: 0,
        totalPages: 0,
        totalWords: 0,
        averageChapterLength: 0,
      },
    };

    let currentPageNumber = 1;
    let totalWords = 0;

    // Generate TOC entries
    if (book.chapters && book.chapters.length > 0) {
      toc.entries = book.chapters.map((chapter, index) => {
        const chapterWords = this._calculateChapterWordCount(chapter);
        const chapterPages = chapter.pages ? chapter.pages.length : 0;
        totalWords += chapterWords;

        const entry = {
          level: 1,
          type: 'chapter',
          number: this._formatNumber(index + 1, numbering),
          title: chapter.title,
          ...(includePageNumbers && { pageNumber: currentPageNumber }),
          ...(includeWordCounts && { wordCount: chapterWords }),
          pages: chapterPages,
        };

        // Add subsections if requested
        if (includeSubsections && chapter.pages && chapter.pages.length > 0) {
          entry.subsections = chapter.pages.map((page, pageIndex) => ({
            level: 2,
            type: 'page',
            number: this._formatNumber(pageIndex + 1, numbering),
            title: page.title || `Page ${pageIndex + 1}`,
            ...(includePageNumbers && { pageNumber: currentPageNumber + pageIndex }),
            ...(includeWordCounts && { wordCount: this._calculatePageWordCount(page) }),
          }));
        }

        currentPageNumber += Math.max(chapterPages, 1);
        return entry;
      });

      // Calculate statistics
      toc.statistics = {
        totalChapters: book.chapters.length,
        totalPages: book.chapters.reduce((sum, ch) => sum + (ch.pages?.length || 0), 0),
        totalWords,
        averageChapterLength: Math.round(totalWords / book.chapters.length),
      };
    }

    return toc;
  }

  // ============ CHAPTER ORGANIZATION ============

  /**
   * Reorders chapters in a book
   * @param {Object} params - Reorder parameters
   * @returns {Promise<Object>} Updated book with reordered chapters
   */
  async reorderChapters(params) {
    const { bookId, authorId, chapterOrder, updateChapterNumbers = true } = params;

    const book = await this.bookService.getBook(bookId, { includeChapters: true });
    if (!book) {
      throw new Error('Book not found');
    }

    if (!book.chapters || book.chapters.length === 0) {
      throw new Error('No chapters found to reorder');
    }

    // Validate chapter order array
    if (!Array.isArray(chapterOrder) || chapterOrder.length !== book.chapters.length) {
      throw new Error('Chapter order array must contain all chapter IDs');
    }

    // Create a map of chapters by ID for efficient lookup
    const chapterMap = new Map();
    book.chapters.forEach((chapter) => {
      chapterMap.set(chapter._id.toString(), chapter);
    });

    // Reorder chapters according to the new order
    const reorderedChapters = chapterOrder.map((chapterId, index) => {
      const chapter = chapterMap.get(chapterId.toString());
      if (!chapter) {
        throw new Error(`Chapter with ID ${chapterId} not found`);
      }

      // Update chapter number if requested
      if (updateChapterNumbers) {
        chapter.chapterNumber = index + 1;
      }

      return chapter;
    });

    // Update the book with reordered chapters
    const updatedBook = await this.bookService.updateBook(bookId, {
      chapters: reorderedChapters,
      lastChapterReorder: new Date(),
    });

    return {
      book: updatedBook,
      reorderSummary: {
        totalChapters: reorderedChapters.length,
        numbersUpdated: updateChapterNumbers,
        reorderedAt: new Date(),
      },
    };
  }

  /**
   * Reorganizes book structure with advanced options
   * @param {Object} params - Reorganization parameters
   * @returns {Promise<Object>} Reorganized book structure
   */
  async reorganizeBookStructure(params) {
    const {
      bookId,
      authorId,
      structureType = 'parts', // 'parts', 'acts', 'sections'
      groupings,
      createDividers = false,
      updateOutline = true,
    } = params;

    const book = await this.bookService.getBook(bookId, { includeChapters: true });
    if (!book) {
      throw new Error('Book not found');
    }

    const restructured = {
      bookId,
      structureType,
      reorganizedAt: new Date(),
      groups: [],
      summary: {
        totalGroups: 0,
        totalChapters: book.chapters?.length || 0,
        dividersCreated: 0,
      },
    };

    if (groupings && Array.isArray(groupings)) {
      restructured.groups = groupings.map((group, index) => ({
        id: `${structureType}_${index + 1}`,
        name:
          group.name ||
          `${structureType.charAt(0).toUpperCase() + structureType.slice(1)} ${index + 1}`,
        description: group.description || '',
        chapterIds: group.chapterIds || [],
        chapterCount: group.chapterIds?.length || 0,
        order: index + 1,
      }));

      restructured.summary.totalGroups = groupings.length;
    }

    // Update book outline if requested
    if (updateOutline) {
      const newOutline = {
        type: structureType,
        structure: restructured.groups,
        lastUpdated: new Date(),
      };

      await this.bookService.updateBook(bookId, {
        outline: newOutline,
        bookStructure: restructured,
      });
    }

    return restructured;
  }

  // ============ ANALYSIS AND INSIGHTS ============

  /**
   * Analyzes book structure and provides optimization suggestions
   * @param {Object} params - Analysis parameters
   * @returns {Promise<Object>} Structure analysis and suggestions
   */
  async analyzeBookStructure(params) {
    const { bookId, includeDetailedAnalysis = true } = params;

    const book = await this.bookService.getBook(bookId, {
      includeChapters: true,
      includePages: true,
    });

    if (!book) {
      throw new Error('Book not found');
    }

    const analysis = {
      bookId,
      analyzedAt: new Date(),
      overview: {
        totalChapters: book.chapters?.length || 0,
        totalPages: 0,
        totalWords: 0,
        averageChapterLength: 0,
        averagePageLength: 0,
      },
      chapterAnalysis: [],
      structureMetrics: {
        lengthConsistency: 0,
        pacing: 'unknown',
        balance: 'unknown',
      },
      recommendations: [],
    };

    if (book.chapters && book.chapters.length > 0) {
      let totalWords = 0;
      let totalPages = 0;
      const chapterLengths = [];

      // Analyze each chapter
      analysis.chapterAnalysis = book.chapters.map((chapter, index) => {
        const chapterWords = this._calculateChapterWordCount(chapter);
        const chapterPageCount = chapter.pages?.length || 0;

        totalWords += chapterWords;
        totalPages += chapterPageCount;
        chapterLengths.push(chapterWords);

        return {
          chapterNumber: index + 1,
          title: chapter.title,
          wordCount: chapterWords,
          pageCount: chapterPageCount,
          averagePageLength: chapterPageCount > 0 ? Math.round(chapterWords / chapterPageCount) : 0,
          status: chapter.status || 'unknown',
        };
      });

      // Calculate overview metrics
      analysis.overview = {
        totalChapters: book.chapters.length,
        totalPages,
        totalWords,
        averageChapterLength: Math.round(totalWords / book.chapters.length),
        averagePageLength: totalPages > 0 ? Math.round(totalWords / totalPages) : 0,
      };

      // Calculate structure metrics
      analysis.structureMetrics = this._calculateStructureMetrics(chapterLengths);

      // Generate recommendations
      analysis.recommendations = this._generateStructureRecommendations(analysis);
    }

    return analysis;
  }

  // ============ HELPER METHODS ============

  /**
   * Structures outline based on type
   * @private
   */
  _structureOutline(outline, outlineType) {
    const structured = {
      type: outlineType,
      createdAt: new Date(),
      lastUpdated: new Date(),
    };

    switch (outlineType) {
      case 'three_act':
        structured.structure = {
          act1: {
            name: 'Setup',
            description: 'Introduce characters, world, and conflict',
            chapters: outline.act1 || [],
            targetWordCount: outline.act1WordCount || 0,
          },
          act2: {
            name: 'Confrontation',
            description: 'Develop conflict, rising action, midpoint',
            chapters: outline.act2 || [],
            targetWordCount: outline.act2WordCount || 0,
          },
          act3: {
            name: 'Resolution',
            description: 'Climax, falling action, resolution',
            chapters: outline.act3 || [],
            targetWordCount: outline.act3WordCount || 0,
          },
        };
        break;

      case 'hero_journey':
        structured.structure = {
          ordinary_world: outline.ordinaryWorld || {},
          call_to_adventure: outline.callToAdventure || {},
          refusal_of_call: outline.refusalOfCall || {},
          meeting_mentor: outline.meetingMentor || {},
          crossing_threshold: outline.crossingThreshold || {},
          tests_allies_enemies: outline.testsAlliesEnemies || {},
          approach_inmost_cave: outline.approachInmostCave || {},
          ordeal: outline.ordeal || {},
          reward: outline.reward || {},
          road_back: outline.roadBack || {},
          resurrection: outline.resurrection || {},
          return_elixir: outline.returnElixir || {},
        };
        break;

      case 'structured':
        structured.structure = {
          synopsis: outline.synopsis || '',
          themes: outline.themes || [],
          characters: outline.characters || [],
          settings: outline.settings || [],
          chapters: outline.chapters || [],
          plotPoints: outline.plotPoints || [],
          targetWordCount: outline.targetWordCount || 0,
        };
        break;

      default: // custom
        structured.structure = outline;
    }

    return structured;
  }

  /**
   * Generates chapters from outline
   * @private
   */
  async _generateChaptersFromOutline(bookId, authorId, outlineChapters) {
    if (!Array.isArray(outlineChapters)) return;

    for (let i = 0; i < outlineChapters.length; i++) {
      const chapterOutline = outlineChapters[i];

      await this.bookService.createChapter({
        bookId,
        authorId,
        title: chapterOutline.title || `Chapter ${i + 1}`,
        description: chapterOutline.description || chapterOutline.summary || '',
        chapterNumber: i + 1,
        status: 'planned',
        outline: chapterOutline,
      });
    }
  }

  /**
   * Calculates word count for a chapter
   * @private
   */
  _calculateChapterWordCount(chapter) {
    if (!chapter.pages || chapter.pages.length === 0) return 0;

    return chapter.pages.reduce((total, page) => {
      return total + this._calculatePageWordCount(page);
    }, 0);
  }

  /**
   * Calculates word count for a page
   * @private
   */
  _calculatePageWordCount(page) {
    if (!page.content) return 0;

    // Simple word count - split by whitespace and filter empty strings
    return page.content.split(/\s+/).filter((word) => word.trim().length > 0).length;
  }

  /**
   * Formats numbers based on numbering style
   * @private
   */
  _formatNumber(number, style) {
    switch (style) {
      case 'roman':
        return this._toRomanNumeral(number);
      case 'none':
        return '';
      default:
        return number.toString();
    }
  }

  /**
   * Converts number to Roman numeral
   * @private
   */
  _toRomanNumeral(num) {
    const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const literals = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];

    let result = '';
    for (let i = 0; i < values.length; i++) {
      while (num >= values[i]) {
        result += literals[i];
        num -= values[i];
      }
    }
    return result;
  }

  /**
   * Calculates structure metrics
   * @private
   */
  _calculateStructureMetrics(chapterLengths) {
    if (chapterLengths.length === 0) {
      return {
        lengthConsistency: 0,
        pacing: 'unknown',
        balance: 'unknown',
      };
    }

    // Calculate length consistency using coefficient of variation
    const mean = chapterLengths.reduce((sum, length) => sum + length, 0) / chapterLengths.length;
    const variance =
      chapterLengths.reduce((sum, length) => sum + Math.pow(length - mean, 2), 0) /
      chapterLengths.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / mean;

    // Convert to consistency score (lower CV = higher consistency)
    const lengthConsistency = Math.max(0, Math.min(100, (1 - coefficientOfVariation) * 100));

    // Analyze pacing (based on chapter length progression)
    let pacing = 'steady';
    if (chapterLengths.length >= 3) {
      const firstThird = chapterLengths.slice(0, Math.ceil(chapterLengths.length / 3));
      const lastThird = chapterLengths.slice(-Math.ceil(chapterLengths.length / 3));

      const firstThirdAvg = firstThird.reduce((sum, len) => sum + len, 0) / firstThird.length;
      const lastThirdAvg = lastThird.reduce((sum, len) => sum + len, 0) / lastThird.length;

      if (lastThirdAvg > firstThirdAvg * 1.2) {
        pacing = 'accelerating';
      } else if (lastThirdAvg < firstThirdAvg * 0.8) {
        pacing = 'decelerating';
      }
    }

    // Analyze balance
    const maxLength = Math.max(...chapterLengths);
    const minLength = Math.min(...chapterLengths);
    const ratio = maxLength / minLength;

    let balance = 'balanced';
    if (ratio > 3) {
      balance = 'unbalanced';
    } else if (ratio > 2) {
      balance = 'somewhat_unbalanced';
    }

    return {
      lengthConsistency: Math.round(lengthConsistency),
      pacing,
      balance,
    };
  }

  /**
   * Generates structure recommendations
   * @private
   */
  _generateStructureRecommendations(analysis) {
    const recommendations = [];

    // Length consistency recommendations
    if (analysis.structureMetrics.lengthConsistency < 60) {
      recommendations.push({
        type: 'consistency',
        priority: 'medium',
        title: 'Improve Chapter Length Consistency',
        description:
          'Your chapters vary significantly in length. Consider evening out the word counts for better pacing.',
        details: `Current consistency score: ${analysis.structureMetrics.lengthConsistency}%`,
      });
    }

    // Balance recommendations
    if (analysis.structureMetrics.balance === 'unbalanced') {
      recommendations.push({
        type: 'balance',
        priority: 'high',
        title: 'Address Chapter Length Imbalance',
        description:
          'Some chapters are much longer or shorter than others. This may affect reader engagement.',
        details: 'Consider splitting very long chapters or combining very short ones.',
      });
    }

    // Chapter count recommendations
    const chapterCount = analysis.overview.totalChapters;
    if (chapterCount > 50) {
      recommendations.push({
        type: 'structure',
        priority: 'low',
        title: 'Consider Chapter Grouping',
        description:
          'With 50+ chapters, consider organizing them into parts or sections for better navigation.',
      });
    } else if (chapterCount < 3) {
      recommendations.push({
        type: 'structure',
        priority: 'medium',
        title: 'Expand Chapter Structure',
        description:
          'Books typically benefit from having more than 2-3 chapters for proper story development.',
      });
    }

    // Word count recommendations
    const totalWords = analysis.overview.totalWords;
    if (totalWords < 50000) {
      recommendations.push({
        type: 'content',
        priority: 'low',
        title: 'Consider Expanding Content',
        description:
          'Your book may be on the shorter side. Consider if additional content would strengthen the narrative.',
        details: `Current word count: ${totalWords.toLocaleString()} words`,
      });
    }

    return recommendations;
  }
}
