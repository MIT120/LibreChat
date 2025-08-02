import mongoose from 'mongoose';

/**
 * Plot Thread Model
 * Represents story threads, subplots, and narrative arcs
 */
const plotThreadSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxLength: 200,
    },
    type: {
      type: String,
      enum: [
        'main_plot',
        'subplot',
        'character_arc',
        'romance',
        'mystery',
        'conflict',
        'theme',
        'backstory',
        'world_building',
        'other',
      ],
      required: true,
    },
    importance: {
      type: String,
      enum: ['primary', 'secondary', 'tertiary'],
      default: 'secondary',
    },
    status: {
      type: String,
      enum: ['planned', 'active', 'resolved', 'abandoned'],
      default: 'planned',
    },
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    authorId: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxLength: 2000,
    },
    premise: {
      type: String,
      trim: true,
      maxLength: 1000,
    },
    goal: {
      type: String,
      trim: true,
      maxLength: 1000,
    },
    conflict: {
      type: String,
      trim: true,
      maxLength: 1000,
    },
    resolution: {
      type: String,
      trim: true,
      maxLength: 1000,
    },
    charactersInvolved: [
      {
        characterId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Character',
        },
        characterName: String,
        role: {
          type: String,
          enum: [
            'protagonist',
            'antagonist',
            'catalyst',
            'victim',
            'helper',
            'observer',
            'obstacle',
            'other',
          ],
        },
        involvement: String, // Description of their involvement
      },
    ],
    locationsInvolved: [
      {
        locationId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Location',
        },
        locationName: String,
        significance: String, // Why this location is important to the plot
      },
    ],
    timeline: [
      {
        chapterId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Chapter',
        },
        chapterTitle: String,
        chapterNumber: Number,
        event: String,
        development: String,
        significance: String,
        order: Number, // For sorting events within the thread
      },
    ],
    dependencies: [
      {
        threadId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'PlotThread',
        },
        threadTitle: String,
        dependencyType: {
          type: String,
          enum: ['prerequisite', 'parallel', 'consequence', 'trigger'],
        },
        description: String,
      },
    ],
    themes: [
      {
        type: String,
        trim: true,
        maxLength: 100,
      },
    ],
    symbolism: {
      symbols: [String],
      metaphors: [String],
      motifs: [String],
    },
    pacing: {
      introduction: {
        chapterId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Chapter',
        },
        chapterTitle: String,
        description: String,
      },
      development: [
        {
          chapterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Chapter',
          },
          chapterTitle: String,
          milestone: String,
          escalation: String,
        },
      ],
      climax: {
        chapterId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Chapter',
        },
        chapterTitle: String,
        description: String,
      },
      resolution: {
        chapterId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Chapter',
        },
        chapterTitle: String,
        description: String,
      },
    },
    tension: {
      level: {
        type: String,
        enum: ['low', 'medium', 'high', 'climactic'],
        default: 'medium',
      },
      tensionPoints: [
        {
          chapterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Chapter',
          },
          chapterTitle: String,
          description: String,
          intensity: {
            type: String,
            enum: ['low', 'medium', 'high', 'peak'],
          },
        },
      ],
    },
    foreshadowing: [
      {
        chapterId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Chapter',
        },
        chapterTitle: String,
        hint: String,
        payoff: String,
        payoffChapter: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Chapter',
        },
      },
    ],
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
      maxLength: 3000,
    },
    continuityNotes: {
      type: String,
      trim: true,
      maxLength: 2000,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient querying
plotThreadSchema.index({ bookId: 1, authorId: 1 });
plotThreadSchema.index({ type: 1 });
plotThreadSchema.index({ importance: 1 });
plotThreadSchema.index({ status: 1 });
plotThreadSchema.index({ tags: 1 });
plotThreadSchema.index({ 'timeline.chapterId': 1 });

// Virtual for thread summary
plotThreadSchema.virtual('summary').get(function () {
  return `${this.title} - ${this.type} (${this.importance})`;
});

// Virtual for completion percentage
plotThreadSchema.virtual('completionPercentage').get(function () {
  if (this.status === 'resolved') return 100;
  if (this.status === 'abandoned') return 0;

  const totalStages = 4; // introduction, development, climax, resolution
  let completedStages = 0;

  if (this.pacing.introduction.chapterId) completedStages++;
  if (this.pacing.development.length > 0) completedStages++;
  if (this.pacing.climax.chapterId) completedStages++;
  if (this.pacing.resolution.chapterId) completedStages++;

  return Math.round((completedStages / totalStages) * 100);
});

// Static method to find plot threads by book
plotThreadSchema.statics.findByBook = function (bookId, authorId, options = {}) {
  const query = { bookId, authorId };

  if (options.type) query.type = options.type;
  if (options.importance) query.importance = options.importance;
  if (options.status) query.status = options.status;
  if (options.isActive !== undefined) query.isActive = options.isActive;
  if (options.tags && options.tags.length > 0) query.tags = { $in: options.tags };

  let sortField = { importance: 1, title: 1 };
  if (options.sortBy === 'title') {
    sortField = { title: 1 };
  } else if (options.sortBy === 'type') {
    sortField = { type: 1, title: 1 };
  } else if (options.sortBy === 'status') {
    sortField = { status: 1, title: 1 };
  } else if (options.sortBy === 'created') {
    sortField = { createdAt: -1 };
  }

  return this.find(query)
    .sort(sortField)
    .limit(options.limit || 100)
    .skip(options.offset || 0)
    .populate('charactersInvolved.characterId', 'name role')
    .populate('locationsInvolved.locationId', 'name type')
    .populate('timeline.chapterId', 'title chapterNumber');
};

// Static method to find plot threads by chapter
plotThreadSchema.statics.findByChapter = function (chapterId) {
  return this.find({ 'timeline.chapterId': chapterId })
    .populate('bookId', 'title')
    .populate('charactersInvolved.characterId', 'name role');
};

// Static method to find plot thread dependencies
plotThreadSchema.statics.findDependencies = function (threadId) {
  return this.aggregate([
    { $match: { _id: threadId } },
    {
      $lookup: {
        from: 'plotthreads',
        localField: 'dependencies.threadId',
        foreignField: '_id',
        as: 'dependentThreads',
      },
    },
    {
      $lookup: {
        from: 'plotthreads',
        localField: '_id',
        foreignField: 'dependencies.threadId',
        as: 'dependsOnThis',
      },
    },
  ]);
};

// Instance method to add timeline event
plotThreadSchema.methods.addTimelineEvent = function (
  chapterId,
  chapterTitle,
  chapterNumber,
  event,
  development,
  significance,
) {
  // Check if event for this chapter already exists
  const existingEvent = this.timeline.find(
    (item) => item.chapterId.toString() === chapterId.toString(),
  );

  if (existingEvent) {
    // Update existing event
    existingEvent.event = event;
    existingEvent.development = development;
    existingEvent.significance = significance;
  } else {
    // Add new event
    this.timeline.push({
      chapterId,
      chapterTitle,
      chapterNumber,
      event,
      development,
      significance,
      order: this.timeline.length + 1,
    });

    // Sort timeline by chapter number
    this.timeline.sort((a, b) => a.chapterNumber - b.chapterNumber);
  }

  return this.save();
};

// Instance method to add character involvement
plotThreadSchema.methods.addCharacterInvolvement = function (
  characterId,
  characterName,
  role,
  involvement,
) {
  // Check if character already involved
  const existingInvolvement = this.charactersInvolved.find(
    (char) => char.characterId.toString() === characterId.toString(),
  );

  if (existingInvolvement) {
    // Update existing involvement
    existingInvolvement.role = role;
    existingInvolvement.involvement = involvement;
  } else {
    // Add new character involvement
    this.charactersInvolved.push({
      characterId,
      characterName,
      role,
      involvement,
    });
  }

  return this.save();
};

// Instance method to add location involvement
plotThreadSchema.methods.addLocationInvolvement = function (
  locationId,
  locationName,
  significance,
) {
  // Check if location already involved
  const existingInvolvement = this.locationsInvolved.find(
    (loc) => loc.locationId.toString() === locationId.toString(),
  );

  if (!existingInvolvement) {
    this.locationsInvolved.push({
      locationId,
      locationName,
      significance,
    });
    return this.save();
  }

  return Promise.resolve(this);
};

// Instance method to add dependency
plotThreadSchema.methods.addDependency = function (
  threadId,
  threadTitle,
  dependencyType,
  description,
) {
  // Check if dependency already exists
  const existingDependency = this.dependencies.find(
    (dep) => dep.threadId.toString() === threadId.toString(),
  );

  if (!existingDependency) {
    this.dependencies.push({
      threadId,
      threadTitle,
      dependencyType,
      description,
    });
    return this.save();
  }

  return Promise.resolve(this);
};

// Instance method to add foreshadowing
plotThreadSchema.methods.addForeshadowing = function (
  chapterId,
  chapterTitle,
  hint,
  payoff,
  payoffChapter,
) {
  this.foreshadowing.push({
    chapterId,
    chapterTitle,
    hint,
    payoff,
    payoffChapter,
  });

  return this.save();
};

// Instance method to update pacing stage
plotThreadSchema.methods.updatePacingStage = function (
  stage,
  chapterId,
  chapterTitle,
  description,
  milestone = '',
  escalation = '',
) {
  switch (stage) {
    case 'introduction':
      this.pacing.introduction = {
        chapterId,
        chapterTitle,
        description,
      };
      break;
    case 'development':
      this.pacing.development.push({
        chapterId,
        chapterTitle,
        milestone,
        escalation,
      });
      break;
    case 'climax':
      this.pacing.climax = {
        chapterId,
        chapterTitle,
        description,
      };
      break;
    case 'resolution':
      this.pacing.resolution = {
        chapterId,
        chapterTitle,
        description,
      };
      break;
  }

  return this.save();
};

export const PlotThread = mongoose.model('PlotThread', plotThreadSchema);
