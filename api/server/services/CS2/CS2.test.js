/**
 * Basic tests for CS2 scraper structure
 */

const config = require('./config');
const { CS2ScraperError, HLTVParsingError } = require('./errors');
const { 
  sanitizeTeamName, 
  parseMatchId, 
  standardizeMapName,
  calculateWinRate,
  validateMatchData 
} = require('./utils');

describe('CS2 Scraper Configuration', () => {
  test('should have valid default configuration', () => {
    expect(config.scraper.enabled).toBeDefined();
    expect(config.scraper.userAgent).toBeDefined();
    expect(config.scraper.requestDelay).toBeGreaterThan(0);
    expect(config.urls.base).toBe('https://www.hltv.org');
  });

  test('should have valid schedule configuration', () => {
    expect(config.schedule.matches).toBeDefined();
    expect(config.schedule.live).toBeDefined();
    expect(config.schedule.historical).toBeDefined();
  });
});

describe('CS2 Scraper Errors', () => {
  test('should create CS2ScraperError with correct properties', () => {
    const error = new CS2ScraperError('Test error', 'TEST_CODE', { test: true });
    expect(error.name).toBe('CS2ScraperError');
    expect(error.code).toBe('TEST_CODE');
    expect(error.details.test).toBe(true);
    expect(error.timestamp).toBeDefined();
  });

  test('should create HLTVParsingError with URL', () => {
    const error = new HLTVParsingError('Parse failed', 'https://test.com');
    expect(error.name).toBe('HLTVParsingError');
    expect(error.details.url).toBe('https://test.com');
  });
});

describe('CS2 Scraper Utils', () => {
  test('should sanitize team names correctly', () => {
    expect(sanitizeTeamName('  Team  Name  ')).toBe('Team Name');
    expect(sanitizeTeamName('Team\t\nName')).toBe('Team Name');
    expect(sanitizeTeamName('')).toBe('');
  });

  test('should parse match ID from URL', () => {
    const url = 'https://www.hltv.org/matches/2374849/natus-vincere-vs-astralis-iem-katowice-2024';
    expect(parseMatchId(url)).toBe('2374849');
    expect(parseMatchId('invalid-url')).toBeNull();
  });

  test('should standardize map names', () => {
    expect(standardizeMapName('de_dust2')).toBe('Dust2');
    expect(standardizeMapName('de_mirage')).toBe('Mirage');
    expect(standardizeMapName('unknown_map')).toBe('unknown_map');
  });

  test('should calculate win rate correctly', () => {
    expect(calculateWinRate([1, 1, 0, 1, 0])).toBe(0.6);
    expect(calculateWinRate([])).toBe(0);
    expect(calculateWinRate([1, 1, 1])).toBe(1);
  });

  test('should validate match data structure', () => {
    const validMatch = {
      hltvId: '123',
      date: new Date(),
      teams: []
    };
    expect(validateMatchData(validMatch)).toBe(true);
    expect(validateMatchData({})).toBe(false);
    expect(validateMatchData(null)).toBe(false);
  });
});