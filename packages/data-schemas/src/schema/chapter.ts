import { Schema } from 'mongoose';
import { IChapter } from '~/types';

const chapterSchema: Schema<IChapter> = new Schema(
  {
    chapterId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    bookId: {
      type: String,
      required: true,
      index: true,
    },
    user: {
      type: String,
      required: true,
      index: true,
    },
    chapterNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
      maxlength: 50000, // ~25,000 words max
    },
    summary: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    feedback: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    wordCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    generationContext: {
      previousSummaries: [
        {
          type: String,
          maxlength: 2000,
        },
      ],
      styleInstructions: {
        type: String,
        trim: true,
        maxlength: 1000,
      },
      specificRequirements: {
        type: String,
        trim: true,
        maxlength: 1000,
      },
    },
    approvedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for efficient queries
chapterSchema.index({ bookId: 1, chapterNumber: 1 }, { unique: true });
chapterSchema.index({ user: 1, status: 1 });
chapterSchema.index({ bookId: 1, status: 1 });
chapterSchema.index({ chapterId: 1, user: 1 }, { unique: true });

// Virtual for estimated reading time (assuming 200 words per minute)
chapterSchema.virtual('estimatedReadingTime').get(function () {
  return Math.ceil(this.wordCount / 200);
});

// Pre-save middleware to calculate word count
chapterSchema.pre('save', function (next) {
  if (this.isModified('content')) {
    // Simple word count calculation
    this.wordCount = this.content
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  // Set approval/rejection timestamps
  if (this.isModified('status')) {
    if (this.status === 'approved' && !this.approvedAt) {
      this.approvedAt = new Date();
      this.rejectedAt = undefined;
    } else if (this.status === 'rejected' && !this.rejectedAt) {
      this.rejectedAt = new Date();
      this.approvedAt = undefined;
    } else if (this.status === 'pending') {
      this.approvedAt = undefined;
      this.rejectedAt = undefined;
    }
  }

  next();
});

export default chapterSchema;
