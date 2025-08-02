import { Character } from '../models/Character.js';
import { Location } from '../models/Location.js';
import { PlotThread } from '../models/PlotThread.js';

/**
 * World Building Service
 * Handles character, location, and plot thread management for fiction writing
 */
export class WorldBuildingService {
  // ============ CHARACTER METHODS ============

  /**
   * Creates a new character
   * @param {Object} characterData - Character data
   * @returns {Promise<Object>} Created character
   */
  async createCharacter(characterData) {
    const {
      name,
      fullName,
      aliases = [],
      role,
      importance = 'supporting',
      bookId,
      authorId,
      description,
      physicalDescription = {},
      personality = {},
      background = {},
      voiceAndSpeech = {},
      tags = [],
      notes,
      isMain = false,
    } = characterData;

    const character = new Character({
      name,
      fullName,
      aliases,
      role,
      importance,
      bookId,
      authorId,
      description,
      physicalDescription,
      personality,
      background,
      voiceAndSpeech,
      tags,
      notes,
      isMain,
    });

    await character.save();
    return character;
  }

  /**
   * Gets characters for a book with filtering
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Characters and metadata
   */
  async getCharacters(params) {
    const {
      bookId,
      authorId,
      role,
      importance,
      status,
      isMain,
      tags,
      limit = 100,
      offset = 0,
      sortBy = 'importance',
    } = params;

    const [characters, total] = await Promise.all([
      Character.findByBook(bookId, authorId, {
        role,
        importance,
        status,
        isMain,
        tags,
        limit,
        offset,
        sortBy,
      }),
      Character.countDocuments({
        bookId,
        authorId,
        ...(role && { role }),
        ...(importance && { importance }),
        ...(status && { status }),
        ...(isMain !== undefined && { isMain }),
        ...(tags && tags.length > 0 && { tags: { $in: tags } }),
      }),
    ]);

    return {
      characters,
      total,
      limit,
      offset,
      hasMore: total > offset + limit,
    };
  }

  /**
   * Updates a character
   * @param {string} characterId - Character ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated character
   */
  async updateCharacter(characterId, updates) {
    const allowedUpdates = [
      'name',
      'fullName',
      'aliases',
      'role',
      'importance',
      'description',
      'physicalDescription',
      'personality',
      'background',
      'voiceAndSpeech',
      'tags',
      'notes',
      'status',
      'isMain',
    ];

    const filteredUpdates = {};
    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    const character = await Character.findByIdAndUpdate(characterId, filteredUpdates, {
      new: true,
      runValidators: true,
    });

    if (!character) {
      throw new Error('Character not found');
    }

    return character;
  }

  /**
   * Deletes a character
   * @param {string} characterId - Character ID
   * @param {string} authorId - Author ID for verification
   * @returns {Promise<void>}
   */
  async deleteCharacter(characterId, authorId) {
    const character = await Character.findOne({ _id: characterId, authorId });

    if (!character) {
      throw new Error('Character not found or access denied');
    }

    await Character.findByIdAndDelete(characterId);
  }

  /**
   * Adds a relationship between characters
   * @param {Object} params - Relationship parameters
   * @returns {Promise<Object>} Updated character
   */
  async addCharacterRelationship(params) {
    const {
      characterId,
      otherCharacterId,
      otherCharacterName,
      relationshipType,
      description = '',
      dynamics = '',
      authorId,
    } = params;

    const character = await Character.findOne({ _id: characterId, authorId });
    if (!character) {
      throw new Error('Character not found or access denied');
    }

    await character.addRelationship(
      otherCharacterId,
      otherCharacterName,
      relationshipType,
      description,
      dynamics,
    );

    return character;
  }

  // ============ LOCATION METHODS ============

  /**
   * Creates a new location
   * @param {Object} locationData - Location data
   * @returns {Promise<Object>} Created location
   */
  async createLocation(locationData) {
    const {
      name,
      type,
      importance = 'supporting',
      bookId,
      authorId,
      description,
      physicalDetails = {},
      atmosphere = {},
      demographics = {},
      governance = {},
      economy = {},
      history = {},
      resources = {},
      magicalProperties = {},
      parentLocationId,
      parentLocationName,
      tags = [],
      notes,
    } = locationData;

    const location = new Location({
      name,
      type,
      importance,
      bookId,
      authorId,
      description,
      physicalDetails,
      atmosphere,
      demographics,
      governance,
      economy,
      history,
      resources,
      magicalProperties,
      ...(parentLocationId && {
        parentLocation: {
          locationId: parentLocationId,
          locationName: parentLocationName,
        },
      }),
      tags,
      notes,
    });

    await location.save();

    // Add this location as a sub-location to parent if specified
    if (parentLocationId) {
      const parentLocation = await Location.findById(parentLocationId);
      if (parentLocation) {
        await parentLocation.addSubLocation(location._id, location.name, description);
      }
    }

    return location;
  }

  /**
   * Gets locations for a book with filtering
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Locations and metadata
   */
  async getLocations(params) {
    const {
      bookId,
      authorId,
      type,
      importance,
      isActive,
      parentLocation,
      tags,
      limit = 100,
      offset = 0,
      sortBy = 'importance',
    } = params;

    const [locations, total] = await Promise.all([
      Location.findByBook(bookId, authorId, {
        type,
        importance,
        isActive,
        parentLocation,
        tags,
        limit,
        offset,
        sortBy,
      }),
      Location.countDocuments({
        bookId,
        authorId,
        ...(type && { type }),
        ...(importance && { importance }),
        ...(isActive !== undefined && { isActive }),
        ...(parentLocation && { 'parentLocation.locationId': parentLocation }),
        ...(tags && tags.length > 0 && { tags: { $in: tags } }),
      }),
    ]);

    return {
      locations,
      total,
      limit,
      offset,
      hasMore: total > offset + limit,
    };
  }

  /**
   * Updates a location
   * @param {string} locationId - Location ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated location
   */
  async updateLocation(locationId, updates) {
    const allowedUpdates = [
      'name',
      'type',
      'importance',
      'description',
      'physicalDetails',
      'atmosphere',
      'demographics',
      'governance',
      'economy',
      'history',
      'resources',
      'magicalProperties',
      'tags',
      'notes',
      'isActive',
    ];

    const filteredUpdates = {};
    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    const location = await Location.findByIdAndUpdate(locationId, filteredUpdates, {
      new: true,
      runValidators: true,
    });

    if (!location) {
      throw new Error('Location not found');
    }

    return location;
  }

  /**
   * Deletes a location
   * @param {string} locationId - Location ID
   * @param {string} authorId - Author ID for verification
   * @returns {Promise<void>}
   */
  async deleteLocation(locationId, authorId) {
    const location = await Location.findOne({ _id: locationId, authorId });

    if (!location) {
      throw new Error('Location not found or access denied');
    }

    await Location.findByIdAndDelete(locationId);
  }

  // ============ PLOT THREAD METHODS ============

  /**
   * Creates a new plot thread
   * @param {Object} plotThreadData - Plot thread data
   * @returns {Promise<Object>} Created plot thread
   */
  async createPlotThread(plotThreadData) {
    const {
      title,
      type,
      importance = 'secondary',
      status = 'planned',
      bookId,
      authorId,
      description,
      premise,
      goal,
      conflict,
      resolution,
      themes = [],
      symbolism = {},
      tags = [],
      notes,
      continuityNotes,
    } = plotThreadData;

    const plotThread = new PlotThread({
      title,
      type,
      importance,
      status,
      bookId,
      authorId,
      description,
      premise,
      goal,
      conflict,
      resolution,
      themes,
      symbolism,
      tags,
      notes,
      continuityNotes,
    });

    await plotThread.save();
    return plotThread;
  }

  /**
   * Gets plot threads for a book with filtering
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Plot threads and metadata
   */
  async getPlotThreads(params) {
    const {
      bookId,
      authorId,
      type,
      importance,
      status,
      isActive,
      tags,
      limit = 100,
      offset = 0,
      sortBy = 'importance',
    } = params;

    const [plotThreads, total] = await Promise.all([
      PlotThread.findByBook(bookId, authorId, {
        type,
        importance,
        status,
        isActive,
        tags,
        limit,
        offset,
        sortBy,
      }),
      PlotThread.countDocuments({
        bookId,
        authorId,
        ...(type && { type }),
        ...(importance && { importance }),
        ...(status && { status }),
        ...(isActive !== undefined && { isActive }),
        ...(tags && tags.length > 0 && { tags: { $in: tags } }),
      }),
    ]);

    return {
      plotThreads,
      total,
      limit,
      offset,
      hasMore: total > offset + limit,
    };
  }

  /**
   * Updates a plot thread
   * @param {string} plotThreadId - Plot thread ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated plot thread
   */
  async updatePlotThread(plotThreadId, updates) {
    const allowedUpdates = [
      'title',
      'type',
      'importance',
      'status',
      'description',
      'premise',
      'goal',
      'conflict',
      'resolution',
      'themes',
      'symbolism',
      'tags',
      'notes',
      'continuityNotes',
      'isActive',
    ];

    const filteredUpdates = {};
    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    const plotThread = await PlotThread.findByIdAndUpdate(plotThreadId, filteredUpdates, {
      new: true,
      runValidators: true,
    });

    if (!plotThread) {
      throw new Error('Plot thread not found');
    }

    return plotThread;
  }

  /**
   * Deletes a plot thread
   * @param {string} plotThreadId - Plot thread ID
   * @param {string} authorId - Author ID for verification
   * @returns {Promise<void>}
   */
  async deletePlotThread(plotThreadId, authorId) {
    const plotThread = await PlotThread.findOne({ _id: plotThreadId, authorId });

    if (!plotThread) {
      throw new Error('Plot thread not found or access denied');
    }

    await PlotThread.findByIdAndDelete(plotThreadId);
  }

  /**
   * Adds a timeline event to a plot thread
   * @param {Object} params - Timeline event parameters
   * @returns {Promise<Object>} Updated plot thread
   */
  async addPlotTimelineEvent(params) {
    const {
      plotThreadId,
      chapterId,
      chapterTitle,
      chapterNumber,
      event,
      development,
      significance,
      authorId,
    } = params;

    const plotThread = await PlotThread.findOne({ _id: plotThreadId, authorId });
    if (!plotThread) {
      throw new Error('Plot thread not found or access denied');
    }

    await plotThread.addTimelineEvent(
      chapterId,
      chapterTitle,
      chapterNumber,
      event,
      development,
      significance,
    );

    return plotThread;
  }

  // ============ INTEGRATED METHODS ============

  /**
   * Gets a comprehensive overview of world building elements for a book
   * @param {string} bookId - Book ID
   * @param {string} authorId - Author ID
   * @returns {Promise<Object>} World building overview
   */
  async getWorldBuildingOverview(bookId, authorId) {
    const [characters, locations, plotThreads, characterStats, locationStats, plotStats] =
      await Promise.all([
        Character.find({ bookId, authorId }).select('name role importance isMain status').limit(20),
        Location.find({ bookId, authorId }).select('name type importance isActive').limit(20),
        PlotThread.find({ bookId, authorId }).select('title type importance status').limit(20),
        Character.aggregate([
          { $match: { bookId, authorId } },
          {
            $group: {
              _id: '$role',
              count: { $sum: 1 },
            },
          },
        ]),
        Location.aggregate([
          { $match: { bookId, authorId } },
          {
            $group: {
              _id: '$type',
              count: { $sum: 1 },
            },
          },
        ]),
        PlotThread.aggregate([
          { $match: { bookId, authorId } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    return {
      summary: {
        totalCharacters: characters.length,
        totalLocations: locations.length,
        totalPlotThreads: plotThreads.length,
        mainCharacters: characters.filter((char) => char.isMain).length,
        majorLocations: locations.filter((loc) => loc.importance === 'major').length,
        activePlotThreads: plotThreads.filter((plot) => plot.status === 'active').length,
      },
      characters: characters.slice(0, 10), // Top 10 for preview
      locations: locations.slice(0, 10),
      plotThreads: plotThreads.slice(0, 10),
      statistics: {
        charactersByRole: characterStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        locationsByType: locationStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        plotThreadsByStatus: plotStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
      },
    };
  }

  /**
   * Gets elements by chapter for scene planning
   * @param {string} chapterId - Chapter ID
   * @returns {Promise<Object>} Chapter elements
   */
  async getChapterElements(chapterId) {
    const [characters, locations, plotThreads] = await Promise.all([
      Character.findByChapter(chapterId),
      Location.findByChapter(chapterId),
      PlotThread.findByChapter(chapterId),
    ]);

    return {
      characters,
      locations,
      plotThreads,
    };
  }

  /**
   * Creates connections between world building elements
   * @param {Object} params - Connection parameters
   * @returns {Promise<Object>} Connection result
   */
  async createElementConnection(params) {
    const { fromType, fromId, toType, toId, connectionType, description, authorId } = params;

    const result = {};

    // Handle character to character relationships
    if (fromType === 'character' && toType === 'character') {
      const character = await Character.findOne({ _id: fromId, authorId });
      const otherCharacter = await Character.findById(toId);

      if (!character || !otherCharacter) {
        throw new Error('Characters not found');
      }

      await character.addRelationship(toId, otherCharacter.name, connectionType, description);
      result.connection = 'Character relationship added';
    }

    // Handle location to location connections
    if (fromType === 'location' && toType === 'location') {
      const location = await Location.findOne({ _id: fromId, authorId });
      const otherLocation = await Location.findById(toId);

      if (!location || !otherLocation) {
        throw new Error('Locations not found');
      }

      await location.addConnection(toId, otherLocation.name, connectionType, '', '', description);
      result.connection = 'Location connection added';
    }

    // Handle plot thread dependencies
    if (fromType === 'plotThread' && toType === 'plotThread') {
      const plotThread = await PlotThread.findOne({ _id: fromId, authorId });
      const otherPlotThread = await PlotThread.findById(toId);

      if (!plotThread || !otherPlotThread) {
        throw new Error('Plot threads not found');
      }

      await plotThread.addDependency(toId, otherPlotThread.title, connectionType, description);
      result.connection = 'Plot thread dependency added';
    }

    return result;
  }
}
