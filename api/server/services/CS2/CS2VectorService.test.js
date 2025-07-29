/**
 * Unit tests for CS2VectorService
 */

const CS2VectorService = require('./CS2VectorService');
const { CS2VectorError } = require('./errors');
const axios = require('axios');

// Mock dependencies
jest.mock('openai');
jest.mock('axios');
jest.mock('../AuthService', () => ({
  generateShortLivedToken: jest.fn(() => 'mock-jwt-token'),
}));
jest.mock('@librechat/api', () => ({
  logAxiosError: jest.fn(),
}));

const OpenAI = require('openai');

describe('CS2VectorService', () => {
  let vectorService;
  let mockOpenAI;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock OpenAI client
    mockOpenAI = {
      embeddings: {
        create: jest.fn(),
      },
    };
    OpenAI.mockImplementation(() => mockOpenAI);

    // Set up environment
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.RAG_API_URL = 'http://test-rag-api';

    vectorService = new CS2VectorService({
      model: 'text-embedding-3-small',
      batchSize: 10,
    });
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.RAG_API_URL;
  });

  describe('Constructor and Initialization', () => {
    test('should create instance with default config', () => {
      const service = new CS2VectorService();
      expect(service.config).toBeDefined();
      expect(service.isInitialized).toBe(false);
      expect(service.openai).toBeNull();
    });

    test('should merge custom options with default config', () => {
      const service = new CS2VectorService({
        model: 'text-embedding-3-large',
        batchSize: 50,
      });
      expect(service.config.model).toBe('text-embedding-3-large');
      expect(service.config.batchSize).toBe(50);
    });

    test('should initialize OpenAI client successfully', async () => {
      await vectorService.initialize();

      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
      });
      expect(vectorService.isInitialized).toBe(true);
      expect(vectorService.openai).toBe(mockOpenAI);
    });

    test('should handle initialization with custom options', async () => {
      await vectorService.initialize({
        apiKey: 'custom-key',
        baseURL: 'https://custom-url',
      });

      expect(OpenAI).toHaveBeenCalledWith({
        apiKey: 'custom-key',
        baseURL: 'https://custom-url',
      });
    });

    test('should throw error when API key is missing', async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(vectorService.initialize()).rejects.toThrow(CS2VectorError);
      await expect(vectorService.initialize()).rejects.toThrow('OpenAI API key is required');
    });

    test('should not reinitialize if already initialized', async () => {
      await vectorService.initialize();
      const firstClient = vectorService.openai;

      await vectorService.initialize();
      expect(vectorService.openai).toBe(firstClient);
      expect(OpenAI).toHaveBeenCalledTimes(1);
    });

    test('should force reinitialize when requested', async () => {
      await vectorService.initialize();
      await vectorService.initialize({ force: true });

      expect(OpenAI).toHaveBeenCalledTimes(2);
    });
  });

  describe('Match Embedding Generation', () => {
    beforeEach(async () => {
      await vectorService.initialize();
    });

    test('should generate match embedding successfully', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const matchData = {
        hltvId: '123',
        teams: ['Team A', 'Team B'],
        tournament: 'Test Tournament',
        status: 'finished',
        date: new Date('2024-01-15'),
        maps: [{ name: 'Dust2', scores: [16, 12] }],
      };

      const result = await vectorService.generateMatchEmbedding(matchData);

      expect(result).toEqual(mockEmbedding);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: expect.stringContaining('Match: Team A vs Team B'),
        encoding_format: 'float',
      });
    });

    test('should handle match embedding generation errors', async () => {
      mockOpenAI.embeddings.create.mockRejectedValue(new Error('API Error'));

      const matchData = { hltvId: '123', teams: ['Team A', 'Team B'] };

      await expect(vectorService.generateMatchEmbedding(matchData)).rejects.toThrow(CS2VectorError);
    });

    test('should format match data correctly for embedding', () => {
      const matchData = {
        teams: ['Natus Vincere', 'Astralis'],
        tournament: 'IEM Katowice',
        status: 'finished',
        date: new Date('2024-01-15'),
        maps: [
          { name: 'Dust2', scores: [16, 12] },
          { name: 'Mirage', scores: [14, 16] },
        ],
        scores: ['2', '1'],
      };

      const formatted = vectorService.formatMatchForEmbedding(matchData);

      expect(formatted).toContain('Match: Natus Vincere vs Astralis');
      expect(formatted).toContain('Tournament: IEM Katowice');
      expect(formatted).toContain('Status: finished');
      expect(formatted).toContain('Maps: Dust2: 16-12, Mirage: 14-16');
      expect(formatted).toContain('Score: 2-1');
    });
  });

  describe('Team Embedding Generation', () => {
    beforeEach(async () => {
      await vectorService.initialize();
    });

    test('should generate team embedding successfully', async () => {
      const mockEmbedding = [0.4, 0.5, 0.6];
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const teamData = {
        name: 'Natus Vincere',
        ranking: 1,
        players: [{ name: 's1mple' }, { name: 'electronic' }],
        stats: { winRate: 75, mapsPlayed: 50 },
      };

      const result = await vectorService.generateTeamEmbedding(teamData);

      expect(result).toEqual(mockEmbedding);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: expect.stringContaining('Team: Natus Vincere'),
        encoding_format: 'float',
      });
    });

    test('should format team data correctly for embedding', () => {
      const teamData = {
        name: 'Astralis',
        ranking: 5,
        players: [{ name: 'device' }, { name: 'Xyp9x' }],
        stats: { winRate: 68, mapsPlayed: 42 },
        recentMatches: [
          { opponent: 'NAVI', result: 'W 2-1' },
          { opponent: 'G2', result: 'L 0-2' },
        ],
      };

      const formatted = vectorService.formatTeamForEmbedding(teamData);

      expect(formatted).toContain('Team: Astralis');
      expect(formatted).toContain('Ranking: 5');
      expect(formatted).toContain('Players: device, Xyp9x');
      expect(formatted).toContain('Stats: winRate: 68, mapsPlayed: 42');
      expect(formatted).toContain('Recent form: vs NAVI: W 2-1, vs G2: L 0-2');
    });
  });

  describe('Player Embedding Generation', () => {
    beforeEach(async () => {
      await vectorService.initialize();
    });

    test('should generate player embedding successfully', async () => {
      const mockEmbedding = [0.7, 0.8, 0.9];
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
      });

      const playerData = {
        name: 's1mple',
        realName: 'Oleksandr Kostyliev',
        age: 26,
        country: 'Ukraine',
        team: 'Natus Vincere',
        stats: { rating: 1.25, adr: 85.5 },
      };

      const result = await vectorService.generatePlayerEmbedding(playerData);

      expect(result).toEqual(mockEmbedding);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: expect.stringContaining('Player: s1mple'),
        encoding_format: 'float',
      });
    });

    test('should format player data correctly for embedding', () => {
      const playerData = {
        name: 'ZywOo',
        realName: 'Mathieu Herbaut',
        age: 24,
        country: 'France',
        team: 'G2 Esports',
        stats: { rating: 1.3, adr: 88.2, kdRatio: 1.35 },
        achievements: [
          { title: 'HLTV #1 Player', date: '2023' },
          { title: 'Major Champion', date: '2023' },
        ],
      };

      const formatted = vectorService.formatPlayerForEmbedding(playerData);

      expect(formatted).toContain('Player: ZywOo');
      expect(formatted).toContain('Real name: Mathieu Herbaut');
      expect(formatted).toContain('Age: 24');
      expect(formatted).toContain('Country: France');
      expect(formatted).toContain('Team: G2 Esports');
      expect(formatted).toContain('Stats: rating: 1.3, adr: 88.2, kdRatio: 1.35');
      expect(formatted).toContain('Achievements: HLTV #1 Player (2023), Major Champion (2023)');
    });
  });

  describe('Batch Embedding Generation', () => {
    beforeEach(async () => {
      await vectorService.initialize();
    });

    test('should generate batch embeddings successfully', async () => {
      const mockEmbeddings = [
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ];
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: mockEmbeddings.map((embedding) => ({ embedding })),
      });

      const matchData = [
        { hltvId: '123', teams: ['Team A', 'Team B'] },
        { hltvId: '456', teams: ['Team C', 'Team D'] },
      ];

      const result = await vectorService.generateBatchEmbeddings(matchData, 'match');

      expect(result).toEqual(mockEmbeddings);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(1);
    });

    test('should handle large batches by splitting them', async () => {
      vectorService.config.batchSize = 2;

      const mockEmbeddings = [
        [0.1, 0.2],
        [0.3, 0.4],
        [0.5, 0.6],
      ];

      mockOpenAI.embeddings.create
        .mockResolvedValueOnce({
          data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }],
        })
        .mockResolvedValueOnce({
          data: [{ embedding: [0.5, 0.6] }],
        });

      const matchData = [
        { hltvId: '123', teams: ['A', 'B'] },
        { hltvId: '456', teams: ['C', 'D'] },
        { hltvId: '789', teams: ['E', 'F'] },
      ];

      const result = await vectorService.generateBatchEmbeddings(matchData, 'match');

      expect(result).toEqual(mockEmbeddings);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(2);
    });

    test('should return empty array for empty input', async () => {
      const result = await vectorService.generateBatchEmbeddings([], 'match');
      expect(result).toEqual([]);
      expect(mockOpenAI.embeddings.create).not.toHaveBeenCalled();
    });
  });

  describe('Vector Storage', () => {
    test('should store embedding successfully', async () => {
      const mockResponse = { success: true, id: 'vector-123' };
      axios.post.mockResolvedValue({ data: mockResponse });

      const params = {
        userId: 'user-123',
        entityId: 'match-456',
        entityType: 'match',
        embedding: [0.1, 0.2, 0.3],
        metadata: { tournament: 'Test' },
      };

      const result = await vectorService.storeEmbedding(params);

      expect(result).toEqual(mockResponse);
      expect(axios.post).toHaveBeenCalledWith(
        'http://test-rag-api/embeddings',
        {
          entity_id: 'match-456',
          entity_type: 'cs2_match',
          embedding: [0.1, 0.2, 0.3],
          metadata: {
            tournament: 'Test',
            source: 'cs2_scraper',
            timestamp: expect.any(String),
          },
        },
        {
          headers: {
            Authorization: 'Bearer mock-jwt-token',
            'Content-Type': 'application/json',
            accept: 'application/json',
          },
        },
      );
    });

    test('should throw error when RAG_API_URL is not configured', async () => {
      delete process.env.RAG_API_URL;

      await expect(
        vectorService.storeEmbedding({
          userId: 'user-123',
          entityId: 'match-456',
          entityType: 'match',
          embedding: [0.1, 0.2, 0.3],
        }),
      ).rejects.toThrow('RAG_API_URL not configured');
    });

    test('should handle storage errors', async () => {
      axios.post.mockRejectedValue(new Error('Storage failed'));

      await expect(
        vectorService.storeEmbedding({
          userId: 'user-123',
          entityId: 'match-456',
          entityType: 'match',
          embedding: [0.1, 0.2, 0.3],
        }),
      ).rejects.toThrow(CS2VectorError);
    });
  });

  describe('Vector Search', () => {
    test('should search similar entities successfully', async () => {
      const mockResults = [
        { entity_id: 'match-123', similarity: 0.95 },
        { entity_id: 'match-456', similarity: 0.87 },
      ];
      axios.post.mockResolvedValue({ data: { results: mockResults } });

      const params = {
        userId: 'user-123',
        queryEmbedding: [0.1, 0.2, 0.3],
        entityType: 'match',
        limit: 5,
        threshold: 0.8,
      };

      const result = await vectorService.searchSimilar(params);

      expect(result).toEqual(mockResults);
      expect(axios.post).toHaveBeenCalledWith(
        'http://test-rag-api/search',
        {
          embedding: [0.1, 0.2, 0.3],
          entity_type: 'cs2_match',
          limit: 5,
          threshold: 0.8,
        },
        {
          headers: {
            Authorization: 'Bearer mock-jwt-token',
            'Content-Type': 'application/json',
            accept: 'application/json',
          },
        },
      );
    });

    test('should handle search errors', async () => {
      axios.post.mockRejectedValue(new Error('Search failed'));

      await expect(
        vectorService.searchSimilar({
          userId: 'user-123',
          queryEmbedding: [0.1, 0.2, 0.3],
          entityType: 'match',
        }),
      ).rejects.toThrow(CS2VectorError);
    });
  });

  describe('Similarity Calculation', () => {
    test('should calculate cosine similarity correctly', () => {
      const vectorA = [1, 0, 0];
      const vectorB = [0, 1, 0];
      const similarity = vectorService.calculateSimilarity(vectorA, vectorB);
      expect(similarity).toBe(0);
    });

    test('should calculate similarity for identical vectors', () => {
      const vectorA = [1, 2, 3];
      const vectorB = [1, 2, 3];
      const similarity = vectorService.calculateSimilarity(vectorA, vectorB);
      expect(similarity).toBeCloseTo(1, 5);
    });

    test('should throw error for vectors with different dimensions', () => {
      const vectorA = [1, 2, 3];
      const vectorB = [1, 2];

      expect(() => vectorService.calculateSimilarity(vectorA, vectorB)).toThrow(
        'Vectors must have the same dimensions',
      );
    });

    test('should handle zero vectors', () => {
      const vectorA = [0, 0, 0];
      const vectorB = [1, 2, 3];
      const similarity = vectorService.calculateSimilarity(vectorA, vectorB);
      expect(similarity).toBe(0);
    });
  });

  describe('Statistics and Cleanup', () => {
    test('should return correct statistics', async () => {
      await vectorService.initialize();
      const stats = vectorService.getStats();

      expect(stats.isInitialized).toBe(true);
      expect(stats.model).toBe('text-embedding-3-small');
      expect(stats.batchSize).toBe(10);
      expect(stats.embeddingDimension).toBe(1536);
    });

    test('should cleanup resources', () => {
      vectorService.cleanup();

      expect(vectorService.openai).toBeNull();
      expect(vectorService.isInitialized).toBe(false);
    });
  });

  describe('Data Formatting', () => {
    test('should format data based on type', () => {
      const matchData = { teams: ['A', 'B'], status: 'live' };
      const teamData = { name: 'Team A', ranking: 1 };
      const playerData = { name: 'Player1', team: 'Team A' };

      expect(vectorService.formatDataForEmbedding(matchData, 'match')).toContain('Match: A vs B');
      expect(vectorService.formatDataForEmbedding(teamData, 'team')).toContain('Team: Team A');
      expect(vectorService.formatDataForEmbedding(playerData, 'player')).toContain(
        'Player: Player1',
      );
    });

    test('should throw error for unknown data type', () => {
      expect(() => vectorService.formatDataForEmbedding({}, 'unknown')).toThrow(
        'Unknown data type for embedding: unknown',
      );
    });
  });
});
