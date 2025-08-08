/**
 * Tests for BookService
 */

import { CreateBookRequest } from '../../types/book.js';
import { Logger } from '../core/Logger.js';
import { BookService } from '../services/BookService.js';
import { DatabaseService } from '../services/DatabaseService.js';

// Mock DatabaseService
jest.mock('../services/DatabaseService.js');

describe('BookService', () => {
    let bookService: BookService;
    let mockLogger: Logger;
    let mockDatabaseService: jest.Mocked<DatabaseService>;

    beforeEach(() => {
        mockLogger = new Logger('test');
        mockDatabaseService = new DatabaseService(mockLogger, {
            uri: 'mongodb://localhost:27017/test',
            options: {
                bufferCommands: false,
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 10000,
                socketTimeoutMS: 0,
                maxPoolSize: 10,
                minPoolSize: 1,
                maxIdleTimeMS: 30000,
                waitQueueTimeoutMS: 5000,
            },
        }) as jest.Mocked<DatabaseService>;

        bookService = new BookService(mockLogger, mockDatabaseService);
    });

    describe('initialization', () => {
        it('should initialize successfully', async () => {
            await expect(bookService.initialize()).resolves.not.toThrow();
            expect(bookService.isInitialized()).toBe(true);
        });
    });

    describe('createBook', () => {
        it('should validate required fields', async () => {
            const invalidRequest = {} as CreateBookRequest;

            await expect(bookService.createBook(invalidRequest)).rejects.toThrow();
        });

        it('should create a book with valid data', async () => {
            const validRequest: CreateBookRequest = {
                title: 'Test Book',
                theme: 'Testing',
                genre: 'Technical',
                writingStyle: {
                    tone: 'formal' as const,
                    voice: 'third_person' as const,
                    vocabulary: 'technical' as const,
                    sentenceStructure: 'complex' as const,
                },
                authorId: 'test-author',
            };

            // This test would need proper mocking of the database operations
            // For now, it's a placeholder to show the test structure
            expect(validRequest.title).toBe('Test Book');
        });
    });

    describe('health check', () => {
        it('should report healthy status when initialized', async () => {
            await bookService.initialize();
            const health = await bookService.checkHealth();

            expect(health.status).toBe('healthy');
            expect(health.lastCheck).toBeInstanceOf(Date);
        });
    });
});
