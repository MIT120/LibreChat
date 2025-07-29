/**
 * Basic tests for parsers and validators
 */

const MatchParser = require('./MatchParser');
const TeamParser = require('./TeamParser');
const PlayerParser = require('./PlayerParser');
const DataValidator = require('../validators/DataValidator');

describe('HLTV Parsers', () => {
  describe('MatchParser', () => {
    test('should create instance', () => {
      const parser = new MatchParser();
      expect(parser).toBeInstanceOf(MatchParser);
      expect(parser.selectors).toBeDefined();
    });

    test('should validate match data structure', () => {
      const parser = new MatchParser();
      const validMatch = {
        hltvId: '123',
        teams: ['Team A', 'Team B'],
        status: 'upcoming',
      };
      expect(parser.validateMatchData(validMatch)).toBe(true);
      expect(parser.validateMatchData({})).toBe(false);
    });
  });

  describe('TeamParser', () => {
    test('should create instance', () => {
      const parser = new TeamParser();
      expect(parser).toBeInstanceOf(TeamParser);
      expect(parser.selectors).toBeDefined();
    });

    test('should validate team data structure', () => {
      const parser = new TeamParser();
      const validTeam = {
        name: 'Test Team',
        players: [],
      };
      expect(parser.validateTeamData(validTeam)).toBe(true);
      expect(parser.validateTeamData({})).toBe(false);
    });
  });

  describe('PlayerParser', () => {
    test('should create instance', () => {
      const parser = new PlayerParser();
      expect(parser).toBeInstanceOf(PlayerParser);
      expect(parser.selectors).toBeDefined();
    });

    test('should validate player data structure', () => {
      const parser = new PlayerParser();
      const validPlayer = {
        name: 'TestPlayer',
        stats: {},
      };
      expect(parser.validatePlayerData(validPlayer)).toBe(true);
      expect(parser.validatePlayerData({})).toBe(false);
    });
  });

  describe('DataValidator', () => {
    let validator;

    beforeEach(() => {
      validator = new DataValidator();
    });

    test('should create instance with schemas', () => {
      expect(validator).toBeInstanceOf(DataValidator);
      expect(validator.schemas.match).toBeDefined();
      expect(validator.schemas.team).toBeDefined();
      expect(validator.schemas.player).toBeDefined();
    });

    test('should validate match data', () => {
      const validMatch = {
        hltvId: '123',
        teams: ['Team A', 'Team B'],
        status: 'upcoming',
      };
      const result = validator.validateMatch(validMatch);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject invalid match data', () => {
      const invalidMatch = {
        hltvId: '',
        teams: ['Only one team'],
        status: 'invalid_status',
      };
      const result = validator.validateMatch(invalidMatch);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate team data', () => {
      const validTeam = {
        name: 'Test Team',
        ranking: 5,
        players: [],
      };
      const result = validator.validateTeam(validTeam);
      expect(result.isValid).toBe(true);
    });

    test('should validate player data', () => {
      const validPlayer = {
        name: 'TestPlayer',
        age: 25,
        stats: {},
      };
      const result = validator.validatePlayer(validPlayer);
      expect(result.isValid).toBe(true);
    });
  });
});
