import {
  IBook,
  IChapter,
  IPage,
  CreateBookRequest,
  UpdateBookRequest,
  CreateChapterRequest,
  UpdateChapterRequest,
  CreatePageRequest,
  UpdatePageRequest,
  BookResponse,
  ChapterResponse,
  PageResponse,
  BookStatistics,
  ContentSuggestion,
  GetBookOptions,
  ListBooksOptions
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

// Content generation options
export interface ContentGenerationOptions {
  contentType?: 'full_chapter' | 'opening' | 'continuation' | 'conclusion';
  wordCount?: number;
  prompt?: string;
  includeDialogue?: boolean;
  mood?: 'dramatic' | 'suspenseful' | 'romantic' | 'humorous' | 'melancholic' | 'inspiring' | 'mysterious' | 'action-packed';
}

export interface PageGenerationOptions {
  pageTitle: string;
  contentPrompt: string;
  wordCount?: number;
  continuePrevious?: boolean;
  pageNumber?: number;
}

export interface ContentImprovementOptions {
  contentType?: 'page' | 'chapter';
  improvementType?: 'grammar' | 'style' | 'flow' | 'clarity' | 'engagement' | 'comprehensive';
  preserveLength?: boolean;
  specificInstructions?: string;
}

// Export service interface
export interface IExportService {
  exportBook(bookId: string, format: string, options: ExportOptions): Promise<ExportResult>;
}

export interface ExportOptions {
  includeMetadata?: boolean;
  authorId: string;
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