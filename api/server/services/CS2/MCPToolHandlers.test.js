const MCPToolHandlers = require('./MCPToolHandlers');
const CS2Match = require('~/models/CS2/CS2Match');
const CS2Team = require('~/models/CS2/CS2Team');

// Mock the dependencies
jest.mock('~/models/CS2/CS2Match', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock('~/models/CS2/CS2Team', () => ({
  findOne: jest.fn(),
}));
jest.mock('~/utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('MCPToolHandlers', () => {
  let handlers;

  beforeEach(() => {
    jest.clearAllMocks();
    handlers = new MCPToolHandlers();

    // Reset rate limiting
    handlers.requestCounts.clear();

    // Mock database query chains
    CS2Match.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });

    CS2Match.findOne.mockReturnValue({
      populate: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    });
  });

  describe('validateInput', () => {
    it('should validate get_match_data parameters correctly', () => {
      const validArgs = {
        matchId: '12345',
        teamName: 'Team A',
        status: 'finished',
        limit: 10,
      };

      expect(() => handlers.validateInput('get_match_data', validArgs)).not.toThrow();
    });

    it('should reject invalid matchId with special characters', () => {
      const invalidArgs = {
        matchId: '123<script>alert("xss")</script>',
      };

      expect(() => handlers.validateInput('get_match_data', invalidArgs)).toThrow(
        "Validation errors: Field 'matchId' contains invalid characters",
      );
    });

    it('should reject teamName that is too long', () => {
      const invalidArgs = {
        teamName: 'A'.repeat(101),
      };

      expect(() => handlers.validateInput('get_match_data', invalidArgs)).toThrow(
        "Validation errors: Field 'teamName' exceeds maximum length of 100",
      );
    });

    it('should reject invalid status enum', () => {
      const invalidArgs = {
        status: 'invalid_status',
      };

      expect(() => handlers.validateInput('get_match_data', invalidArgs)).toThrow(
        "Validation errors: Field 'status' must be one of: upcoming, live, finished",
      );
    });

    it('should reject limit outside valid range', () => {
      const invalidArgs = {
        limit: 150,
      };

      expect(() => handlers.validateInput('get_match_data', invalidArgs)).toThrow(
        "Validation errors: Field 'limit' must be at most 100",
      );
    });

    it('should validate get_team_stats required fields', () => {
      const invalidArgs = {};

      expect(() => handlers.validateInput('get_team_stats', invalidArgs)).toThrow(
        "Validation errors: Field 'teamName' is required",
      );
    });

    it('should validate predict_match_outcome required fields', () => {
      const invalidArgs = {
        matchId: '12345',
      };

      expect(() => handlers.validateInput('predict_match_outcome', invalidArgs)).toThrow(
        "Validation errors: Field 'predictionType' is required",
      );
    });

    it('should reject unknown tool names', () => {
      expect(() => handlers.validateInput('unknown_tool', {})).toThrow(
        'Unknown tool: unknown_tool',
      );
    });
  });

  describe('sanitizeInput', () => {
    it('should remove dangerous characters from strings', () => {
      const input = {
        teamName: 'Team<script>alert("xss")</script>',
        matchId: 'match"id\'with&quotes',
      };

      const sanitized = handlers.sanitizeInput(input);

      expect(sanitized.teamName).toBe('Teamscriptalert(xss)/script');
      expect(sanitized.matchId).toBe('matchidwithquotes');
    });

    it('should preserve non-string values', () => {
      const input = {
        limit: 10,
        active: true,
      };

      const sanitized = handlers.sanitizeInput(input);

      expect(sanitized.limit).toBe(10);
      expect(sanitized.active).toBe(true);
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit', () => {
      expect(() => handlers.checkRateLimit('client1')).not.toThrow();
    });

    it('should throw error when rate limit exceeded', () => {
      // Simulate 60 requests in the last minute
      const now = Date.now();
      handlers.requestCounts.set('client1', Array(60).fill(now));

      expect(() => handlers.checkRateLimit('client1')).toThrow(
        'Rate limit exceeded. Please try again later.',
      );
    });

    it('should clean up old requests outside time window', () => {
      const oldTime = Date.now() - 120000; // 2 minutes ago
      const newTime = Date.now();

      handlers.requestCounts.set('client1', [oldTime, newTime]);

      expect(() => handlers.checkRateLimit('client1')).not.toThrow();

      // Should only have recent requests
      const requests = handlers.requestCounts.get('client1');
      expect(requests.filter((t) => t > Date.now() - 60000)).toHaveLength(2); // newTime + current request
    });
  });

  describe('handleGetMatchData', () => {
    beforeEach(() => {
      CS2Match.find().populate().sort().limit().lean.mockResolvedValue([]);
    });

    it('should handle valid match data request', async () => {
      const mockMatches = [
        {
          hltvId: '12345',
          date: new Date('2024-01-15'),
          tournament: { name: 'Test Tournament' },
          teams: [
            { team: { name: 'Team A', ranking: 1 }, score: 2 },
            { team: { name: 'Team B', ranking: 2 }, score: 0 },
          ],
          maps: [],
          status: 'finished',
          predictions: {},
        },
      ];

      CS2Match.find().populate().sort().limit().lean.mockResolvedValue(mockMatches);

      const result = await handlers.handleGetMatchData({ matchId: '12345' }, 'client1');

      expect(result.content[0].type).toBe('text');
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.matches).toHaveLength(1);
      expect(responseData.matches[0].id).toBe('12345');
      expect(responseData.timestamp).toBeDefined();
    });

    it('should handle team name search with no results', async () => {
      CS2Team.findOne.mockResolvedValue(null);

      const result = await handlers.handleGetMatchData({ teamName: 'NonExistent Team' }, 'client1');

      expect(result.content[0].type).toBe('text');
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.matches).toHaveLength(0);
      expect(responseData.message).toContain('No team found matching');
    });

    it('should handle invalid date range', async () => {
      const result = await handlers.handleGetMatchData(
        {
          dateRange: { start: 'invalid-date' },
        },
        'client1',
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid start date format');
    });

    it('should enforce maximum limit', async () => {
      await handlers.handleGetMatchData({ limit: 150 }, 'client1');

      // Should call with limit of 100 (enforced maximum)
      expect(CS2Match.find().populate().sort().limit).toHaveBeenCalledWith(100);
    });

    it('should handle database errors gracefully', async () => {
      CS2Match.find.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const result = await handlers.handleGetMatchData({ matchId: '12345' }, 'client1');

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Error retrieving match data');
    });

    it('should respect rate limiting', async () => {
      // Fill up rate limit
      handlers.requestCounts.set('client1', Array(60).fill(Date.now()));

      const result = await handlers.handleGetMatchData({ matchId: '12345' }, 'client1');

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Rate limit exceeded');
    });
  });

  describe('handleGetTeamStats', () => {
    beforeEach(() => {
      CS2Match.find().populate().sort.mockResolvedValue([]);
    });

    it('should handle valid team stats request', async () => {
      const mockTeam = {
        _id: 'team123',
        name: 'Team A',
        ranking: 1,
        recentForm: [1, 1, 0, 1, 1],
      };
      CS2Team.findOne.mockResolvedValue(mockTeam);

      const result = await handlers.handleGetTeamStats({ teamName: 'Team A' }, 'client1');

      expect(result.content[0].type).toBe('text');
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.team.name).toBe('Team A');
      expect(responseData.statistics).toBeDefined();
      expect(responseData.timestamp).toBeDefined();
    });

    it('should return error for non-existent team', async () => {
      CS2Team.findOne.mockResolvedValue(null);

      const result = await handlers.handleGetTeamStats({ teamName: 'NonExistent' }, 'client1');

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Team "NonExistent" not found');
    });

    it('should handle map-specific stats', async () => {
      const mockTeam = { _id: 'team123', name: 'Team A', ranking: 1 };
      CS2Team.findOne.mockResolvedValue(mockTeam);

      await handlers.handleGetTeamStats(
        {
          teamName: 'Team A',
          mapName: 'de_mirage',
        },
        'client1',
      );

      expect(CS2Match.find).toHaveBeenCalledWith(
        expect.objectContaining({
          'maps.name': 'de_mirage',
        }),
      );
    });

    it('should calculate enhanced statistics', async () => {
      const mockTeam = { _id: 'team123', name: 'Team A', ranking: 1 };
      const mockMatches = [
        {
          teams: [
            { team: { _id: { equals: (id) => id === 'team123' } }, score: 2 },
            { team: { _id: { equals: (id) => id !== 'team123' } }, score: 1 },
          ],
          maps: [
            {
              name: 'de_mirage',
              winner: { equals: (id) => id === 'team123' },
              score: { team1: 16, team2: 12 },
            },
          ],
        },
      ];

      CS2Team.findOne.mockResolvedValue(mockTeam);
      CS2Match.find().populate().sort.mockResolvedValue(mockMatches);

      const result = await handlers.handleGetTeamStats({ teamName: 'Team A' }, 'client1');

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.statistics.matchRecord.wins).toBe(1);
      expect(responseData.statistics.mapSpecificStats).toBeDefined();
      expect(responseData.statistics.matchRecord.currentStreak).toBeDefined();
    });
  });

  describe('handlePredictMatchOutcome', () => {
    it('should handle valid prediction request', async () => {
      const mockMatch = {
        hltvId: '12345',
        teams: [
          { team: { name: 'Team A', ranking: 1, recentForm: [1, 1, 1] } },
          { team: { name: 'Team B', ranking: 5, recentForm: [0, 1, 0] } },
        ],
        tournament: { name: 'Test Tournament' },
        status: 'upcoming',
      };

      CS2Match.findOne().populate().lean.mockResolvedValue(mockMatch);

      const result = await handlers.handlePredictMatchOutcome(
        {
          matchId: '12345',
          predictionType: 'half_time',
        },
        'client1',
      );

      expect(result.content[0].type).toBe('text');
      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.predictionType).toBe('half_time');
      expect(responseData.prediction.winner).toBeDefined();
      expect(responseData.prediction.probability).toBeGreaterThan(0);
      expect(responseData.prediction.confidence).toBeDefined();
      expect(responseData.disclaimer).toContain('entertainment purposes only');
    });

    it('should return error for non-existent match', async () => {
      CS2Match.findOne().populate().lean.mockResolvedValue(null);

      const result = await handlers.handlePredictMatchOutcome(
        {
          matchId: 'nonexistent',
          predictionType: 'half_time',
        },
        'client1',
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Match with ID "nonexistent" not found');
    });

    it('should handle all prediction types', async () => {
      const mockMatch = {
        hltvId: '12345',
        teams: [
          { team: { name: 'Team A', ranking: 1, recentForm: [1, 1, 1] } },
          { team: { name: 'Team B', ranking: 5, recentForm: [0, 1, 0] } },
        ],
        tournament: { name: 'Test Tournament' },
      };

      CS2Match.findOne().populate().lean.mockResolvedValue(mockMatch);

      const predictionTypes = ['half_time', 'map_winner', 'series_outcome'];

      for (const predictionType of predictionTypes) {
        const result = await handlers.handlePredictMatchOutcome(
          {
            matchId: '12345',
            predictionType,
          },
          'client1',
        );

        const responseData = JSON.parse(result.content[0].text);
        expect(responseData.predictionType).toBe(predictionType);
        expect(responseData.prediction).toBeDefined();
      }
    });
  });

  describe('calculateEnhancedTeamStats', () => {
    it('should calculate comprehensive statistics', () => {
      const mockMatches = [
        {
          teams: [
            { team: { _id: { equals: (id) => id === 'team123' } }, score: 2 },
            { team: { _id: { equals: (id) => id !== 'team123' } }, score: 1 },
          ],
          maps: [
            {
              name: 'de_mirage',
              winner: { equals: (id) => id === 'team123' },
              score: { team1: 16, team2: 12 },
            },
            {
              name: 'de_dust2',
              winner: { equals: (id) => id !== 'team123' },
              score: { team1: 10, team2: 16 },
            },
          ],
        },
      ];

      const stats = handlers.calculateEnhancedTeamStats(mockMatches, 'team123');

      expect(stats.matchRecord.wins).toBe(1);
      expect(stats.matchRecord.losses).toBe(0);
      expect(stats.matchRecord.recentForm).toBe('W');
      expect(stats.matchRecord.currentStreak.type).toBe('win');
      expect(stats.matchRecord.currentStreak.count).toBe(1);
      expect(stats.mapRecord.wins).toBe(1);
      expect(stats.mapRecord.losses).toBe(1);
      expect(stats.mapSpecificStats).toHaveLength(2);
    });

    it('should handle map-specific filtering', () => {
      const mockMatches = [
        {
          teams: [
            { team: { _id: { equals: (id) => id === 'team123' } }, score: 2 },
            { team: { _id: { equals: (id) => id !== 'team123' } }, score: 0 },
          ],
          maps: [
            {
              name: 'de_mirage',
              winner: { equals: (id) => id === 'team123' },
              score: { team1: 16, team2: 10 },
            },
            {
              name: 'de_dust2',
              winner: { equals: (id) => id !== 'team123' },
              score: { team1: 12, team2: 16 },
            },
          ],
        },
      ];

      const stats = handlers.calculateEnhancedTeamStats(mockMatches, 'team123', 'de_mirage');

      expect(stats.mapRecord.wins).toBe(1);
      expect(stats.mapRecord.losses).toBe(0);
    });
  });

  describe('calculateStreak', () => {
    it('should calculate win streak correctly', () => {
      const recentMatches = ['W', 'W', 'W', 'L', 'W'];
      const streak = handlers.calculateStreak(recentMatches);

      expect(streak.type).toBe('win');
      expect(streak.count).toBe(3);
    });

    it('should calculate loss streak correctly', () => {
      const recentMatches = ['L', 'L', 'W', 'W'];
      const streak = handlers.calculateStreak(recentMatches);

      expect(streak.type).toBe('loss');
      expect(streak.count).toBe(2);
    });

    it('should handle empty match history', () => {
      const streak = handlers.calculateStreak([]);

      expect(streak.type).toBe('none');
      expect(streak.count).toBe(0);
    });
  });

  describe('prediction methods', () => {
    const mockMatch = {
      teams: [
        { team: { name: 'Team A', ranking: 1, recentForm: [1, 1, 1, 0, 1] } },
        { team: { name: 'Team B', ranking: 5, recentForm: [0, 1, 0, 1, 0] } },
      ],
    };

    it('should generate enhanced half-time prediction', async () => {
      const prediction = await handlers.generateEnhancedHalfTimePrediction(mockMatch);

      expect(prediction.winner).toBeDefined();
      expect(prediction.probability).toBeGreaterThan(0);
      expect(prediction.probability).toBeLessThanOrEqual(1);
      expect(prediction.confidence).toMatch(/^(low|medium|high)$/);
      expect(prediction.factors).toBeInstanceOf(Array);
      expect(prediction.methodology).toBeDefined();
    });

    it('should generate enhanced map winner prediction', async () => {
      const prediction = await handlers.generateEnhancedMapWinnerPrediction(mockMatch);

      expect(prediction.winner).toBeDefined();
      expect(prediction.probability).toBeGreaterThanOrEqual(0.2);
      expect(prediction.probability).toBeLessThanOrEqual(0.8);
      expect(prediction.factors).toContain('Map-specific performance history');
    });

    it('should generate enhanced series outcome prediction', async () => {
      const prediction = await handlers.generateEnhancedSeriesOutcomePrediction(mockMatch);

      expect(prediction.winner).toBeDefined();
      expect(prediction.winnerProbability).toBeGreaterThan(0);
      expect(prediction.seriesLength).toHaveProperty('2-0');
      expect(prediction.seriesLength).toHaveProperty('2-1');
      expect(prediction.seriesLength['2-0'] + prediction.seriesLength['2-1']).toBeCloseTo(1, 2);
    });
  });

  describe('form factor calculation', () => {
    it('should calculate form difference correctly', () => {
      const form1 = [1, 1, 0, 1, 1]; // 0.8 average
      const form2 = [0, 0, 1, 0, 0]; // 0.2 average

      const formFactor = handlers.calculateFormFactor(form1, form2);

      expect(formFactor).toBeCloseTo(0.6, 1);
    });

    it('should handle missing form data', () => {
      const formFactor = handlers.calculateFormFactor(null, [1, 0, 1]);

      expect(formFactor).toBe(0);
    });
  });

  describe('confidence calculation', () => {
    it('should return high confidence for large differences', () => {
      const confidence = handlers.calculateConfidence(0.2, 0.1);
      expect(confidence).toBe('high');
    });

    it('should return medium confidence for moderate differences', () => {
      const confidence = handlers.calculateConfidence(0.1, 0.05);
      expect(confidence).toBe('medium');
    });

    it('should return low confidence for small differences', () => {
      const confidence = handlers.calculateConfidence(0.03, 0.02);
      expect(confidence).toBe('low');
    });
  });
});
