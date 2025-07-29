/**
 * Tests for CS2 schema validation and model creation
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createModels } = require('@librechat/data-schemas');

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

describe('CS2 Schema Validation', () => {
  test('CS2Match model should be available', () => {
    expect(models.CS2Match).toBeDefined();
    expect(typeof models.CS2Match.create).toBe('function');
  });

  test('CS2Team model should be available', () => {
    expect(models.CS2Team).toBeDefined();
    expect(typeof models.CS2Team.create).toBe('function');
  });

  test('CS2Player model should be available', () => {
    expect(models.CS2Player).toBeDefined();
    expect(typeof models.CS2Player.create).toBe('function');
  });

  test('CS2Match should validate required fields', async () => {
    const invalidMatch = {
      // Missing required hltvId and date
      tournament: { name: 'Test Tournament' },
      teams: [],
      maps: [],
      status: 'upcoming',
    };

    await expect(models.CS2Match.create(invalidMatch)).rejects.toThrow();
  });

  test('CS2Match should create with valid data', async () => {
    const validMatch = {
      hltvId: '123456',
      date: new Date(),
      tournament: { name: 'Test Tournament' },
      teams: [],
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

    const match = await models.CS2Match.create(validMatch);
    expect(match).toBeDefined();
    expect(match.hltvId).toBe('test123');
    expect(match.status).toBe('upcoming');
  });

  test('CS2Team should create with valid data', async () => {
    const validTeam = {
      hltvId: 'team123',
      name: 'Test Team',
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
    };

    const team = await models.CS2Team.create(validTeam);
    expect(team).toBeDefined();
    expect(team.hltvId).toBe('team123');
    expect(team.name).toBe('Test Team');
  });

  test('CS2Player should create with valid data', async () => {
    const validPlayer = {
      hltvId: 'player123',
      nickname: 'TestPlayer',
      statistics: {
        overall: {
          rating: 1.0,
          kills: 0,
          deaths: 0,
          assists: 0,
          kd: 0,
          adr: 0,
          kast: 0,
          impact: 0,
          totalMaps: 0,
          totalRounds: 0,
        },
        recent: {
          rating: 1.0,
          kd: 0,
          adr: 0,
          kast: 0,
          mapsPlayed: 0,
          timeframe: '3months',
        },
      },
      mapStats: [],
      weaponStats: {
        rifle: { kills: 0, accuracy: 0, headshotRate: 0 },
        awp: { kills: 0, accuracy: 0, killsPerRound: 0 },
        pistol: { kills: 0, accuracy: 0, roundWinRate: 0 },
      },
      achievements: [],
      metadata: {
        scrapedAt: new Date(),
        lastUpdated: new Date(),
        source: 'HLTV',
        isActive: true,
      },
    };

    const player = await models.CS2Player.create(validPlayer);
    expect(player).toBeDefined();
    expect(player.hltvId).toBe('player123');
    expect(player.nickname).toBe('TestPlayer');
  });

  test('CS2Match should enforce unique hltvId constraint', async () => {
    const matchData = {
      hltvId: 'unique123',
      date: new Date(),
      tournament: { name: 'Unique Tournament' },
      teams: [],
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

    await models.CS2Match.create(matchData);
    
    // Try to create another match with same hltvId
    await expect(models.CS2Match.create(matchData)).rejects.toThrow();
  });

  test('CS2Match should have proper indexes', () => {
    const indexes = models.CS2Match.collection.getIndexes();
    expect(indexes).toBeDefined();
  });
});