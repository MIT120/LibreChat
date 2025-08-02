import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Book } from '../models/Book.js';
import { Chapter } from '../models/Chapter.js';
import { Page } from '../models/Page.js';

export class BookService {
  constructor() {
    this.initialized = false;
  }

  async initializeDatabase() {
    if (this.initialized || mongoose.connection.readyState === 1) {
      return;
    }

    try {
      // Get connection string from environment or use Docker default
      const mongoUri =
        process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://mongodb:27017/LibreChat'; // Docker default

      // Enhanced connection options to prevent timeouts
      const connectionOptions = {
        bufferCommands: false, // Disable mongoose buffering
        serverSelectionTimeoutMS: 15000, // How long to wait for server selection
        connectTimeoutMS: 20000, // How long to wait for initial connection
        socketTimeoutMS: 45000, // How long to wait for socket operations
        maxPoolSize: 10, // Maintain up to 10 socket connections
        minPoolSize: 1, // Maintain at least 1 socket connection
        maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
        waitQueueTimeoutMS: 10000, // How long to wait for a connection from pool
      };

      // Validate the connection string
      if (
        !mongoUri ||
        (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://'))
      ) {
        console.warn('Invalid or missing MongoDB URI, using Docker default');
        await mongoose.connect('mongodb://mongodb:27017/LibreChat', connectionOptions);
      } else {
        await mongoose.connect(mongoUri, connectionOptions);
      }

      // Wait for connection to be ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Database connection timeout after 20 seconds'));
        }, 20000);

        if (mongoose.connection.readyState === 1) {
          clearTimeout(timeout);
          resolve();
        } else {
          mongoose.connection.once('connected', () => {
            clearTimeout(timeout);
            resolve();
          });
          mongoose.connection.once('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        }
      });

      this.initialized = true;
      console.log('MongoDB connection established successfully');
    } catch (error) {
      console.error('MongoDB connection failed:', error.message);
      this.initialized = false;
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  async ensureConnection() {
    if (!this.initialized || mongoose.connection.readyState !== 1) {
      await this.initializeDatabase();
    }

    // Double-check connection is ready
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database connection not ready');
    }
  }

  async createBook(bookData) {
    try {
      await this.ensureConnection();

      // Validate required fields
      if (
        !bookData.title ||
        !bookData.theme ||
        !bookData.genre ||
        !bookData.writingStyle ||
        !bookData.authorId
      ) {
        throw new Error(
          'Missing required fields: title, theme, genre, writingStyle, and authorId are required',
        );
      }

      // Create the book document
      const book = new Book({
        _id: uuidv4(),
        title: bookData.title,
        subtitle: bookData.subtitle,
        theme: bookData.theme,
        genre: bookData.genre,
        targetAudience: bookData.targetAudience,
        writingStyle: bookData.writingStyle,
        description: bookData.description,
        targetWordCount: bookData.targetWordCount,
        estimatedPages: bookData.estimatedPages,
        authorId: bookData.authorId,
        status: 'planning',
        currentWordCount: 0,
        metadata: {
          language: 'en',
          keywords: [],
          tags: [],
        },
        settings: {
          autoSave: true,
          backupFrequency: 'daily',
          collaborationEnabled: false,
          exportFormats: ['pdf'],
        },
      });

      const savedBook = await book.save();
      return savedBook;
    } catch (error) {
      // If it's a duplicate key error for bookId, provide helpful information
      if (error.message.includes('E11000') && error.message.includes('bookId')) {
        throw new Error(
          'Failed to create book: Database contains orphaned bookId index. Please run the database cleanup script to fix this issue.',
        );
      }
      throw new Error(`Failed to create book: ${error.message}`);
    }
  }

  async getBook(bookId, options = {}) {
    try {
      await this.ensureConnection();

      // Use lean() for better performance and add timeout
      const book = await Book.findById(bookId)
        .lean()
        .maxTimeMS(15000) // 15 second timeout for this specific query
        .exec();

      if (!book) {
        throw new Error(`Book with ID ${bookId} not found`);
      }

      const result = { ...book };

      if (options.includeChapters) {
        // Optimize chapter query with timeout
        const chapters = await Chapter.find({ bookId })
          .sort({ chapterNumber: 1 })
          .lean()
          .maxTimeMS(10000) // 10 second timeout
          .exec();
        result.chapters = chapters;

        if (options.includePages) {
          // Optimize pages query - get all pages for all chapters in one query
          const chapterIds = chapters.map((chapter) => chapter._id);
          const allPages = await Page.find({ chapterId: { $in: chapterIds } })
            .sort({ chapterId: 1, pageNumber: 1 })
            .lean()
            .maxTimeMS(15000) // 15 second timeout
            .exec();

          // Group pages by chapter
          const pagesByChapter = {};
          allPages.forEach((page) => {
            const chapterId = page.chapterId.toString();
            if (!pagesByChapter[chapterId]) {
              pagesByChapter[chapterId] = [];
            }
            pagesByChapter[chapterId].push(page);
          });

          // Assign pages to their respective chapters
          result.chapters.forEach((chapter) => {
            const chapterId = chapter._id.toString();
            chapter.pages = pagesByChapter[chapterId] || [];
          });
        }
      }

      return result;
    } catch (error) {
      if (error.name === 'MongooseError' && error.message.includes('buffering timed out')) {
        throw new Error('Database connection timeout. Please try again in a moment.');
      }
      throw new Error(`Failed to get book: ${error.message}`);
    }
  }

  async listBooks(options = {}) {
    try {
      await this.ensureConnection();

      const { authorId, status, genre, limit = 20, offset = 0 } = options;

      if (!authorId) {
        throw new Error('authorId is required');
      }

      const query = { authorId };

      if (status) {
        query.status = status;
      }

      if (genre) {
        query.genre = new RegExp(genre, 'i');
      }

      const books = await Book.find(query)
        .sort({ updatedAt: -1 })
        .limit(limit)
        .skip(offset)
        .select('-__v');

      const total = await Book.countDocuments(query);

      return {
        books,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      };
    } catch (error) {
      throw new Error(`Failed to list books: ${error.message}`);
    }
  }

  async updateBook(bookId, updates) {
    try {
      await this.ensureConnection();

      const book = await Book.findById(bookId);
      if (!book) {
        throw new Error(`Book with ID ${bookId} not found`);
      }

      // Apply updates
      Object.keys(updates).forEach((key) => {
        if (key === 'writingStyle' && updates[key]) {
          // Merge writing style updates
          book.writingStyle = { ...book.writingStyle, ...updates[key] };
        } else if (updates[key] !== undefined) {
          book[key] = updates[key];
        }
      });

      const updatedBook = await book.save();
      return updatedBook;
    } catch (error) {
      throw new Error(`Failed to update book: ${error.message}`);
    }
  }

  async deleteBook(bookId, authorId) {
    try {
      await this.ensureConnection();

      const book = await Book.findById(bookId);
      if (!book) {
        throw new Error(`Book with ID ${bookId} not found`);
      }

      if (book.authorId !== authorId) {
        throw new Error('Unauthorized: You can only delete your own books');
      }

      // Delete all associated pages first
      const chapters = await Chapter.find({ bookId });
      for (const chapter of chapters) {
        await Page.deleteMany({ chapterId: chapter._id });
      }

      // Delete all chapters
      await Chapter.deleteMany({ bookId });

      // Delete the book
      await Book.findByIdAndDelete(bookId);

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete book: ${error.message}`);
    }
  }

  async getBookStatistics(bookId) {
    try {
      await this.ensureConnection();

      const book = await Book.findById(bookId);
      if (!book) {
        throw new Error(`Book with ID ${bookId} not found`);
      }

      const chapters = await Chapter.find({ bookId });
      const chapterIds = chapters.map((ch) => ch._id);
      const pages = await Page.find({ chapterId: { $in: chapterIds } });

      // Calculate statistics
      const totalChapters = chapters.length;
      const totalPages = pages.length;
      const completedChapters = chapters.filter(
        (ch) => ch.status === 'completed' || ch.status === 'published',
      ).length;
      const completedPages = pages.filter(
        (p) => p.status === 'approved' || p.status === 'published',
      ).length;

      // Calculate word counts
      const currentWordCount = chapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0);
      const targetWordCount = book.targetWordCount || 0;
      const completionPercentage =
        targetWordCount > 0 ? (currentWordCount / targetWordCount) * 100 : 0;

      // Chapter status breakdown
      const chapterStatusBreakdown = chapters.reduce((acc, ch) => {
        acc[ch.status] = (acc[ch.status] || 0) + 1;
        return acc;
      }, {});

      // Page status breakdown
      const pageStatusBreakdown = pages.reduce((acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {});

      return {
        bookInfo: {
          id: book._id,
          title: book.title,
          status: book.status,
          theme: book.theme,
          genre: book.genre,
        },
        progress: {
          completionPercentage: Math.round(completionPercentage * 100) / 100,
          currentWordCount,
          targetWordCount,
          wordsRemaining: Math.max(0, targetWordCount - currentWordCount),
        },
        chapters: {
          total: totalChapters,
          completed: completedChapters,
          statusBreakdown: chapterStatusBreakdown,
        },
        pages: {
          total: totalPages,
          completed: completedPages,
          statusBreakdown: pageStatusBreakdown,
        },
        lastUpdated: book.updatedAt,
      };
    } catch (error) {
      throw new Error(`Failed to get book statistics: ${error.message}`);
    }
  }

  async updateWordCount(bookId) {
    try {
      await this.ensureConnection();

      const chapters = await Chapter.find({ bookId });
      const totalWordCount = chapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0);

      await Book.findByIdAndUpdate(bookId, { currentWordCount: totalWordCount });
      return totalWordCount;
    } catch (error) {
      throw new Error(`Failed to update word count: ${error.message}`);
    }
  }

  // Chapter Management Methods
  async createChapter(chapterData) {
    try {
      await this.ensureConnection();

      // Validate required fields
      if (!chapterData.bookId || !chapterData.title) {
        throw new Error('Missing required fields: bookId and title are required');
      }

      // Check if book exists
      const book = await Book.findById(chapterData.bookId);
      if (!book) {
        throw new Error(`Book with ID ${chapterData.bookId} not found`);
      }

      // Auto-generate chapter number if not provided
      if (!chapterData.chapterNumber) {
        const lastChapter = await Chapter.findOne({ bookId: chapterData.bookId })
          .sort({ chapterNumber: -1 })
          .lean()
          .maxTimeMS(10000) // 10 second timeout
          .exec();
        chapterData.chapterNumber = lastChapter ? lastChapter.chapterNumber + 1 : 1;
      }

      // Create the chapter document
      const chapter = new Chapter({
        _id: uuidv4(),
        bookId: chapterData.bookId,
        chapterNumber: chapterData.chapterNumber,
        title: chapterData.title,
        description: chapterData.description,
        outline: chapterData.outline,
        targetWordCount: chapterData.targetWordCount,
        status: chapterData.status || 'planned',
        notes: chapterData.notes,
        wordCount: 0,
      });

      const savedChapter = await chapter.save();
      return savedChapter;
    } catch (error) {
      throw new Error(`Failed to create chapter: ${error.message}`);
    }
  }

  async getChapter(chapterId, options = {}) {
    try {
      await this.ensureConnection();

      const chapter = await Chapter.findById(chapterId);
      if (!chapter) {
        throw new Error(`Chapter with ID ${chapterId} not found`);
      }

      const result = chapter.toObject();

      if (options.includePages) {
        const pages = await Page.find({ chapterId }).sort({ pageNumber: 1 });
        result.pages = pages;
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to get chapter: ${error.message}`);
    }
  }

  async listChapters(bookId) {
    try {
      await this.ensureConnection();

      if (!bookId) {
        throw new Error('bookId is required');
      }

      const chapters = await Chapter.find({ bookId }).sort({ chapterNumber: 1 });
      return chapters;
    } catch (error) {
      throw new Error(`Failed to list chapters: ${error.message}`);
    }
  }

  async updateChapter(chapterId, updates) {
    try {
      await this.ensureConnection();

      const chapter = await Chapter.findById(chapterId);
      if (!chapter) {
        throw new Error(`Chapter with ID ${chapterId} not found`);
      }

      // Apply updates
      Object.keys(updates).forEach((key) => {
        if (updates[key] !== undefined) {
          chapter[key] = updates[key];
        }
      });

      const updatedChapter = await chapter.save();

      // Update book word count if chapter word count changed
      if (updates.wordCount !== undefined) {
        await this.updateWordCount(chapter.bookId);
      }

      return updatedChapter;
    } catch (error) {
      throw new Error(`Failed to update chapter: ${error.message}`);
    }
  }

  async deleteChapter(chapterId, authorId) {
    try {
      await this.ensureConnection();

      const chapter = await Chapter.findById(chapterId);
      if (!chapter) {
        throw new Error(`Chapter with ID ${chapterId} not found`);
      }

      // Verify author permission
      const book = await Book.findById(chapter.bookId);
      if (book && book.authorId !== authorId) {
        throw new Error('Unauthorized: You can only delete chapters from your own books');
      }

      // Delete all pages in this chapter
      await Page.deleteMany({ chapterId });

      // Delete the chapter
      await Chapter.findByIdAndDelete(chapterId);

      // Update book word count
      await this.updateWordCount(chapter.bookId);

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete chapter: ${error.message}`);
    }
  }

  // Page Management Methods
  async createPage(pageData) {
    try {
      await this.ensureConnection();

      // Validate required fields
      if (!pageData.chapterId || !pageData.title || !pageData.content) {
        throw new Error('Missing required fields: chapterId, title, and content are required');
      }

      // Check if chapter exists
      const chapter = await Chapter.findById(pageData.chapterId);
      if (!chapter) {
        throw new Error(`Chapter with ID ${pageData.chapterId} not found`);
      }

      // Auto-generate page number if not provided
      if (!pageData.pageNumber) {
        const lastPage = await Page.findOne({ chapterId: pageData.chapterId })
          .sort({ pageNumber: -1 })
          .lean()
          .maxTimeMS(10000) // 10 second timeout
          .exec();
        pageData.pageNumber = lastPage ? lastPage.pageNumber + 1 : 1;
      }

      // Calculate word count
      const wordCount = pageData.content.split(/\s+/).filter((word) => word.length > 0).length;

      // Generate unique pageId - ensure it's never null or undefined
      const pageId = uuidv4();

      // Validate pageId generation
      if (!pageId || pageId === null || pageId === undefined) {
        throw new Error('Failed to generate valid pageId');
      }

      // Create the page document with explicit pageId validation
      const pageDocument = {
        _id: pageId,
        pageId: pageId,
        chapterId: pageData.chapterId,
        pageNumber: pageData.pageNumber,
        title: pageData.title,
        content: pageData.content,
        wordCount: wordCount,
        notes: pageData.notes,
        status: pageData.status || 'draft',
      };

      // Double-check that pageId is set before creating the document
      if (!pageDocument.pageId) {
        throw new Error('pageId cannot be null or undefined');
      }

      const page = new Page(pageDocument);
      const savedPage = await page.save();

      // Update chapter word count
      await this.updateChapterWordCount(pageData.chapterId);

      return savedPage;
    } catch (error) {
      // If it's a duplicate key error, provide more helpful information
      if (error.message.includes('E11000') && error.message.includes('pageId')) {
        throw new Error(
          'Failed to create page: A page with this ID already exists. This may indicate database corruption. Please run the database cleanup script.',
        );
      }
      throw new Error(`Failed to create page: ${error.message}`);
    }
  }

  async getPage(pageId) {
    try {
      await this.ensureConnection();

      const page = await Page.findById(pageId);
      if (!page) {
        throw new Error(`Page with ID ${pageId} not found`);
      }

      return page;
    } catch (error) {
      throw new Error(`Failed to get page: ${error.message}`);
    }
  }

  async listPages(chapterId) {
    try {
      await this.ensureConnection();

      if (!chapterId) {
        throw new Error('chapterId is required');
      }

      const pages = await Page.find({ chapterId }).sort({ pageNumber: 1 });
      return pages;
    } catch (error) {
      throw new Error(`Failed to list pages: ${error.message}`);
    }
  }

  async updatePage(pageId, updates) {
    try {
      await this.ensureConnection();

      const page = await Page.findById(pageId);
      if (!page) {
        throw new Error(`Page with ID ${pageId} not found`);
      }

      // Apply updates
      Object.keys(updates).forEach((key) => {
        if (updates[key] !== undefined) {
          page[key] = updates[key];
        }
      });

      // Recalculate word count if content changed
      if (updates.content !== undefined) {
        page.wordCount = updates.content.split(/\s+/).filter((word) => word.length > 0).length;
      }

      const updatedPage = await page.save();

      // Update chapter and book word counts
      await this.updateChapterWordCount(page.chapterId);

      return updatedPage;
    } catch (error) {
      throw new Error(`Failed to update page: ${error.message}`);
    }
  }

  async deletePage(pageId, authorId) {
    try {
      await this.ensureConnection();

      const page = await Page.findById(pageId);
      if (!page) {
        throw new Error(`Page with ID ${pageId} not found`);
      }

      // Verify author permission
      const chapter = await Chapter.findById(page.chapterId);
      if (chapter) {
        const book = await Book.findById(chapter.bookId);
        if (book && book.authorId !== authorId) {
          throw new Error('Unauthorized: You can only delete pages from your own books');
        }
      }

      const chapterId = page.chapterId;

      // Delete the page
      await Page.findByIdAndDelete(pageId);

      // Update chapter and book word counts
      await this.updateChapterWordCount(chapterId);

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete page: ${error.message}`);
    }
  }

  async updateChapterWordCount(chapterId) {
    try {
      await this.ensureConnection();

      const pages = await Page.find({ chapterId });
      const totalWordCount = pages.reduce((sum, page) => sum + (page.wordCount || 0), 0);

      const chapter = await Chapter.findByIdAndUpdate(
        chapterId,
        { wordCount: totalWordCount },
        { new: true },
      );

      if (chapter) {
        await this.updateWordCount(chapter.bookId);
      }

      return totalWordCount;
    } catch (error) {
      throw new Error(`Failed to update chapter word count: ${error.message}`);
    }
  }

  // Content Generation Helper
  async generateContentSuggestion(chapterId, context = {}) {
    try {
      await this.ensureConnection();

      const chapter = await Chapter.findById(chapterId);
      if (!chapter) {
        throw new Error(`Chapter with ID ${chapterId} not found`);
      }

      const book = await Book.findById(chapter.bookId);
      if (!book) {
        throw new Error('Book not found for this chapter');
      }

      // Get existing pages for context
      const existingPages = await Page.find({ chapterId }).sort({ pageNumber: 1 });

      return {
        bookContext: {
          title: book.title,
          theme: book.theme,
          genre: book.genre,
          writingStyle: book.writingStyle,
          targetAudience: book.targetAudience,
        },
        chapterContext: {
          title: chapter.title,
          description: chapter.description,
          outline: chapter.outline,
          chapterNumber: chapter.chapterNumber,
        },
        existingContent: existingPages.map((page) => ({
          pageNumber: page.pageNumber,
          title: page.title,
          wordCount: page.wordCount,
        })),
        suggestions: {
          nextPageTitle: `Page ${existingPages.length + 1} of Chapter ${chapter.chapterNumber}`,
          recommendedWordCount: Math.floor((chapter.targetWordCount || 3000) / 10), // Assuming ~10 pages per chapter
          writingPrompt: `Continue the story in ${book.writingStyle.tone} tone, using ${book.writingStyle.voice} perspective. Focus on ${book.theme}.`,
        },
      };
    } catch (error) {
      throw new Error(`Failed to generate content suggestion: ${error.message}`);
    }
  }
}
