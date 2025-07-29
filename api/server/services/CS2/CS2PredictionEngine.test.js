const CS2PredictionEngine = require('./CS2PredictionEngine');
const { CS2Match } = require('~/db/models');

// Mock the database models
jest.mock('~/db/models', () => ({
  CS2Match: {
    findOne: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
  CS2Team: {
    findById: jest.fn(),
  },
}));

// Mock logger
jest.mock('~/utils/logger', () => ({
  child: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('CS2PredictionEngine', () => {
  let engine;
  let mockMatch;
  let mockTeam1;
  let mockTeam2;

  beforeEach(() => {
    engine = new CS2PredictionEngine();

    mockTeam1 = {
      _id: 'team1_id',
      name: 'Team A',
      ranking: { current: 5 },
    };

    mockTeam2 = {
      _id: 'team2_id',
      name: 'Team B',
      ranking: { current: 10 },
    };

    mockMatch = {
      hltvId: 'test_match_123',
      status: 'live',
      teams: [
        { team: mockTeam1, score: 0 },
        { team: mockTeam2, score: 0 },
      ],
      maps: [
        {
          name: 'de_mirage',
          rounds: [
            { number: 1, winner: 'CT', ctScore: 1, tScore: 0 },
            { number: 2, winner: 'T', ctScore: 1, tScore: 1 },
            { number: 3, winner: 'CT', ctScore: 2, tScore: 1 },
            { number: 4, winner: 'CT', ctScore: 3, tScore: 1 },
            { number: 5, winner: 'T', ctScore: 3, tScore: 2 },
          ],
        },
      ],
      liveData: {
        currentMap: 0,
        currentRound: 5,
        score: { team1: 3, team2: 2 },
        economy: { team1: 4500, team2: 2100 },
      },
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('predictHalfTimeWinner', () => {
    it('should predict half-time winner successfully', async () => {
      // Setup mocks
      CS2Match.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockMatch),
        }),
      });

      CS2Match.find.mockResolvedValue([]);
      CS2Match.findOneAndUpdate.mockResolvedValue({});

      const result = await engine.predictHalfTimeWinner('test_match_123');

      expect(result).toHaveProperty('winner');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('probabilities');
      expect(result).toHaveProperty('factors');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
      expect(['team1', 'team2']).toContain(result.winner);
    });

    it('should throw error for non-existent match', async () => {
      CS2Match.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(engine.predictHalfTimeWinner('non_existent')).rejects.toThrow(
        'Match non_existent not found',
      );
    });

    it('should throw error for non-live match', async () => {
      const finishedMatch = { ...mockMatch, status: 'finished' };
      CS2Match.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(finishedMatch),
        }),
      });

      await expect(engine.predictHalfTimeWinner('test_match_123')).rejects.toThrow(
        'Match test_match_123 is not live',
      );
    });

    it('should throw error for insufficient live data', async () => {
      const matchWithoutLiveData = { ...mockMatch, liveData: null };
      CS2Match.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(matchWithoutLiveData),
        }),
      });

      await expect(engine.predictHalfTimeWinner('test_match_123')).rejects.toThrow(
        'Insufficient live data for match test_match_123',
      );
    });
  });

  describe('predictMapWinner', () => {
    beforeEach(() => {
      mockMatch.maps[0].pickBy = mockTeam1._id;
    });

    it('should predict map winner successfully', async () => {
      CS2Match.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockMatch),
        }),
      });

      CS2Match.find.mockResolvedValue([
        {
          teams: [{ team: mockTeam1._id }],
          maps: [{ name: 'de_mirage', winner: mockTeam1._id }],
        },
      ]);

      CS2Match.findOneAndUpdate.mockResolvedValue({});

      const result = await engine.predictMapWinner('test_match_123', 0);

      expect(result).toHaveProperty('winner');
      expect(result).toHaveProperty('winnerName');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('probabilities');
      expect(result).toHaveProperty('factors');
      expect(result).toHaveProperty('keyFactors');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
      expect(result.keyFactors).toHaveLength(3);
    });

    it('should throw error for non-existent match', async () => {
      CS2Match.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(engine.predictMapWinner('non_existent')).rejects.toThrow(
        'Match non_existent not found',
      );
    });

    it('should throw error for non-existent map', async () => {
      CS2Match.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockMatch),
        }),
      });

      await expect(engine.predictMapWinner('test_match_123', 5)).rejects.toThrow(
        'Map 5 not found for match test_match_123',
      );
    });
  });

  describe('predictSeriesOutcome', () => {
    let bo3Match;

    beforeEach(() => {
      bo3Match = {
        ...mockMatch,
        format: 'bo3',
        maps: [
          {
            name: 'de_mirage',
            winner: mockTeam1._id,
            score: { team1: 16, team2: 12 },
          },
          {
            name: 'de_inferno',
            winner: mockTeam2._id,
            score: { team1: 14, team2: 16 },
          },
        ],
      };
    });

    it('should predict series outcome successfully', async () => {
      CS2Match.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(bo3Match),
        }),
      });

      CS2Match.find.mockResolvedValue([
        {
          teams: [{ team: mockTeam1._id, isWinner: true }],
          maps: [
            { name: 'de_mirage', winner: mockTeam1._id },
            { name: 'de_inferno', winner: mockTeam2._id },
            { name: 'de_dust2', winner: mockTeam1._id },
          ],
        },
      ]);

      CS2Match.findOneAndUpdate.mockResolvedValue({});

      const result = await engine.predictSeriesOutcome('test_match_123');

      expect(result).toHaveProperty('outcome');
      expect(result).toHaveProperty('winner');
      expect(result).toHaveProperty('winnerName');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('probabilities');
      expect(result).toHaveProperty('outcomes');
      expect(result).toHaveProperty('currentState');
      expect(result).toHaveProperty('factors');
      expect(result).toHaveProperty('keyFactors');
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
      expect(['2-0', '2-1']).toContain(result.outcome);
      expect(result.currentState.team1MapWins).toBe(1);
      expect(result.currentState.team2MapWins).toBe(1);
      expect(result.currentState.mapsRemaining).toBe(1);
    });

    it('should throw error for non-bo3 match', async () => {
      const bo1Match = { ...mockMatch, format: 'bo1' };
      CS2Match.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(bo1Match),
        }),
      });

      await expect(engine.predictSeriesOutcome('test_match_123')).rejects.toThrow(
        'Match test_match_123 is not a best-of-3 series',
      );
    });

    it('should throw error for no completed maps', async () => {
      const noMapsMatch = { ...bo3Match, maps: [{ name: 'de_mirage' }] };
      CS2Match.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(noMapsMatch),
        }),
      });

      await expect(engine.predictSeriesOutcome('test_match_123')).rejects.toThrow(
        'No completed maps found for series prediction in match test_match_123',
      );
    });
  });

  // Test helper methods
  describe('Helper Methods', () => {
    describe('_calculateCurrentScoreFactor', () => {
      it('should calculate score factor correctly when team1 is ahead', () => {
        const liveData = { score: { team1: 8, team2: 4 } };
        const result = engine._calculateCurrentScoreFactor(liveData, mockTeam1, mockTeam2);

        expect(result.team1).toBeGreaterThan(0.5);
        expect(result.team2).toBeLessThan(0.5);
        expect(result.team1 + result.team2).toBeCloseTo(1.0, 5);
      });

      it('should return equal probabilities for tied score', () => {
        const liveData = { score: { team1: 5, team2: 5 } };
        const result = engine._calculateCurrentScoreFactor(liveData, mockTeam1, mockTeam2);

        expect(result.team1).toBe(0.5);
        expect(result.team2).toBe(0.5);
      });

      it('should handle zero total rounds', () => {
        const liveData = { score: { team1: 0, team2: 0 } };
        const result = engine._calculateCurrentScoreFactor(liveData, mockTeam1, mockTeam2);

        expect(result.team1).toBe(0.5);
        expect(result.team2).toBe(0.5);
      });
    });

    describe('_calculateEconomyFactor', () => {
      it('should calculate economy factor correctly', () => {
        const liveData = { economy: { team1: 4500, team2: 2100 } };
        const result = engine._calculateEconomyFactor(liveData, mockTeam1, mockTeam2);

        expect(result.team1).toBeGreaterThan(0.5);
        expect(result.team2).toBeLessThan(0.5);
        expect(result.team1 + result.team2).toBeCloseTo(1.0, 5);
      });

      it('should handle missing economy data', () => {
        const liveData = {};
        const result = engine._calculateEconomyFactor(liveData, mockTeam1, mockTeam2);

        expect(result.team1).toBe(0.5);
        expect(result.team2).toBe(0.5);
      });

      it('should handle zero economy values', () => {
        const liveData = { economy: { team1: 0, team2: 0 } };
        const result = engine._calculateEconomyFactor(liveData, mockTeam1, mockTeam2);

        expect(result.team1).toBe(0.5);
        expect(result.team2).toBe(0.5);
      });
    });

    describe('_calculateRankingFactor', () => {
      it('should favor better ranked team', () => {
        const result = engine._calculateRankingFactor(
          { team: { ranking: { current: 5 } } },
          { team: { ranking: { current: 15 } } },
        );

        expect(result.team1).toBeGreaterThan(0.5);
        expect(result.team2).toBeLessThan(0.5);
      });

      it('should handle missing ranking data', () => {
        const result = engine._calculateRankingFactor({ team: {} }, { team: {} });

        expect(result.team1).toBe(0.5);
        expect(result.team2).toBe(0.5);
      });

      it('should cap ranking influence', () => {
        const result = engine._calculateRankingFactor(
          { team: { ranking: { current: 1 } } },
          { team: { ranking: { current: 100 } } },
        );

        // Should not exceed maximum influence
        expect(result.team1).toBeLessThanOrEqual(0.65);
        expect(result.team2).toBeGreaterThanOrEqual(0.35);
      });
    });

    describe('_calculateSeriesMomentumFactor', () => {
      it('should calculate momentum correctly when series is tied', () => {
        const completedMaps = [{ winner: mockTeam1._id }, { winner: mockTeam2._id }];

        const result = engine._calculateSeriesMomentumFactor(
          { team: { _id: mockTeam1._id } },
          { team: { _id: mockTeam2._id } },
          completedMaps,
        );

        expect(result.team1).toBeCloseTo(0.45, 1); // 0.5 - 0.05 (last map bonus to team2)
        expect(result.team2).toBeCloseTo(0.55, 1); // 0.5 + 0.05 (last map bonus)
        expect(result.confidence).toBe(1.0); // 2 maps completed
      });

      it('should favor team leading the series', () => {
        const completedMaps = [{ winner: mockTeam1._id }];

        const result = engine._calculateSeriesMomentumFactor(
          { team: { _id: mockTeam1._id } },
          { team: { _id: mockTeam2._id } },
          completedMaps,
        );

        expect(result.team1).toBeGreaterThan(0.5);
        expect(result.team2).toBeLessThan(0.5);
        expect(result.confidence).toBe(0.5); // 1 map completed
      });

      it('should handle no completed maps', () => {
        const result = engine._calculateSeriesMomentumFactor(
          { team: { _id: mockTeam1._id } },
          { team: { _id: mockTeam2._id } },
          [],
        );

        expect(result.team1).toBe(0.5);
        expect(result.team2).toBe(0.5);
        expect(result.confidence).toBe(0.0);
      });
    });

    describe('_calculateSeriesOutcomeProbabilities', () => {
      it('should calculate probabilities for 1-0 series lead', () => {
        const result = engine._calculateSeriesOutcomeProbabilities(0.6, 0.4, 1, 0);

        expect(result).toHaveProperty('2-0');
        expect(result).toHaveProperty('2-1');
        // After normalization, the probabilities should sum to 1
        expect(result['2-0']).toBeGreaterThan(0.5); // Team1 more likely to win 2-0
        expect(result['2-1']).toBeLessThan(0.5); // Less likely to go to 2-1
        expect(result['2-0'] + result['2-1']).toBeCloseTo(1.0, 5);
      });

      it('should calculate probabilities for 1-1 series tie', () => {
        const result = engine._calculateSeriesOutcomeProbabilities(0.6, 0.4, 1, 1);

        expect(result).toHaveProperty('2-1');
        expect(result['2-1']).toBeCloseTo(1.0, 1); // Either team can win 2-1
      });

      it('should handle completed series', () => {
        const result = engine._calculateSeriesOutcomeProbabilities(0.6, 0.4, 2, 0);

        expect(result['2-0']).toBe(1.0);
        expect(result['2-1']).toBe(0.0);
      });
    });
  });

  // Integration tests
  describe('Integration Tests', () => {
    it('should handle complete half-time prediction workflow', async () => {
      CS2Match.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockMatch),
        }),
      });

      CS2Match.find.mockResolvedValue([
        {
          teams: [{ team: mockTeam1._id }],
          maps: [
            { name: 'de_mirage', winner: mockTeam1._id },
            { name: 'de_mirage', winner: mockTeam2._id },
          ],
        },
      ]);

      CS2Match.findOneAndUpdate.mockResolvedValue({});

      const result = await engine.predictHalfTimeWinner('test_match_123');

      expect(result).toBeDefined();
      expect(result.factors).toHaveLength(6);
      expect(result.factors.map((f) => f.name)).toEqual([
        'current_score',
        'economy_state',
        'momentum',
        'historical_half_time',
        'ranking_difference',
        'map_specific',
      ]);
    });

    it('should handle complete map winner prediction workflow', async () => {
      mockMatch.maps[0].pickBy = mockTeam1._id;
      mockMatch.tournament = { tier: 'S' };

      CS2Match.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockMatch),
        }),
      });

      CS2Match.find.mockResolvedValue([
        {
          teams: [{ team: mockTeam1._id }],
          maps: [{ name: 'de_mirage', winner: mockTeam1._id }],
        },
      ]);

      CS2Match.findOneAndUpdate.mockResolvedValue({});

      const result = await engine.predictMapWinner('test_match_123', 0);

      expect(result).toBeDefined();
      expect(result.factors).toHaveLength(6);
      expect(result.factors.map((f) => f.name)).toEqual([
        'map_performance',
        'pick_ban_strategy',
        'recent_form',
        'head_to_head',
        'ranking_difference',
        'tournament_tier',
      ]);
    });

    it('should handle complete series outcome prediction workflow', async () => {
      const bo3Match = {
        ...mockMatch,
        format: 'bo3',
        maps: [{ name: 'de_mirage', winner: mockTeam1._id, score: { team1: 16, team2: 12 } }],
      };

      CS2Match.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(bo3Match),
        }),
      });

      CS2Match.find.mockResolvedValue([
        {
          teams: [{ team: mockTeam1._id, isWinner: true }],
          maps: [{ winner: mockTeam1._id }, { winner: mockTeam2._id }, { winner: mockTeam1._id }],
        },
      ]);

      CS2Match.findOneAndUpdate.mockResolvedValue({});

      const result = await engine.predictSeriesOutcome('test_match_123');

      expect(result).toBeDefined();
      expect(result.factors).toHaveLength(6);
      expect(result.factors.map((f) => f.name)).toEqual([
        'series_momentum',
        'mental_resilience',
        'remaining_map_pool',
        'series_history',
        'team_strength',
        'fatigue_factor',
      ]);
    });
  });
});
