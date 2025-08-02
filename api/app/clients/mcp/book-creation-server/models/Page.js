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
  },
  { timestamps: true },
);

// Indexes for better performance
PageSchema.index({ chapterId: 1, pageNumber: 1 });
PageSchema.index({ status: 1 });

export const Page = mongoose.model('Page', PageSchema);
