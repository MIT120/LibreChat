/**
 * Unit tests for CS2VectorStorage
 */

const CS2VectorStorage = require('./CS2VectorStorage');
const CS2VectorService = require('./CS2VectorService');
const { CS2VectorError } = require('./errors');
const axios = require('axios');

// Mock dependencies
jest.mock('./CS2VectorService');
jest.mock('axios');
jest.mock('~/server/services/AuthService', () => ({
  generateShortLivedToken: jest.fn(() => 'mock-jwt-token'),
}));
jest.mock('@librechat/api', () => ({
  logAxiosError: jest.fn(),
}));

describe('CS2VectorStorage', () => {
  let vectorStorage;
  let mockVectorService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock CS2VectorService
    mockVectorService = {
      initialize: jest.fn().mockResolvedValue(),
      generateMatchEmbedding: jest.fn(),
      generateTeamEmbedding: jest.fn(),
      generatePlayerEmbedding: jest.fn(),
      storeEmbedding: jest.fn(),
      searchSimilar: jest.fn(),
      calculateSimilarity: jest.fn(),
      getStats: jest.fn(() => ({ model: 'test-model' })),
      cleanup: jest.fn(),
    };

    CS2VectorService.mockImplementation(() => mockVectorService);

    // Set up environment
    process.env.RAG_API_URL = 'http://test-rag-api';

    vectorStorage = new CS2VectorStorage({
      similarityThreshold: 0.8,
      maxResults: 50,
    });
  });

  afterEach(() => {
    delete process.env.RAG_API_URL;
  });

  describe('Constructor and Initialization', () => {
    test('should create instance with default config', () => {
      const storage = new CS2VectorStorage();
      expect(storage.config.indexName).toBe('cs2_vectors');
      expect(storage.config.similarityThreshold).toBe(0.7);
      expect(storage.entityTypes).toBeDefined();
    });

    test('should merge custom options with default config', () => {
      expect(vectorStorage.config.similarityThreshold).toBe(0.8);
      expect(vectorStorage.config.maxResults).toBe(50);
    });

    test('should initialize vector service', async () => {
      await vectorStorage.initialize({ apiKey: 'test-key' });

      expect(mockVectorService.initialize).toHaveBeenCalledWith({ apiKey: 'test-key' });
    });
  });

  describe('Match Vector Storage', () => {
    beforeEach(async () => {
      await vectorStorage.initialize();
    });

    test('should store match vector successfully', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      const mockResult = { success: true, id: 'vector-123' };

      mockVectorService.generateMatchEmbedding.mockResolvedValue(mockEmbedding);
      mockVectorService.storeEmbedding.mockResolvedValue(mockResult);

      const matchData = {
        hltvId: '123',
        teams: ['Team A', 'Team B'],
        tournament: 'Test Tournament',
        status: 'finished',
        date: new Date('2024-01-15'),
        maps: [{ name: 'Dust2' }],
      };

      const result = await vectorStorage.storeMatchVector({
        userId: 'user-123',
        matchData,
        metadata: { custom: 'data' },
      });

      expect(result).toEqual(mockResult);
      expect(mockVectorService.generateMatchEmbedding).toHaveBeenCalledWith(matchData);
      expect(mockVectorService.storeEmbedding).toHaveBeenCalledWith({
        userId: 'user-123',
        entityId: '123',
        entityType: 'cs2_match',
        embedding: mockEmbedding,
        metadata: expect.objectContaining({
          custom: 'data',
          entityType: 'cs2_match',
          hltvId: '123',
          teams: ['Team A', 'Team B'],
          tournament: 'Test Tournament',
          status: 'finished',
          maps: ['Dust2'],
        }),
      });
    });

    test('should handle match vector storage errors', async () => {
      mockVectorService.generateMatchEmbedding.mockRejectedValue(new Error('Embedding failed'));

      const matchData = { hltvId: '123', teams: ['Team A', 'Team B'] };

      await expect(
        vectorStorage.storeMatchVector({
          userId: 'user-123',
          matchData,
        }),
      ).rejects.toThrow(CS2VectorError);
    });
  });

  describe('Team Vector Storage', () => {
    beforeEach(async () => {
      await vectorStorage.initialize();
    });

    test('should store team vector successfully', async () => {
      const mockEmbedding = [0.4, 0.5, 0.6];
      const mockResult = { success: true, id: 'vector-456' };

      mockVectorService.generateTeamEmbedding.mockResolvedValue(mockEmbedding);
      mockVectorService.storeEmbedding.mockResolvedValue(mockResult);

      const teamData = {
        hltvId: '456',
        name: 'Test Team',
        ranking: 5,
        players: [{ name: 'Player1' }, { name: 'Player2' }],
        region: 'Europe',
      };

      const result = await vectorStorage.storeTeamVector({
        userId: 'user-123',
        teamData,
      });

      expect(result).toEqual(mockResult);
      expect(mockVectorService.generateTeamEmbedding).toHaveBeenCalledWith(teamData);
      expect(mockVectorService.storeEmbedding).toHaveBeenCalledWith({
        userId: 'user-123',
        entityId: '456',
        entityType: 'cs2_team',
        embedding: mockEmbedding,
        metadata: expect.objectContaining({
          entityType: 'cs2_team',
          hltvId: '456',
          name: 'Test Team',
          ranking: 5,
          players: ['Player1', 'Player2'],
          region: 'Europe',
        }),
      });
    });

    test('should handle team vector storage errors', async () => {
      mockVectorService.generateTeamEmbedding.mockRejectedValue(new Error('Embedding failed'));

      const teamData = { name: 'Test Team' };

      await expect(
        vectorStorage.storeTeamVector({
          userId: 'user-123',
          teamData,
        }),
      ).rejects.toThrow(CS2VectorError);
    });
  });

  describe('Player Vector Storage', () => {
    beforeEach(async () => {
      await vectorStorage.initialize();
    });

    test('should store player vector successfully', async () => {
      const mockEmbedding = [0.7, 0.8, 0.9];
      const mockResult = { success: true, id: 'vector-789' };

      mockVectorService.generatePlayerEmbedding.mockResolvedValue(mockEmbedding);
      mockVectorService.storeEmbedding.mockResolvedValue(mockResult);

      const playerData = {
        hltvId: '789',
        name: 'TestPlayer',
        realName: 'Test Player',
        team: 'Test Team',
        country: 'USA',
        age: 25,
      };

      const result = await vectorStorage.storePlayerVector({
        userId: 'user-123',
        playerData,
      });

      expect(result).toEqual(mockResult);
      expect(mockVectorService.generatePlayerEmbedding).toHaveBeenCalledWith(playerData);
      expect(mockVectorService.storeEmbedding).toHaveBeenCalledWith({
        userId: 'user-123',
        entityId: '789',
        entityType: 'cs2_player',
        embedding: mockEmbedding,
        metadata: expect.objectContaining({
          entityType: 'cs2_player',
          hltvId: '789',
          name: 'TestPlayer',
          realName: 'Test Player',
          team: 'Test Team',
          country: 'USA',
          age: 25,
        }),
      });
    });

    test('should handle player vector storage errors', async () => {
      mockVectorService.generatePlayerEmbedding.mockRejectedValue(new Error('Embedding failed'));

      const playerData = { name: 'TestPlayer' };

      await expect(
        vectorStorage.storePlayerVector({
          userId: 'user-123',
          playerData,
        }),
      ).rejects.toThrow(CS2VectorError);
    });
  });

  describe('Similarity Search', () => {
    beforeEach(async () => {
      await vectorStorage.initialize();
    });

    test('should find similar matches successfully', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      const mockResults = [
        {
          entity_id: 'match-456',
          similarity: 0.95,
          metadata: {
            entityType: 'cs2_match',
            teams: ['Team C', 'Team D'],
            tournament: 'Test Tournament',
            date: '2024-01-16',
            status: 'finished',
          },
        },
      ];

      mockVectorService.generateMatchEmbedding.mockResolvedValue(mockEmbedding);
      mockVectorService.searchSimilar.mockResolvedValue(mockResults);
      mockVectorService.calculateSimilarity.mockReturnValue(0.95);

      const matchData = {
        teams: ['Team A', 'Team B'],
        tournament: 'Test Tournament',
        status: 'finished',
      };

      const result = await vectorStorage.findSimilarMatches({
        userId: 'user-123',
        matchData,
        limit: 5,
        threshold: 0.8,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('similarity', 0.95);
      expect(result[0]).toHaveProperty('matchContext');
      expect(result[0].matchContext.teams).toEqual(['Team C', 'Team D']);
    });

    test('should find similar teams successfully', async () => {
      const mockEmbedding = [0.4, 0.5, 0.6];
      const mockResults = [
        {
          entity_id: 'team-456',
          similarity: 0.87,
          metadata: {
            entityType: 'cs2_team',
            name: 'Similar Team',
            ranking: 6,
            players: ['Player3', 'Player4'],
            region: 'Europe',
          },
        },
      ];

      mockVectorService.generateTeamEmbedding.mockResolvedValue(mockEmbedding);
      mockVectorService.searchSimilar.mockResolvedValue(mockResults);
      mockVectorService.calculateSimilarity.mockReturnValue(0.87);

      const teamData = {
        name: 'Test Team',
        ranking: 5,
        region: 'Europe',
      };

      const result = await vectorStorage.findSimilarTeams({
        userId: 'user-123',
        teamData,
        limit: 5,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('similarity', 0.87);
      expect(result[0]).toHaveProperty('teamContext');
      expect(result[0].teamContext.name).toBe('Similar Team');
    });

    test('should find similar players successfully', async () => {
      const mockEmbedding = [0.7, 0.8, 0.9];
      const mockResults = [
        {
          entity_id: 'player-456',
          similarity: 0.92,
          metadata: {
            entityType: 'cs2_player',
            name: 'SimilarPlayer',
            realName: 'Similar Player',
            team: 'Another Team',
            country: 'Canada',
            age: 24,
          },
        },
      ];

      mockVectorService.generatePlayerEmbedding.mockResolvedValue(mockEmbedding);
      mockVectorService.searchSimilar.mockResolvedValue(mockResults);
      mockVectorService.calculateSimilarity.mockReturnValue(0.92);

      const playerData = {
        name: 'TestPlayer',
        team: 'Test Team',
        country: 'USA',
      };

      const result = await vectorStorage.findSimilarPlayers({
        userId: 'user-123',
        playerData,
        limit: 5,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('similarity', 0.92);
      expect(result[0]).toHaveProperty('playerContext');
      expect(result[0].playerContext.name).toBe('SimilarPlayer');
    });
  });

  describe('Metadata Search', () => {
    test('should search matches by teams', async () => {
      const mockResults = [
        {
          entity_id: 'match-123',
          metadata: {
            teams: ['Team A', 'Team B'],
            tournament: 'Test Tournament',
          },
        },
      ];

      axios.post.mockResolvedValue({ data: { results: mockResults } });

      const result = await vectorStorage.searchMatchesByTeams({
        userId: 'user-123',
        teamNames: ['Team A', 'Team B'],
      });

      expect(result).toEqual(mockResults);
      expect(axios.post).toHaveBeenCalledWith(
        'http://test-rag-api/search/metadata',
        {
          filters: {
            entityType: 'cs2_match',
            teams: { $in: ['Team A', 'Team B'] },
          },
          sort: {},
          limit: 100,
        },
        expect.any(Object),
      );
    });

    test('should search matches by tournament', async () => {
      const mockResults = [
        {
          entity_id: 'match-456',
          metadata: {
            tournament: 'IEM Katowice',
            teams: ['Team C', 'Team D'],
          },
        },
      ];

      axios.post.mockResolvedValue({ data: { results: mockResults } });

      const result = await vectorStorage.searchMatchesByTournament({
        userId: 'user-123',
        tournament: 'Katowice',
      });

      expect(result).toEqual(mockResults);
      expect(axios.post).toHaveBeenCalledWith(
        'http://test-rag-api/search/metadata',
        {
          filters: {
            entityType: 'cs2_match',
            tournament: { $regex: 'Katowice', $options: 'i' },
          },
          sort: {},
          limit: 100,
        },
        expect.any(Object),
      );
    });

    test('should handle metadata search errors', async () => {
      axios.post.mockRejectedValue(new Error('Search failed'));

      await expect(
        vectorStorage.searchMatchesByTeams({
          userId: 'user-123',
          teamNames: ['Team A'],
        }),
      ).rejects.toThrow(CS2VectorError);
    });

    test('should throw error when RAG_API_URL is not configured', async () => {
      delete process.env.RAG_API_URL;

      await expect(
        vectorStorage.searchByMetadata({
          userId: 'user-123',
          filters: {},
        }),
      ).rejects.toThrow('RAG_API_URL not configured');
    });
  });

  describe('Performance Trend Analysis', () => {
    test('should get team performance trend', async () => {
      const mockMatches = [
        {
          metadata: {
            teams: ['Test Team', 'Opponent A'],
            date: '2024-01-15',
            tournament: 'Tournament A',
            maps: ['Dust2'],
          },
        },
        {
          metadata: {
            teams: ['Test Team', 'Opponent B'],
            date: '2024-01-16',
            tournament: 'Tournament B',
            maps: ['Mirage'],
          },
        },
      ];

      axios.post.mockResolvedValue({ data: { results: mockMatches } });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const result = await vectorStorage.getTeamPerformanceTrend({
        userId: 'user-123',
        teamName: 'Test Team',
        startDate,
        endDate,
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('date', '2024-01-15');
      expect(result[0]).toHaveProperty('opponent', 'Opponent A');
      expect(result[0]).toHaveProperty('result');
      expect(['W', 'L']).toContain(result[0].result);
    });
  });

  describe('Filter Matching', () => {
    test('should match simple filters', () => {
      const metadata = {
        entityType: 'cs2_match',
        tournament: 'IEM Katowice',
        status: 'finished',
      };

      const filters = {
        entityType: 'cs2_match',
        status: 'finished',
      };

      expect(vectorStorage.matchesFilters(metadata, filters)).toBe(true);
    });

    test('should match $in filters', () => {
      const metadata = {
        teams: ['Team A', 'Team B'],
      };

      const filters = {
        teams: { $in: ['Team A'] },
      };

      expect(vectorStorage.matchesFilters(metadata, filters)).toBe(true);
    });

    test('should match regex filters', () => {
      const metadata = {
        tournament: 'IEM Katowice 2024',
      };

      const filters = {
        tournament: { $regex: 'katowice', $options: 'i' },
      };

      expect(vectorStorage.matchesFilters(metadata, filters)).toBe(true);
    });

    test('should not match when filter fails', () => {
      const metadata = {
        status: 'live',
      };

      const filters = {
        status: 'finished',
      };

      expect(vectorStorage.matchesFilters(metadata, filters)).toBe(false);
    });
  });

  describe('Context Extraction', () => {
    test('should extract match context correctly', () => {
      const metadata = {
        teams: ['Team A', 'Team B'],
        tournament: 'Test Tournament',
        date: '2024-01-15',
        maps: ['Dust2', 'Mirage'],
        status: 'finished',
        extra: 'ignored',
      };

      const context = vectorStorage.extractMatchContext(metadata);

      expect(context).toEqual({
        teams: ['Team A', 'Team B'],
        tournament: 'Test Tournament',
        date: '2024-01-15',
        maps: ['Dust2', 'Mirage'],
        status: 'finished',
      });
    });

    test('should extract team context correctly', () => {
      const metadata = {
        name: 'Test Team',
        ranking: 5,
        players: ['Player1', 'Player2'],
        region: 'Europe',
        extra: 'ignored',
      };

      const context = vectorStorage.extractTeamContext(metadata);

      expect(context).toEqual({
        name: 'Test Team',
        ranking: 5,
        players: ['Player1', 'Player2'],
        region: 'Europe',
      });
    });

    test('should extract player context correctly', () => {
      const metadata = {
        name: 'TestPlayer',
        realName: 'Test Player',
        team: 'Test Team',
        country: 'USA',
        age: 25,
        extra: 'ignored',
      };

      const context = vectorStorage.extractPlayerContext(metadata);

      expect(context).toEqual({
        name: 'TestPlayer',
        realName: 'Test Player',
        team: 'Test Team',
        country: 'USA',
        age: 25,
      });
    });
  });

  describe('Statistics and Cleanup', () => {
    test('should return correct statistics', () => {
      const stats = vectorStorage.getStats();

      expect(stats.entityTypes).toBeDefined();
      expect(stats.config).toBeDefined();
      expect(stats.vectorService).toEqual({ model: 'test-model' });
    });

    test('should cleanup resources', () => {
      vectorStorage.cleanup();
      expect(mockVectorService.cleanup).toHaveBeenCalled();
    });
  });
});
