import { Schema } from 'mongoose';
import { IBook } from '~/types';

const bookSchema: Schema<IBook> = new Schema(
  {
    bookId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    user: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    theme: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    genre: {
      type: String,
      required: true,
      enum: ['fiction', 'non-fiction', 'technical', 'educational'],
    },
    status: {
      type: String,
      enum: ['outline_pending', 'in_progress', 'completed', 'cancelled'],
      default: 'outline_pending',
      index: true,
    },
    outline: {
      chapters: [
        {
          title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
          },
          description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000,
          },
        },
      ],
      approvedAt: {
        type: Date,
      },
    },
    config: {
      chapterCount: {
        type: Number,
        default: 10,
        min: 3,
        max: 50,
      },
      writingStyle: {
        type: String,
        enum: ['formal', 'casual', 'academic', 'creative'],
        default: 'casual',
      },
      targetAudience: {
        type: String,
        trim: true,
        maxlength: 200,
      },
      formatting: {
        font: {
          type: String,
          default: 'Arial',
          trim: true,
        },
        fontSize: {
          type: Number,
          default: 12,
          min: 8,
          max: 24,
        },
        lineSpacing: {
          type: Number,
          default: 1.5,
          enum: [1, 1.15, 1.5, 2],
        },
      },
    },
    progress: {
      currentChapter: {
        type: Number,
        default: 0,
        min: 0,
      },
      completedChapters: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalChapters: {
        type: Number,
        required: true,
        min: 3,
        max: 50,
      },
    },
    metadata: {
      wordCount: {
        type: Number,
        default: 0,
        min: 0,
      },
      estimatedReadingTime: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for efficient queries
bookSchema.index({ user: 1, status: 1 });
bookSchema.index({ user: 1, createdAt: -1 });
bookSchema.index({ bookId: 1, user: 1 }, { unique: true });

// Virtual for completion percentage
bookSchema.virtual('completionPercentage').get(function () {
  if (this.progress.totalChapters === 0) return 0;
  return Math.round((this.progress.completedChapters / this.progress.totalChapters) * 100);
});

// Pre-save middleware to validate progress consistency
bookSchema.pre('save', function (next) {
  // Ensure currentChapter doesn't exceed totalChapters
  if (this.progress.currentChapter > this.progress.totalChapters) {
    this.progress.currentChapter = this.progress.totalChapters;
  }

  // Ensure completedChapters doesn't exceed totalChapters
  if (this.progress.completedChapters > this.progress.totalChapters) {
    this.progress.completedChapters = this.progress.totalChapters;
  }

  // Update status based on progress
  if (
    this.progress.completedChapters === this.progress.totalChapters &&
    this.status === 'in_progress'
  ) {
    this.status = 'completed';
  }

  next();
});

export default bookSchema;
