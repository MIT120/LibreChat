import type { Document } from 'mongoose';

export interface IBookOutlineChapter {
  title: string;
  description: string;
}

export interface IBookOutline {
  chapters: IBookOutlineChapter[];
  approvedAt?: Date;
}

export interface IBookConfig {
  chapterCount: number;
  writingStyle: 'formal' | 'casual' | 'academic' | 'creative';
  targetAudience?: string;
  formatting: {
    font: string;
    fontSize: number;
    lineSpacing: number;
  };
}

export interface IBookProgress {
  currentChapter: number;
  completedChapters: number;
  totalChapters: number;
}

export interface IBookMetadata {
  wordCount: number;
  estimatedReadingTime: number;
}

export interface IBook extends Document {
  bookId: string;
  user: string;
  title: string;
  theme: string;
  genre: 'fiction' | 'non-fiction' | 'technical' | 'educational';
  status: 'outline_pending' | 'in_progress' | 'completed' | 'cancelled';
  outline: IBookOutline;
  config: IBookConfig;
  progress: IBookProgress;
  metadata: IBookMetadata;
  createdAt: Date;
  updatedAt: Date;
  // Virtual properties
  completionPercentage: number;
}
