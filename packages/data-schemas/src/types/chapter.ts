import { z } from 'zod';

// Page schema
export const PageSchema = z.object({
  id: z.string().optional(),
  chapterId: z.string(),
  pageNumber: z.number().min(1),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  wordCount: z.number().min(0),
  notes: z.string().optional(),
  status: z.enum(['draft', 'review', 'approved', 'published']).default('draft'),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Chapter schema
export const ChapterSchema = z.object({
  id: z.string().optional(),
  bookId: z.string(),
  chapterNumber: z.number().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  outline: z.string().optional(),
  wordCount: z.number().min(0).default(0),
  targetWordCount: z.number().min(0).optional(),
  status: z
    .enum(['planned', 'in_progress', 'draft', 'review', 'approved', 'published'])
    .default('planned'),
  pages: z.array(PageSchema).optional(),
  notes: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Book schema
export const BookSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(300),
  subtitle: z.string().max(500).optional(),
  theme: z.string().min(1).max(200),
  genre: z.string().min(1).max(100),
  targetAudience: z.string().max(500).optional(),
  writingStyle: z.object({
    tone: z.enum([
      'formal',
      'informal',
      'academic',
      'conversational',
      'humorous',
      'serious',
      'inspirational',
    ]),
    voice: z.enum(['first_person', 'second_person', 'third_person']),
    perspective: z.string().max(500).optional(),
    vocabulary: z.enum(['simple', 'intermediate', 'advanced', 'technical']),
    sentenceStructure: z.enum(['simple', 'complex', 'varied']),
    specialInstructions: z.string().max(1000).optional(),
  }),
  description: z.string().max(2000).optional(),
  targetWordCount: z.number().min(0).optional(),
  currentWordCount: z.number().min(0).default(0),
  estimatedPages: z.number().min(0).optional(),
  chapters: z.array(ChapterSchema).optional(),
  status: z
    .enum(['planning', 'outlining', 'writing', 'editing', 'review', 'completed', 'published'])
    .default('planning'),
  authorId: z.string(),
  publishingInfo: z
    .object({
      isbn: z.string().optional(),
      publisher: z.string().optional(),
      publicationDate: z.date().optional(),
      copyright: z.string().optional(),
      edition: z.string().optional(),
    })
    .optional(),
  metadata: z
    .object({
      keywords: z.array(z.string()).optional(),
      language: z.string().default('en'),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
  settings: z
    .object({
      autoSave: z.boolean().default(true),
      backupFrequency: z.enum(['hourly', 'daily', 'weekly']).default('daily'),
      collaborationEnabled: z.boolean().default(false),
      exportFormats: z.array(z.enum(['pdf', 'epub', 'docx', 'html', 'txt'])).default(['pdf']),
    })
    .optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Type exports
export type Page = z.infer<typeof PageSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
export type Book = z.infer<typeof BookSchema>;

// Create book request schema
export const CreateBookRequestSchema = z.object({
  title: z.string().min(1).max(300),
  subtitle: z.string().max(500).optional(),
  theme: z.string().min(1).max(200),
  genre: z.string().min(1).max(100),
  targetAudience: z.string().max(500).optional(),
  writingStyle: z.object({
    tone: z.enum([
      'formal',
      'informal',
      'academic',
      'conversational',
      'humorous',
      'serious',
      'inspirational',
    ]),
    voice: z.enum(['first_person', 'second_person', 'third_person']),
    perspective: z.string().max(500).optional(),
    vocabulary: z.enum(['simple', 'intermediate', 'advanced', 'technical']),
    sentenceStructure: z.enum(['simple', 'complex', 'varied']),
    specialInstructions: z.string().max(1000).optional(),
  }),
  description: z.string().max(2000).optional(),
  targetWordCount: z.number().min(0).optional(),
  estimatedPages: z.number().min(0).optional(),
  authorId: z.string(),
});

export type CreateBookRequest = z.infer<typeof CreateBookRequestSchema>;

// MongoDB interfaces for Mongoose
export interface IPage {
  _id?: string;
  pageId: string;
  chapterId: string;
  pageNumber: number;
  title: string;
  content: string;
  wordCount: number;
  notes?: string;
  status: 'draft' | 'review' | 'approved' | 'published';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IChapter {
  _id?: string;
  bookId: string;
  chapterNumber: number;
  title: string;
  description?: string;
  outline?: string;
  wordCount: number;
  targetWordCount?: number;
  status: 'planned' | 'in_progress' | 'draft' | 'review' | 'approved' | 'published';
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IBook {
  _id?: string;
  title: string;
  subtitle?: string;
  theme: string;
  genre: string;
  targetAudience?: string;
  writingStyle: {
    tone:
      | 'formal'
      | 'informal'
      | 'academic'
      | 'conversational'
      | 'humorous'
      | 'serious'
      | 'inspirational';
    voice: 'first_person' | 'second_person' | 'third_person';
    perspective?: string;
    vocabulary: 'simple' | 'intermediate' | 'advanced' | 'technical';
    sentenceStructure: 'simple' | 'complex' | 'varied';
    specialInstructions?: string;
  };
  description?: string;
  targetWordCount?: number;
  currentWordCount: number;
  estimatedPages?: number;
  status: 'planning' | 'outlining' | 'writing' | 'editing' | 'review' | 'completed' | 'published';
  authorId: string;
  publishingInfo?: {
    isbn?: string;
    publisher?: string;
    publicationDate?: Date;
    copyright?: string;
    edition?: string;
  };
  metadata?: {
    keywords?: string[];
    language: string;
    category?: string;
    tags?: string[];
  };
  settings?: {
    autoSave: boolean;
    backupFrequency: 'hourly' | 'daily' | 'weekly';
    collaborationEnabled: boolean;
    exportFormats: ('pdf' | 'epub' | 'docx' | 'html' | 'txt')[];
  };
  createdAt?: Date;
  updatedAt?: Date;
}
