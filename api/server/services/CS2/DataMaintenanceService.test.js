const DataMaintenanceService = require('./DataMaintenanceService');
const { CS2Match, CS2Team, CS2Player } = require('~/db/models');
const mongoose = require('mongoose');

// Mock the models
jest.mock('~/db/models', () => ({
  CS2Match: {
    aggregate: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findByIdAndDelete: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    collection: {
      reIndex: jest.fn(),
      indexStats: jest.fn(),
      indexes: jest.fn(),
      stats: jest.fn(),
    },
  },
  CS2Team: {
    aggregate: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateMany: jest.fn(),
    collection: {
      reIndex: jest.fn(),
      indexStats: jest.fn(),
      indexes: jest.fn(),
      stats: jest.fn(),
    },
  },
  CS2Player: {
    aggregate: jest.fn(),
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateMany: jest.fn(),
    collection: {
      reIndex: jest.fn(),
      indexStats: jest.fn(),
      indexes: jest.fn(),
      stats: jest.fn(),
    },
  },
}));

// Mock mongoose
jest.mock('mongoose', () => ({
  startSession: jest.fn(),
  connection: {
    db: {
      stats: jest.fn(),
      collection: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('~/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('DataMaintenanceService', () => {
  let service;
  let mockSession;

  beforeEach(() => {
    service = new DataMaintenanceService();

    // Mock session
    mockSession = {
      withTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    mongoose.startSession.mockResolvedValue(mockSession);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('runMaintenanceRoutine', () => {
    it('should run complete maintenance routine successfully', async () => {
      // Mock all sub-methods to return successful results
      service.removeDuplicates = jest.fn().mockResolvedValue({ removed: 5, errors: [] });
      service.checkAndFixConsistency = jest.fn().mockResolvedValue({ fixed: 3, errors: [] });
      service.archiveOldData = jest.fn().mockResolvedValue({ archived: 10, errors: [] });
      service.optimizeIndexes = jest.fn().mockResolvedValue({ optimized: 3, errors: [] });

      const result = await service.runMaintenanceRoutine();

      expect(result).toEqual({
        duplicatesRemoved: 5,
        inconsistenciesFixed: 3,
        recordsArchived: 10,
        indexesOptimized: 3,
        errors: [],
        duration: expect.any(Number),
      });

      expect(service.removeDuplicates).toHaveBeenCalledWith({ dryRun: false });
      expect(service.checkAndFixConsistency).toHaveBeenCalledWith({ dryRun: false });
      expect(service.archiveOldData).toHaveBeenCalledWith({ dryRun: false });
      expect(service.optimizeIndexes).toHaveBeenCalledWith({ dryRun: false });
    });

    it('should handle dry run mode', async () => {
      service.removeDuplicates = jest.fn().mockResolvedValue({ removed: 0, errors: [] });
      service.checkAndFixConsistency = jest.fn().mockResolvedValue({ fixed: 0, errors: [] });
      service.archiveOldData = jest.fn().mockResolvedValue({ archived: 0, errors: [] });
      service.optimizeIndexes = jest.fn().mockResolvedValue({ optimized: 0, errors: [] });

      expect(service.removeDuplicates).toHaveBeenCalledWith({ dryRun: true });
      expect(service.checkAndFixConsistency).toHaveBeenCalledWith({ dryRun: true });
      expect(service.archiveOldData).toHaveBeenCalledWith({ dryRun: true });
      expect(service.optimizeIndexes).toHaveBeenCalledWith({ dryRun: true });
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Test error');
      service.removeDuplicates = jest.fn().mockRejectedValue(error);

      const result = await service.runMaintenanceRoutine();

      expect(result.errors).toContain('Test error');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should allow selective maintenance operations', async () => {
      service.removeDuplicates = jest.fn().mockResolvedValue({ removed: 5, errors: [] });
      service.checkAndFixConsistency = jest.fn();
      service.archiveOldData = jest.fn();
      service.optimizeIndexes = jest.fn();

      await service.runMaintenanceRoutine({
        includeDuplicateRemoval: true,
        includeConsistencyCheck: false,
        includeArchival: false,
        includeIndexOptimization: false,
      });

      expect(service.removeDuplicates).toHaveBeenCalled();
      expect(service.checkAndFixConsistency).not.toHaveBeenCalled();
      expect(service.archiveOldData).not.toHaveBeenCalled();
      expect(service.optimizeIndexes).not.toHaveBeenCalled();
    });
  });

  describe('removeDuplicates', () => {
    it('should find and remove duplicate matches', async () => {
      const duplicateMatches = [
        {
          _id: 'match1',
          count: 2,
          docs: [
            { id: 'doc1', createdAt: '2024-01-01' },
            { id: 'doc2', createdAt: '2024-01-02' },
          ],
        },
      ];

      service.findDuplicateMatches = jest.fn().mockResolvedValue(duplicateMatches);
      service.findDuplicateTeams = jest.fn().mockResolvedValue([]);
      service.findDuplicatePlayers = jest.fn().mockResolvedValue([]);
      service.removeDuplicateMatches = jest.fn().mockResolvedValue(1);

      const result = await service.removeDuplicates();

      expect(result.removed).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(service.removeDuplicateMatches).toHaveBeenCalledWith(duplicateMatches);
    });

    it('should handle dry run mode', async () => {
      service.findDuplicateMatches = jest.fn().mockResolvedValue([{ _id: 'match1' }]);
      service.findDuplicateTeams = jest.fn().mockResolvedValue([]);
      service.findDuplicatePlayers = jest.fn().mockResolvedValue([]);
      service.removeDuplicateMatches = jest.fn();

      const result = await service.removeDuplicates({ dryRun: true });

      expect(result.removed).toBe(0);
      expect(service.removeDuplicateMatches).not.toHaveBeenCalled();
    });

    it('should handle errors during duplicate removal', async () => {
      const error = new Error('Database error');
      service.findDuplicateMatches = jest.fn().mockRejectedValue(error);

      const result = await service.removeDuplicates();

      expect(result.errors).toContain('Duplicate removal error: Database error');
    });
  });

  describe('findDuplicateMatches', () => {
    it('should find matches with duplicate hltvIds', async () => {
      const expectedPipeline = [
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

      const mockResult = [{ _id: 'match1', count: 2 }];
      CS2Match.aggregate.mockResolvedValue(mockResult);

      const result = await service.findDuplicateMatches();

      expect(CS2Match.aggregate).toHaveBeenCalledWith(expectedPipeline);
      expect(result).toEqual(mockResult);
    });
  });

  describe('removeDuplicateMatches', () => {
    it('should remove older duplicate matches', async () => {
      const duplicates = [
        {
          _id: 'match1',
          docs: [
            { id: 'doc1', createdAt: '2024-01-02T00:00:00Z' }, // Newer
            { id: 'doc2', createdAt: '2024-01-01T00:00:00Z' }, // Older
          ],
        },
      ];

      mockSession.withTransaction.mockImplementation(async (callback) => {
        await callback();
      });

      CS2Match.findByIdAndDelete.mockResolvedValue({});

      const result = await service.removeDuplicateMatches(duplicates);

      expect(result).toBe(1);
      expect(CS2Match.findByIdAndDelete).toHaveBeenCalledWith('doc2', { session: mockSession });
      expect(CS2Match.findByIdAndDelete).not.toHaveBeenCalledWith('doc1', expect.any(Object));
    });

    it('should handle transaction errors', async () => {
      const error = new Error('Transaction failed');
      mockSession.withTransaction.mockRejectedValue(error);

      const duplicates = [{ _id: 'match1', docs: [{ id: 'doc1' }] }];

      await expect(service.removeDuplicateMatches(duplicates)).rejects.toThrow(
        'Transaction failed',
      );
      expect(mockSession.endSession).toHaveBeenCalled();
    });
  });

  describe('checkAndFixConsistency', () => {
    it('should find and fix consistency issues', async () => {
      const orphanedRefs = { matches: [{ _id: 'match1' }], teams: [] };
      const invalidMatches = [{ _id: 'match2', status: 'invalid' }];
      const missingMetadata = { matches: [], teams: [], players: [] };

      service.findOrphanedReferences = jest.fn().mockResolvedValue(orphanedRefs);
      service.findInvalidMatchStatuses = jest.fn().mockResolvedValue(invalidMatches);
      service.findMissingMetadata = jest.fn().mockResolvedValue(missingMetadata);
      service.fixOrphanedReferences = jest.fn().mockResolvedValue(1);
      service.fixInvalidMatchStatuses = jest.fn().mockResolvedValue(1);
      service.fixMissingMetadata = jest.fn().mockResolvedValue(0);

      const result = await service.checkAndFixConsistency();

      expect(result.fixed).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle dry run mode for consistency checks', async () => {
      service.findOrphanedReferences = jest.fn().mockResolvedValue({ matches: [{}], teams: [] });
      service.findInvalidMatchStatuses = jest.fn().mockResolvedValue([{}]);
      service.findMissingMetadata = jest
        .fn()
        .mockResolvedValue({ matches: [], teams: [], players: [] });
      service.fixOrphanedReferences = jest.fn();
      service.fixInvalidMatchStatuses = jest.fn();
      service.fixMissingMetadata = jest.fn();

      const result = await service.checkAndFixConsistency({ dryRun: true });

      expect(result.fixed).toBe(0);
      expect(service.fixOrphanedReferences).not.toHaveBeenCalled();
      expect(service.fixInvalidMatchStatuses).not.toHaveBeenCalled();
      expect(service.fixMissingMetadata).not.toHaveBeenCalled();
    });
  });

  describe('findOrphanedReferences', () => {
    it('should find matches with orphaned team references', async () => {
      const mockMatches = [{ _id: 'match1', hltvId: 'match1', teams: [] }];
      const mockTeams = [];

      CS2Match.aggregate.mockResolvedValue(mockMatches);
      CS2Team.aggregate.mockResolvedValue(mockTeams);

      const result = await service.findOrphanedReferences();

      expect(result.matches).toEqual(mockMatches);
      expect(result.teams).toEqual(mockTeams);
    });
  });

  describe('archiveOldData', () => {
    it('should archive old matches', async () => {
      const oldMatches = [
        { _id: 'match1', hltvId: 'match1', date: '2023-01-01' },
        { _id: 'match2', hltvId: 'match2', date: '2023-01-02' },
      ];

      // Create a mock chain for the first find call (old matches to archive)
      const mockSelectChain1 = {
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(oldMatches),
        }),
      };

      // Create a mock chain for the second find call (very old matches to delete)
      const mockSelectChain2 = {
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      };

      CS2Match.find.mockReturnValueOnce(mockSelectChain1).mockReturnValueOnce(mockSelectChain2);

      CS2Match.updateMany.mockResolvedValue({ modifiedCount: 2 });
      CS2Match.deleteMany.mockResolvedValue({ deletedCount: 0 });

      const result = await service.archiveOldData();

      expect(result.archived).toBe(2);
      expect(CS2Match.updateMany).toHaveBeenCalledWith(
        { _id: { $in: ['match1', 'match2'] } },
        {
          $set: {
            'metadata.archived': true,
            'metadata.archivedAt': expect.any(Date),
          },
        },
      );
    });

    it('should delete very old archived matches', async () => {
      // Create mock chains for both find calls
      const mockSelectChain1 = {
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      };

      const veryOldMatches = [{ _id: 'match1', hltvId: 'match1' }];
      const mockSelectChain2 = {
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(veryOldMatches),
        }),
      };

      CS2Match.find.mockReturnValueOnce(mockSelectChain1).mockReturnValueOnce(mockSelectChain2);

      CS2Match.updateMany.mockResolvedValue({ modifiedCount: 0 });
      CS2Match.deleteMany.mockResolvedValue({ deletedCount: 1 });

      const result = await service.archiveOldData();

      expect(result.archived).toBe(1);
      expect(CS2Match.deleteMany).toHaveBeenCalledWith({
        _id: { $in: ['match1'] },
      });
    });

    it('should handle dry run mode for archival', async () => {
      const oldMatches = [{ _id: 'match1' }];
      CS2Match.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(oldMatches),
        }),
      });

      CS2Match.updateMany.mockResolvedValue({});
      CS2Match.deleteMany.mockResolvedValue({});

      const result = await service.archiveOldData({ dryRun: true });

      expect(result.archived).toBe(0);
      expect(CS2Match.updateMany).not.toHaveBeenCalled();
      expect(CS2Match.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('optimizeIndexes', () => {
    it('should optimize indexes for all collections', async () => {
      CS2Match.collection.reIndex.mockResolvedValue({});
      CS2Team.collection.reIndex.mockResolvedValue({});
      CS2Player.collection.reIndex.mockResolvedValue({});

      CS2Match.collection.indexStats.mockResolvedValue([]);
      CS2Team.collection.indexStats.mockResolvedValue([]);
      CS2Player.collection.indexStats.mockResolvedValue([]);

      service.analyzeQueryPerformance = jest.fn().mockResolvedValue([]);

      const result = await service.optimizeIndexes();

      expect(result.optimized).toBe(3);
      expect(CS2Match.collection.reIndex).toHaveBeenCalled();
      expect(CS2Team.collection.reIndex).toHaveBeenCalled();
      expect(CS2Player.collection.reIndex).toHaveBeenCalled();
    });

    it('should handle dry run mode for index optimization', async () => {
      service.analyzeQueryPerformance = jest.fn().mockResolvedValue([]);

      const result = await service.optimizeIndexes({ dryRun: true });

      expect(result.optimized).toBe(0);
      expect(CS2Match.collection.reIndex).not.toHaveBeenCalled();
    });

    it('should handle index optimization errors', async () => {
      const error = new Error('Index error');
      CS2Match.collection.reIndex.mockRejectedValue(error);

      const result = await service.optimizeIndexes();

      expect(result.errors).toContain('Index optimization error: Index error');
    });
  });

  describe('getDatabaseHealth', () => {
    it('should return database health metrics', async () => {
      const mockStats = {
        db: 'testdb',
        collections: 3,
        objects: 1000,
        dataSize: 1024000,
        storageSize: 2048000,
        indexSize: 512000,
      };

      const mockCollectionStats = {
        count: 100,
        size: 1024,
        avgObjSize: 10.24,
        nindexes: 3,
        totalIndexSize: 512,
      };

      mongoose.connection.db.stats.mockResolvedValue(mockStats);
      mongoose.connection.db.collection.mockReturnValue({
        stats: jest.fn().mockResolvedValue(mockCollectionStats),
      });

      const result = await service.getDatabaseHealth();

      expect(result.database).toEqual({
        name: 'testdb',
        collections: 3,
        objects: 1000,
        dataSize: 1024000,
        storageSize: 2048000,
        indexSize: 512000,
      });
      expect(result.collections).toHaveProperty('cs2matches');
      expect(result.collections).toHaveProperty('cs2teams');
      expect(result.collections).toHaveProperty('cs2players');
      expect(result.maintenance).toEqual(service.maintenanceStats);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle missing collections gracefully', async () => {
      const mockStats = { db: 'testdb' };
      mongoose.connection.db.stats.mockResolvedValue(mockStats);
      mongoose.connection.db.collection.mockReturnValue({
        stats: jest.fn().mockRejectedValue(new Error('Collection not found')),
      });

      const result = await service.getDatabaseHealth();

      expect(result.collections.cs2matches).toEqual({ error: 'Collection not found' });
    });
  });

  describe('getMaintenanceStats', () => {
    it('should return current maintenance statistics', () => {
      service.maintenanceStats.duplicatesRemoved = 10;
      service.maintenanceStats.inconsistenciesFixed = 5;

      const stats = service.getMaintenanceStats();

      expect(stats.duplicatesRemoved).toBe(10);
      expect(stats.inconsistenciesFixed).toBe(5);
    });
  });

  describe('resetMaintenanceStats', () => {
    it('should reset all maintenance statistics', () => {
      service.maintenanceStats.duplicatesRemoved = 10;
      service.maintenanceStats.inconsistenciesFixed = 5;

      service.resetMaintenanceStats();

      expect(service.maintenanceStats.duplicatesRemoved).toBe(0);
      expect(service.maintenanceStats.inconsistenciesFixed).toBe(0);
      expect(service.maintenanceStats.lastMaintenanceRun).toBeNull();
    });
  });
});
