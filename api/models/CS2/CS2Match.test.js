/**
 * Unit tests for CS2Match model methods
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createModels } = require('@librechat/data-schemas');

const {
  createMatch,
  findMatchByHltvId,
  updateMatchByHltvId,
  findMatchesByTeam,
  findLiveMatches,
  updateMatchPredictions,
} = require('./CS2Match');

let mongoServer;
let models;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  
  models = createModels(mongoose);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await models.CS2Match.deleteMany({});
  await models.CS2Team.deleteMany({});
});

describe('CS2Match Model Methods', () => {
  let testTeam1, testTeam2;
  
  beforeEach(async () => {
    // Create test teams
    testTeam1 = await models.CS2Team.create({
      hltvId: 'team1',
      name: 'Team Alpha',
      country: 'US',
      ranking: { current: 1 },
      players: [],
      recentForm: [],
      mapStats: [],
      statistics: {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        avgRating: 0,
        avgKD: 0,
        avgADR: 0,
      },
      achievements: [],
      metadata: {
        scrapedAt: new Date(),
        lastUpdated: new Date(),
        source: 'HLTV',
        isActive: true,
      },
    });
    
    testTeam2 = await models.CS2Team.create({
      hltvId: 'team2',
      name: 'Team Beta',
      country: 'SE',
      ranking: { current: 2 },
      players: [],
      recentForm: [],
      mapStats: [],
      statistics: {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        avgRating: 0,
        avgKD: 0,
        avgADR: 0,
      },
      achievements: [],
      metadata: {
        scrapedAt: new Date(),
        lastUpdated: new Date(),
        source: 'HLTV',
        isActive: true,
      },
    });
  });

  describe('createMatch', () => {
    test('should create a new match successfully', async () => {
      const matchData = {
        hltvId: 'match123',
        date: new Date(),
        tournament: {
          name: 'Test Tournament',
          tier: 'S',
          prizePool: 100000,
        },
        teams: [
          { team: testTeam1._id, score: 0, isWinner: false },
          { team: testTeam2._id, score: 0, isWinner: false },
        ],
        maps: [],
        status: 'upcoming',
        format: 'bo3',
        predictions: {
          halfTime: { predicted: false, factors: [] },
          mapWinner: { predicted: false, factors: [] },
          seriesOutcome: { predicted: false, factors: [] },
        },
        metadata: {
          scrapedAt: new Date(),
          lastUpdated: new Date(),
          source: 'HLTV',
          version: '1.0',
        },
      };

      const match = await createMatch(matchData);
      
      expect(match).toBeDefined();
      expect(match.hltvId).toBe('match123');
      expect(match.tournament.name).toBe('Test Tournament');
      expect(match.teams).toHaveLength(2);
      expect(match.status).toBe('upcoming');
    });

    test('should fail to create match with duplicate hltvId', async () => {
      const matchData = {
        hltvId: 'duplicate123',
        date: new Date(),
        tournament: { name: 'Test Tournament' },
        teams: [
          { team: testTeam1._id, score: 0, isWinner: false },
          { team: testTeam2._id, score: 0, isWinner: false },
        ],
        maps: [],
        status: 'upcoming',
        predictions: {
          halfTime: { predicted: false, factors: [] },
          mapWinner: { predicted: false, factors: [] },
          seriesOutcome: { predicted: false, factors: [] },
        },
        metadata: {
          scrapedAt: new Date(),
          lastUpdated: new Date(),
          source: 'HLTV',
          version: '1.0',
        },
      };

      await createMatch(matchData);
      
      await expect(createMatch(matchData)).rejects.toThrow();
    });
  });

  describe('findMatchByHltvId', () => {
    test('should find existing match by hltvId', async () => {
      const matchData = {
        hltvId: 'find123',
        date: new Date(),
        tournament: { name: 'Find Tournament' },
        teams: [
          { team: testTeam1._id, score: 0, isWinner: false },
          { team: testTeam2._id, score: 0, isWinner: false },
        ],
        maps: [],
        status: 'live',
        predictions: {
          halfTime: { predicted: false, factors: [] },
          mapWinner: { predicted: false, factors: [] },
          seriesOutcome: { predicted: false, factors: [] },
        },
        metadata: {
          scrapedAt: new Date(),
          lastUpdated: new Date(),
          source: 'HLTV',
          version: '1.0',
        },
      };

      await createMatch(matchData);
      const found = await findMatchByHltvId('find123');
      
      expect(found).toBeDefined();
      expect(found.hltvId).toBe('find123');
      expect(found.status).toBe('live');
    });

    test('should return null for non-existent match', async () => {
      const found = await findMatchByHltvId('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('updateMatchByHltvId', () => {
    test('should update existing match', async () => {
      const matchData = {
        hltvId: 'update123',
        date: new Date(),
        tournament: { name: 'Update Tournament' },
        teams: [
          { team: testTeam1._id, score: 0, isWinner: false },
          { team: testTeam2._id, score: 0, isWinner: false },
        ],
        maps: [],
        status: 'upcoming',
        predictions: {
          halfTime: { predicted: false, factors: [] },
          mapWinner: { predicted: false, factors: [] },
          seriesOutcome: { predicted: false, factors: [] },
        },
        metadata: {
          scrapedAt: new Date(),
          lastUpdated: new Date(),
          source: 'HLTV',
          version: '1.0',
        },
      };

      await createMatch(matchData);
      
      const updated = await updateMatchByHltvId('update123', {
        status: 'live',
        'teams.0.score': 1,
      });
      
      expect(updated).toBeDefined();
      expect(updated.status).toBe('live');
      expect(updated.metadata.lastUpdated).toBeDefined();
    });
  });

  describe('findMatchesByTeam', () => {
    test('should find matches for a specific team', async () => {
      const matchData = {
        hltvId: 'team_match123',
        date: new Date(),
        tournament: { name: 'Team Tournament' },
        teams: [
          { team: testTeam1._id, score: 0, isWinner: false },
          { team: testTeam2._id, score: 0, isWinner: false },
        ],
        maps: [],
        status: 'finished',
        predictions: {
          halfTime: { predicted: false, factors: [] },
          mapWinner: { predicted: false, factors: [] },
          seriesOutcome: { predicted: false, factors: [] },
        },
        metadata: {
          scrapedAt: new Date(),
          lastUpdated: new Date(),
          source: 'HLTV',
          version: '1.0',
        },
      };

      await createMatch(matchData);
      
      const matches = await findMatchesByTeam(testTeam1._id.toString());
      
      expect(matches).toHaveLength(1);
      expect(matches[0].hltvId).toBe('team_match123');
    });

    test('should filter matches by status', async () => {
      const liveMatch = {
        hltvId: 'live123',
        date: new Date(),
        tournament: { name: 'Live Tournament' },
        teams: [
          { team: testTeam1._id, score: 0, isWinner: false },
          { team: testTeam2._id, score: 0, isWinner: false },
        ],
        maps: [],
        status: 'live',
        predictions: {
          halfTime: { predicted: false, factors: [] },
          mapWinner: { predicted: false, factors: [] },
          seriesOutcome: { predicted: false, factors: [] },
        },
        metadata: {
          scrapedAt: new Date(),
          lastUpdated: new Date(),
          source: 'HLTV',
          version: '1.0',
        },
      };

      const finishedMatch = {
        hltvId: 'finished123',
        date: new Date(),
        tournament: { name: 'Finished Tournament' },
        teams: [
          { team: testTeam1._id, score: 0, isWinner: false },
          { team: testTeam2._id, score: 0, isWinner: false },
        ],
        maps: [],
        status: 'finished',
        predictions: {
          halfTime: { predicted: false, factors: [] },
          mapWinner: { predicted: false, factors: [] },
          seriesOutcome: { predicted: false, factors: [] },
        },
        metadata: {
          scrapedAt: new Date(),
          lastUpdated: new Date(),
          source: 'HLTV',
          version: '1.0',
        },
      };

      await createMatch(liveMatch);
      await createMatch(finishedMatch);
      
      const liveMatches = await findMatchesByTeam(testTeam1._id.toString(), { status: 'live' });
      
      expect(liveMatches).toHaveLength(1);
      expect(liveMatches[0].status).toBe('live');
    });
  });

  describe('findLiveMatches', () => {
    test('should find only live matches', async () => {
      const liveMatch = {
        hltvId: 'live456',
        date: new Date(),
        tournament: { name: 'Live Tournament' },
        teams: [
          { team: testTeam1._id, score: 0, isWinner: false },
          { team: testTeam2._id, score: 0, isWinner: false },
        ],
        maps: [],
        status: 'live',
        predictions: {
          halfTime: { predicted: false, factors: [] },
          mapWinner: { predicted: false, factors: [] },
          seriesOutcome: { predicted: false, factors: [] },
        },
        metadata: {
          scrapedAt: new Date(),
          lastUpdated: new Date(),
          source: 'HLTV',
          version: '1.0',
        },
      };

      const upcomingMatch = {
        hltvId: 'upcoming456',
        date: new Date(),
        tournament: { name: 'Upcoming Tournament' },
        teams: [
          { team: testTeam1._id, score: 0, isWinner: false },
          { team: testTeam2._id, score: 0, isWinner: false },
        ],
        maps: [],
        status: 'upcoming',
        predictions: {
          halfTime: { predicted: false, factors: [] },
          mapWinner: { predicted: false, factors: [] },
          seriesOutcome: { predicted: false, factors: [] },
        },
        metadata: {
          scrapedAt: new Date(),
          lastUpdated: new Date(),
          source: 'HLTV',
          version: '1.0',
        },
      };

      await createMatch(liveMatch);
      await createMatch(upcomingMatch);
      
      const liveMatches = await findLiveMatches();
      
      expect(liveMatches).toHaveLength(1);
      expect(liveMatches[0].status).toBe('live');
    });
  });

  describe('updateMatchPredictions', () => {
    test('should update match predictions', async () => {
      const matchData = {
        hltvId: 'predict123',
        date: new Date(),
        tournament: { name: 'Prediction Tournament' },
        teams: [
          { team: testTeam1._id, score: 0, isWinner: false },
          { team: testTeam2._id, score: 0, isWinner: false },
        ],
        maps: [],
        status: 'live',
        predictions: {
          halfTime: { predicted: false, factors: [] },
          mapWinner: { predicted: false, factors: [] },
          seriesOutcome: { predicted: false, factors: [] },
        },
        metadata: {
          scrapedAt: new Date(),
          lastUpdated: new Date(),
          source: 'HLTV',
          version: '1.0',
        },
      };

      await createMatch(matchData);
      
      const predictions = {
        halfTime: {
          predicted: true,
          winner: testTeam1._id,
          confidence: 0.75,
          factors: [
            { name: 'current_score', weight: 0.4, value: '8-7' },
            { name: 'economy', weight: 0.3, value: 'favorable' },
          ],
        },
      };
      
      const updated = await updateMatchPredictions('predict123', predictions);
      
      expect(updated).toBeDefined();
      expect(updated.predictions.halfTime.predicted).toBe(true);
      expect(updated.predictions.halfTime.confidence).toBe(0.75);
      expect(updated.predictions.halfTime.factors).toHaveLength(2);
    });
  });
});