/**
 * Team Parser for HLTV Team Pages
 * 
 * Handles parsing of team data from HLTV team pages
 * with fallback mechanisms for structure changes.
 */

const { HLTVParsingError } = require('../errors');
const { sanitizeTeamName } = require('../utils');

class TeamParser {
  constructor() {
    this.selectors = {
      // Primary selectors (current HLTV structure)
      primary: {
        teamName: '.profile-team-name, .team-name',
        ranking: '.profile-team-stat .right, .ranking',
        players: '.bodyshot-team .player, .player-container .player',
        playerName: '.player-nick, .player-name',
        playerFlag: '.flag',
        recentMatches: '.recent-results .result, .match-result',
        teamLogo: '.team-logo, .logo'
      },
      
      // Fallback selectors (alternative structures)
      fallback: {
        teamName: '.team-title, .teamname, h1',
        ranking: '.rank, .team-rank, .position',
        players: '.lineup .player, .roster .player, .team-player',
        playerName: '.name, .nick, .player-title',
        playerFlag: '.country, .flag-icon',
        recentMatches: '.results .match, .match-history .match',
        teamLogo: 'img[alt*="logo"], .team-image'
      }
    };
  }

  /**
   * Parse team statistics page
   * @param {Document} document - DOM document
   * @returns {Object} Parsed team object
   */
  parseTeamStats(document) {
    try {
      // Try primary selectors first
      let teamData = this.parseWithSelectors(document, this.selectors.primary);
      
      // If incomplete data, try fallback selectors
      if (!teamData.name || teamData.players.length === 0) {
        const fallbackData = this.parseWithSelectors(document, this.selectors.fallback);
        teamData = this.mergeTeamData(teamData, fallbackData);
      }
      
      return teamData;
    } catch (error) {
      throw new HLTVParsingError(
        `Failed to parse team stats: ${error.message}`,
        window.location?.href || 'unknown',
        { originalError: error.message }
      );
    }
  }

  /**
   * Parse team data using specific selectors
   * @param {Document} document - DOM document
   * @param {Object} selectors - Selector configuration
   * @returns {Object} Parsed team object
   */
  parseWithSelectors(document, selectors) {
    const result = {
      name: '',
      ranking: null,
      players: [],
      recentMatches: [],
      logo: '',
      stats: {}
    };

    // Parse team name
    const nameElement = document.querySelector(selectors.teamName);
    if (nameElement) {
      result.name = sanitizeTeamName(nameElement.textContent?.trim() || '');
    }

    // Parse ranking
    const rankingElement = document.querySelector(selectors.ranking);
    if (rankingElement) {
      result.ranking = this.parseRanking(rankingElement);
    }

    // Parse team logo
    const logoElement = document.querySelector(selectors.teamLogo);
    if (logoElement) {
      result.logo = logoElement.src || '';
    }

    // Parse players
    result.players = this.parsePlayers(document, selectors);

    // Parse recent matches
    result.recentMatches = this.parseRecentMatches(document, selectors);

    // Parse additional stats
    result.stats = this.parseTeamStatistics(document);

    return result;
  }

  /**
   * Parse team ranking from element
   * @param {Element} element - Ranking element
   * @returns {number|null} Team ranking
   */
  parseRanking(element) {
    const text = element.textContent?.trim() || '';
    
    // Try different ranking formats
    const patterns = [
      /#(\d+)/,           // #5
      /(\d+)/,            // 5
      /rank\s*(\d+)/i,    // Rank 5
      /position\s*(\d+)/i // Position 5
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const ranking = parseInt(match[1]);
        return isNaN(ranking) ? null : ranking;
      }
    }

    return null;
  }

  /**
   * Parse team players
   * @param {Document} document - DOM document
   * @param {Object} selectors - Selector configuration
   * @returns {Array} Player objects
   */
  parsePlayers(document, selectors) {
    const playerElements = document.querySelectorAll(selectors.players);
    const players = [];

    Array.from(playerElements).forEach(playerEl => {
      try {
        const nameElement = playerEl.querySelector(selectors.playerName) || playerEl;
        const flagElement = playerEl.querySelector(selectors.playerFlag);
        
        const player = {
          name: nameElement.textContent?.trim() || '',
          country: flagElement?.title || flagElement?.alt || '',
          role: this.parsePlayerRole(playerEl),
          stats: this.parsePlayerStats(playerEl)
        };

        if (player.name) {
          players.push(player);
        }
      } catch (error) {
        console.warn('Failed to parse player:', error.message);
      }
    });

    return players;
  }

  /**
   * Parse player role from element
   * @param {Element} element - Player element
   * @returns {string} Player role
   */
  parsePlayerRole(element) {
    const roleElement = element.querySelector('.role, .player-role, .position');
    if (roleElement) {
      const role = roleElement.textContent?.trim().toLowerCase();
      
      // Standardize role names
      if (role.includes('igl') || role.includes('leader')) return 'IGL';
      if (role.includes('awp')) return 'AWPer';
      if (role.includes('entry')) return 'Entry';
      if (role.includes('support')) return 'Support';
      if (role.includes('lurk')) return 'Lurker';
    }
    
    return 'Rifler'; // Default role
  }

  /**
   * Parse player statistics from element
   * @param {Element} element - Player element
   * @returns {Object} Player stats
   */
  parsePlayerStats(element) {
    const stats = {};
    
    // Look for common stat elements
    const statElements = element.querySelectorAll('.stat, .player-stat, .statistic');
    
    Array.from(statElements).forEach(statEl => {
      const label = statEl.querySelector('.label, .stat-name')?.textContent?.trim().toLowerCase();
      const value = statEl.querySelector('.value, .stat-value')?.textContent?.trim();
      
      if (label && value) {
        stats[label] = value;
      }
    });

    return stats;
  }

  /**
   * Parse recent matches
   * @param {Document} document - DOM document
   * @param {Object} selectors - Selector configuration
   * @returns {Array} Recent match objects
   */
  parseRecentMatches(document, selectors) {
    const matchElements = document.querySelectorAll(selectors.recentMatches);
    const matches = [];

    Array.from(matchElements).slice(0, 10).forEach(matchEl => { // Limit to 10 recent matches
      try {
        const opponent = matchEl.querySelector('.opponent, .vs, .enemy')?.textContent?.trim();
        const result = matchEl.querySelector('.result, .score')?.textContent?.trim();
        const date = matchEl.querySelector('.date, .time')?.textContent?.trim();
        const map = matchEl.querySelector('.map, .mapname')?.textContent?.trim();

        if (opponent) {
          matches.push({
            opponent: sanitizeTeamName(opponent),
            result: result || '',
            date: date || '',
            map: map || ''
          });
        }
      } catch (error) {
        console.warn('Failed to parse recent match:', error.message);
      }
    });

    return matches;
  }

  /**
   * Parse team statistics
   * @param {Document} document - DOM document
   * @returns {Object} Team statistics
   */
  parseTeamStatistics(document) {
    const stats = {};
    
    // Parse various team statistics
    const statSelectors = [
      { selector: '.team-stat', label: 'stat-name', value: 'stat-value' },
      { selector: '.statistic', label: 'label', value: 'value' },
      { selector: '.team-info .stat', label: 'name', value: 'number' }
    ];

    for (const config of statSelectors) {
      const statElements = document.querySelectorAll(config.selector);
      
      Array.from(statElements).forEach(statEl => {
        const label = statEl.querySelector(`.${config.label}`)?.textContent?.trim().toLowerCase();
        const value = statEl.querySelector(`.${config.value}`)?.textContent?.trim();
        
        if (label && value) {
          stats[label] = value;
        }
      });
    }

    // Parse win rate if available
    const winRateElement = document.querySelector('.win-rate, .winrate, .win-percentage');
    if (winRateElement) {
      const winRateText = winRateElement.textContent?.trim();
      const winRateMatch = winRateText?.match(/(\d+(?:\.\d+)?)%?/);
      if (winRateMatch) {
        stats.winRate = parseFloat(winRateMatch[1]);
      }
    }

    // Parse maps played
    const mapsElement = document.querySelector('.maps-played, .total-maps');
    if (mapsElement) {
      const mapsText = mapsElement.textContent?.trim();
      const mapsMatch = mapsText?.match(/(\d+)/);
      if (mapsMatch) {
        stats.mapsPlayed = parseInt(mapsMatch[1]);
      }
    }

    return stats;
  }

  /**
   * Merge team data from primary and fallback parsing
   * @param {Object} primary - Primary parsed data
   * @param {Object} fallback - Fallback parsed data
   * @returns {Object} Merged team data
   */
  mergeTeamData(primary, fallback) {
    return {
      name: primary.name || fallback.name,
      ranking: primary.ranking !== null ? primary.ranking : fallback.ranking,
      players: primary.players.length > 0 ? primary.players : fallback.players,
      recentMatches: primary.recentMatches.length > 0 ? primary.recentMatches : fallback.recentMatches,
      logo: primary.logo || fallback.logo,
      stats: { ...fallback.stats, ...primary.stats }
    };
  }

  /**
   * Validate parsed team data
   * @param {Object} teamData - Parsed team data
   * @returns {boolean} True if valid
   */
  validateTeamData(teamData) {
    if (!teamData || typeof teamData !== 'object') {
      return false;
    }

    // Required fields
    if (!teamData.name || typeof teamData.name !== 'string') {
      return false;
    }

    // Players should be an array
    if (!Array.isArray(teamData.players)) {
      return false;
    }

    // Ranking should be null or a positive number
    if (teamData.ranking !== null && (typeof teamData.ranking !== 'number' || teamData.ranking < 1)) {
      return false;
    }

    return true;
  }
}

module.exports = TeamParser;