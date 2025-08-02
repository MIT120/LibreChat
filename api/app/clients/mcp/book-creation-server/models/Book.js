import mongoose from 'mongoose';

// Writing style sub-schema
const WritingStyleSchema = new mongoose.Schema(
  {
    tone: {
      type: String,
      enum: [
        'formal',
        'informal',
        'academic',
        'conversational',
        'humorous',
        'serious',
        'inspirational',
      ],
      required: true,
    },
    voice: {
      type: String,
      enum: ['first_person', 'second_person', 'third_person'],
      required: true,
    },
    perspective: {
      type: String,
      maxlength: 500,
      trim: true,
    },
    vocabulary: {
      type: String,
      enum: ['simple', 'intermediate', 'advanced', 'technical'],
      required: true,
    },
    sentenceStructure: {
      type: String,
      enum: ['simple', 'complex', 'varied'],
      required: true,
    },
    specialInstructions: {
      type: String,
      maxlength: 1000,
      trim: true,
    },
  },
  { _id: false },
);

// Publishing info sub-schema
const PublishingInfoSchema = new mongoose.Schema(
  {
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
  },
  { _id: false },
);

// Metadata sub-schema
const MetadataSchema = new mongoose.Schema(
  {
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
  },
  { _id: false },
);

// Settings sub-schema
const SettingsSchema = new mongoose.Schema(
  {
    autoSave: {
      type: Boolean,
      default: true,
    },
    backupFrequency: {
      type: String,
      enum: ['hourly', 'daily', 'weekly'],
      default: 'daily',
    },
    collaborationEnabled: {
      type: Boolean,
      default: false,
    },
    exportFormats: {
      type: [String],
      enum: ['pdf', 'epub', 'docx', 'html', 'txt'],
      default: ['pdf'],
    },
  },
  { _id: false },
);

// Book schema
const BookSchema = new mongoose.Schema(
  {
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
      enum: ['planning', 'outlining', 'writing', 'editing', 'review', 'completed', 'published'],
      default: 'planning',
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
      default: {},
    },
    settings: {
      type: SettingsSchema,
      default: {},
    },
  },
  { timestamps: true },
);

// Indexes for better performance
BookSchema.index({ authorId: 1, status: 1 });
BookSchema.index({ theme: 1, genre: 1 });
BookSchema.index({ 'metadata.tags': 1 });

export const Book = mongoose.model('Book', BookSchema);
