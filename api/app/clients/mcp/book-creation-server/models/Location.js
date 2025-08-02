import mongoose from 'mongoose';

/**
 * Location Model
 * Represents settings, places, and world-building elements for fiction
 */
const locationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxLength: 150,
    },
    type: {
      type: String,
      enum: [
        'country',
        'city',
        'town',
        'village',
        'district',
        'building',
        'room',
        'landmark',
        'natural_feature',
        'fictional_world',
        'dimension',
        'other',
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
      maxLength: 3000,
    },
    physicalDetails: {
      size: String, // e.g., "small village", "sprawling metropolis"
      geography: String, // mountains, plains, coastal, etc.
      climate: String,
      architecture: String,
      layout: String,
      landmarks: [String],
      naturalFeatures: [String],
    },
    atmosphere: {
      mood: String, // e.g., "mysterious", "welcoming", "foreboding"
      lighting: String,
      sounds: String,
      smells: String,
      generalFeel: String,
    },
    demographics: {
      population: String,
      inhabitants: [String], // types of people/creatures
      culture: String,
      language: String,
      customs: String,
      socialStructure: String,
    },
    governance: {
      rulerType: String, // king, mayor, council, etc.
      governmentType: String,
      laws: String,
      militaryPresence: String,
    },
    economy: {
      mainIndustries: [String],
      tradeGoods: [String],
      currency: String,
      economicStatus: String, // prosperous, struggling, etc.
    },
    history: {
      founded: String,
      significantEvents: [
        {
          event: String,
          date: String,
          impact: String,
        },
      ],
      historicalImportance: String,
    },
    parentLocation: {
      locationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
      },
      locationName: String,
    },
    subLocations: [
      {
        locationId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Location',
        },
        locationName: String,
        description: String,
      },
    ],
    connectedLocations: [
      {
        locationId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Location',
        },
        locationName: String,
        connectionType: String, // "border", "trade route", "portal", etc.
        distance: String,
        travelTime: String,
        description: String,
      },
    ],
    firstMention: {
      chapterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chapter',
      },
      chapterTitle: String,
      context: String,
    },
    chaptersUsed: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chapter',
      },
    ],
    sceneDetails: [
      {
        chapterId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Chapter',
        },
        chapterTitle: String,
        sceneDescription: String,
        charactersPresent: [String],
        eventsOccurred: String,
      },
    ],
    resources: {
      availableResources: [String], // water, minerals, magical elements, etc.
      dangers: [String], // wild animals, natural disasters, magical threats
      opportunities: [String],
    },
    magicalProperties: {
      hasMagic: {
        type: Boolean,
        default: false,
      },
      magicType: String,
      magicalEvents: [String],
      restrictions: String,
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
locationSchema.index({ bookId: 1, authorId: 1 });
locationSchema.index({ type: 1 });
locationSchema.index({ importance: 1 });
locationSchema.index({ name: 1 });
locationSchema.index({ 'parentLocation.locationId': 1 });
locationSchema.index({ tags: 1 });

// Virtual for location hierarchy
locationSchema.virtual('fullLocation').get(function () {
  if (this.parentLocation?.locationName) {
    return `${this.name} (${this.parentLocation.locationName})`;
  }
  return this.name;
});

// Virtual for location summary
locationSchema.virtual('summary').get(function () {
  return `${this.name} - ${this.type} (${this.importance})`;
});

// Static method to find locations by book
locationSchema.statics.findByBook = function (bookId, authorId, options = {}) {
  const query = { bookId, authorId };

  if (options.type) query.type = options.type;
  if (options.importance) query.importance = options.importance;
  if (options.isActive !== undefined) query.isActive = options.isActive;
  if (options.tags && options.tags.length > 0) query.tags = { $in: options.tags };
  if (options.parentLocation) {
    query['parentLocation.locationId'] = options.parentLocation;
  }

  let sortField = { importance: 1, name: 1 };
  if (options.sortBy === 'name') {
    sortField = { name: 1 };
  } else if (options.sortBy === 'type') {
    sortField = { type: 1, name: 1 };
  } else if (options.sortBy === 'created') {
    sortField = { createdAt: -1 };
  }

  return this.find(query)
    .sort(sortField)
    .limit(options.limit || 100)
    .skip(options.offset || 0)
    .populate('parentLocation.locationId', 'name type')
    .populate('subLocations.locationId', 'name type')
    .populate('chaptersUsed', 'title chapterNumber');
};

// Static method to find locations by chapter
locationSchema.statics.findByChapter = function (chapterId) {
  return this.find({ chaptersUsed: chapterId }).populate('bookId', 'title');
};

// Static method to build location hierarchy
locationSchema.statics.buildHierarchy = function (bookId, authorId) {
  return this.aggregate([
    { $match: { bookId, authorId } },
    {
      $graphLookup: {
        from: 'locations',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parentLocation.locationId',
        as: 'descendants',
      },
    },
    {
      $addFields: {
        level: {
          $cond: {
            if: { $eq: ['$parentLocation.locationId', null] },
            then: 0,
            else: 1,
          },
        },
      },
    },
    { $sort: { level: 1, name: 1 } },
  ]);
};

// Instance method to add chapter usage
locationSchema.methods.addChapterUsage = function (
  chapterId,
  chapterTitle,
  sceneDescription = '',
  charactersPresent = [],
  eventsOccurred = '',
) {
  // Add to chapters used if not already there
  if (!this.chaptersUsed.includes(chapterId)) {
    this.chaptersUsed.push(chapterId);

    // Set first mention if not set
    if (!this.firstMention.chapterId) {
      this.firstMention = {
        chapterId,
        chapterTitle,
        context: sceneDescription,
      };
    }
  }

  // Add scene details
  const existingScene = this.sceneDetails.find(
    (scene) => scene.chapterId.toString() === chapterId.toString(),
  );

  if (existingScene) {
    // Update existing scene
    existingScene.sceneDescription = sceneDescription;
    existingScene.charactersPresent = charactersPresent;
    existingScene.eventsOccurred = eventsOccurred;
  } else {
    // Add new scene
    this.sceneDetails.push({
      chapterId,
      chapterTitle,
      sceneDescription,
      charactersPresent,
      eventsOccurred,
    });
  }

  return this.save();
};

// Instance method to add sub-location
locationSchema.methods.addSubLocation = function (
  subLocationId,
  subLocationName,
  description = '',
) {
  // Check if sub-location already exists
  const existingSubLocation = this.subLocations.find(
    (sub) => sub.locationId.toString() === subLocationId.toString(),
  );

  if (!existingSubLocation) {
    this.subLocations.push({
      locationId: subLocationId,
      locationName: subLocationName,
      description,
    });
    return this.save();
  }

  return Promise.resolve(this);
};

// Instance method to add connection to another location
locationSchema.methods.addConnection = function (
  otherLocationId,
  otherLocationName,
  connectionType,
  distance = '',
  travelTime = '',
  description = '',
) {
  // Check if connection already exists
  const existingConnection = this.connectedLocations.find(
    (conn) => conn.locationId.toString() === otherLocationId.toString(),
  );

  if (existingConnection) {
    // Update existing connection
    existingConnection.connectionType = connectionType;
    existingConnection.distance = distance;
    existingConnection.travelTime = travelTime;
    existingConnection.description = description;
  } else {
    // Add new connection
    this.connectedLocations.push({
      locationId: otherLocationId,
      locationName: otherLocationName,
      connectionType,
      distance,
      travelTime,
      description,
    });
  }

  return this.save();
};

// Instance method to add historical event
locationSchema.methods.addHistoricalEvent = function (event, date, impact) {
  this.history.significantEvents.push({
    event,
    date,
    impact,
  });

  return this.save();
};

export const Location = mongoose.model('Location', locationSchema);
