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
  /** Optional spec-driven plan that governs narrative/world/style and image consistency */
  spec?: IBookSpec;
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
  spec?: Partial<IBookSpec>;
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
  chapterNumber?: number;
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
  wordCount?: number;
}

export interface GetBookOptions {
  includeChapters?: boolean | undefined;
  includePages?: boolean | undefined;
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

export interface PageResponse extends IPage { }

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
    targetAudience?: string | undefined;
  };
  chapterContext: {
    title: string;
    description?: string | undefined;
    outline?: string | undefined;
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

// Spec-driven plan: characters, world, palette, rules and image consistency
export interface IColorPalette {
  primary: string;
  secondary?: string;
  accents?: string[];
  mood?: string; // e.g., "warm, pastel", "noir, muted"
}

export interface ICharacterSpec {
  id: string; // stable handle used in prompts
  name: string;
  role: string; // e.g., protagonist, mentor
  description: string; // stable visual/narrative descriptors
  visualTraits?: string[]; // hair, clothing, colors
  narrativeTraits?: string[]; // personality, goals
}

export interface IWorldSpec {
  setting: string; // time/place
  rules: string[]; // magic/science/social rules
  themes: string[];
  toneGuide?: string; // reinforces writingStyle tone
}

export interface IImageStyleSpec {
  style: string; // e.g., "children's book illustration", "studio ghibli-inspired"
  camera?: string; // lens, framing
  rendering?: string; // flat shading, watercolor, line art
  negativeCues?: string[]; // what to avoid for consistency
}

export interface IBookSpec {
  colorPalette?: IColorPalette;
  characters?: ICharacterSpec[];
  world?: IWorldSpec;
  imageStyle?: IImageStyleSpec;
  narrativeRules?: string[]; // do/don't for plot progression and POV
  contextBracketFormat?: boolean; // when true, generate bracketed context sections
  planMarkdown?: string; // optional human-readable plan to guide chapters/pages
}