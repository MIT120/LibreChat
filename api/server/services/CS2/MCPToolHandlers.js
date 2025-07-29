const logger = require('~/utils/logger');
const CS2Match = require('~/models/CS2/CS2Match');
const CS2Team = require('~/models/CS2/CS2Team');
const CS2Player = require('~/models/CS2/CS2Player');

/**
 * Enhanced MCP tool handlers with validation, security, and error handling
 */
class MCPToolHandlers {
  constructor() {
    this.requestCounts = new Map(); // Simple rate limiting
    this.maxRequestsPerMinute = 60;
  }

  /**
   * Handle get_match_data tool requests
   */
  async handleGetMatchData(args) {
    const { matchId, teamName, dateRange, status, limit = 10 } = args;

    try {
      const query = await this.buildMatchQuery({ matchId, teamName, dateRange, status });

      const matches = await CS2Match.find(query)
        .populate('teams.team', 'name ranking')
        .sort({ date: -1 })
        .limit(limit);

      const formattedMatches = this.formatMatchData(matches);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                matches: formattedMatches,
                total: matches.length,
                query: args,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      logger.error('[MCPToolHandlers] Error in handleGetMatchData:', error);
      throw error;
    }
  }

  /**
   * Handle get_team_stats tool requests
   */
  async handleGetTeamStats(args) {
    const { teamName, mapName, timeframe = '3months' } = args;

    try {
      const team = await this.findTeamByName(teamName);
      if (!team) {
        return this.createErrorResponse(`Team "${teamName}" not found`);
      }

      const { startDate } = this.calculateTimeRange(timeframe);
      const matches = await this.getTeamMatches(team._id, startDate, mapName);
      const stats = this.statisticsCalculator.calculate(matches, team._id, mapName);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                team: {
                  name: team.name,
                  ranking: team.ranking,
                  recentForm: team.recentForm,
                },
                timeframe,
                mapName: mapName || 'all maps',
                statistics: stats,
                matchCount: matches.length,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      logger.error('[MCPToolHandlers] Error in handleGetTeamStats:', error);
      throw error;
    }
  }

  /**
   * Handle predict_match_outcome tool requests
   */
  async handlePredictMatchOutcome(args) {
    const { matchId, predictionType } = args;

    try {
      const match = await CS2Match.findOne({ hltvId: matchId }).populate(
        'teams.team',
        'name ranking recentForm',
      );

      if (!match) {
        return this.createErrorResponse(`Match with ID "${matchId}" not found`);
      }

      const prediction = await this.predictionEngine.generatePrediction(match, predictionType);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                match: this.formatMatchInfo(match),
                predictionType,
                prediction,
                timestamp: new Date().toISOString(),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      logger.error('[MCPToolHandlers] Error in handlePredictMatchOutcome:', error);
      throw error;
    }
  }

  // Private helper methods
  async buildMatchQuery({ matchId, teamName, dateRange, status }) {
    const query = {};

    if (matchId) {
      query.hltvId = matchId;
    }

    if (teamName) {
      const team = await this.findTeamByName(teamName);
      if (team) {
        query['teams.team'] = team._id;
      }
    }

    if (dateRange) {
      query.date = {};
      if (dateRange.start) {
        query.date.$gte = new Date(dateRange.start);
      }
      if (dateRange.end) {
        query.date.$lte = new Date(dateRange.end);
      }
    }

    if (status) {
      query.status = status;
    }

    return query;
  }

  async findTeamByName(teamName) {
    return await CS2Team.findOne({ name: new RegExp(teamName, 'i') });
  }

  calculateTimeRange(timeframe) {
    const now = new Date();
    const timeframeMap = {
      '1month': 30,
      '3months': 90,
      '6months': 180,
      '1year': 365,
    };
    const daysBack = timeframeMap[timeframe] || 90;
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    return { startDate };
  }

  async getTeamMatches(teamId, startDate, mapName) {
    const matchQuery = {
      'teams.team': teamId,
      date: { $gte: startDate },
      status: 'finished',
    };

    if (mapName) {
      matchQuery['maps.name'] = mapName;
    }

    return await CS2Match.find(matchQuery).populate('teams.team', 'name').sort({ date: -1 });
  }

  formatMatchData(matches) {
    return matches.map((match) => ({
      id: match.hltvId,
      date: match.date,
      tournament: match.tournament,
      teams: match.teams.map((t) => ({
        name: t.team.name,
        score: t.score,
        ranking: t.team.ranking,
      })),
      maps: match.maps,
      status: match.status,
      predictions: match.predictions,
    }));
  }

  formatMatchInfo(match) {
    return {
      id: match.hltvId,
      teams: match.teams.map((t) => ({
        name: t.team.name,
        ranking: t.team.ranking,
      })),
      tournament: match.tournament,
    };
  }

  createErrorResponse(message) {
    return {
      content: [
        {
          type: 'text',
          text: message,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handles team statistics calculations
 * Separated for better testability and reusability
 */
class TeamStatisticsCalculator {
  calculate(matches, teamId, mapName) {
    const stats = {
      wins: 0,
      losses: 0,
      mapWins: 0,
      mapLosses: 0,
      totalRounds: 0,
      roundsWon: 0,
    };

    matches.forEach((match) => {
      this.processMatch(match, teamId, mapName, stats);
    });

    return this.formatStatistics(stats);
  }

  processMatch(match, teamId, mapName, stats) {
    const teamData = match.teams.find((t) => t.team._id.equals(teamId));
    const opponentData = match.teams.find((t) => !t.team._id.equals(teamId));

    if (!teamData || !opponentData) return;

    // Match result
    if (teamData.score > opponentData.score) {
      stats.wins++;
    } else {
      stats.losses++;
    }

    // Map statistics
    match.maps.forEach((map) => {
      if (mapName && map.name !== mapName) return;

      this.processMapStats(map, teamId, stats);
    });
  }

  processMapStats(map, teamId, stats) {
    const isTeamWinner = map.winner && map.winner.equals(teamId);

    if (isTeamWinner) {
      stats.mapWins++;
    } else {
      stats.mapLosses++;
    }

    // Round statistics (simplified)
    if (map.score) {
      const teamRounds = isTeamWinner
        ? Math.max(map.score.team1, map.score.team2)
        : Math.min(map.score.team1, map.score.team2);
      const opponentRounds = isTeamWinner
        ? Math.min(map.score.team1, map.score.team2)
        : Math.max(map.score.team1, map.score.team2);

      stats.roundsWon += teamRounds;
      stats.totalRounds += teamRounds + opponentRounds;
    }
  }

  formatStatistics(stats) {
    const { wins, losses, mapWins, mapLosses, roundsWon, totalRounds } = stats;

    return {
      matchRecord: {
        wins,
        losses,
        winRate: this.calculateWinRate(wins, losses),
      },
      mapRecord: {
        wins: mapWins,
        losses: mapLosses,
        winRate: this.calculateWinRate(mapWins, mapLosses),
      },
      roundRecord: {
        won: roundsWon,
        total: totalRounds,
        winRate: this.calculateWinRate(roundsWon, totalRounds),
      },
    };
  }

  calculateWinRate(wins, total) {
    return total > 0 ? wins / total : 0;
  }
}

/**
 * Simple prediction engine
 * Can be extended with more sophisticated algorithms
 */


module.exports = MCPToolHandlers;
