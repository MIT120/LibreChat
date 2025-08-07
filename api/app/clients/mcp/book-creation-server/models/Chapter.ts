import mongoose, { Schema, Document } from 'mongoose';
import { IChapter, ChapterStatus } from '../types/book.js';

// Document interface for Mongoose
export interface IChapterDocument extends IChapter, Document {}

// Chapter schema
const ChapterSchema = new Schema<IChapterDocument>({
  _id: {
    type: String,
    required: true,
  },
  bookId: {
    type: String,
    required: true,
    ref: 'Book',
  },
  chapterNumber: {
    type: Number,
    required: true,
    min: 1,
  },
  title: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true,
  },
  description: {
    type: String,
    maxlength: 1000,
    trim: true,
  },
  outline: {
    type: String,
    trim: true,
  },
  wordCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  targetWordCount: {
    type: Number,
    min: 0,
  },
  status: {
    type: String,
    enum: Object.values(ChapterStatus),
    default: ChapterStatus.PLANNED,
  },
  notes: {
    type: String,
    trim: true,
  },
}, { 
  timestamps: true,
  collection: 'chapters'
});

// Indexes for better performance
ChapterSchema.index({ bookId: 1, chapterNumber: 1 });
ChapterSchema.index({ status: 1 });

// Export the model
export const Chapter = mongoose.model<IChapterDocument>('Chapter', ChapterSchema);