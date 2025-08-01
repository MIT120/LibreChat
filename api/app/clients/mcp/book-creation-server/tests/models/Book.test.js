const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const BookModel = require('../../models/Book');

describe('BookModel', () => {
  let mongoServer;
  let testUserId;

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri);
    testUserId = new mongoose.Types.ObjectId().toString();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear the database before each test
    await mongoose.connection.db.dropDatabase();
  });

  describe('create', () => {
    it('should create a new book with valid data', async () => {
      const bookData = {
        user: testUserId,
        title: 'Test Book',
        theme: 'A test book about testing',
        genre: 'technical',
        config: {
          chapterCount: 5,
          writingStyle: 'formal',
          targetAudience: 'developers',
        },
        outline: [
          { title: 'Chapter 1', description: 'Introduction' },
          { title: 'Chapter 2', description: 'Getting Started' },
        ],
      };

      const book = await BookModel.create(bookData);

      expect(book).toBeDefined();
      expect(book.bookId).toBeDefined();
      expect(book.user).toBe(testUserId);
      expect(book.title).toBe('Test Book');
      expect(book.theme).toBe('A test book about testing');
      expect(book.genre).toBe('technical');
      expect(book.status).toBe('outline_pending');
      expect(book.config.chapterCount).toBe(5);
      expect(book.config.writingStyle).toBe('formal');
      expect(book.progress.totalChapters).toBe(5);
      expect(book.outline.chapters).toHaveLength(2);
    });

    it('should create a book with default values when config is minimal', async () => {
      const bookData = {
        user: testUserId,
        title: 'Minimal Book',
        theme: 'A minimal book',
        genre: 'fiction',
      };

      const book = await BookModel.create(bookData);

      expect(book.config.chapterCount).toBe(10);
      expect(book.config.writingStyle).toBe('casual');
      expect(book.config.formatting.font).toBe('Arial');
      expect(book.config.formatting.fontSize).toBe(12);
      expect(book.config.formatting.lineSpacing).toBe(1.5);
      expect(book.progress.totalChapters).toBe(10);
    });

    it('should throw error when required fields are missing', async () => {
      const bookData = {
        user: testUserId,
        title: 'Test Book',
        // Missing theme and genre
      };

      await expect(BookModel.create(bookData)).rejects.toThrow();
    });

    it('should throw error when genre is invalid', async () => {
      const bookData = {
        user: testUserId,
        title: 'Test Book',
        theme: 'A test book',
        genre: 'invalid-genre',
      };

      await expect(BookModel.create(bookData)).rejects.toThrow();
    });
  });

  describe('findByIdAndUser', () => {
    let testBook;

    beforeEach(async () => {
      testBook = await BookModel.create({
        user: testUserId,
        title: 'Test Book',
        theme: 'A test book',
        genre: 'fiction',
      });
    });

    it('should find a book by ID and user', async () => {
      const book = await BookModel.findByIdAndUser(testBook.bookId, testUserId);

      expect(book).toBeDefined();
      expect(book.bookId).toBe(testBook.bookId);
      expect(book.user).toBe(testUserId);
    });

    it('should return null when book not found', async () => {
      const book = await BookModel.findByIdAndUser('non-existent-id', testUserId);
      expect(book).toBeNull();
    });

    it('should return null when user does not match', async () => {
      const otherUserId = new mongoose.Types.ObjectId().toString();
      const book = await BookModel.findByIdAndUser(testBook.bookId, otherUserId);
      expect(book).toBeNull();
    });
  });

  describe('findByUser', () => {
    beforeEach(async () => {
      // Create multiple books for testing
      await BookModel.create({
        user: testUserId,
        title: 'Book 1',
        theme: 'Theme 1',
        genre: 'fiction',
      });

      await BookModel.create({
        user: testUserId,
        title: 'Book 2',
        theme: 'Theme 2',
        genre: 'non-fiction',
      });

      // Create a book for another user
      const otherUserId = new mongoose.Types.ObjectId().toString();
      await BookModel.create({
        user: otherUserId,
        title: 'Other Book',
        theme: 'Other Theme',
        genre: 'technical',
      });
    });

    it('should find all books for a user', async () => {
      const books = await BookModel.findByUser(testUserId);

      expect(books).toHaveLength(2);
      expect(books[0].user).toBe(testUserId);
      expect(books[1].user).toBe(testUserId);
    });

    it('should filter books by status', async () => {
      // Update one book to in_progress status
      const books = await BookModel.findByUser(testUserId);
      await BookModel.updateByIdAndUser(books[0].bookId, testUserId, { status: 'in_progress' });

      const inProgressBooks = await BookModel.findByUser(testUserId, { status: 'in_progress' });
      const pendingBooks = await BookModel.findByUser(testUserId, { status: 'outline_pending' });

      expect(inProgressBooks).toHaveLength(1);
      expect(pendingBooks).toHaveLength(1);
    });

    it('should limit results when limit option is provided', async () => {
      const books = await BookModel.findByUser(testUserId, { limit: 1 });
      expect(books).toHaveLength(1);
    });
  });

  describe('updateByIdAndUser', () => {
    let testBook;

    beforeEach(async () => {
      testBook = await BookModel.create({
        user: testUserId,
        title: 'Test Book',
        theme: 'A test book',
        genre: 'fiction',
      });
    });

    it('should update a book successfully', async () => {
      const updateData = {
        title: 'Updated Book Title',
        status: 'in_progress',
      };

      const updatedBook = await BookModel.updateByIdAndUser(
        testBook.bookId,
        testUserId,
        updateData,
      );

      expect(updatedBook).toBeDefined();
      expect(updatedBook.title).toBe('Updated Book Title');
      expect(updatedBook.status).toBe('in_progress');
    });

    it('should return null when book not found', async () => {
      const updatedBook = await BookModel.updateByIdAndUser('non-existent-id', testUserId, {
        title: 'Updated',
      });

      expect(updatedBook).toBeNull();
    });

    it('should validate update data', async () => {
      await expect(
        BookModel.updateByIdAndUser(testBook.bookId, testUserId, { genre: 'invalid-genre' }),
      ).rejects.toThrow();
    });
  });

  describe('deleteByIdAndUser', () => {
    let testBook;

    beforeEach(async () => {
      testBook = await BookModel.create({
        user: testUserId,
        title: 'Test Book',
        theme: 'A test book',
        genre: 'fiction',
      });
    });

    it('should delete a book successfully', async () => {
      const deleted = await BookModel.deleteByIdAndUser(testBook.bookId, testUserId);
      expect(deleted).toBe(true);

      const book = await BookModel.findByIdAndUser(testBook.bookId, testUserId);
      expect(book).toBeNull();
    });

    it('should return false when book not found', async () => {
      const deleted = await BookModel.deleteByIdAndUser('non-existent-id', testUserId);
      expect(deleted).toBe(false);
    });
  });

  describe('approveOutline', () => {
    let testBook;

    beforeEach(async () => {
      testBook = await BookModel.create({
        user: testUserId,
        title: 'Test Book',
        theme: 'A test book',
        genre: 'fiction',
      });
    });

    it('should approve outline and change status to in_progress', async () => {
      const approvedBook = await BookModel.approveOutline(testBook.bookId, testUserId);

      expect(approvedBook).toBeDefined();
      expect(approvedBook.status).toBe('in_progress');
      expect(approvedBook.outline.approvedAt).toBeDefined();
    });

    it('should return null when book is not in outline_pending status', async () => {
      // First approve the outline
      await BookModel.approveOutline(testBook.bookId, testUserId);

      // Try to approve again
      const result = await BookModel.approveOutline(testBook.bookId, testUserId);
      expect(result).toBeNull();
    });
  });

  describe('updateProgress', () => {
    let testBook;

    beforeEach(async () => {
      testBook = await BookModel.create({
        user: testUserId,
        title: 'Test Book',
        theme: 'A test book',
        genre: 'fiction',
      });
    });

    it('should update progress fields', async () => {
      const progressData = {
        currentChapter: 3,
        completedChapters: 2,
        wordCount: 5000,
      };

      const updatedBook = await BookModel.updateProgress(testBook.bookId, testUserId, progressData);

      expect(updatedBook.progress.currentChapter).toBe(3);
      expect(updatedBook.progress.completedChapters).toBe(2);
      expect(updatedBook.metadata.wordCount).toBe(5000);
      expect(updatedBook.metadata.estimatedReadingTime).toBe(25); // 5000 / 200
    });

    it('should update only provided fields', async () => {
      const progressData = { currentChapter: 5 };

      const updatedBook = await BookModel.updateProgress(testBook.bookId, testUserId, progressData);

      expect(updatedBook.progress.currentChapter).toBe(5);
      expect(updatedBook.progress.completedChapters).toBe(0); // Should remain unchanged
    });
  });

  describe('getStatistics', () => {
    beforeEach(async () => {
      // Create books with different statuses
      await BookModel.create({
        user: testUserId,
        title: 'Book 1',
        theme: 'Theme 1',
        genre: 'fiction',
      });

      const book2 = await BookModel.create({
        user: testUserId,
        title: 'Book 2',
        theme: 'Theme 2',
        genre: 'non-fiction',
      });

      // Update one book to completed status with word count
      await BookModel.updateByIdAndUser(book2.bookId, testUserId, {
        status: 'completed',
        'metadata.wordCount': 10000,
      });
    });

    it('should return correct statistics', async () => {
      const stats = await BookModel.getStatistics(testUserId);

      expect(stats.total).toBe(2);
      expect(stats.outline_pending).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.in_progress).toBe(0);
      expect(stats.cancelled).toBe(0);
      expect(stats.totalWords).toBe(10000);
    });

    it('should return zero statistics for user with no books', async () => {
      const otherUserId = new mongoose.Types.ObjectId().toString();
      const stats = await BookModel.getStatistics(otherUserId);

      expect(stats.total).toBe(0);
      expect(stats.totalWords).toBe(0);
    });
  });
});
