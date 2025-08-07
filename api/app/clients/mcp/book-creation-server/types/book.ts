import { IEntity } from './index.js';

// Enums for better type safety
export enum BookStatus {
  PLANNING = 'planning',
  OUTLINING = 'outlining',
  WRITING = 'writing',
  EDITING = 'editing',
  REVIEW = 'review',
  COMPLETED = 'completed',
  PUBLISHED = 'published'
}

export enum ChapterStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  DRAFT = 'draft',
  REVIEW = 'review',
  APPROVED = 'approved',
  PUBLISHED = 'published'
}

export enum PageStatus {
  DRAFT = 'draft',
  REVIEW = 'review',
  APPROVED = 'approved',
  PUBLISHED = 'published'
}

export enum WritingTone {
  FORMAL = 'formal',
  INFORMAL = 'informal',
  ACADEMIC = 'academic',
  CONVERSATIONAL = 'conversational',
  HUMOROUS = 'humorous',
  SERIOUS = 'serious',
  INSPIRATIONAL = 'inspirational'
}

export enum WritingVoice {
  FIRST_PERSON = 'first_person',
  SECOND_PERSON = 'second_person',
  THIRD_PERSON = 'third_person'
}

export enum VocabularyLevel {
  SIMPLE = 'simple',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  TECHNICAL = 'technical'
}

export enum SentenceStructure {
  SIMPLE = 'simple',
  COMPLEX = 'complex',
  VARIED = 'varied'
}

export enum ExportFormat {
  PDF = 'pdf',
  EPUB = 'epub',
  DOCX = 'docx',
  HTML = 'html',
  TXT = 'txt'
}

export enum BackupFrequency {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly'
}

// Writing style interface
export interface IWritingStyle {
  tone: WritingTone;
  voice: WritingVoice;
  perspective?: string;
  vocabulary: VocabularyLevel;
  sentenceStructure: SentenceStructure;
  specialInstructions?: string;
}

// Publishing info interface
export interface IPublishingInfo {
  isbn?: string;
  publisher?: string;
  publicationDate?: Date;
  copyright?: string;
  edition?: string;
}

// Book metadata interface
export interface IBookMetadata {
  keywords: string[];
  language: string;
  category?: string;
  tags: string[];
}

// Book settings interface
export interface IBookSettings {
  autoSave: boolean;
  backupFrequency: BackupFrequency;
  collaborationEnabled: boolean;
  exportFormats: ExportFormat[];
}

// Core book interface
export interface IBook extends IEntity {
  title: string;
  subtitle?: string;
  theme: string;
  genre: string;
  targetAudience?: string;
  writingStyle: IWritingStyle;
  description?: string;
  targetWordCount?: number;
  currentWordCount: number;
  estimatedPages?: number;
  status: BookStatus;
  authorId: string;
  publishingInfo?: IPublishingInfo;
  metadata: IBookMetadata;
  settings: IBookSettings;
}

// Chapter interface
export interface IChapter extends IEntity {
  bookId: string;
  chapterNumber: number;
  title: string;
  description?: string;
  outline?: string;
  targetWordCount?: number;
  wordCount: number;
  status: ChapterStatus;
  notes?: string;
}

// Page interface
export interface IPage extends IEntity {
  pageId: string;
  chapterId: string;
  pageNumber: number;
  title: string;
  content: string;
  wordCount: number;
  notes?: string;
  status: PageStatus;
}

// Request/Response types
export interface CreateBookRequest {
  title: string;
  subtitle?: string;
  theme: string;
  genre: string;
  targetAudience?: string;
  writingStyle: IWritingStyle;
  description?: string;
  targetWordCount?: number;
  estimatedPages?: number;
  authorId: string;
}

export interface UpdateBookRequest {
  title?: string;
  subtitle?: string;
  theme?: string;
  genre?: string;
  targetAudience?: string;
  writingStyle?: Partial<IWritingStyle>;
  description?: string;
  targetWordCount?: number;
  estimatedPages?: number;
  status?: BookStatus;
}

export interface CreateChapterRequest {
  bookId: string;
  title: string;
  description?: string;
  outline?: string;
  targetWordCount?: number;
  chapterNumber?: number;
}

export interface UpdateChapterRequest {
  title?: string;
  description?: string;
  outline?: string;
  targetWordCount?: number;
  status?: ChapterStatus;
  notes?: string;
}

export interface CreatePageRequest {
  chapterId: string;
  title: string;
  content: string;
  notes?: string;
  pageNumber?: number;
}

export interface UpdatePageRequest {
  title?: string;
  content?: string;
  notes?: string;
  status?: PageStatus;
}

export interface GetBookOptions {
  includeChapters?: boolean;
  includePages?: boolean;
}

export interface ListBooksOptions {
  authorId: string;
  status?: BookStatus;
  genre?: string;
  limit?: number;
  offset?: number;
}

// Response types
export interface BookResponse extends IBook {
  chapters?: ChapterResponse[];
}

export interface ChapterResponse extends IChapter {
  pages?: PageResponse[];
}

export interface PageResponse extends IPage {}

export interface BookStatistics {
  bookInfo: {
    id: string;
    title: string;
    status: BookStatus;
    theme: string;
    genre: string;
  };
  progress: {
    completionPercentage: number;
    currentWordCount: number;
    targetWordCount: number;
    wordsRemaining: number;
  };
  chapters: {
    total: number;
    completed: number;
    statusBreakdown: Record<ChapterStatus, number>;
  };
  pages: {
    total: number;
    completed: number;
    statusBreakdown: Record<PageStatus, number>;
  };
  lastUpdated: Date;
}

export interface ContentSuggestion {
  bookContext: {
    title: string;
    theme: string;
    genre: string;
    writingStyle: IWritingStyle;
    targetAudience?: string;
  };
  chapterContext: {
    title: string;
    description?: string;
    outline?: string;
    chapterNumber: number;
  };
  existingContent: Array<{
    pageNumber: number;
    title: string;
    wordCount: number;
  }>;
  suggestions: {
    nextPageTitle: string;
    recommendedWordCount: number;
    writingPrompt: string;
  };
}