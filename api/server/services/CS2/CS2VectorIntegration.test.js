/**
 * Integration tests for CS2 Vector Services
 *
 * Tests the complete workflow from data ingestion to similarity search
 */

const CS2VectorService = require('./CS2VectorService');
const CS2VectorStorage = require('./CS2VectorStorage');

// Mock external dependencies
jest.mock('openai');
jest.mock('axios');
jest.mock('~/server/services/AuthService', () => ({
  generateShortLivedToken: jest.fn(() => 'mock-jwt-token'),
}));
jest.mock('@librechat/api', () => ({
  logAxiosError: jest.fn(),
}));

const OpenAI = require('openai');
const axios = require('axios');

describe('CS2 Vector Services Integration', () => {
  let vectorService;
  let vectorStorage;
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

    vectorService = new CS2VectorService();
    vectorStorage = new CS2VectorStorage();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.RAG_API_URL;
  });

  describe('End-to-End Match Processing', () => {
    test('should process match data from embedding to storage to search', async () => {
      // Mock embeddings for different matches
      const matchEmbedding1 = [0.1, 0.2, 0.3, 0.4, 0.5];
      const matchEmbedding2 = [0.2, 0.3, 0.4, 0.5, 0.6];
      const queryEmbedding = [0.15, 0.25, 0.35, 0.45, 0.55];

      mockOpenAI.embeddings.create
        .mockResolvedValueOnce({ data: [{ embedding: matchEmbedding1 }] })
        .mockResolvedValueOnce({ data: [{ embedding: matchEmbedding2 }] })
        .mockResolvedValueOnce({ data: [{ embedding: queryEmbedding }] });

      // Mock storage responses
      axios.post
        .mockResolvedValueOnce({ data: { success: true, id: 'vector-1' } })
        .mockResolvedValueOnce({ data: { success: true, id: 'vector-2' } })
        .mockResolvedValueOnce({
          data: {
            results: [
              {
                entity_id: 'match-1',
                similarity: 0.95,
                embedding: matchEmbedding1,
                metadata: {
                  entityType: 'cs2_match',
                  hltvId: 'match-1',
                  teams: ['Natus Vincere', 'Astralis'],
                  tournament: 'IEM Katowice',
                  status: 'finished',
                },
              },
            ],
          },
        });

      // Initialize services
      await vectorStorage.initialize();

      // Step 1: Store first match
      const match1 = {
        hltvId: 'match-1',
        teams: ['Natus Vincere', 'Astralis'],
        tournament: 'IEM Katowice',
        status: 'finished',
        date: new Date('2024-01-15'),
      };

      const storeResult1 = await vectorStorage.storeMatchVector({
        userId: 'user-123',
        matchData: match1,
      });

      expect(storeResult1.success).toBe(true);

      // Step 2: Store second match
      const match2 = {
        hltvId: 'match-2',
        teams: ['G2 Esports', 'FaZe Clan'],
        tournament: 'ESL Pro League',
        status: 'finished',
        date: new Date('2024-01-16'),
      };

      const storeResult2 = await vectorStorage.storeMatchVector({
        userId: 'user-123',
        matchData: match2,
      });

      expect(storeResult2.success).toBe(true);

      // Step 3: Search for similar matches
      const queryMatch = {
        teams: ['Natus Vincere', 'Team Liquid'],
        tournament: 'IEM Katowice',
        status: 'upcoming',
      };

      const similarMatches = await vectorStorage.findSimilarMatches({
        userId: 'user-123',
        matchData: queryMatch,
        limit: 5,
        threshold: 0.8,
      });

      // Verify results
      expect(similarMatches).toHaveLength(1);
      expect(similarMatches[0].entity_id).toBe('match-1');
      expect(similarMatches[0].similarity).toBe(0.95);
      expect(similarMatches[0].matchContext.teams).toEqual(['Natus Vincere', 'Astralis']);
      expect(similarMatches[0].matchContext.tournament).toBe('IEM Katowice');

      // Verify API calls
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(3);
      expect(axios.post).toHaveBeenCalledTimes(3); // 2 stores + 1 search
    });
  });

  describe('Team Performance Analysis', () => {
    test('should analyze team performance using vector similarity', async () => {
      const teamEmbedding1 = [0.7, 0.8, 0.9, 0.6, 0.5];
      const teamEmbedding2 = [0.8, 0.9, 0.7, 0.5, 0.6];
      const queryEmbedding = [0.75, 0.85, 0.8, 0.55, 0.55];

      mockOpenAI.embeddings.create
        .mockResolvedValueOnce({ data: [{ embedding: teamEmbedding1 }] })
        .mockResolvedValueOnce({ data: [{ embedding: teamEmbedding2 }] })
        .mockResolvedValueOnce({ data: [{ embedding: queryEmbedding }] });

      axios.post
        .mockResolvedValueOnce({ data: { success: true, id: 'team-vector-1' } })
        .mockResolvedValueOnce({ data: { success: true, id: 'team-vector-2' } })
        .mockResolvedValueOnce({
          data: {
            results: [
              {
                entity_id: 'team-1',
                similarity: 0.92,
                embedding: teamEmbedding1,
                metadata: {
                  entityType: 'cs2_team',
                  name: 'Natus Vincere',
                  ranking: 1,
                  players: ['s1mple', 'electronic', 'Perfecto', 'b1t', 'sdy'],
                  region: 'Europe',
                },
              },
            ],
          },
        });

      await vectorStorage.initialize();

      // Store team data
      const team1 = {
        name: 'Natus Vincere',
        ranking: 1,
        players: [
          { name: 's1mple' },
          { name: 'electronic' },
          { name: 'Perfecto' },
          { name: 'b1t' },
          { name: 'sdy' },
        ],
        region: 'Europe',
        stats: { winRate: 75, mapsPlayed: 50 },
      };

      await vectorStorage.storeTeamVector({
        userId: 'user-123',
        teamData: team1,
      });

      const team2 = {
        name: 'Astralis',
        ranking: 5,
        players: [
          { name: 'device' },
          { name: 'Xyp9x' },
          { name: 'gla1ve' },
          { name: 'Magisk' },
          { name: 'blameF' },
        ],
        region: 'Europe',
        stats: { winRate: 68, mapsPlayed: 45 },
      };

      await vectorStorage.storeTeamVector({
        userId: 'user-123',
        teamData: team2,
      });

      // Find similar teams
      const queryTeam = {
        name: 'G2 Esports',
        ranking: 2,
        region: 'Europe',
        stats: { winRate: 72, mapsPlayed: 48 },
      };

      const similarTeams = await vectorStorage.findSimilarTeams({
        userId: 'user-123',
        teamData: queryTeam,
        limit: 3,
      });

      expect(similarTeams).toHaveLength(1);
      expect(similarTeams[0].teamContext.name).toBe('Natus Vincere');
      expect(similarTeams[0].teamContext.ranking).toBe(1);
      expect(similarTeams[0].similarity).toBe(0.92);
    });
  });

  describe('Player Comparison System', () => {
    test('should find players with similar playing styles', async () => {
      const playerEmbedding1 = [0.3, 0.4, 0.5, 0.6, 0.7];
      const playerEmbedding2 = [0.4, 0.5, 0.6, 0.7, 0.8];
      const queryEmbedding = [0.35, 0.45, 0.55, 0.65, 0.75];

      mockOpenAI.embeddings.create
        .mockResolvedValueOnce({ data: [{ embedding: playerEmbedding1 }] })
        .mockResolvedValueOnce({ data: [{ embedding: playerEmbedding2 }] })
        .mockResolvedValueOnce({ data: [{ embedding: queryEmbedding }] });

      axios.post
        .mockResolvedValueOnce({ data: { success: true, id: 'player-vector-1' } })
        .mockResolvedValueOnce({ data: { success: true, id: 'player-vector-2' } })
        .mockResolvedValueOnce({
          data: {
            results: [
              {
                entity_id: 'player-1',
                similarity: 0.88,
                embedding: playerEmbedding1,
                metadata: {
                  entityType: 'cs2_player',
                  name: 's1mple',
                  realName: 'Oleksandr Kostyliev',
                  team: 'Natus Vincere',
                  country: 'Ukraine',
                  age: 26,
                },
              },
            ],
          },
        });

      await vectorStorage.initialize();

      // Store player data
      const player1 = {
        name: 's1mple',
        realName: 'Oleksandr Kostyliev',
        team: 'Natus Vincere',
        country: 'Ukraine',
        age: 26,
        stats: {
          rating: 1.25,
          adr: 85.5,
          kdRatio: 1.35,
          headshotPercentage: 52.3,
        },
      };

      await vectorStorage.storePlayerVector({
        userId: 'user-123',
        playerData: player1,
      });

      const player2 = {
        name: 'ZywOo',
        realName: 'Mathieu Herbaut',
        team: 'G2 Esports',
        country: 'France',
        age: 24,
        stats: {
          rating: 1.3,
          adr: 88.2,
          kdRatio: 1.4,
          headshotPercentage: 48.7,
        },
      };

      await vectorStorage.storePlayerVector({
        userId: 'user-123',
        playerData: player2,
      });

      // Find similar players
      const queryPlayer = {
        name: 'sh1ro',
        team: 'Cloud9',
        country: 'Russia',
        age: 23,
        stats: {
          rating: 1.22,
          adr: 82.1,
          kdRatio: 1.28,
          headshotPercentage: 50.5,
        },
      };

      const similarPlayers = await vectorStorage.findSimilarPlayers({
        userId: 'user-123',
        playerData: queryPlayer,
        limit: 3,
      });

      expect(similarPlayers).toHaveLength(1);
      expect(similarPlayers[0].playerContext.name).toBe('s1mple');
      expect(similarPlayers[0].playerContext.team).toBe('Natus Vincere');
      expect(similarPlayers[0].similarity).toBe(0.88);
    });
  });

  describe('Cross-Entity Analysis', () => {
    test('should perform complex queries across different entity types', async () => {
      // Mock search by metadata for matches involving specific teams
      axios.post.mockResolvedValue({
        data: {
          results: [
            {
              entity_id: 'match-123',
              metadata: {
                entityType: 'cs2_match',
                teams: ['Natus Vincere', 'Astralis'],
                tournament: 'IEM Katowice',
                date: '2024-01-15',
                status: 'finished',
              },
            },
            {
              entity_id: 'match-456',
              metadata: {
                entityType: 'cs2_match',
                teams: ['Natus Vincere', 'G2 Esports'],
                tournament: 'ESL Pro League',
                date: '2024-01-20',
                status: 'finished',
              },
            },
          ],
        },
      });

      await vectorStorage.initialize();

      // Search for matches involving Natus Vincere
      const naviMatches = await vectorStorage.searchMatchesByTeams({
        userId: 'user-123',
        teamNames: ['Natus Vincere'],
      });

      expect(naviMatches).toHaveLength(2);
      expect(naviMatches[0].metadata.teams).toContain('Natus Vincere');
      expect(naviMatches[1].metadata.teams).toContain('Natus Vincere');

      // Verify different tournaments
      const tournaments = naviMatches.map((match) => match.metadata.tournament);
      expect(tournaments).toContain('IEM Katowice');
      expect(tournaments).toContain('ESL Pro League');
    });

    test('should analyze team performance trends over time', async () => {
      const mockMatches = [
        {
          metadata: {
            entityType: 'cs2_match',
            teams: ['Test Team', 'Opponent A'],
            date: '2024-01-15T10:00:00Z',
            tournament: 'Tournament A',
            maps: ['Dust2'],
            status: 'finished',
          },
        },
        {
          metadata: {
            entityType: 'cs2_match',
            teams: ['Test Team', 'Opponent B'],
            date: '2024-01-20T14:00:00Z',
            tournament: 'Tournament B',
            maps: ['Mirage'],
            status: 'finished',
          },
        },
        {
          metadata: {
            entityType: 'cs2_match',
            teams: ['Test Team', 'Opponent C'],
            date: '2024-01-25T16:00:00Z',
            tournament: 'Tournament C',
            maps: ['Inferno'],
            status: 'finished',
          },
        },
      ];

      axios.post.mockResolvedValue({ data: { results: mockMatches } });

      await vectorStorage.initialize();

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const performanceTrend = await vectorStorage.getTeamPerformanceTrend({
        userId: 'user-123',
        teamName: 'Test Team',
        startDate,
        endDate,
      });

      expect(performanceTrend).toHaveLength(3);
      expect(performanceTrend[0].date).toBe('2024-01-15T10:00:00Z');
      expect(performanceTrend[0].opponent).toBe('Opponent A');
      expect(performanceTrend[0].tournament).toBe('Tournament A');
      expect(['W', 'L']).toContain(performanceTrend[0].result);

      // Verify chronological order
      const dates = performanceTrend.map((match) => new Date(match.date));
      expect(dates[0] < dates[1]).toBe(true);
      expect(dates[1] < dates[2]).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty search results gracefully', async () => {
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      });

      axios.post.mockResolvedValue({ data: { results: [] } });

      await vectorStorage.initialize();

      const queryMatch = {
        teams: ['Non-existent Team A', 'Non-existent Team B'],
        tournament: 'Non-existent Tournament',
      };

      const results = await vectorStorage.findSimilarMatches({
        userId: 'user-123',
        matchData: queryMatch,
      });

      expect(results).toEqual([]);
    });

    test('should handle API errors gracefully', async () => {
      mockOpenAI.embeddings.create.mockRejectedValue(new Error('OpenAI API Error'));

      await vectorStorage.initialize();

      const matchData = {
        teams: ['Team A', 'Team B'],
        tournament: 'Test Tournament',
      };

      await expect(
        vectorStorage.storeMatchVector({
          userId: 'user-123',
          matchData,
        }),
      ).rejects.toThrow('Failed to store match vector');
    });
  });
});
