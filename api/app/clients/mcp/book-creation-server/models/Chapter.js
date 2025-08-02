import mongoose from 'mongoose';

// Chapter schema
const ChapterSchema = new mongoose.Schema(
  {
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
      enum: ['planned', 'in_progress', 'draft', 'review', 'approved', 'published'],
      default: 'planned',
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

// Indexes for better performance
ChapterSchema.index({ bookId: 1, chapterNumber: 1 });
ChapterSchema.index({ status: 1 });

export const Chapter = mongoose.model('Chapter', ChapterSchema);
