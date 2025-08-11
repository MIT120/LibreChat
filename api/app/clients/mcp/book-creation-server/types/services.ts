import {
  BookResponse,
  BookStatistics,
  ChapterResponse,
  ContentGenerationOptions,
  ContentImprovementOptions,
  ContentSuggestion,
  CreateBookRequest,
  CreateChapterRequest,
  CreatePageRequest,
  GetBookOptions,
  IBook,
  IChapter,
  IPage,
  ListBooksOptions,
  PageGenerationOptions,
  PageResponse,
  UpdateBookRequest,
  UpdateChapterRequest,
  UpdatePageRequest
} from './book.js';
import { PaginatedResponse } from './index.js';

// Repository interfaces
export interface IBookRepository {
  create(data: CreateBookRequest): Promise<IBook>;
  findById(id: string): Promise<IBook | null>;
  findByAuthor(authorId: string, options?: ListBooksOptions): Promise<PaginatedResponse<IBook>>;
  update(id: string, data: UpdateBookRequest): Promise<IBook>;
  delete(id: string): Promise<boolean>;
  updateWordCount(bookId: string): Promise<number>;
}

export interface IChapterRepository {
  create(data: CreateChapterRequest): Promise<IChapter>;
  findById(id: string): Promise<IChapter | null>;
  findByBook(bookId: string): Promise<IChapter[]>;
  update(id: string, data: UpdateChapterRequest): Promise<IChapter>;
  delete(id: string): Promise<boolean>;
  updateWordCount(chapterId: string): Promise<number>;
}

export interface IPageRepository {
  create(data: CreatePageRequest): Promise<IPage>;
  findById(id: string): Promise<IPage | null>;
  findByChapter(chapterId: string): Promise<IPage[]>;
  update(id: string, data: UpdatePageRequest): Promise<IPage>;
  delete(id: string): Promise<boolean>;
}

// Service interfaces
export interface IBookService {
  createBook(data: CreateBookRequest): Promise<BookResponse>;
  getBook(id: string, options?: GetBookOptions): Promise<BookResponse>;
  listBooks(options: ListBooksOptions): Promise<PaginatedResponse<BookResponse>>;
  updateBook(id: string, data: UpdateBookRequest): Promise<BookResponse>;
  deleteBook(id: string, authorId: string): Promise<void>;
  getBookStatistics(id: string): Promise<BookStatistics>;
}

export interface IChapterService {
  createChapter(data: CreateChapterRequest): Promise<ChapterResponse>;
  getChapter(id: string, includePages?: boolean): Promise<ChapterResponse>;
  listChapters(bookId: string): Promise<ChapterResponse[]>;
  updateChapter(id: string, data: UpdateChapterRequest): Promise<ChapterResponse>;
  deleteChapter(id: string, authorId: string): Promise<void>;
}

export interface IPageService {
  createPage(data: CreatePageRequest): Promise<PageResponse>;
  getPage(id: string): Promise<PageResponse>;
  listPages(chapterId: string): Promise<PageResponse[]>;
  updatePage(id: string, data: UpdatePageRequest): Promise<PageResponse>;
  deletePage(id: string, authorId: string): Promise<void>;
}

export interface IContentService {
  generateContentSuggestion(chapterId: string, context?: Record<string, any>): Promise<ContentSuggestion>;
  generateChapterContent(chapterId: string, options: ContentGenerationOptions): Promise<string>;
  generatePageContent(chapterId: string, options: PageGenerationOptions): Promise<PageResponse>;
  improveContent(contentId: string, options: ContentImprovementOptions): Promise<string>;
}

// Content generation options are defined in book.ts to avoid duplication

// Export service interface
export interface IExportService {
  exportBook(bookId: string, format: string, options: ExportOptions): Promise<ExportResult>;
}

export interface ExportOptions {
  includeMetadata?: boolean;
  authorId: string;
  /** Optional additional filename to copy the export to (e.g., conversationId.html) */
  aliasFilename?: string;
}

export interface ExportResult {
  filename: string;
  filepath: string;
  format: string;
  size: number;
  createdAt: Date;
}

// Configuration service interface
export interface IConfigService {
  get<T>(key: string): T;
  set<T>(key: string, value: T): void;
  has(key: string): boolean;
  getAll(): Record<string, any>;
}

// Database connection interface
export interface IDatabaseConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getConnectionState(): string;
}