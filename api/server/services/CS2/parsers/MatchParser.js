/**
 * Match Parser for HLTV Match Pages
 *
 * Handles parsing of match data from various HLTV page formats
 * with fallback mechanisms for structure changes.
 */

const { HLTVParsingError } = require('../errors');
const { sanitizeTeamName, standardizeMapName } = require('../utils');

class MatchParser {
  constructor() {
    this.selectors = {
      // Primary selectors (current HLTV structure)
      primary: {
        matchElements: '.upcomingMatch, .result-con, .liveMatch',
        matchLink: 'a[href*="/matches/"]',
        teamName: '.teamName, .team-name',
        matchTime: '.matchTime, .time',
        matchEvent: '.matchEvent, .event',
        matchScore: '.matchMeta, .result-score',
        liveIndicator: '.live',
      },

      // Fallback selectors (alternative structures)
      fallback: {
        matchElements: '.match, .match-item, .upcoming-match',
        matchLink: 'a[href*="matches"]',
        teamName: '.team .name, .team-title, .teamname',
        matchTime: '.time, .match-time, .date',
        matchEvent: '.event, .tournament, .match-event',
        matchScore: '.score, .result, .match-score',
        liveIndicator: '.live, .status-live',
      },
    };
  }

  /**
   * Parse match list from HLTV matches page
   * @param {Document} document - DOM document
   * @param {number} limit - Maximum matches to parse
   * @returns {Array} Parsed match objects
   */
  parseMatchList(document, limit = 50) {
    try {
      // Try primary selectors first
      let matches = this.parseWithSelectors(document, this.selectors.primary, limit);

      // If no matches found, try fallback selectors
      if (matches.length === 0) {
        matches = this.parseWithSelectors(document, this.selectors.fallback, limit);
      }

      return matches;
    } catch (error) {
      throw new HLTVParsingError(
        `Failed to parse match list: ${error.message}`,
        window.location?.href || 'unknown',
        { originalError: error.message },
      );
    }
  }

  /**
   * Parse matches using specific selectors
   * @param {Document} document - DOM document
   * @param {Object} selectors - Selector configuration
   * @param {number} limit - Maximum matches to parse
   * @returns {Array} Parsed match objects
   */
  parseWithSelectors(document, selectors, limit) {
    const matchElements = document.querySelectorAll(selectors.matchElements);
    const results = [];

    for (let i = 0; i < Math.min(matchElements.length, limit); i++) {
      const element = matchElements[i];

      try {
        const match = this.parseMatchElement(element, selectors);
        if (match && match.hltvId) {
          results.push(match);
        }
      } catch (error) {
        console.warn(`Failed to parse match element ${i}:`, error.message);
        // Continue parsing other matches
      }
    }

    return results;
  }

  /**
   * Parse individual match element
   * @param {Element} element - Match DOM element
   * @param {Object} selectors - Selector configuration
   * @returns {Object|null} Parsed match object
   */
  parseMatchElement(element, selectors) {
    // Extract match ID from href
    const linkElement = element.querySelector(selectors.matchLink);
    const href = linkElement?.href || '';
    const matchIdMatch = href.match(/\/matches\/(\d+)\//);
    const hltvId = matchIdMatch ? matchIdMatch[1] : null;

    if (!hltvId) {
      return null;
    }

    // Extract team names
    const teamElements = element.querySelectorAll(selectors.teamName);
    const teams = Array.from(teamElements)
      .map((team) => team.textContent?.trim())
      .filter((name) => name)
      .map((name) => sanitizeTeamName(name));

    // Extract date/time
    const timeElement = element.querySelector(selectors.matchTime);
    const dateStr = timeElement ? timeElement.textContent.trim() : '';

    // Extract tournament info
    const eventElement = element.querySelector(selectors.matchEvent);
    const tournament = eventElement ? eventElement.textContent.trim() : '';

    // Extract score if available (for results)
    const scoreElements = element.querySelectorAll(selectors.matchScore);
    const scores = Array.from(scoreElements).map((score) => score.textContent.trim());

    // Determine match status
    let status = 'upcoming';
    if (element.querySelector(selectors.liveIndicator) || element.classList.contains('live')) {
      status = 'live';
    } else if (element.classList.contains('result-con') || scores.length > 0) {
      status = 'finished';
    }

    return {
      hltvId,
      teams,
      dateStr,
      tournament,
      scores,
      status,
    };
  }

  /**
   * Parse detailed match page
   * @param {Document} document - DOM document
   * @returns {Object} Detailed match object
   */
  parseMatchDetails(document) {
    try {
      const result = {
        teams: [],
        maps: [],
        tournament: {},
        status: 'upcoming',
        players: [],
      };

      // Parse teams with multiple selector strategies
      result.teams = this.parseTeams(document);

      // Parse maps
      result.maps = this.parseMaps(document);

      // Parse tournament info
      result.tournament = this.parseTournament(document);

      // Parse players
      result.players = this.parsePlayers(document);

      // Determine status
      result.status = this.parseMatchStatus(document);

      return result;
    } catch (error) {
      throw new HLTVParsingError(
        `Failed to parse match details: ${error.message}`,
        window.location?.href || 'unknown',
        { originalError: error.message },
      );
    }
  }

  /**
   * Parse team information from match details
   * @param {Document} document - DOM document
   * @returns {Array} Team objects
   */
  parseTeams(document) {
    const teamSelectors = ['.team', '.match-team', '.team-box', '.teamName'];

    for (const selector of teamSelectors) {
      const teamElements = document.querySelectorAll(selector);
      if (teamElements.length > 0) {
        return Array.from(teamElements)
          .map((team) => {
            const nameElement = team.querySelector('.teamName, .team-name, .name') || team;
            const logoElement = team.querySelector('.logo, .team-logo, img');

            return {
              name: sanitizeTeamName(nameElement.textContent?.trim() || ''),
              logo: logoElement?.src || '',
              players: [],
            };
          })
          .filter((team) => team.name);
      }
    }

    return [];
  }

  /**
   * Parse map information from match details
   * @param {Document} document - DOM document
   * @returns {Array} Map objects
   */
  parseMaps(document) {
    const mapSelectors = ['.mapholder', '.map', '.match-map', '.map-holder'];

    for (const selector of mapSelectors) {
      const mapElements = document.querySelectorAll(selector);
      if (mapElements.length > 0) {
        return Array.from(mapElements)
          .map((mapEl) => {
            const mapNameElement = mapEl.querySelector('.mapname, .map-name, .name');
            const scoreElements = mapEl.querySelectorAll(
              '.results-team-score, .score, .team-score',
            );

            return {
              name: standardizeMapName(mapNameElement?.textContent?.trim() || ''),
              scores: Array.from(scoreElements).map(
                (score) => parseInt(score.textContent.trim()) || 0,
              ),
            };
          })
          .filter((map) => map.name);
      }
    }

    return [];
  }

  /**
   * Parse tournament information
   * @param {Document} document - DOM document
   * @returns {Object} Tournament object
   */
  parseTournament(document) {
    const eventSelectors = ['.event', '.tournament', '.match-event', '.event-name'];

    for (const selector of eventSelectors) {
      const eventElement = document.querySelector(selector);
      if (eventElement) {
        return {
          name: eventElement.textContent?.trim() || '',
          tier: this.extractTournamentTier(eventElement),
          prizePool: this.extractPrizePool(document),
        };
      }
    }

    return {};
  }

  /**
   * Parse player information
   * @param {Document} document - DOM document
   * @returns {Array} Player objects
   */
  parsePlayers(document) {
    const playerSelectors = ['.player', '.lineup .player', '.team-player', '.player-name'];

    const players = [];

    for (const selector of playerSelectors) {
      const playerElements = document.querySelectorAll(selector);
      if (playerElements.length > 0) {
        Array.from(playerElements).forEach((player) => {
          const nameElement = player.querySelector('.player-nick, .name') || player;
          const flagElement = player.querySelector('.flag, .country');

          const playerData = {
            name: nameElement.textContent?.trim() || '',
            country: flagElement?.title || flagElement?.alt || '',
          };

          if (playerData.name) {
            players.push(playerData);
          }
        });
        break; // Use first successful selector
      }
    }

    return players;
  }

  /**
   * Parse match status
   * @param {Document} document - DOM document
   * @returns {string} Match status
   */
  parseMatchStatus(document) {
    if (document.querySelector('.live, .status-live')) {
      return 'live';
    }

    if (document.querySelector('.results, .finished, .match-finished')) {
      return 'finished';
    }

    return 'upcoming';
  }

  /**
   * Extract tournament tier from element
   * @param {Element} element - Tournament element
   * @returns {string} Tournament tier
   */
  extractTournamentTier(element) {
    const text = element.textContent?.toLowerCase() || '';

    if (text.includes('major')) return 'S';
    if (text.includes('premier')) return 'A';
    if (text.includes('championship')) return 'A';
    if (text.includes('masters')) return 'B';

    return 'C'; // Default tier
  }

  /**
   * Extract prize pool from document
   * @param {Document} document - DOM document
   * @returns {number|null} Prize pool amount
   */
  extractPrizePool(document) {
    const prizeSelectors = ['.prize-pool', '.prizepool', '.tournament-prize'];

    for (const selector of prizeSelectors) {
      const prizeElement = document.querySelector(selector);
      if (prizeElement) {
        const text = prizeElement.textContent || '';
        const match = text.match(/\$?([\d,]+)/);
        if (match) {
          return parseInt(match[1].replace(/,/g, ''));
        }
      }
    }

    return null;
  }

  /**
   * Validate parsed match data
   * @param {Object} matchData - Parsed match data
   * @returns {boolean} True if valid
   */
  validateMatchData(matchData) {
    if (!matchData || typeof matchData !== 'object') {
      return false;
    }

    // Required fields
    if (!matchData.hltvId) {
      return false;
    }

    // Teams should be an array
    if (!Array.isArray(matchData.teams)) {
      return false;
    }

    // Status should be valid
    const validStatuses = ['upcoming', 'live', 'finished'];
    if (!validStatuses.includes(matchData.status)) {
      return false;
    }

    return true;
  }
}

module.exports = MatchParser;
