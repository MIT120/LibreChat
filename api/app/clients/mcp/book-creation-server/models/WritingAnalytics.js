import mongoose from 'mongoose';

/**
 * Writing Analytics Model
 * Stores comprehensive writing style analysis and metrics
 */
const writingAnalyticsSchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    authorId: {
      type: String,
      required: true,
    },
    analysisDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    contentAnalyzed: {
      totalWordCount: {
        type: Number,
        default: 0,
      },
      chapterCount: {
        type: Number,
        default: 0,
      },
      pageCount: {
        type: Number,
        default: 0,
      },
      lastAnalyzedChapter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chapter',
      },
    },
    styleMetrics: {
      averageWordsPerSentence: {
        type: Number,
        default: 0,
      },
      averageSentencesPerParagraph: {
        type: Number,
        default: 0,
      },
      averageWordsPerParagraph: {
        type: Number,
        default: 0,
      },
      averageChapterLength: {
        type: Number,
        default: 0,
      },
      vocabularyDiversity: {
        type: Number, // Unique words / Total words ratio
        default: 0,
      },
      readabilityScore: {
        fleschKincaid: Number,
        fleschReading: Number,
        colemanLiau: Number,
        automatedReadability: Number,
        gunningFog: Number,
        smog: Number,
        averageGradeLevel: Number,
      },
    },
    vocabularyAnalysis: {
      totalUniqueWords: {
        type: Number,
        default: 0,
      },
      mostFrequentWords: [
        {
          word: String,
          count: Number,
          frequency: Number, // percentage
        },
      ],
      complexWordsCount: {
        type: Number,
        default: 0,
      },
      averageWordLength: {
        type: Number,
        default: 0,
      },
      syllableDistribution: {
        oneToTwo: Number,
        three: Number,
        fourToFive: Number,
        sixPlus: Number,
      },
    },
    sentenceAnalysis: {
      totalSentences: {
        type: Number,
        default: 0,
      },
      sentenceTypes: {
        declarative: Number,
        interrogative: Number,
        imperative: Number,
        exclamatory: Number,
      },
      sentenceLengthDistribution: {
        short: Number, // 1-10 words
        medium: Number, // 11-20 words
        long: Number, // 21-30 words
        veryLong: Number, // 30+ words
      },
      complexityScore: {
        type: Number,
        default: 0,
      },
    },
    dialogueAnalysis: {
      dialoguePercentage: {
        type: Number,
        default: 0,
      },
      averageDialogueLength: {
        type: Number,
        default: 0,
      },
      speechPatternVariation: {
        type: Number,
        default: 0,
      },
      dialogueTags: {
        said: Number,
        asked: Number,
        other: Number,
      },
    },
    paceAndRhythm: {
      sentenceVariation: {
        type: Number, // Coefficient of variation
        default: 0,
      },
      paragraphVariation: {
        type: Number,
        default: 0,
      },
      chapterVariation: {
        type: Number,
        default: 0,
      },
      rhythmScore: {
        type: Number, // Overall rhythm rating
        default: 0,
      },
    },
    genreSpecific: {
      actionSequences: {
        percentage: Number,
        averageLength: Number,
        intensity: Number,
      },
      descriptivePassages: {
        percentage: Number,
        averageLength: Number,
        detail: Number,
      },
      characterInteraction: {
        percentage: Number,
        emotionalRange: Number,
      },
      worldBuilding: {
        percentage: Number,
        complexity: Number,
      },
    },
    consistencyMetrics: {
      styleConsistency: {
        type: Number, // 0-100 score
        default: 0,
      },
      toneConsistency: {
        type: Number,
        default: 0,
      },
      characterVoiceConsistency: {
        type: Number,
        default: 0,
      },
      pacingConsistency: {
        type: Number,
        default: 0,
      },
    },
    improvements: [
      {
        category: {
          type: String,
          enum: [
            'sentence_variety',
            'vocabulary',
            'readability',
            'dialogue',
            'pacing',
            'consistency',
            'structure',
            'style',
          ],
        },
        issue: String,
        suggestion: String,
        priority: {
          type: String,
          enum: ['high', 'medium', 'low'],
          default: 'medium',
        },
        examples: [String],
      },
    ],
    overallScore: {
      styleScore: {
        type: Number, // 0-100
        default: 0,
      },
      readabilityScore: {
        type: Number,
        default: 0,
      },
      consistencyScore: {
        type: Number,
        default: 0,
      },
      overallRating: {
        type: Number,
        default: 0,
      },
      gradeLevel: String, // e.g., "High School", "College", etc.
    },
    comparisonData: {
      previousAnalysis: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WritingAnalytics',
      },
      improvementAreas: [String],
      progressNotes: String,
    },
    tags: [
      {
        type: String,
        trim: true,
        maxLength: 50,
      },
    ],
    notes: {
      type: String,
      trim: true,
      maxLength: 2000,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient querying
writingAnalyticsSchema.index({ bookId: 1, authorId: 1 });
writingAnalyticsSchema.index({ analysisDate: -1 });
writingAnalyticsSchema.index({ authorId: 1, analysisDate: -1 });

// Virtual for improvement summary
writingAnalyticsSchema.virtual('improvementSummary').get(function () {
  const highPriority = this.improvements.filter((imp) => imp.priority === 'high').length;
  const mediumPriority = this.improvements.filter((imp) => imp.priority === 'medium').length;
  const lowPriority = this.improvements.filter((imp) => imp.priority === 'low').length;

  return {
    total: this.improvements.length,
    highPriority,
    mediumPriority,
    lowPriority,
  };
});

// Virtual for readability summary
writingAnalyticsSchema.virtual('readabilitySummary').get(function () {
  if (!this.styleMetrics.readabilityScore) return 'Not analyzed';

  const avg = this.styleMetrics.readabilityScore.averageGradeLevel;
  if (avg <= 6) return 'Elementary';
  if (avg <= 8) return 'Middle School';
  if (avg <= 12) return 'High School';
  if (avg <= 16) return 'College';
  return 'Graduate';
});

// Static method to find latest analysis
writingAnalyticsSchema.statics.findLatest = function (bookId, authorId) {
  return this.findOne({ bookId, authorId })
    .sort({ analysisDate: -1 })
    .populate('comparisonData.previousAnalysis');
};

// Static method to get analysis history
writingAnalyticsSchema.statics.getHistory = function (bookId, authorId, limit = 10) {
  return this.find({ bookId, authorId })
    .sort({ analysisDate: -1 })
    .limit(limit)
    .select('analysisDate overallScore styleMetrics.readabilityScore');
};

// Instance method to calculate improvement from previous analysis
writingAnalyticsSchema.methods.calculateImprovement = function (previousAnalysis) {
  if (!previousAnalysis) return null;

  return {
    styleImprovement:
      this.overallScore.styleScore - (previousAnalysis.overallScore?.styleScore || 0),
    readabilityImprovement:
      this.overallScore.readabilityScore - (previousAnalysis.overallScore?.readabilityScore || 0),
    consistencyImprovement:
      this.overallScore.consistencyScore - (previousAnalysis.overallScore?.consistencyScore || 0),
    overallImprovement:
      this.overallScore.overallRating - (previousAnalysis.overallScore?.overallRating || 0),
    wordCountGrowth:
      this.contentAnalyzed.totalWordCount - (previousAnalysis.contentAnalyzed?.totalWordCount || 0),
    vocabularyGrowth:
      this.vocabularyAnalysis.totalUniqueWords -
      (previousAnalysis.vocabularyAnalysis?.totalUniqueWords || 0),
  };
};

// Instance method to add improvement suggestion
writingAnalyticsSchema.methods.addImprovement = function (
  category,
  issue,
  suggestion,
  priority = 'medium',
  examples = [],
) {
  this.improvements.push({
    category,
    issue,
    suggestion,
    priority,
    examples,
  });
  return this.save();
};

export const WritingAnalytics = mongoose.model('WritingAnalytics', writingAnalyticsSchema);
