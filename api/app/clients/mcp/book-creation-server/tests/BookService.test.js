import { jest } from '@jest/globals';
import { BookService } from '../services/BookService.js';

// Mock mongoose and models
jest.mock('mongoose');
jest.mock('../models/Book.js');
jest.mock('../models/Chapter.js');
jest.mock('../models/Page.js');

describe('BookService', () => {
  let bookService;

  beforeEach(() => {
    bookService = new BookService();
    jest.clearAllMocks();
  });

  describe('createBook', () => {
    it('should create a book with valid data', async () => {
      const bookData = {
        title: 'Test Book',
        theme: 'Technology',
        genre: 'Non-fiction',
        writingStyle: {
          tone: 'formal',
          voice: 'third_person',
          vocabulary: 'advanced',
          sentenceStructure: 'complex',
        },
        authorId: 'user123',
      };

      const mockBook = {
        _id: 'book123',
        ...bookData,
        save: jest.fn().mockResolvedValue({ _id: 'book123', ...bookData }),
      };

      // Mock the Book constructor
      const { Book } = await import('../models/Book.js');
      Book.mockImplementation(() => mockBook);

      const result = await bookService.createBook(bookData);

      expect(Book).toHaveBeenCalledWith(
        expect.objectContaining({
          title: bookData.title,
          theme: bookData.theme,
          genre: bookData.genre,
          writingStyle: bookData.writingStyle,
          authorId: bookData.authorId,
        }),
      );
      expect(mockBook.save).toHaveBeenCalled();
      expect(result._id).toBe('book123');
    });

    it('should throw error for missing required fields', async () => {
      const incompleteData = {
        title: 'Test Book',
        // missing theme, genre, writingStyle, authorId
      };

      await expect(bookService.createBook(incompleteData)).rejects.toThrow(
        'Missing required fields: title, theme, genre, writingStyle, and authorId are required',
      );
    });
  });

  describe('getBook', () => {
    it('should retrieve a book by ID', async () => {
      const mockBook = {
        _id: 'book123',
        title: 'Test Book',
        toObject: jest.fn().mockReturnValue({
          _id: 'book123',
          title: 'Test Book',
        }),
      };

      const { Book } = await import('../models/Book.js');
      Book.findById = jest.fn().mockResolvedValue(mockBook);

      const result = await bookService.getBook('book123');

      expect(Book.findById).toHaveBeenCalledWith('book123');
      expect(result._id).toBe('book123');
    });

    it('should throw error for non-existent book', async () => {
      const { Book } = await import('../models/Book.js');
      Book.findById = jest.fn().mockResolvedValue(null);

      await expect(bookService.getBook('nonexistent')).rejects.toThrow(
        'Book with ID nonexistent not found',
      );
    });
  });

  describe('listBooks', () => {
    it('should list books for an author', async () => {
      const mockBooks = [
        { _id: 'book1', title: 'Book 1', authorId: 'user123' },
        { _id: 'book2', title: 'Book 2', authorId: 'user123' },
      ];

      const { Book } = await import('../models/Book.js');
      Book.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue(mockBooks),
            }),
          }),
        }),
      });
      Book.countDocuments = jest.fn().mockResolvedValue(2);

      const result = await bookService.listBooks({ authorId: 'user123' });

      expect(result.books).toEqual(mockBooks);
      expect(result.pagination.total).toBe(2);
    });

    it('should throw error for missing authorId', async () => {
      await expect(bookService.listBooks({})).rejects.toThrow('authorId is required');
    });
  });

  describe('updateBook', () => {
    it('should update a book', async () => {
      const mockBook = {
        _id: 'book123',
        title: 'Original Title',
        writingStyle: { tone: 'formal' },
        save: jest.fn().mockResolvedValue({
          _id: 'book123',
          title: 'Updated Title',
        }),
      };

      const { Book } = await import('../models/Book.js');
      Book.findById = jest.fn().mockResolvedValue(mockBook);

      const updates = { title: 'Updated Title' };
      const result = await bookService.updateBook('book123', updates);

      expect(mockBook.title).toBe('Updated Title');
      expect(mockBook.save).toHaveBeenCalled();
    });
  });

  describe('deleteBook', () => {
    it('should delete a book and associated content', async () => {
      const mockBook = {
        _id: 'book123',
        authorId: 'user123',
      };

      const mockChapters = [
        { _id: 'chapter1', bookId: 'book123' },
        { _id: 'chapter2', bookId: 'book123' },
      ];

      const { Book } = await import('../models/Book.js');
      const { Chapter } = await import('../models/Chapter.js');
      const { Page } = await import('../models/Page.js');

      Book.findById = jest.fn().mockResolvedValue(mockBook);
      Chapter.find = jest.fn().mockResolvedValue(mockChapters);
      Page.deleteMany = jest.fn().mockResolvedValue({});
      Chapter.deleteMany = jest.fn().mockResolvedValue({});
      Book.findByIdAndDelete = jest.fn().mockResolvedValue({});

      const result = await bookService.deleteBook('book123', 'user123');

      expect(Page.deleteMany).toHaveBeenCalledTimes(2);
      expect(Chapter.deleteMany).toHaveBeenCalledWith({ bookId: 'book123' });
      expect(Book.findByIdAndDelete).toHaveBeenCalledWith('book123');
      expect(result.success).toBe(true);
    });

    it('should throw error for unauthorized deletion', async () => {
      const mockBook = {
        _id: 'book123',
        authorId: 'user123',
      };

      const { Book } = await import('../models/Book.js');
      Book.findById = jest.fn().mockResolvedValue(mockBook);

      await expect(bookService.deleteBook('book123', 'user456')).rejects.toThrow(
        'Unauthorized: You can only delete your own books',
      );
    });
  });
});
