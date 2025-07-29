const { CS2Match, CS2Team, CS2Player } = require('~/db/models');
const logger = require('~/utils/logger');
const mongoose = require('mongoose');

/**
 * Data cleanup and maintenance service for CS2 data
 * Handles deduplication, consistency checks, archival, and database optimization
 */
class DataMaintenanceService {
  constructor() {
    this.maintenanceStats = {
      duplicatesRemoved: 0,
      inconsistenciesFixed: 0,
      recordsArchived: 0,
      indexesOptimized: 0,
      lastMaintenanceRun: null,
    };
  }

  /**
   * Run complete data maintenance routine
   * @param {Object} options - Maintenance options
   * @returns {Promise<Object>} Maintenance results
   */
  async runMaintenanceRoutine(options = {}) {
    const {
      includeDuplicateRemoval = true,
      includeConsistencyCheck = true,
      includeArchival = true,
      includeIndexOptimization = true,
      dryRun = false,
    } = options;

    logger.info('Starting data maintenance routine', { options });
    const startTime = Date.now();
    const results = this._initializeResults();

    try {
      const tasks = this._buildMaintenanceTasks(options);

      for (const task of tasks) {
        if (task.enabled) {
          await this._executeMaintenanceTask(task, results, { dryRun });
        }
      }

      results.duration = Date.now() - startTime;
      this.maintenanceStats.lastMaintenanceRun = new Date();

      logger.info('Data maintenance routine completed', { results });
      return results;
    } catch (error) {
      logger.error('Data maintenance routine failed', { error: error.message });
      results.errors.push(error.message);
      results.duration = Date.now() - startTime;
      return results;
    }
  }

  /**
   * Initialize maintenance results object
   * @private
   */
  _initializeResults() {
    return {
      duplicatesRemoved: 0,
      inconsistenciesFixed: 0,
      recordsArchived: 0,
      indexesOptimized: 0,
      errors: [],
      duration: 0,
    };
  }

  /**
   * Build array of maintenance tasks based on options
   * @private
   */
  _buildMaintenanceTasks(options) {
    return [
      {
        name: 'duplicate_removal',
        enabled: options.includeDuplicateRemoval,
        method: this.removeDuplicates.bind(this),
        resultKey: 'duplicatesRemoved',
        logMessage: 'Running duplicate removal',
      },
      {
        name: 'consistency_check',
        enabled: options.includeConsistencyCheck,
        method: this.checkAndFixConsistency.bind(this),
        resultKey: 'inconsistenciesFixed',
        logMessage: 'Running consistency checks',
      },
      {
        name: 'archival',
        enabled: options.includeArchival,
        method: this.archiveOldData.bind(this),
        resultKey: 'recordsArchived',
        logMessage: 'Running data archival',
      },
      {
        name: 'index_optimization',
        enabled: options.includeIndexOptimization,
        method: this.optimizeIndexes.bind(this),
        resultKey: 'indexesOptimized',
        logMessage: 'Running index optimization',
      },
    ];
  }

  /**
   * Execute a single maintenance task
   * @private
   */
  async _executeMaintenanceTask(task, results, options) {
    logger.info(task.logMessage);
    const taskResult = await task.method(options);

    if (task.resultKey === 'duplicatesRemoved') {
      results.duplicatesRemoved = taskResult.removed;
    } else if (task.resultKey === 'inconsistenciesFixed') {
      results.inconsistenciesFixed = taskResult.fixed;
    } else if (task.resultKey === 'recordsArchived') {
      results.recordsArchived = taskResult.archived;
    } else if (task.resultKey === 'indexesOptimized') {
      results.indexesOptimized = taskResult.optimized;
    }

    if (taskResult.errors && taskResult.errors.length > 0) {
      results.errors.push(...taskResult.errors);
    }
  }

  /**
   * Remove duplicate records across all CS2 collections
   * @param {Object} options - Removal options
   * @returns {Promise<Object>} Removal results
   */
  async removeDuplicates(options = {}) {
    const { dryRun = false } = options;
    const results = { removed: 0, errors: [] };

    try {
      // Remove duplicate matches by hltvId
      const matchDuplicates = await this.findDuplicateMatches();
      if (matchDuplicates.length > 0) {
        logger.info(`Found ${matchDuplicates.length} duplicate matches`);
        if (!dryRun) {
          const matchesRemoved = await this.removeDuplicateMatches(matchDuplicates);
          results.removed += matchesRemoved;
        }
      }

      // Remove duplicate teams by hltvId
      const teamDuplicates = await this.findDuplicateTeams();
      if (teamDuplicates.length > 0) {
        logger.info(`Found ${teamDuplicates.length} duplicate teams`);
        if (!dryRun) {
          const teamsRemoved = await this.removeDuplicateTeams(teamDuplicates);
          results.removed += teamsRemoved;
        }
      }

      // Remove duplicate players by hltvId
      const playerDuplicates = await this.findDuplicatePlayers();
      if (playerDuplicates.length > 0) {
        logger.info(`Found ${playerDuplicates.length} duplicate players`);
        if (!dryRun) {
          const playersRemoved = await this.removeDuplicatePlayers(playerDuplicates);
          results.removed += playersRemoved;
        }
      }

      this.maintenanceStats.duplicatesRemoved += results.removed;
      return results;
    } catch (error) {
      logger.error('Error removing duplicates', { error: error.message });
      results.errors.push(`Duplicate removal error: ${error.message}`);
      return results;
    }
  }

  /**
   * Find duplicate matches by hltvId
   * @returns {Promise<Array>} Array of duplicate match groups
   */
  async findDuplicateMatches() {
    const pipeline = [
      {
        $group: {
          _id: '$hltvId',
          count: { $sum: 1 },
          docs: { $push: { id: '$_id', createdAt: '$metadata.createdAt' } },
        },
      },
      {
        $match: { count: { $gt: 1 } },
      },
    ];

    return await CS2Match.aggregate(pipeline);
  }

  /**
   * Find duplicate teams by hltvId
   * @returns {Promise<Array>} Array of duplicate team groups
   */
  async findDuplicateTeams() {
    const pipeline = [
      {
        $group: {
          _id: '$hltvId',
          count: { $sum: 1 },
          docs: { $push: { id: '$_id', createdAt: '$metadata.createdAt' } },
        },
      },
      {
        $match: { count: { $gt: 1 } },
      },
    ];

    return await CS2Team.aggregate(pipeline);
  }

  /**
   * Find duplicate players by hltvId
   * @returns {Promise<Array>} Array of duplicate player groups
   */
  async findDuplicatePlayers() {
    const pipeline = [
      {
        $group: {
          _id: '$hltvId',
          count: { $sum: 1 },
          docs: { $push: { id: '$_id', createdAt: '$metadata.createdAt' } },
        },
      },
      {
        $match: { count: { $gt: 1 } },
      },
    ];

    return await CS2Player.aggregate(pipeline);
  }

  /**
   * Remove duplicate matches, keeping the most recent one
   * @param {Array} duplicates - Array of duplicate match groups
   * @returns {Promise<number>} Number of matches removed
   */
  async removeDuplicateMatches(duplicates) {
    return this._removeDuplicateEntities(duplicates, {
      model: CS2Match,
      entityType: 'matches',
      referenceUpdates: [], // Matches don't have references to update
    });
  }

  /**
   * Remove duplicate teams, keeping the most recent one
   * @param {Array} duplicates - Array of duplicate team groups
   * @returns {Promise<number>} Number of teams removed
   */
  async removeDuplicateTeams(duplicates) {
    return this._removeDuplicateEntities(duplicates, {
      model: CS2Team,
      entityType: 'teams',
      referenceUpdates: [
        {
          model: CS2Match,
          queryField: 'teams.team',
          updateField: 'teams.$.team',
        },
      ],
    });
  }

  /**
   * Remove duplicate players, keeping the most recent one
   * @param {Array} duplicates - Array of duplicate player groups
   * @returns {Promise<number>} Number of players removed
   */
  async removeDuplicatePlayers(duplicates) {
    return this._removeDuplicateEntities(duplicates, {
      model: CS2Player,
      entityType: 'players',
      referenceUpdates: [
        {
          model: CS2Team,
          queryField: 'players.player',
          updateField: 'players.$.player',
        },
      ],
    });
  }

  /**
   * Generic method to remove duplicate entities
   * @private
   * @param {Array} duplicates - Array of duplicate groups
   * @param {Object} config - Configuration for entity removal
   * @returns {Promise<number>} Number of entities removed
   */
  async _removeDuplicateEntities(duplicates, config) {
    let removed = 0;
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        for (const duplicate of duplicates) {
          const sortedDocs = duplicate.docs.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
          );
          const toRemove = sortedDocs.slice(1);
          const keepDoc = sortedDocs[0];

          for (const doc of toRemove) {
            // Update references before removing
            for (const refUpdate of config.referenceUpdates) {
              const query = { [refUpdate.queryField]: doc.id };
              const update = { $set: { [refUpdate.updateField]: keepDoc.id } };

              await refUpdate.model.updateMany(query, update, { session });
            }

            await config.model.findByIdAndDelete(doc.id, { session });
            removed++;
          }
        }
      });
    } catch (error) {
      logger.error(`Error removing duplicate ${config.entityType}`, { error: error.message });
      throw error;
    } finally {
      await session.endSession();
    }

    return removed;
  }

  /**
   * Check and fix data consistency issues
   * @param {Object} options - Consistency check options
   * @returns {Promise<Object>} Consistency check results
   */
  async checkAndFixConsistency(options = {}) {
    const { dryRun = false } = options;
    const results = { fixed: 0, errors: [] };

    try {
      // Check for orphaned references
      const orphanedRefs = await this.findOrphanedReferences();
      if (orphanedRefs.matches.length > 0 || orphanedRefs.teams.length > 0) {
        logger.info('Found orphaned references', {
          matches: orphanedRefs.matches.length,
          teams: orphanedRefs.teams.length,
        });
        if (!dryRun) {
          const fixed = await this.fixOrphanedReferences(orphanedRefs);
          results.fixed += fixed;
        }
      }

      // Check for invalid match statuses
      const invalidMatches = await this.findInvalidMatchStatuses();
      if (invalidMatches.length > 0) {
        logger.info(`Found ${invalidMatches.length} matches with invalid statuses`);
        if (!dryRun) {
          const fixed = await this.fixInvalidMatchStatuses(invalidMatches);
          results.fixed += fixed;
        }
      }

      // Check for missing metadata
      const missingMetadata = await this.findMissingMetadata();
      if (
        missingMetadata.matches.length > 0 ||
        missingMetadata.teams.length > 0 ||
        missingMetadata.players.length > 0
      ) {
        logger.info('Found records with missing metadata', {
          matches: missingMetadata.matches.length,
          teams: missingMetadata.teams.length,
          players: missingMetadata.players.length,
        });
        if (!dryRun) {
          const fixed = await this.fixMissingMetadata(missingMetadata);
          results.fixed += fixed;
        }
      }

      this.maintenanceStats.inconsistenciesFixed += results.fixed;
      return results;
    } catch (error) {
      logger.error('Error checking consistency', { error: error.message });
      results.errors.push(`Consistency check error: ${error.message}`);
      return results;
    }
  }

  /**
   * Find orphaned references in the database
   * @returns {Promise<Object>} Orphaned references
   */
  async findOrphanedReferences() {
    const orphaned = { matches: [], teams: [] };

    // Find matches with non-existent team references
    const matchesWithOrphanedTeams = await CS2Match.aggregate([
      {
        $lookup: {
          from: 'cs2teams',
          localField: 'teams.team',
          foreignField: '_id',
          as: 'teamData',
        },
      },
      {
        $match: {
          $expr: {
            $lt: [{ $size: '$teamData' }, { $size: '$teams' }],
          },
        },
      },
      {
        $project: { _id: 1, hltvId: 1, teams: 1 },
      },
    ]);

    orphaned.matches = matchesWithOrphanedTeams;

    // Find teams with non-existent player references
    const teamsWithOrphanedPlayers = await CS2Team.aggregate([
      {
        $lookup: {
          from: 'cs2players',
          localField: 'players.player',
          foreignField: '_id',
          as: 'playerData',
        },
      },
      {
        $match: {
          $expr: {
            $lt: [{ $size: '$playerData' }, { $size: '$players' }],
          },
        },
      },
      {
        $project: { _id: 1, hltvId: 1, players: 1 },
      },
    ]);

    orphaned.teams = teamsWithOrphanedPlayers;

    return orphaned;
  }

  /**
   * Fix orphaned references by removing invalid references
   * @param {Object} orphanedRefs - Orphaned references to fix
   * @returns {Promise<number>} Number of fixes applied
   */
  async fixOrphanedReferences(orphanedRefs) {
    let fixed = 0;
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // Fix matches with orphaned team references
        for (const match of orphanedRefs.matches) {
          const validTeamIds = await CS2Team.find({
            _id: { $in: match.teams.map((t) => t.team) },
          })
            .select('_id')
            .lean();

          const validIds = validTeamIds.map((t) => t._id.toString());
          const validTeams = match.teams.filter((t) => validIds.includes(t.team.toString()));

          if (validTeams.length !== match.teams.length) {
            await CS2Match.findByIdAndUpdate(
              match._id,
              { $set: { teams: validTeams } },
              { session },
            );
            fixed++;
          }
        }

        // Fix teams with orphaned player references
        for (const team of orphanedRefs.teams) {
          const validPlayerIds = await CS2Player.find({
            _id: { $in: team.players.map((p) => p.player) },
          })
            .select('_id')
            .lean();

          const validIds = validPlayerIds.map((p) => p._id.toString());
          const validPlayers = team.players.filter((p) => validIds.includes(p.player.toString()));

          if (validPlayers.length !== team.players.length) {
            await CS2Team.findByIdAndUpdate(
              team._id,
              { $set: { players: validPlayers } },
              { session },
            );
            fixed++;
          }
        }
      });
    } catch (error) {
      logger.error('Error fixing orphaned references', { error: error.message });
      throw error;
    } finally {
      await session.endSession();
    }

    return fixed;
  }

  /**
   * Find matches with invalid statuses
   * @returns {Promise<Array>} Array of matches with invalid statuses
   */
  async findInvalidMatchStatuses() {
    const validStatuses = ['upcoming', 'live', 'finished'];
    return await CS2Match.find({
      status: { $nin: validStatuses },
    })
      .select('_id hltvId status')
      .lean();
  }

  /**
   * Fix invalid match statuses
   * @param {Array} invalidMatches - Matches with invalid statuses
   * @returns {Promise<number>} Number of matches fixed
   */
  async fixInvalidMatchStatuses(invalidMatches) {
    let fixed = 0;

    for (const match of invalidMatches) {
      // Determine correct status based on match data
      let correctStatus = 'finished'; // Default assumption

      if (match.date && new Date(match.date) > new Date()) {
        correctStatus = 'upcoming';
      }

      await CS2Match.findByIdAndUpdate(match._id, {
        $set: {
          status: correctStatus,
          'metadata.lastUpdated': new Date(),
        },
      });
      fixed++;
    }

    return fixed;
  }

  /**
   * Find records with missing metadata
   * @returns {Promise<Object>} Records with missing metadata
   */
  async findMissingMetadata() {
    const missing = { matches: [], teams: [], players: [] };

    // Find matches without metadata
    missing.matches = await CS2Match.find({
      $or: [
        { metadata: { $exists: false } },
        { 'metadata.createdAt': { $exists: false } },
        { 'metadata.lastUpdated': { $exists: false } },
      ],
    })
      .select('_id hltvId')
      .lean();

    // Find teams without metadata
    missing.teams = await CS2Team.find({
      $or: [
        { metadata: { $exists: false } },
        { 'metadata.createdAt': { $exists: false } },
        { 'metadata.lastUpdated': { $exists: false } },
      ],
    })
      .select('_id hltvId')
      .lean();

    // Find players without metadata
    missing.players = await CS2Player.find({
      $or: [
        { metadata: { $exists: false } },
        { 'metadata.createdAt': { $exists: false } },
        { 'metadata.lastUpdated': { $exists: false } },
      ],
    })
      .select('_id hltvId')
      .lean();

    return missing;
  }

  /**
   * Fix missing metadata by adding default values
   * @param {Object} missingMetadata - Records with missing metadata
   * @returns {Promise<number>} Number of records fixed
   */
  async fixMissingMetadata(missingMetadata) {
    let fixed = 0;
    const now = new Date();

    // Fix matches
    for (const match of missingMetadata.matches) {
      await CS2Match.findByIdAndUpdate(match._id, {
        $set: {
          'metadata.createdAt': now,
          'metadata.lastUpdated': now,
          'metadata.isActive': true,
        },
      });
      fixed++;
    }

    // Fix teams
    for (const team of missingMetadata.teams) {
      await CS2Team.findByIdAndUpdate(team._id, {
        $set: {
          'metadata.createdAt': now,
          'metadata.lastUpdated': now,
          'metadata.isActive': true,
        },
      });
      fixed++;
    }

    // Fix players
    for (const player of missingMetadata.players) {
      await CS2Player.findByIdAndUpdate(player._id, {
        $set: {
          'metadata.createdAt': now,
          'metadata.lastUpdated': now,
          'metadata.isActive': true,
        },
      });
      fixed++;
    }

    return fixed;
  }

  /**
   * Archive old match data to reduce database size
   * @param {Object} options - Archival options
   * @returns {Promise<Object>} Archival results
   */
  async archiveOldData(options = {}) {
    const {
      dryRun = false,
      archiveAfterDays = 365, // Archive matches older than 1 year
      deleteAfterDays = 730, // Delete archived matches older than 2 years
    } = options;

    const results = { archived: 0, errors: [] };

    try {
      const archiveDate = new Date();
      archiveDate.setDate(archiveDate.getDate() - archiveAfterDays);

      const deleteDate = new Date();
      deleteDate.setDate(deleteDate.getDate() - deleteAfterDays);

      // Find old matches to archive
      const oldMatches = await CS2Match.find({
        date: { $lt: archiveDate },
        status: 'finished',
        'metadata.archived': { $ne: true },
      })
        .select('_id hltvId date')
        .lean();

      logger.info(`Found ${oldMatches.length} matches to archive`);

      if (!dryRun && oldMatches.length > 0) {
        // Mark matches as archived
        await CS2Match.updateMany(
          { _id: { $in: oldMatches.map((m) => m._id) } },
          {
            $set: {
              'metadata.archived': true,
              'metadata.archivedAt': new Date(),
            },
          },
        );
        results.archived += oldMatches.length;
      }

      // Find very old matches to delete
      const veryOldMatches = await CS2Match.find({
        date: { $lt: deleteDate },
        'metadata.archived': true,
      })
        .select('_id hltvId')
        .lean();

      logger.info(`Found ${veryOldMatches.length} matches to delete`);

      if (!dryRun && veryOldMatches.length > 0) {
        await CS2Match.deleteMany({
          _id: { $in: veryOldMatches.map((m) => m._id) },
        });
        results.archived += veryOldMatches.length; // Count deletions as archival
      }

      this.maintenanceStats.recordsArchived += results.archived;
      return results;
    } catch (error) {
      logger.error('Error archiving old data', { error: error.message });
      results.errors.push(`Archival error: ${error.message}`);
      return results;
    }
  }

  /**
   * Optimize database indexes for better performance
   * @param {Object} options - Optimization options
   * @returns {Promise<Object>} Optimization results
   */
  async optimizeIndexes(options = {}) {
    const { dryRun = false } = options;
    const results = { optimized: 0, errors: [] };

    try {
      const collections = [
        { model: CS2Match, name: 'cs2matches' },
        { model: CS2Team, name: 'cs2teams' },
        { model: CS2Player, name: 'cs2players' },
      ];

      for (const collection of collections) {
        if (!dryRun) {
          // Rebuild indexes
          await collection.model.collection.reIndex();
          results.optimized++;

          // Get index statistics
          const indexStats = await collection.model.collection.indexStats();
          logger.info(`Index statistics for ${collection.name}`, {
            indexes: indexStats.length,
          });
        }
      }

      // Analyze query performance and suggest new indexes
      const suggestions = await this.analyzeQueryPerformance();
      if (suggestions.length > 0) {
        logger.info('Index optimization suggestions', { suggestions });
      }

      this.maintenanceStats.indexesOptimized += results.optimized;
      return results;
    } catch (error) {
      logger.error('Error optimizing indexes', { error: error.message });
      results.errors.push(`Index optimization error: ${error.message}`);
      return results;
    }
  }

  /**
   * Analyze query performance and suggest index optimizations
   * @returns {Promise<Array>} Array of optimization suggestions
   */
  async analyzeQueryPerformance() {
    const suggestions = [];

    try {
      // Check for slow queries in MongoDB profiler (if enabled)
      const db = mongoose.connection.db;

      // Analyze common query patterns
      const commonQueries = [
        { collection: 'cs2matches', field: 'hltvId', type: 'single' },
        { collection: 'cs2matches', field: 'date', type: 'range' },
        { collection: 'cs2matches', field: 'teams.team', type: 'single' },
        { collection: 'cs2teams', field: 'hltvId', type: 'single' },
        { collection: 'cs2teams', field: 'name', type: 'text' },
        { collection: 'cs2players', field: 'hltvId', type: 'single' },
        { collection: 'cs2players', field: 'nickname', type: 'text' },
      ];

      // Check if recommended indexes exist
      for (const query of commonQueries) {
        const collection = db.collection(query.collection);
        const indexes = await collection.indexes();
        const hasIndex = indexes.some((index) => index.key[query.field]);

        if (!hasIndex) {
          suggestions.push({
            collection: query.collection,
            field: query.field,
            type: query.type,
            recommendation: `Create index on ${query.field} for better query performance`,
          });
        }
      }
    } catch (error) {
      logger.error('Error analyzing query performance', { error: error.message });
    }

    return suggestions;
  }

  /**
   * Get maintenance statistics
   * @returns {Object} Current maintenance statistics
   */
  getMaintenanceStats() {
    return { ...this.maintenanceStats };
  }

  /**
   * Reset maintenance statistics
   */
  resetMaintenanceStats() {
    this.maintenanceStats = {
      duplicatesRemoved: 0,
      inconsistenciesFixed: 0,
      recordsArchived: 0,
      indexesOptimized: 0,
      lastMaintenanceRun: null,
    };
  }

  /**
   * Get database health metrics
   * @returns {Promise<Object>} Database health information
   */
  async getDatabaseHealth() {
    try {
      const db = mongoose.connection.db;
      const stats = await db.stats();

      // Get collection statistics
      const collections = ['cs2matches', 'cs2teams', 'cs2players'];
      const collectionStats = {};

      for (const collectionName of collections) {
        try {
          const collection = db.collection(collectionName);
          const collStats = await collection.stats();
          collectionStats[collectionName] = {
            count: collStats.count,
            size: collStats.size,
            avgObjSize: collStats.avgObjSize,
            indexCount: collStats.nindexes,
            indexSize: collStats.totalIndexSize,
          };
        } catch (error) {
          // Collection might not exist yet
          collectionStats[collectionName] = { error: 'Collection not found' };
        }
      }

      return {
        database: {
          name: stats.db,
          collections: stats.collections,
          objects: stats.objects,
          dataSize: stats.dataSize,
          storageSize: stats.storageSize,
          indexSize: stats.indexSize,
        },
        collections: collectionStats,
        maintenance: this.maintenanceStats,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Error getting database health', { error: error.message });
      throw error;
    }
  }
}

module.exports = DataMaintenanceService;
