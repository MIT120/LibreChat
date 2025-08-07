import mongoose, { Schema, Document } from 'mongoose';
import {
  IBook,
  IWritingStyle,
  IPublishingInfo,
  IBookMetadata,
  IBookSettings,
  BookStatus,
  WritingTone,
  WritingVoice,
  VocabularyLevel,
  SentenceStructure,
  ExportFormat,
  BackupFrequency
} from '../types/book.js';

// Document interfaces for Mongoose
export interface IBookDocument extends IBook, Document {}

// Writing style sub-schema
const WritingStyleSchema = new Schema<IWritingStyle>({
  tone: {
    type: String,
    enum: Object.values(WritingTone),
    required: true,
  },
  voice: {
    type: String,
    enum: Object.values(WritingVoice),
    required: true,
  },
  perspective: {
    type: String,
    maxlength: 500,
    trim: true,
  },
  vocabulary: {
    type: String,
    enum: Object.values(VocabularyLevel),
    required: true,
  },
  sentenceStructure: {
    type: String,
    enum: Object.values(SentenceStructure),
    required: true,
  },
  specialInstructions: {
    type: String,
    maxlength: 1000,
    trim: true,
  },
}, { _id: false });

// Publishing info sub-schema
const PublishingInfoSchema = new Schema<IPublishingInfo>({
  isbn: {
    type: String,
    trim: true,
  },
  publisher: {
    type: String,
    trim: true,
  },
  publicationDate: {
    type: Date,
  },
  copyright: {
    type: String,
    trim: true,
  },
  edition: {
    type: String,
    trim: true,
  },
}, { _id: false });

// Metadata sub-schema
const MetadataSchema = new Schema<IBookMetadata>({
  keywords: {
    type: [String],
    default: [],
  },
  language: {
    type: String,
    default: 'en',
  },
  category: {
    type: String,
    trim: true,
  },
  tags: {
    type: [String],
    default: [],
  },
}, { _id: false });

// Settings sub-schema
const SettingsSchema = new Schema<IBookSettings>({
  autoSave: {
    type: Boolean,
    default: true,
  },
  backupFrequency: {
    type: String,
    enum: Object.values(BackupFrequency),
    default: BackupFrequency.DAILY,
  },
  collaborationEnabled: {
    type: Boolean,
    default: false,
  },
  exportFormats: {
    type: [String],
    enum: Object.values(ExportFormat),
    default: [ExportFormat.PDF],
  },
}, { _id: false });

// Book schema
const BookSchema = new Schema<IBookDocument>({
  _id: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
    maxlength: 300,
    trim: true,
  },
  subtitle: {
    type: String,
    maxlength: 500,
    trim: true,
  },
  theme: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true,
  },
  genre: {
    type: String,
    required: true,
    maxlength: 100,
    trim: true,
  },
  targetAudience: {
    type: String,
    maxlength: 500,
    trim: true,
  },
  writingStyle: {
    type: WritingStyleSchema,
    required: true,
  },
  description: {
    type: String,
    maxlength: 2000,
    trim: true,
  },
  targetWordCount: {
    type: Number,
    min: 0,
  },
  currentWordCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  estimatedPages: {
    type: Number,
    min: 0,
  },
  status: {
    type: String,
    enum: Object.values(BookStatus),
    default: BookStatus.PLANNING,
  },
  authorId: {
    type: String,
    required: true,
    ref: 'User',
  },
  publishingInfo: {
    type: PublishingInfoSchema,
  },
  metadata: {
    type: MetadataSchema,
    default: () => ({
      keywords: [],
      language: 'en',
      tags: [],
    }),
  },
  settings: {
    type: SettingsSchema,
    default: () => ({
      autoSave: true,
      backupFrequency: BackupFrequency.DAILY,
      collaborationEnabled: false,
      exportFormats: [ExportFormat.PDF],
    }),
  },
}, { 
  timestamps: true,
  collection: 'books'
});

// Indexes for better performance
BookSchema.index({ authorId: 1, status: 1 });
BookSchema.index({ theme: 1, genre: 1 });
BookSchema.index({ 'metadata.tags': 1 });

// Export the model
export const Book = mongoose.model<IBookDocument>('Book', BookSchema);