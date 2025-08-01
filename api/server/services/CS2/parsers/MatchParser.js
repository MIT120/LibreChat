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
      // Primary selectors (updated for current HLTV structure)
      primary: {
        matchElements: '.upcomingMatch, .result-con, .liveMatch, .upcoming-match, .result, .match',
        matchLink: 'a[href*="/matches/"], a[href*="matches"]',
        teamName:
          '.teamName, .team-name, .team, .team1-gradient, .team2-gradient, .team div, .team span, .team-logo + span, .team-logo + div',
        matchTime: '.matchTime, .time, .match-time, .date, .startTime',
        matchEvent: '.matchEvent, .event, .tournament, .event-name, .match-event',
        matchScore: '.matchMeta, .result-score, .score, .result, .maps, .bo',
        liveIndicator: '.live, .status-live, .liveMatch',
      },

      // Fallback selectors (broader compatibility)
      fallback: {
        matchElements:
          '.match, .match-item, .upcoming-match, .result, .game, .fixture, div[class*="match"], div[class*="result"]',
        matchLink: 'a[href*="matches"], a[href*="/matches/"], a[href*="match"]',
        teamName:
          '.team .name, .team-title, .teamname, .team, .team-name, .team1, .team2, .opponent, .competitor, div[class*="team"] span, div[class*="team"] div',
        matchTime: '.time, .match-time, .date, .timestamp, .when, .start-time, .scheduled',
        matchEvent: '.event, .tournament, .match-event, .competition, .league, .series',
        matchScore: '.score, .result, .match-score, .final-score, .maps-score, .bo, .series-score',
        liveIndicator: '.live, .status-live, .in-progress, .ongoing, .active',
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

    // Extract team names with multiple fallback strategies
    let teams = [];

    // Strategy 1: Use the configured selectors
    const teamElements = element.querySelectorAll(selectors.teamName);
    teams = Array.from(teamElements)
      .map((team) => team.textContent?.trim())
      .filter((name) => name && name.length > 1)
      .map((name) => sanitizeTeamName(name));

    // Strategy 2: If no teams found, try to extract from match link text
    if (teams.length < 2) {
      const linkElement = element.querySelector(selectors.matchLink);
      const linkText = linkElement?.textContent?.trim() || '';
      const vsMatch = linkText.match(/(.+?)\s+vs\s+(.+)/i);
      if (vsMatch) {
        teams = [sanitizeTeamName(vsMatch[1].trim()), sanitizeTeamName(vsMatch[2].trim())];
      }
    }

    // Strategy 3: Look for any elements that might contain team names
    if (teams.length < 2) {
      const possibleTeamElements = element.querySelectorAll('span, div, .team, [class*="team"]');
      const possibleTeams = Array.from(possibleTeamElements)
        .map((el) => el.textContent?.trim())
        .filter((text) => text && text.length > 1 && text.length < 30)
        .filter((text) => /^[A-Za-z0-9\s\-.]+$/.test(text)) // Only valid team name characters
        .map((name) => sanitizeTeamName(name))
        .slice(0, 2); // Take first 2 potential team names

      if (possibleTeams.length >= 2) {
        teams = possibleTeams;
      }
    }

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
