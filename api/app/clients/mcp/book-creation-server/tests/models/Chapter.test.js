const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ChapterModel = require('../../models/Chapter');

describe('ChapterModel', () => {
  let mongoServer;
  let testUserId;
  let testBookId;

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    await mongoose.connect(mongoUri);
    testUserId = new mongoose.Types.ObjectId().toString();
    testBookId = 'test-book-id';
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
    it('should create a new chapter with valid data', async () => {
      const chapterData = {
        bookId: testBookId,
        user: testUserId,
        chapterNumber: 1,
        title: 'Chapter 1: Introduction',
        content: 'This is the introduction chapter content.',
        generationContext: {
          previousSummaries: [],
          styleInstructions: 'Write in a formal tone',
          specificRequirements: 'Include examples',
        },
      };

      const chapter = await ChapterModel.create(chapterData);

      expect(chapter).toBeDefined();
      expect(chapter.chapterId).toBeDefined();
      expect(chapter.bookId).toBe(testBookId);
      expect(chapter.user).toBe(testUserId);
      expect(chapter.chapterNumber).toBe(1);
      expect(chapter.title).toBe('Chapter 1: Introduction');
      expect(chapter.content).toBe('This is the introduction chapter content.');
      expect(chapter.status).toBe('pending');
      expect(chapter.wordCount).toBeGreaterThan(0);
      expect(chapter.generationContext.styleInstructions).toBe('Write in a formal tone');
    });

    it('should create a chapter with minimal data', async () => {
      const chapterData = {
        bookId: testBookId,
        user: testUserId,
        chapterNumber: 2,
        title: 'Chapter 2',
        content: 'Chapter content.',
      };

      const chapter = await ChapterModel.create(chapterData);

      expect(chapter).toBeDefined();
      expect(chapter.generationContext.previousSummaries).toEqual([]);
      expect(chapter.generationContext.styleInstructions).toBe('');
      expect(chapter.generationContext.specificRequirements).toBe('');
    });

    it('should throw error when required fields are missing', async () => {
      const chapterData = {
        bookId: testBookId,
        user: testUserId,
        // Missing chapterNumber, title, and content
      };

      await expect(ChapterModel.create(chapterData)).rejects.toThrow();
    });

    it('should calculate word count automatically', async () => {
      const chapterData = {
        bookId: testBookId,
        user: testUserId,
        chapterNumber: 1,
        title: 'Test Chapter',
        content: 'This is a test chapter with exactly ten words in it.',
      };

      const chapter = await ChapterModel.create(chapterData);
      expect(chapter.wordCount).toBe(11); // Actual word count
    });
  });

  describe('findByIdAndUser', () => {
    let testChapter;

    beforeEach(async () => {
      testChapter = await ChapterModel.create({
        bookId: testBookId,
        user: testUserId,
        chapterNumber: 1,
        title: 'Test Chapter',
        content: 'Test content',
      });
    });

    it('should find a chapter by ID and user', async () => {
      const chapter = await ChapterModel.findByIdAndUser(testChapter.chapterId, testUserId);

      expect(chapter).toBeDefined();
      expect(chapter.chapterId).toBe(testChapter.chapterId);
      expect(chapter.user).toBe(testUserId);
    });

    it('should return null when chapter not found', async () => {
      const chapter = await ChapterModel.findByIdAndUser('non-existent-id', testUserId);
      expect(chapter).toBeNull();
    });

    it('should return null when user does not match', async () => {
      const otherUserId = new mongoose.Types.ObjectId().toString();
      const chapter = await ChapterModel.findByIdAndUser(testChapter.chapterId, otherUserId);
      expect(chapter).toBeNull();
    });
  });

  describe('findByBook', () => {
    beforeEach(async () => {
      // Create multiple chapters for the same book
      await ChapterModel.create({
        bookId: testBookId,
        user: testUserId,
        chapterNumber: 1,
        title: 'Chapter 1',
        content: 'Content 1',
      });

      await ChapterModel.create({
        bookId: testBookId,
        user: testUserId,
        chapterNumber: 2,
        title: 'Chapter 2',
        content: 'Content 2',
      });

      // Create a chapter for another book
      await ChapterModel.create({
        bookId: 'other-book-id',
        user: testUserId,
        chapterNumber: 1,
        title: 'Other Chapter',
        content: 'Other content',
      });
    });

    it('should find all chapters for a book', async () => {
      const chapters = await ChapterModel.findByBook(testBookId, testUserId);

      expect(chapters).toHaveLength(2);
      expect(chapters[0].bookId).toBe(testBookId);
      expect(chapters[1].bookId).toBe(testBookId);
    });

    it('should sort chapters by number when requested', async () => {
      const chapters = await ChapterModel.findByBook(testBookId, testUserId, {
        sortByNumber: true,
      });

      expect(chapters).toHaveLength(2);
      expect(chapters[0].chapterNumber).toBe(1);
      expect(chapters[1].chapterNumber).toBe(2);
    });

    it('should filter chapters by status', async () => {
      // Approve one chapter
      const chapters = await ChapterModel.findByBook(testBookId, testUserId);
      await ChapterModel.approve(chapters[0].chapterId, testUserId, 'Summary');

      const approvedChapters = await ChapterModel.findByBook(testBookId, testUserId, {
        status: 'approved',
      });
      const pendingChapters = await ChapterModel.findByBook(testBookId, testUserId, {
        status: 'pending',
      });

      expect(approvedChapters).toHaveLength(1);
      expect(pendingChapters).toHaveLength(1);
    });
  });

  describe('updateByIdAndUser', () => {
    let testChapter;

    beforeEach(async () => {
      testChapter = await ChapterModel.create({
        bookId: testBookId,
        user: testUserId,
        chapterNumber: 1,
        title: 'Test Chapter',
        content: 'Test content',
      });
    });

    it('should update a chapter successfully', async () => {
      const updateData = {
        title: 'Updated Chapter Title',
        content: 'Updated chapter content with more words than before.',
      };

      const updatedChapter = await ChapterModel.updateByIdAndUser(
        testChapter.chapterId,
        testUserId,
        updateData
      );

      expect(updatedChapter).toBeDefined();
      expect(updatedChapter.title).toBe('Updated Chapter Title');
      expect(updatedChapter.content).toBe('Updated chapter content with more words than before.');
      // The word count should be recalculated based on the new content
      const expectedWordCount = updatedChapter.content.trim().split(/\s+/).filter(word => word.length > 0).length;
      expect(updatedChapter.wordCount).toBe(expectedWordCount);
    });

    it('should return null when chapter not found', async () => {
      const updatedChapter = await ChapterModel.updateByIdAndUser(
        'non-existent-id',
        testUserId,
        { title: 'Updated' }
      );

      expect(updatedChapter).toBeNull();
    });
  });

  describe('deleteByIdAndUser', () => {
    let testChapter;

    beforeEach(async () => {
      testChapter = await ChapterModel.create({
        bookId: testBookId,
        user: testUserId,
        chapterNumber: 1,
        title: 'Test Chapter',
        content: 'Test content',
      });
    });

    it('should delete a chapter successfully', async () => {
      const deleted = await ChapterModel.deleteByIdAndUser(testChapter.chapterId, testUserId);
      expect(deleted).toBe(true);

      const chapter = await ChapterModel.findByIdAndUser(testChapter.chapterId, testUserId);
      expect(chapter).toBeNull();
    });

    it('should return false when chapter not found', async () => {
      const deleted = await ChapterModel.deleteByIdAndUser('non-existent-id', testUserId);
      expect(deleted).toBe(false);
    });
  });

  describe('deleteByBook', () => {
    beforeEach(async () => {
      // Create multiple chapters for the same book
      await ChapterModel.create({
        bookId: testBookId,
        user: testUserId,
        chapterNumber: 1,
        title: 'Chapter 1',
        content: 'Content 1',
      });

      await ChapterModel.create({
        bookId: testBookId,
        user: testUserId,
        chapterNumber: 2,
        title: 'Chapter 2',
        content: 'Content 2',
      });
    });

    it('should delete all chapters for a book', async () => {
      const deletedCount = await ChapterModel.deleteByBook(testBookId, testUserId);
      expect(deletedCount).toBe(2);

      const chapters = await ChapterModel.findByBook(testBookId, testUserId);
      expect(chapters).toHaveLength(0);
    });

    it('should return 0 when no chapters found', async () => {
      const deletedCount = await ChapterModel.deleteByBook('non-existent-book', testUserId);
      expect(deletedCount).toBe(0);
    });
  });

  describe('approve', () => {
    let testChapter;

    beforeEach(async () => {
      testChapter = await ChapterModel.create({
        bookId: testBookId,
        user: testUserId,
        chapterNumber: 1,
        title: 'Test Chapter',
        content: 'Test content',
      });
    });

    it('should approve a chapter with summary', async () => {
      const summary = 'This chapter introduces the main concepts.';
      const approvedChapter = await ChapterModel.approve(
        testChapter.chapterId,
        testUserId,
        summary
      );

      expect(approvedChapter).toBeDefined();
      expect(approvedChapter.status).toBe('approved');
      expect(approvedChapter.summary).toBe(summary);
      expect(approvedChapter.approvedAt).toBeDefined();
      expect(approvedChapter.rejectedAt).toBeUndefined();
    });

    it('should return null when chapter is not in pending status', async () => {
      // First approve the chapter
      await ChapterModel.approve(testChapter.chapterId, testUserId, 'Summary');

      // Try to approve again
      const result = await ChapterModel.approve(testChapter.chapterId, testUserId, 'New summary');
      expect(result).toBeNull();
    });
  });

  describe('reject', () => {
    let testChapter;

    beforeEach(async () => {
      testChapter = await ChapterModel.create({
        bookId: testBookId,
        user: testUserId,
        chapterNumber: 1,
        title: 'Test Chapter',
        content: 'Test content',
      });
    });

    it('should reject a chapter with feedback', async () => {
      const feedback = 'The chapter needs more detail and examples.';
      const rejectedChapter = await ChapterModel.reject(
        testChapter.chapterId,
        testUserId,
        feedback
      );

      expect(rejectedChapter).toBeDefined();
      expect(rejectedChapter.status).toBe('rejected');
      expect(rejectedChapter.feedback).toBe(feedback);
      expect(rejectedChapter.rejectedAt).toBeDefined();
      expect(rejectedChapter.approvedAt).toBeUndefined();
    });

    it('should return null when chapter is not in pending status', async () => {
      // First reject the chapter
      await ChapterModel.reject(testChapter.chapterId, testUserId, 'Feedback');

      // Try to reject again
      const result = await ChapterModel.reject(testChapter.chapterId, testUserId, 'New feedback');
      expect(result).toBeNull();
    });
  });

  describe('getApprovedSummaries', () => {
    beforeEach(async () => {
      // Create and approve multiple chapters
      const chapter1 = await ChapterModel.create({
        bookId: testBookId,
        user: testUserId,
        chapterNumber: 1,
        title: 'Chapter 1',
        content: 'Content 1',
      });

      const chapter2 = await ChapterModel.create({
        bookId: testBookId,
        user: testUserId,
        chapterNumber: 2,
        title: 'Chapter 2',
        content: 'Content 2',
      });

      

      // Approve first two chapters
      await ChapterModel.approve(chapter1.chapterId, testUserId, 'Summary 1');
      await ChapterModel.approve(chapter2.chapterId, testUserId, 'Summary 2');
      // Leave chapter 3 pending
    });

    it('should return summaries of approved chapters before specified chapter', async () => {
      const summaries = await ChapterModel.getApprovedSummaries(testBookId, testUserId, 3);

      expect(summaries).toHaveLength(2);
      expect(summaries[0].chapterNumber).toBe(1);
      expect(summaries[0].summary).toBe('Summary 1');
      expect(summaries[1].chapterNumber).toBe(2);
      expect(summaries[1].summary).toBe('Summary 2');
    });

    it('should return empty array when no approved chapters exist', async () => {
      const summaries = await ChapterModel.getApprovedSummaries(testBookId, testUserId, 1);
      expect(summaries).toHaveLength(0);
    });
  });

  describe('getBookStatistics', () => {
    beforeEach(async () => {
      // Create chapters with different statuses
      const chapter1 = await ChapterModel.create({
        bookId: testBookId,
        user: testUserId,
        chapterNumber: 1,
        title: 'Chapter 1',
        content: 'This is chapter one with ten words exactly here.',
      });

      const chapter2 = await ChapterModel.create({
        bookId: testBookId,
        user: testUserId,
        chapterNumber: 2,
        title: 'Chapter 2',
        content: 'This is chapter two with exactly ten words as well.',
      });

      // Approve one chapter
      await ChapterModel.approve(chapter1.chapterId, testUserId, 'Summary');
      // Reject another
      await ChapterModel.reject(chapter2.chapterId, testUserId, 'Feedback');
    });

    it('should return correct statistics', async () => {
      const stats = await ChapterModel.getBookStatistics(testBookId, testUserId);

      expect(stats.total).toBe(2);
      expect(stats.approved).toBe(1);
      expect(stats.rejected).toBe(1);
      expect(stats.pending).toBe(0);
      expect(stats.totalWords).toBe(19); // 9 + 10 words per chapter
    });
  });

  describe('getNextChapterNumber', () => {
    it('should return 1 when no chapters exist', async () => {
      const nextNumber = await ChapterModel.getNextChapterNumber(testBookId, testUserId);
      expect(nextNumber).toBe(1);
    });

    it('should return correct next chapter number', async () => {
      await ChapterModel.create({
        bookId: testBookId,
        user: testUserId,
        chapterNumber: 1,
        title: 'Chapter 1',
        content: 'Content 1',
      });

      await ChapterModel.create({
        bookId: testBookId,
        user: testUserId,
        chapterNumber: 3,
        title: 'Chapter 3',
        content: 'Content 3',
      });

      const nextNumber = await ChapterModel.getNextChapterNumber(testBookId, testUserId);
      expect(nextNumber).toBe(4); // Should be based on highest existing number
    });
  });
});