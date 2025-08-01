import type { Document } from 'mongoose';

export interface IChapterGenerationContext {
  previousSummaries: string[];
  styleInstructions?: string;
  specificRequirements?: string;
}

export interface IChapter extends Document {
  chapterId: string;
  bookId: string;
  user: string;
  chapterNumber: number;
  title: string;
  content: string;
  summary?: string;
  status: 'pending' | 'approved' | 'rejected';
  feedback?: string;
  wordCount: number;
  generationContext: IChapterGenerationContext;
  approvedAt?: Date;
  rejectedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Virtual properties
  estimatedReadingTime: number;
}
