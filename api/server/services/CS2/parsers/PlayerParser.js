/**
 * Player Parser for HLTV Player Pages
 * 
 * Handles parsing of player data from HLTV player pages
 * with fallback mechanisms for structure changes.
 */

const { HLTVParsingError } = require('../errors');
const { sanitizeTeamName } = require('../utils');

class PlayerParser {
  constructor() {
    this.selectors = {
      // Primary selectors (current HLTV structure)
      primary: {
        playerName: '.playerNickname, .player-name',
        realName: '.playerRealname, .real-name',
        age: '.playerAge, .age',
        country: '.playerCountry, .country',
        team: '.team-info .team-name, .current-team',
        stats: '.stats-row, .player-stat',
        statLabel: '.stats-row-label, .stat-name',
        statValue: '.stats-row-value, .stat-value',
        playerImage: '.playerPicture, .player-image',
        achievements: '.achievement, .trophy'
      },
      
      // Fallback selectors (alternative structures)
      fallback: {
        playerName: '.player-title, .name, h1',
        realName: '.full-name, .player-real-name',
        age: '.player-age, .birth-date',
        country: '.flag, .nationality',
        team: '.team, .team-name, .current-team-name',
        stats: '.statistic, .stat-item, '.performance',
        statLabel: '.label, .name, '.stat-title',
        statValue: '.value, '.number, '.stat-number',
        playerImage: '.photo, '.picture, 'img[alt*="player"]',
        achievements: '.award, '.title, '.honor'
      }
    };
  }

  /**
   * Parse player statistics page
   * @param {Document} document - DOM document
   * @returns {Object} Parsed player object
   */
  parsePlayerStats(document) {
    try {
      // Try primary selectors first
      let playerData = this.parseWithSelectors(document, this.selectors.primary);
      
      // If incomplete data, try fallback selectors
      if (!playerData.name || Object.keys(playerData.stats).length === 0) {
        const fallbackData = this.parseWithSelectors(document, this.selectors.fallback);
        playerData = this.mergePlayerData(playerData, fallbackData);
      }
      
      return playerData;
    } catch (error) {
      throw new HLTVParsingError(
        `Failed to parse player stats: ${error.message}`,
        window.location?.href || 'unknown',
        { originalError: error.message }
      );
    }
  }

  /**
   * Parse player data using specific selectors
   * @param {Document} document - DOM document
   * @param {Object} selectors - Selector configuration
   * @returns {Object} Parsed player object
   */
  parseWithSelectors(document, selectors) {
    const result = {
      name: '',
      realName: '',
      age: null,
      country: '',
      team: '',
      image: '',
      stats: {},
      achievements: [],
      careerStats: {}
    };

    // Parse player name
    const nameElement = document.querySelector(selectors.playerName);
    if (nameElement) {
      result.name = nameElement.textContent?.trim() || '';
    }

    // Parse real name
    const realNameElement = document.querySelector(selectors.realName);
    if (realNameElement) {
      result.realName = realNameElement.textContent?.trim() || '';
    }

    // Parse age
    const ageElement = document.querySelector(selectors.age);
    if (ageElement) {
      result.age = this.parseAge(ageElement);
    }

    // Parse country
    const countryElement = document.querySelector(selectors.country);
    if (countryElement) {
      result.country = countryElement.title || countryElement.alt || countryElement.textContent?.trim() || '';
    }

    // Parse current team
    const teamElement = document.querySelector(selectors.team);
    if (teamElement) {
      result.team = sanitizeTeamName(teamElement.textContent?.trim() || '');
    }

    // Parse player image
    const imageElement = document.querySelector(selectors.playerImage);
    if (imageElement) {
      result.image = imageElement.src || '';
    }

    // Parse statistics
    result.stats = this.parseStatistics(document, selectors);

    // Parse achievements
    result.achievements = this.parseAchievements(document, selectors);

    // Parse career statistics
    result.careerStats = this.parseCareerStats(document);

    return result;
  }

  /**
   * Parse player age from element
   * @param {Element} element - Age element
   * @returns {number|null} Player age
   */
  parseAge(element) {
    const text = element.textContent?.trim() || '';
    
    // Try different age formats
    const patterns = [
      /(\d+)\s*years?\s*old/i,  // "25 years old"
      /age:?\s*(\d+)/i,         // "Age: 25"
      /(\d+)/                   // Just the number
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const age = parseInt(match[1]);
        return (age > 0 && age < 100) ? age : null;
      }
    }

    return null;
  }

  /**
   * Parse player statistics
   * @param {Document} document - DOM document
   * @param {Object} selectors - Selector configuration
   * @returns {Object} Player statistics
   */
  parseStatistics(document, selectors) {
    const stats = {};
    
    // Parse individual stat rows
    const statElements = document.querySelectorAll(selectors.stats);
    
    Array.from(statElements).forEach(statEl => {
      try {
        const labelElement = statEl.querySelector(selectors.statLabel) || statEl;
        const valueElement = statEl.querySelector(selectors.statValue) || statEl;
        
        const label = labelElement.textContent?.trim().toLowerCase();
        const value = valueElement.textContent?.trim();
        
        if (label && value && label !== value) {
          // Standardize common stat names
          const standardizedLabel = this.standardizeStatLabel(label);
          stats[standardizedLabel] = this.parseStatValue(value);
        }
      } catch (error) {
        console.warn('Failed to parse stat element:', error.message);
      }
    });

    // Parse additional stats from different sections
    this.parseAdditionalStats(document, stats);

    return stats;
  }

  /**
   * Standardize statistic labels
   * @param {string} label - Original label
   * @returns {string} Standardized label
   */
  standardizeStatLabel(label) {
    const labelMap = {
      'k/d ratio': 'kdRatio',
      'k/d': 'kdRatio',
      'kd ratio': 'kdRatio',
      'adr': 'adr',
      'average damage per round': 'adr',
      'rating': 'rating',
      'rating 2.0': 'rating2',
      'hltv rating': 'rating',
      'headshot %': 'headshotPercentage',
      'hs%': 'headshotPercentage',
      'headshots': 'headshotPercentage',
      'maps played': 'mapsPlayed',
      'rounds played': 'roundsPlayed',
      'kills': 'kills',
      'deaths': 'deaths',
      'assists': 'assists',
      'kast': 'kast',
      'impact': 'impact'
    };

    return labelMap[label] || label.replace(/\s+/g, '').replace(/[^\w]/g, '');
  }

  /**
   * Parse statistic value
   * @param {string} value - Raw value string
   * @returns {number|string} Parsed value
   */
  parseStatValue(value) {
    // Try to parse as number
    const numMatch = value.match(/^(\d+(?:\.\d+)?)/);
    if (numMatch) {
      const num = parseFloat(numMatch[1]);
      return isNaN(num) ? value : num;
    }

    // Handle percentage values
    const percentMatch = value.match(/^(\d+(?:\.\d+)?)%/);
    if (percentMatch) {
      return parseFloat(percentMatch[1]);
    }

    return value;
  }

  /**
   * Parse additional statistics from different sections
   * @param {Document} document - DOM document
   * @param {Object} stats - Stats object to populate
   */
  parseAdditionalStats(document, stats) {
    // Parse from overview sections
    const overviewSelectors = [
      '.overview-stat',
      '.player-overview .stat',
      '.summary-stat'
    ];

    for (const selector of overviewSelectors) {
      const elements = document.querySelectorAll(selector);
      Array.from(elements).forEach(el => {
        const label = el.querySelector('.label, .name')?.textContent?.trim().toLowerCase();
        const value = el.querySelector('.value, .number')?.textContent?.trim();
        
        if (label && value) {
          const standardizedLabel = this.standardizeStatLabel(label);
          stats[standardizedLabel] = this.parseStatValue(value);
        }
      });
    }
  }

  /**
   * Parse player achievements
   * @param {Document} document - DOM document
   * @param {Object} selectors - Selector configuration
   * @returns {Array} Achievement objects
   */
  parseAchievements(document, selectors) {
    const achievements = [];
    const achievementElements = document.querySelectorAll(selectors.achievements);
    
    Array.from(achievementElements).forEach(achEl => {
      try {
        const title = achEl.querySelector('.title, .name, .achievement-name')?.textContent?.trim();
        const date = achEl.querySelector('.date, .year')?.textContent?.trim();
        const tournament = achEl.querySelector('.tournament, .event')?.textContent?.trim();
        const placement = achEl.querySelector('.placement, .position')?.textContent?.trim();

        if (title) {
          achievements.push({
            title: title,
            date: date || '',
            tournament: tournament || '',
            placement: placement || ''
          });
        }
      } catch (error) {
        console.warn('Failed to parse achievement:', error.message);
      }
    });

    return achievements;
  }

  /**
   * Parse career statistics
   * @param {Document} document - DOM document
   * @returns {Object} Career statistics
   */
  parseCareerStats(document) {
    const careerStats = {};
    
    // Look for career/total statistics sections
    const careerSelectors = [
      '.career-stats',
      '.total-stats',
      '.all-time-stats',
      '.lifetime-stats'
    ];

    for (const selector of careerSelectors) {
      const careerSection = document.querySelector(selector);
      if (careerSection) {
        const statElements = careerSection.querySelectorAll('.stat, .statistic');
        
        Array.from(statElements).forEach(statEl => {
          const label = statEl.querySelector('.label, .name')?.textContent?.trim().toLowerCase();
          const value = statEl.querySelector('.value, .number')?.textContent?.trim();
          
          if (label && value) {
            const standardizedLabel = this.standardizeStatLabel(label);
            careerStats[standardizedLabel] = this.parseStatValue(value);
          }
        });
        
        break; // Use first found section
      }
    }

    return careerStats;
  }

  /**
   * Merge player data from primary and fallback parsing
   * @param {Object} primary - Primary parsed data
   * @param {Object} fallback - Fallback parsed data
   * @returns {Object} Merged player data
   */
  mergePlayerData(primary, fallback) {
    return {
      name: primary.name || fallback.name,
      realName: primary.realName || fallback.realName,
      age: primary.age !== null ? primary.age : fallback.age,
      country: primary.country || fallback.country,
      team: primary.team || fallback.team,
      image: primary.image || fallback.image,
      stats: { ...fallback.stats, ...primary.stats },
      achievements: primary.achievements.length > 0 ? primary.achievements : fallback.achievements,
      careerStats: { ...fallback.careerStats, ...primary.careerStats }
    };
  }

  /**
   * Validate parsed player data
   * @param {Object} playerData - Parsed player data
   * @returns {boolean} True if valid
   */
  validatePlayerData(playerData) {
    if (!playerData || typeof playerData !== 'object') {
      return false;
    }

    // Required fields
    if (!playerData.name || typeof playerData.name !== 'string') {
      return false;
    }

    // Age should be null or a reasonable number
    if (playerData.age !== null && (typeof playerData.age !== 'number' || playerData.age < 16 || playerData.age > 50)) {
      return false;
    }

    // Stats should be an object
    if (!playerData.stats || typeof playerData.stats !== 'object') {
      return false;
    }

    return true;
  }
}

module.exports = PlayerParser;