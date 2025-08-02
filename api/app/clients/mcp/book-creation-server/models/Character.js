import mongoose from 'mongoose';

/**
 * Character Model
 * Represents fictional characters with detailed attributes, development arcs, and relationships
 */
const characterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxLength: 100,
    },
    fullName: {
      type: String,
      trim: true,
      maxLength: 200,
    },
    aliases: [
      {
        type: String,
        trim: true,
        maxLength: 100,
      },
    ],
    role: {
      type: String,
      enum: [
        'protagonist',
        'antagonist',
        'deuteragonist',
        'love_interest',
        'mentor',
        'sidekick',
        'villain',
        'supporting',
        'minor',
        'background',
      ],
      required: true,
    },
    importance: {
      type: String,
      enum: ['major', 'supporting', 'minor'],
      default: 'supporting',
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
    physicalDescription: {
      age: Number,
      height: String,
      build: String,
      hairColor: String,
      eyeColor: String,
      distinguishingFeatures: String,
      appearance: String,
    },
    personality: {
      traits: [String], // e.g., ["brave", "stubborn", "witty"]
      strengths: [String],
      weaknesses: [String],
      fears: [String],
      motivations: [String],
      goals: [String],
      conflicts: [String],
    },
    background: {
      birthplace: String,
      family: String,
      education: String,
      occupation: String,
      socialClass: String,
      backstory: String,
    },
    relationships: [
      {
        characterId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Character',
        },
        characterName: String, // For easy reference
        relationshipType: {
          type: String,
          enum: [
            'family',
            'romantic',
            'friend',
            'enemy',
            'rival',
            'mentor',
            'student',
            'ally',
            'colleague',
            'stranger',
            'other',
          ],
        },
        description: String,
        dynamics: String, // How they interact
      },
    ],
    characterArc: {
      startingPoint: String,
      characterGrowth: String,
      keyMoments: [
        {
          chapterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Chapter',
          },
          chapterTitle: String,
          event: String,
          impact: String,
        },
      ],
      endingPoint: String,
      transformation: String,
    },
    firstAppearance: {
      chapterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chapter',
      },
      chapterTitle: String,
      scene: String,
    },
    lastAppearance: {
      chapterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chapter',
      },
      chapterTitle: String,
      scene: String,
    },
    chaptersAppeared: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chapter',
      },
    ],
    voiceAndSpeech: {
      speechPattern: String,
      vocabulary: String,
      accent: String,
      catchphrases: [String],
      dialogueNotes: String,
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
      maxLength: 3000,
    },
    status: {
      type: String,
      enum: ['active', 'deceased', 'missing', 'retired'],
      default: 'active',
    },
    isMain: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for efficient querying
characterSchema.index({ bookId: 1, authorId: 1 });
characterSchema.index({ role: 1 });
characterSchema.index({ importance: 1 });
characterSchema.index({ name: 1 });
characterSchema.index({ tags: 1 });

// Virtual for character summary
characterSchema.virtual('summary').get(function () {
  return `${this.name} - ${this.role} (${this.importance})`;
});

// Virtual for age category
characterSchema.virtual('ageCategory').get(function () {
  if (!this.physicalDescription?.age) return 'Unknown';
  const age = this.physicalDescription.age;
  if (age < 13) return 'Child';
  if (age < 20) return 'Teenager';
  if (age < 35) return 'Young Adult';
  if (age < 65) return 'Adult';
  return 'Elder';
});

// Static method to find characters by book
characterSchema.statics.findByBook = function (bookId, authorId, options = {}) {
  const query = { bookId, authorId };

  if (options.role) query.role = options.role;
  if (options.importance) query.importance = options.importance;
  if (options.status) query.status = options.status;
  if (options.isMain !== undefined) query.isMain = options.isMain;
  if (options.tags && options.tags.length > 0) query.tags = { $in: options.tags };

  let sortField = { importance: 1, name: 1 };
  if (options.sortBy === 'name') {
    sortField = { name: 1 };
  } else if (options.sortBy === 'role') {
    sortField = { role: 1, name: 1 };
  } else if (options.sortBy === 'created') {
    sortField = { createdAt: -1 };
  }

  return this.find(query)
    .sort(sortField)
    .limit(options.limit || 100)
    .skip(options.offset || 0)
    .populate('relationships.characterId', 'name role')
    .populate('chaptersAppeared', 'title chapterNumber');
};

// Static method to find characters by chapter
characterSchema.statics.findByChapter = function (chapterId) {
  return this.find({ chaptersAppeared: chapterId }).populate('bookId', 'title');
};

// Instance method to add appearance in chapter
characterSchema.methods.addChapterAppearance = function (chapterId, chapterTitle) {
  if (!this.chaptersAppeared.includes(chapterId)) {
    this.chaptersAppeared.push(chapterId);

    // Update first appearance if not set
    if (!this.firstAppearance.chapterId) {
      this.firstAppearance = {
        chapterId,
        chapterTitle,
      };
    }

    // Always update last appearance
    this.lastAppearance = {
      chapterId,
      chapterTitle,
    };

    return this.save();
  }
  return Promise.resolve(this);
};

// Instance method to add relationship
characterSchema.methods.addRelationship = function (
  otherCharacterId,
  otherCharacterName,
  relationshipType,
  description = '',
  dynamics = '',
) {
  // Check if relationship already exists
  const existingRelationship = this.relationships.find(
    (rel) => rel.characterId.toString() === otherCharacterId.toString(),
  );

  if (existingRelationship) {
    // Update existing relationship
    existingRelationship.relationshipType = relationshipType;
    existingRelationship.description = description;
    existingRelationship.dynamics = dynamics;
  } else {
    // Add new relationship
    this.relationships.push({
      characterId: otherCharacterId,
      characterName: otherCharacterName,
      relationshipType,
      description,
      dynamics,
    });
  }

  return this.save();
};

// Instance method to add character arc moment
characterSchema.methods.addArcMoment = function (chapterId, chapterTitle, event, impact) {
  this.characterArc.keyMoments.push({
    chapterId,
    chapterTitle,
    event,
    impact,
  });

  return this.save();
};

export const Character = mongoose.model('Character', characterSchema);
