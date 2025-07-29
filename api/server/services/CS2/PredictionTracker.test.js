// Mock dependencies first
jest.mock('~/db/models', () => ({
  CS2Match: {
    findOneAndUpdate: jest.fn(),
    findOne: jest.fn(),
    aggregate: jest.fn(),
  },
}));

jest.mock('~/utils/logger', () => ({
  child: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const PredictionTracker = require('./PredictionTracker');
const { CS2Match } = require('~/db/models');

describe('PredictionTracker', () => {
  let tracker;
  let mockMatch;

  beforeEach(() => {
    tracker = new PredictionTracker();

    // Reset all mocks
    jest.clearAllMocks();

    // Mock match data
    mockMatch = {
      hltvId: 'test-match-123',
      status: 'finished',
      format: 'bo3',
      teams: [
        { team: { _id: 'team1-id', name: 'Team 1' } },
        { team: { _id: 'team2-id', name: 'Team 2' } },
      ],
      maps: [
        {
          name: 'de_mirage',
          winner: 'team1-id',
          score: { team1: 16, team2: 12 },
          rounds: Array.from({ length: 30 }, (_, i) => ({
            number: i + 1,
            winner: i < 15 ? (i % 2 === 0 ? 'CT' : 'T') : i % 2 === 0 ? 'T' : 'CT',
          })),
        },
        {
          name: 'de_dust2',
          winner: 'team2-id',
          score: { team1: 14, team2: 16 },
        },
      ],
      predictions: {
        halfTime: {
          predicted: true,
          winner: 'team1',
          confidence: 0.75,
          timestamp: new Date(),
          evaluated: false,
        },
        mapWinner: {
          predicted: true,
          winner: 'team1-id',
          confidence: 0.82,
          timestamp: new Date(),
          evaluated: false,
        },
        seriesOutcome: {
          predicted: true,
          outcome: '2-1',
          winner: 'team1-id',
          confidence: 0.68,
          timestamp: new Date(),
          evaluated: false,
        },
      },
      date: new Date(),
    };
  });

  describe('storePrediction', () => {
    it('should store a prediction successfully', async () => {
      const prediction = {
        winner: 'team1',
        confidence: 0.75,
        probabilities: { team1: 0.75, team2: 0.25 },
      };

      CS2Match.findOneAndUpdate.mockResolvedValue({
        hltvId: 'test-match-123',
        predictions: {
          halfTime: {
            ...prediction,
            predicted: true,
            timestamp: expect.any(Date),
            evaluated: false,
          },
        },
      });

      const result = await tracker.storePrediction('test-match-123', 'halfTime', prediction);

      expect(CS2Match.findOneAndUpdate).toHaveBeenCalledWith(
        { hltvId: 'test-match-123' },
        {
          $set: {
            'predictions.halfTime': {
              ...prediction,
              predicted: true,
              timestamp: expect.any(Date),
              evaluated: false,
            },
            'metadata.lastUpdated': expect.any(Date),
          },
        },
        { new: true, lean: true },
      );

      expect(result).toBeDefined();
      expect(result.predictions.halfTime.predicted).toBe(true);
    });

    it('should throw error if match not found', async () => {
      CS2Match.findOneAndUpdate.mockResolvedValue(null);

      await expect(tracker.storePrediction('nonexistent-match', 'halfTime', {})).rejects.toThrow(
        'Match nonexistent-match not found',
      );
    });
  });

  describe('evaluatePredictions', () => {
    beforeEach(() => {
      CS2Match.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockMatch),
        }),
      });

      CS2Match.findOneAndUpdate.mockResolvedValue(mockMatch);
    });

    it('should evaluate all prediction types for a finished match', async () => {
      const result = await tracker.evaluatePredictions('test-match-123');

      expect(result).toHaveProperty('halfTime');
      expect(result).toHaveProperty('mapWinner');
      expect(result).toHaveProperty('seriesOutcome');

      expect(result.halfTime.accurate).toBe(true); // team1 won first half
      expect(result.mapWinner.accurate).toBe(true); // team1 won first map
      expect(result.seriesOutcome.accurate).toBe(false); // predicted 2-1 but was 1-1 (incomplete)
    });

    it('should throw error for non-finished match', async () => {
      const unfinishedMatch = { ...mockMatch, status: 'live' };
      CS2Match.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(unfinishedMatch),
        }),
      });

      await expect(tracker.evaluatePredictions('test-match-123')).rejects.toThrow(
        'Match test-match-123 is not finished yet',
      );
    });

    it('should handle match not found', async () => {
      CS2Match.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      await expect(tracker.evaluatePredictions('nonexistent-match')).rejects.toThrow(
        'Match nonexistent-match not found',
      );
    });
  });

  describe('_evaluateHalfTimePrediction', () => {
    it('should correctly evaluate accurate half-time prediction', async () => {
      const result = await tracker._evaluateHalfTimePrediction(mockMatch);

      expect(result.accurate).toBe(true);
      expect(result.actualWinner).toBe('team1');
      expect(result.predictedWinner).toBe('team1');
      expect(result.confidence).toBe(0.75);
      expect(result.actualScore).toEqual({ team1: 8, team2: 7 }); // Based on mock rounds
    });

    it('should handle insufficient round data', async () => {
      const matchWithoutRounds = {
        ...mockMatch,
        maps: [{ name: 'de_mirage', rounds: [] }],
      };

      const result = await tracker._evaluateHalfTimePrediction(matchWithoutRounds);

      expect(result.accurate).toBe(false);
      expect(result.reason).toBe('insufficient_data');
    });
  });

  describe('_evaluateMapWinnerPrediction', () => {
    it('should correctly evaluate accurate map winner prediction', async () => {
      const result = await tracker._evaluateMapWinnerPrediction(mockMatch);

      expect(result.accurate).toBe(true);
      expect(result.actualWinner).toBe('team1-id');
      expect(result.predictedWinner).toBe('team1-id');
      expect(result.mapName).toBe('de_mirage');
    });

    it('should handle missing winner data', async () => {
      const matchWithoutWinner = {
        ...mockMatch,
        maps: [{ name: 'de_mirage', winner: null }],
      };

      const result = await tracker._evaluateMapWinnerPrediction(matchWithoutWinner);

      expect(result.accurate).toBe(false);
      expect(result.reason).toBe('no_winner_data');
    });
  });

  describe('_evaluateSeriesOutcomePrediction', () => {
    it('should correctly evaluate series outcome prediction', async () => {
      // Add third map to complete the series
      const completeMatch = {
        ...mockMatch,
        maps: [
          ...mockMatch.maps,
          { name: 'de_inferno', winner: 'team1-id', score: { team1: 16, team2: 10 } },
        ],
      };

      const result = await tracker._evaluateSeriesOutcomePrediction(completeMatch);

      expect(result.accurate).toBe(true);
      expect(result.actualOutcome).toBe('2-1');
      expect(result.predictedOutcome).toBe('2-1');
      expect(result.outcomeAccurate).toBe(true);
      expect(result.winnerAccurate).toBe(true);
    });

    it('should handle non-bo3 series', async () => {
      const bo1Match = { ...mockMatch, format: 'bo1' };

      const result = await tracker._evaluateSeriesOutcomePrediction(bo1Match);

      expect(result.accurate).toBe(false);
      expect(result.reason).toBe('not_bo3_series');
    });

    it('should handle insufficient maps', async () => {
      const incompleteMatch = {
        ...mockMatch,
        maps: [mockMatch.maps[0]], // Only one map
      };

      const result = await tracker._evaluateSeriesOutcomePrediction(incompleteMatch);

      expect(result.accurate).toBe(false);
      expect(result.reason).toBe('insufficient_maps');
    });
  });

  describe('calculateAccuracyMetrics', () => {
    beforeEach(() => {
      // Mock aggregation results
      CS2Match.aggregate.mockResolvedValue([
        {
          totalPredictions: 100,
          accuratePredictions: 75,
          averageConfidence: 0.72,
          confidenceSum: 72,
          accurateConfidenceSum: 54,
        },
      ]);
    });

    it('should calculate accuracy metrics for all prediction types', async () => {
      const result = await tracker.calculateAccuracyMetrics();

      expect(result).toHaveProperty('halfTime');
      expect(result).toHaveProperty('mapWinner');
      expect(result).toHaveProperty('seriesOutcome');
      expect(result).toHaveProperty('overall');

      expect(result.halfTime.accuracy).toBe(75);
      expect(result.halfTime.totalPredictions).toBe(100);
      expect(result.halfTime.averageConfidence).toBe(0.72);
    });

    it('should calculate metrics for specific prediction type', async () => {
      const result = await tracker.calculateAccuracyMetrics({ predictionType: 'halfTime' });

      expect(result).toHaveProperty('halfTime');
      expect(result).not.toHaveProperty('mapWinner');
      expect(result).not.toHaveProperty('overall');
    });

    it('should handle different timeframes', async () => {
      await tracker.calculateAccuracyMetrics({ timeframe: '7d' });

      expect(CS2Match.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              date: expect.objectContaining({
                $gte: expect.any(Date),
              }),
            }),
          }),
        ]),
      );
    });

    it('should handle confidence range filters', async () => {
      await tracker.calculateAccuracyMetrics({
        minConfidence: 0.7,
        maxConfidence: 0.9,
      });

      expect(CS2Match.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              'predictions.halfTime.confidence': {
                $gte: 0.7,
                $lte: 0.9,
              },
            }),
          }),
        ]),
      );
    });
  });

  describe('getAccuracyByConfidenceRange', () => {
    beforeEach(() => {
      CS2Match.aggregate.mockResolvedValue([
        {
          totalPredictions: 20,
          accuratePredictions: 15,
          averageConfidence: 0.75,
          confidenceSum: 15,
          accurateConfidenceSum: 11.25,
        },
      ]);
    });

    it('should return accuracy breakdown by confidence ranges', async () => {
      const result = await tracker.getAccuracyByConfidenceRange();

      expect(result).toHaveProperty('50-60%');
      expect(result).toHaveProperty('60-70%');
      expect(result).toHaveProperty('70-80%');
      expect(result).toHaveProperty('80-90%');
      expect(result).toHaveProperty('90-100%');

      expect(result['70-80%']).toHaveProperty('halfTime');
      expect(result['70-80%']).toHaveProperty('mapWinner');
      expect(result['70-80%']).toHaveProperty('seriesOutcome');
    });

    it('should handle specific prediction type', async () => {
      const result = await tracker.getAccuracyByConfidenceRange({
        predictionType: 'halfTime',
      });

      expect(result['70-80%']).toHaveProperty('accuracy');
      expect(result['70-80%']).toHaveProperty('totalPredictions');
      expect(result['70-80%']).not.toHaveProperty('halfTime');
    });
  });

  describe('getAccuracyTrends', () => {
    beforeEach(() => {
      CS2Match.aggregate.mockResolvedValue([
        {
          _id: '2024-01-15',
          totalPredictions: 10,
          halfTimeAccurate: 8,
          halfTimeTotal: 10,
          mapWinnerAccurate: 7,
          mapWinnerTotal: 10,
          seriesOutcomeAccurate: 6,
          seriesOutcomeTotal: 8,
        },
        {
          _id: '2024-01-16',
          totalPredictions: 12,
          halfTimeAccurate: 9,
          halfTimeTotal: 12,
          mapWinnerAccurate: 8,
          mapWinnerTotal: 12,
          seriesOutcomeAccurate: 7,
          seriesOutcomeTotal: 10,
        },
      ]);
    });

    it('should return daily accuracy trends', async () => {
      const result = await tracker.getAccuracyTrends();

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('date', '2024-01-15');
      expect(result[0]).toHaveProperty('halfTime');
      expect(result[0]).toHaveProperty('mapWinner');
      expect(result[0]).toHaveProperty('seriesOutcome');
      expect(result[0]).toHaveProperty('overall');

      expect(result[0].halfTime.accuracy).toBe(80);
      expect(result[0].mapWinner.accuracy).toBe(70);
      expect(result[0].seriesOutcome.accuracy).toBe(75);
    });

    it('should handle different periods', async () => {
      await tracker.getAccuracyTrends({ period: 'monthly' });

      expect(CS2Match.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $group: expect.objectContaining({
              _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
            }),
          }),
        ]),
      );
    });
  });

  describe('batchEvaluatePredictions', () => {
    it('should evaluate multiple matches successfully', async () => {
      const matchIds = ['match1', 'match2', 'match3'];

      // Mock successful evaluations
      tracker.evaluatePredictions = jest
        .fn()
        .mockResolvedValueOnce({ halfTime: { accurate: true } })
        .mockResolvedValueOnce({ mapWinner: { accurate: false } })
        .mockRejectedValueOnce(new Error('Match not found'));

      const result = await tracker.batchEvaluatePredictions(matchIds);

      expect(result.summary.total).toBe(3);
      expect(result.summary.evaluated).toBe(2);
      expect(result.summary.errors).toBe(1);
      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
    });

    it('should handle empty match list', async () => {
      const result = await tracker.batchEvaluatePredictions([]);

      expect(result.summary.total).toBe(0);
      expect(result.summary.evaluated).toBe(0);
      expect(result.summary.errors).toBe(0);
    });
  });

  describe('_getDateFilter', () => {
    it('should return correct date filter for different timeframes', () => {
      const now = new Date();

      const filter7d = tracker._getDateFilter('7d');
      const expectedDate7d = new Date();
      expectedDate7d.setDate(now.getDate() - 7);

      expect(filter7d.date.$gte.getDate()).toBe(expectedDate7d.getDate());

      const filter30d = tracker._getDateFilter('30d');
      const expectedDate30d = new Date();
      expectedDate30d.setDate(now.getDate() - 30);

      expect(filter30d.date.$gte.getDate()).toBe(expectedDate30d.getDate());

      const filter1y = tracker._getDateFilter('1y');
      const expectedDate1y = new Date();
      expectedDate1y.setFullYear(now.getFullYear() - 1);

      expect(filter1y.date.$gte.getFullYear()).toBe(expectedDate1y.getFullYear());
    });

    it('should default to 30 days for unknown timeframe', () => {
      const filter = tracker._getDateFilter('unknown');
      const now = new Date();
      const expectedDate = new Date();
      expectedDate.setDate(now.getDate() - 30);

      expect(filter.date.$gte.getDate()).toBe(expectedDate.getDate());
    });
  });

  describe('_calculateOverallMetrics', () => {
    it('should calculate overall metrics correctly', () => {
      const metrics = {
        halfTime: {
          totalPredictions: 100,
          accuratePredictions: 80,
          averageConfidence: 75,
        },
        mapWinner: {
          totalPredictions: 90,
          accuratePredictions: 70,
          averageConfidence: 70,
        },
        seriesOutcome: {
          totalPredictions: 50,
          accuratePredictions: 35,
          averageConfidence: 65,
        },
      };

      const overall = tracker._calculateOverallMetrics(metrics);

      expect(overall.totalPredictions).toBe(240);
      expect(overall.accuratePredictions).toBe(185);
      expect(overall.accuracy).toBe(77.08); // (185/240) * 100, rounded to 2 decimals
    });

    it('should handle empty metrics', () => {
      const overall = tracker._calculateOverallMetrics({});

      expect(overall.totalPredictions).toBe(0);
      expect(overall.accuratePredictions).toBe(0);
      expect(overall.accuracy).toBe(0);
    });
  });
});
