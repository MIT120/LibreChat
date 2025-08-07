import mongoose from 'mongoose';

// Page schema
const PageSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    pageId: {
      type: String,
      required: true,
      unique: true,
    },
    chapterId: {
      type: String,
      required: true,
      ref: 'Chapter',
    },
    pageNumber: {
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
    content: {
      type: String,
      required: true,
    },
    wordCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['draft', 'review', 'approved', 'published'],
      default: 'draft',
    },
    images: [
      {
        id: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        localPath: {
          type: String,
          required: true,
        },
        placement: {
          position: {
            type: String,
            enum: ['before', 'after', 'between'],
            default: 'between',
          },
          reason: String,
          confidence: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.8,
          },
        },
        prompt: String,
        style: String,
        contextAnalysis: {
          themes: [String],
          characters: [String],
          setting: String,
          mood: String,
          actionLevel: String,
          storyBeat: String,
        },
        generatedAt: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ['generating', 'generated', 'failed', 'approved'],
          default: 'generated',
        },
      },
    ],
  },
  { timestamps: true },
);

// Indexes for better performance
PageSchema.index({ chapterId: 1, pageNumber: 1 });
PageSchema.index({ status: 1 });

export const Page = mongoose.model('Page', PageSchema);
