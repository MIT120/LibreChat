import mongoose from 'mongoose';

/**
 * Research Note Model
 * Represents research findings, notes, and sources for book writing
 */
const researchNoteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxLength: 200,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      trim: true,
      maxLength: 500,
    },
    sourceUrl: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || /^https?:\/\/.+/.test(v);
        },
        message: 'Invalid URL format',
      },
    },
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chapter',
      default: null, // Can be null for book-level research
    },
    authorId: {
      type: String,
      required: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        maxLength: 50,
      },
    ],
    category: {
      type: String,
      enum: [
        'fact',
        'quote',
        'statistic',
        'reference',
        'idea',
        'background',
        'expert_opinion',
        'historical_data',
        'technical_info',
        'other',
      ],
      default: 'other',
    },
    reliability: {
      type: String,
      enum: ['high', 'medium', 'low', 'unverified'],
      default: 'unverified',
    },
    dateAdded: {
      type: Date,
      default: Date.now,
    },
    dateAccessed: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      maxLength: 1000,
    },
    isFactChecked: {
      type: Boolean,
      default: false,
    },
    usedInChapters: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chapter',
      },
    ],
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium',
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient querying
researchNoteSchema.index({ bookId: 1, authorId: 1 });
researchNoteSchema.index({ chapterId: 1 });
researchNoteSchema.index({ tags: 1 });
researchNoteSchema.index({ category: 1 });
researchNoteSchema.index({ dateAdded: -1 });

// Virtual for word count
researchNoteSchema.virtual('wordCount').get(function () {
  if (!this.content) return 0;
  return this.content
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
});

// Static method to find research by book
researchNoteSchema.statics.findByBook = function (bookId, authorId, options = {}) {
  const query = { bookId, authorId };

  if (options.chapterId) {
    query.chapterId = options.chapterId;
  }

  if (options.category) {
    query.category = options.category;
  }

  if (options.tags && options.tags.length > 0) {
    query.tags = { $in: options.tags };
  }

  return this.find(query)
    .sort({ dateAdded: -1 })
    .limit(options.limit || 50)
    .skip(options.offset || 0);
};

// Instance method to mark as used in chapter
researchNoteSchema.methods.markUsedInChapter = function (chapterId) {
  if (!this.usedInChapters.includes(chapterId)) {
    this.usedInChapters.push(chapterId);
    return this.save();
  }
  return Promise.resolve(this);
};

export const ResearchNote = mongoose.model('ResearchNote', researchNoteSchema);
