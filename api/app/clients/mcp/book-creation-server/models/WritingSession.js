import mongoose from 'mongoose';

/**
 * Writing Session Model
 * Tracks individual writing sessions with word counts, time spent, and progress metrics
 */
const writingSessionSchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chapter',
      default: null, // Can be null for general book writing
    },
    authorId: {
      type: String,
      required: true,
    },
    sessionDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    duration: {
      type: Number, // Duration in minutes
      default: 0,
    },
    wordsWritten: {
      type: Number,
      required: true,
      default: 0,
    },
    wordsBefore: {
      type: Number,
      default: 0,
    },
    wordsAfter: {
      type: Number,
      default: 0,
    },
    netWordCount: {
      type: Number,
      default: 0, // wordsAfter - wordsBefore
    },
    wordsPerMinute: {
      type: Number,
      default: 0,
    },
    sessionType: {
      type: String,
      enum: [
        'writing',
        'editing',
        'revision',
        'outlining',
        'research',
        'planning',
        'brainstorming',
        'other',
      ],
      default: 'writing',
    },
    mood: {
      type: String,
      enum: ['excellent', 'good', 'okay', 'difficult', 'frustrated'],
      default: 'okay',
    },
    productivity: {
      type: String,
      enum: ['very_high', 'high', 'medium', 'low', 'very_low'],
      default: 'medium',
    },
    goals: {
      wordGoal: {
        type: Number,
        default: 0,
      },
      timeGoal: {
        type: Number, // in minutes
        default: 0,
      },
      achieved: {
        type: Boolean,
        default: false,
      },
    },
    notes: {
      type: String,
      trim: true,
      maxLength: 1000,
    },
    challenges: [
      {
        type: String,
        trim: true,
        maxLength: 200,
      },
    ],
    accomplishments: [
      {
        type: String,
        trim: true,
        maxLength: 200,
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
        maxLength: 50,
      },
    ],
    location: {
      type: String,
      trim: true,
      maxLength: 100,
    },
    device: {
      type: String,
      trim: true,
      maxLength: 100,
    },
    interruptions: {
      type: Number,
      default: 0,
    },
    flowState: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient querying
writingSessionSchema.index({ bookId: 1, authorId: 1 });
writingSessionSchema.index({ sessionDate: -1 });
writingSessionSchema.index({ authorId: 1, sessionDate: -1 });
writingSessionSchema.index({ chapterId: 1 });

// Virtual for session efficiency
writingSessionSchema.virtual('efficiency').get(function () {
  if (this.duration === 0) return 0;
  return Math.round((this.wordsWritten / this.duration) * 100) / 100;
});

// Virtual for goal achievement percentage
writingSessionSchema.virtual('goalAchievement').get(function () {
  if (this.goals.wordGoal === 0 && this.goals.timeGoal === 0) return 100;

  let wordAchievement = 0;
  let timeAchievement = 0;

  if (this.goals.wordGoal > 0) {
    wordAchievement = Math.min((this.wordsWritten / this.goals.wordGoal) * 100, 100);
  }

  if (this.goals.timeGoal > 0) {
    timeAchievement = Math.min((this.duration / this.goals.timeGoal) * 100, 100);
  }

  if (this.goals.wordGoal > 0 && this.goals.timeGoal > 0) {
    return Math.round((wordAchievement + timeAchievement) / 2);
  } else if (this.goals.wordGoal > 0) {
    return Math.round(wordAchievement);
  } else {
    return Math.round(timeAchievement);
  }
});

// Pre-save middleware to calculate derived fields
writingSessionSchema.pre('save', function (next) {
  // Calculate duration if endTime is set
  if (this.endTime && this.startTime) {
    this.duration = Math.round((this.endTime - this.startTime) / (1000 * 60)); // Convert to minutes
  }

  // Calculate net word count
  if (this.wordsAfter && this.wordsBefore) {
    this.netWordCount = this.wordsAfter - this.wordsBefore;
  }

  // Calculate words per minute
  if (this.duration > 0) {
    this.wordsPerMinute = Math.round((this.wordsWritten / this.duration) * 100) / 100;
  }

  // Check if goals were achieved
  if (this.goals.wordGoal > 0 || this.goals.timeGoal > 0) {
    const wordGoalMet = this.goals.wordGoal === 0 || this.wordsWritten >= this.goals.wordGoal;
    const timeGoalMet = this.goals.timeGoal === 0 || this.duration >= this.goals.timeGoal;
    this.goals.achieved = wordGoalMet && timeGoalMet;
  }

  next();
});

// Static method to get sessions by date range
writingSessionSchema.statics.findByDateRange = function (
  authorId,
  startDate,
  endDate,
  options = {},
) {
  const query = {
    authorId,
    sessionDate: {
      $gte: startDate,
      $lte: endDate,
    },
  };

  if (options.bookId) {
    query.bookId = options.bookId;
  }

  if (options.chapterId) {
    query.chapterId = options.chapterId;
  }

  if (options.sessionType) {
    query.sessionType = options.sessionType;
  }

  return this.find(query)
    .sort({ sessionDate: -1 })
    .limit(options.limit || 100)
    .populate('bookId', 'title')
    .populate('chapterId', 'title chapterNumber');
};

// Static method to get daily statistics
writingSessionSchema.statics.getDailyStats = function (authorId, date, bookId = null) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const matchQuery = {
    authorId,
    sessionDate: {
      $gte: startOfDay,
      $lte: endOfDay,
    },
  };

  if (bookId) {
    matchQuery.bookId = bookId;
  }

  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalWords: { $sum: '$wordsWritten' },
        totalTime: { $sum: '$duration' },
        sessionCount: { $sum: 1 },
        avgWordsPerMinute: { $avg: '$wordsPerMinute' },
        goalsAchieved: {
          $sum: { $cond: ['$goals.achieved', 1, 0] },
        },
        sessionTypes: { $push: '$sessionType' },
        moods: { $push: '$mood' },
      },
    },
  ]);
};

// Instance method to end session
writingSessionSchema.methods.endSession = function (wordsAfter, endTime = new Date()) {
  this.endTime = endTime;
  this.wordsAfter = wordsAfter;
  return this.save();
};

export const WritingSession = mongoose.model('WritingSession', writingSessionSchema);
