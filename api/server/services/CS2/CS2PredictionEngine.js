const { CS2Match, CS2Team } = require('~/db/models');
const logger = require('~/utils/logger');

/**
 * CS2 Prediction Engine
 * Provides prediction algorithms for half-time results, map winners, and series outcomes
 */
class CS2PredictionEngine {
  constructor() {
    this.logger = logger.child({ service: 'CS2PredictionEngine' });
  }

  /**
   * Predict half-time winner based on current match state and historical data
   * @param {string} matchId - The match HLTV ID
   * @param {Object} options - Prediction options
   * @returns {Promise<Object>} Prediction result with confidence and factors
   */
  async predictHalfTimeWinner(matchId, options = {}) {
    try {
      this.logger.info(`Predicting half-time winner for match ${matchId}`);

      // Get current match data
      const match = await CS2Match.findOne({ hltvId: matchId })
        .populate('teams.team', 'name ranking.current')
        .lean();

      if (!match) {
        throw new Error(`Match ${matchId} not found`);
      }

      if (match.status !== 'live') {
        throw new Error(`Match ${matchId} is not live`);
      }

      if (!match.liveData || match.liveData.currentRound < 1) {
        throw new Error(`Insufficient live data for match ${matchId}`);
      }

      const team1 = match.teams[0];
      const team2 = match.teams[1];
      const liveData = match.liveData;

      // Calculate prediction factors
      const factors = await this._calculateHalfTimeFactors(team1, team2, liveData, match);

      // Calculate weighted prediction
      const prediction = this._calculateHalfTimePrediction(factors);

      // Store prediction in database
      await this._storePrediction(matchId, 'halfTime', prediction);

      this.logger.info(`Half-time prediction completed for match ${matchId}`, {
        winner: prediction.winner,
        confidence: prediction.confidence,
      });

      return prediction;
    } catch (error) {
      this.logger.error(`Error predicting half-time winner for match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate factors that influence half-time predictions
   * @private
   */
  async _calculateHalfTimeFactors(team1, team2, liveData, match) {
    const factors = [];

    // Current score momentum
    const currentScoreFactor = this._calculateCurrentScoreFactor(liveData, team1, team2);
    factors.push({
      name: 'current_score',
      weight: 0.25,
      value: currentScoreFactor,
    });

    // Economy state
    const economyFactor = this._calculateEconomyFactor(liveData, team1, team2);
    factors.push({
      name: 'economy_state',
      weight: 0.2,
      value: economyFactor,
    });

    // Recent round performance (momentum)
    const momentumFactor = await this._calculateMomentumFactor(match, team1, team2);
    factors.push({
      name: 'momentum',
      weight: 0.15,
      value: momentumFactor,
    });

    // Historical half-time performance
    const historicalFactor = await this._calculateHistoricalHalfTimeFactor(team1, team2, match);
    factors.push({
      name: 'historical_half_time',
      weight: 0.2,
      value: historicalFactor,
    });

    // Team ranking difference
    const rankingFactor = this._calculateRankingFactor(team1, team2);
    factors.push({
      name: 'ranking_difference',
      weight: 0.1,
      value: rankingFactor,
    });

    // Map-specific performance
    const mapFactor = await this._calculateMapSpecificFactor(team1, team2, match);
    factors.push({
      name: 'map_specific',
      weight: 0.1,
      value: mapFactor,
    });

    return factors;
  }

  /**
   * Calculate current score factor
   * @private
   */
  _calculateCurrentScoreFactor(liveData, team1, team2) {
    const score1 = liveData.score.team1;
    const score2 = liveData.score.team2;
    const totalRounds = score1 + score2;

    if (totalRounds === 0) {
      return { team1: 0.5, team2: 0.5 };
    }

    // Simple score-based momentum
    const team1Advantage = (score1 - score2) / totalRounds;

    return {
      team1: 0.5 + team1Advantage * 0.3, // Cap influence at 30%
      team2: 0.5 - team1Advantage * 0.3,
    };
  }

  /**
   * Calculate economy factor
   * @private
   */
  _calculateEconomyFactor(liveData, team1, team2) {
    const economy1 = liveData.economy?.team1 || 0;
    const economy2 = liveData.economy?.team2 || 0;

    if (economy1 === 0 && economy2 === 0) {
      return { team1: 0.5, team2: 0.5 };
    }

    const totalEconomy = economy1 + economy2;
    const economyAdvantage = (economy1 - economy2) / totalEconomy;

    return {
      team1: 0.5 + economyAdvantage * 0.2, // Cap influence at 20%
      team2: 0.5 - economyAdvantage * 0.2,
    };
  }

  /**
   * Calculate momentum factor based on recent rounds
   * @private
   */
  async _calculateMomentumFactor(match, team1, team2) {
    const currentMap = match.maps[match.liveData.currentMap];
    if (!currentMap || !currentMap.rounds || currentMap.rounds.length < 3) {
      return { team1: 0.5, team2: 0.5 };
    }

    // Look at last 5 rounds for momentum
    const recentRounds = currentMap.rounds.slice(-5);
    let team1Wins = 0;
    let team2Wins = 0;

    recentRounds.forEach((round) => {
      // Determine which team won based on round winner and team sides
      // This is simplified - in reality we'd need to track side switches
      if (round.winner === 'CT') {
        team1Wins++; // Assuming team1 is CT for simplicity
      } else {
        team2Wins++;
      }
    });

    const totalRecentRounds = team1Wins + team2Wins;
    if (totalRecentRounds === 0) {
      return { team1: 0.5, team2: 0.5 };
    }

    return {
      team1: team1Wins / totalRecentRounds,
      team2: team2Wins / totalRecentRounds,
    };
  }

  /**
   * Calculate historical half-time performance factor
   * @private
   */
  async _calculateHistoricalHalfTimeFactor(team1, team2, match) {
    try {
      // Get recent matches for both teams on this map
      const mapName = match.maps[match.liveData.currentMap]?.name;
      if (!mapName) {
        return { team1: 0.5, team2: 0.5 };
      }

      const [team1Stats, team2Stats] = await Promise.all([
        this._getTeamHalfTimeStats(team1.team._id, mapName),
        this._getTeamHalfTimeStats(team2.team._id, mapName),
      ]);

      const team1Rate = team1Stats.halfTimeWinRate || 0.5;
      const team2Rate = team2Stats.halfTimeWinRate || 0.5;

      // Normalize to ensure they sum to 1
      const total = team1Rate + team2Rate;
      return {
        team1: team1Rate / total,
        team2: team2Rate / total,
      };
    } catch (error) {
      this.logger.warn('Error calculating historical half-time factor:', error);
      return { team1: 0.5, team2: 0.5 };
    }
  }

  /**
   * Get team half-time statistics
   * @private
   */
  async _getTeamHalfTimeStats(teamId, mapName) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // Last 90 days

    const matches = await CS2Match.find({
      'teams.team': teamId,
      'maps.name': mapName,
      status: 'finished',
      date: { $gte: cutoffDate },
    })
      .select('teams maps')
      .lean();

    let halfTimeWins = 0;
    let totalHalves = 0;

    matches.forEach((match) => {
      const teamData = match.teams.find((t) => t.team.toString() === teamId.toString());
      if (!teamData) return;

      match.maps.forEach((map) => {
        if (map.name === mapName && map.rounds && map.rounds.length >= 15) {
          // Check if team won first half (rounds 1-15)
          const firstHalfRounds = map.rounds.slice(0, 15);
          let teamRoundsWon = 0;

          firstHalfRounds.forEach((round) => {
            // Simplified logic - would need proper side tracking
            if (round.winner === 'CT') {
              teamRoundsWon++;
            }
          });

          if (teamRoundsWon > 7) {
            // Won first half
            halfTimeWins++;
          }
          totalHalves++;
        }
      });
    });

    return {
      halfTimeWinRate: totalHalves > 0 ? halfTimeWins / totalHalves : 0.5,
      totalHalves,
    };
  }

  /**
   * Calculate ranking factor
   * @private
   */
  _calculateRankingFactor(team1, team2) {
    const ranking1 = team1.team.ranking?.current || 50;
    const ranking2 = team2.team.ranking?.current || 50;

    // Lower ranking number is better
    const rankingDiff = ranking2 - ranking1; // Positive if team1 is better ranked
    const maxDiff = 30; // Cap the influence

    const normalizedDiff = Math.max(-maxDiff, Math.min(maxDiff, rankingDiff)) / maxDiff;

    return {
      team1: 0.5 + normalizedDiff * 0.15, // Cap influence at 15%
      team2: 0.5 - normalizedDiff * 0.15,
    };
  }

  /**
   * Calculate map-specific performance factor
   * @private
   */
  async _calculateMapSpecificFactor(team1, team2, match) {
    try {
      const mapName = match.maps[match.liveData.currentMap]?.name;
      if (!mapName) {
        return { team1: 0.5, team2: 0.5 };
      }

      const [team1MapStats, team2MapStats] = await Promise.all([
        this._getTeamMapStats(team1.team._id, mapName),
        this._getTeamMapStats(team2.team._id, mapName),
      ]);

      const team1Rate = team1MapStats.winRate || 0.5;
      const team2Rate = team2MapStats.winRate || 0.5;

      // Normalize
      const total = team1Rate + team2Rate;
      return {
        team1: team1Rate / total,
        team2: team2Rate / total,
      };
    } catch (error) {
      this.logger.warn('Error calculating map-specific factor:', error);
      return { team1: 0.5, team2: 0.5 };
    }
  }

  /**
   * Get team map statistics
   * @private
   */
  async _getTeamMapStats(teamId, mapName) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 180); // Last 6 months

    const matches = await CS2Match.find({
      'teams.team': teamId,
      'maps.name': mapName,
      status: 'finished',
      date: { $gte: cutoffDate },
    })
      .select('teams maps')
      .lean();

    let wins = 0;
    let totalMaps = 0;

    matches.forEach((match) => {
      match.maps.forEach((map) => {
        if (map.name === mapName && map.winner) {
          if (map.winner.toString() === teamId.toString()) {
            wins++;
          }
          totalMaps++;
        }
      });
    });

    return {
      winRate: totalMaps > 0 ? wins / totalMaps : 0.5,
      totalMaps,
      wins,
    };
  }

  /**
   * Calculate final half-time prediction from factors
   * @private
   */
  _calculateHalfTimePrediction(factors) {
    let team1Score = 0;
    let team2Score = 0;
    let totalWeight = 0;

    factors.forEach((factor) => {
      team1Score += factor.value.team1 * factor.weight;
      team2Score += factor.value.team2 * factor.weight;
      totalWeight += factor.weight;
    });

    // Normalize scores
    team1Score /= totalWeight;
    team2Score /= totalWeight;

    // Determine winner and confidence
    const winner = team1Score > team2Score ? 'team1' : 'team2';
    const confidence = Math.abs(team1Score - team2Score);

    // Ensure confidence is between 0.5 and 1.0
    const normalizedConfidence = Math.max(0.5, Math.min(1.0, 0.5 + confidence));

    return {
      winner,
      confidence: normalizedConfidence,
      probabilities: {
        team1: team1Score,
        team2: team2Score,
      },
      factors,
      timestamp: new Date(),
    };
  }

  /**
   * Predict map winner based on team performance, pick/ban strategy, and historical data
   * @param {string} matchId - The match HLTV ID
   * @param {number} mapIndex - Index of the map to predict (default: 0)
   * @param {Object} options - Prediction options
   * @returns {Promise<Object>} Prediction result with confidence and factors
   */
  async predictMapWinner(matchId, mapIndex = 0, options = {}) {
    try {
      this.logger.info(`Predicting map winner for match ${matchId}, map ${mapIndex}`);

      // Get current match data
      const match = await CS2Match.findOne({ hltvId: matchId })
        .populate('teams.team', 'name ranking.current')
        .lean();

      if (!match) {
        throw new Error(`Match ${matchId} not found`);
      }

      if (!match.maps || !match.maps[mapIndex]) {
        throw new Error(`Map ${mapIndex} not found for match ${matchId}`);
      }

      const team1 = match.teams[0];
      const team2 = match.teams[1];
      const map = match.maps[mapIndex];

      // Calculate prediction factors
      const factors = await this._calculateMapWinnerFactors(team1, team2, map, match);

      // Calculate weighted prediction
      const prediction = this._calculateMapWinnerPrediction(factors, team1, team2);

      // Store prediction in database
      await this._storePrediction(matchId, 'mapWinner', prediction);

      this.logger.info(`Map winner prediction completed for match ${matchId}`, {
        map: map.name,
        winner: prediction.winner,
        confidence: prediction.confidence,
      });

      return prediction;
    } catch (error) {
      this.logger.error(`Error predicting map winner for match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate factors that influence map winner predictions
   * @private
   */
  async _calculateMapWinnerFactors(team1, team2, map, match) {
    const factors = [];

    // Map-specific team performance
    const mapPerformanceFactor = await this._calculateMapPerformanceFactor(team1, team2, map.name);
    factors.push({
      name: 'map_performance',
      weight: 0.3,
      value: mapPerformanceFactor,
    });

    // Pick/ban strategy factor
    const pickBanFactor = this._calculatePickBanFactor(team1, team2, map);
    factors.push({
      name: 'pick_ban_strategy',
      weight: 0.2,
      value: pickBanFactor,
    });

    // Recent form on this map
    const recentFormFactor = await this._calculateRecentMapFormFactor(team1, team2, map.name);
    factors.push({
      name: 'recent_form',
      weight: 0.2,
      value: recentFormFactor,
    });

    // Head-to-head record on this map
    const headToHeadFactor = await this._calculateHeadToHeadMapFactor(team1, team2, map.name);
    factors.push({
      name: 'head_to_head',
      weight: 0.15,
      value: headToHeadFactor,
    });

    // Team ranking difference
    const rankingFactor = this._calculateRankingFactor(team1, team2);
    factors.push({
      name: 'ranking_difference',
      weight: 0.1,
      value: rankingFactor,
    });

    // Tournament tier factor
    const tournamentFactor = this._calculateTournamentTierFactor(team1, team2, match);
    factors.push({
      name: 'tournament_tier',
      weight: 0.05,
      value: tournamentFactor,
    });

    return factors;
  }

  /**
   * Calculate map-specific performance factor
   * @private
   */
  async _calculateMapPerformanceFactor(team1, team2, mapName) {
    try {
      const [team1Stats, team2Stats] = await Promise.all([
        this._getTeamMapStats(team1.team._id, mapName),
        this._getTeamMapStats(team2.team._id, mapName),
      ]);

      const team1Rate = team1Stats.winRate;
      const team2Rate = team2Stats.winRate;

      // Weight by sample size
      const team1Weight = Math.min(1.0, team1Stats.totalMaps / 10);
      const team2Weight = Math.min(1.0, team2Stats.totalMaps / 10);

      const adjustedTeam1Rate = team1Rate * team1Weight + 0.5 * (1 - team1Weight);
      const adjustedTeam2Rate = team2Rate * team2Weight + 0.5 * (1 - team2Weight);

      // Normalize
      const total = adjustedTeam1Rate + adjustedTeam2Rate;
      return {
        team1: adjustedTeam1Rate / total,
        team2: adjustedTeam2Rate / total,
        confidence: (team1Weight + team2Weight) / 2,
      };
    } catch (error) {
      this.logger.warn('Error calculating map performance factor:', error);
      return { team1: 0.5, team2: 0.5, confidence: 0.0 };
    }
  }

  /**
   * Calculate pick/ban strategy factor
   * @private
   */
  _calculatePickBanFactor(team1, team2, map) {
    if (!map.pickBy) {
      return { team1: 0.5, team2: 0.5, confidence: 0.0 };
    }

    // Team that picked the map gets advantage
    const pickingTeam = map.pickBy.toString();
    const team1Id = team1.team._id.toString();
    const team2Id = team2.team._id.toString();

    if (pickingTeam === team1Id) {
      return { team1: 0.65, team2: 0.35, confidence: 0.8 };
    } else if (pickingTeam === team2Id) {
      return { team1: 0.35, team2: 0.65, confidence: 0.8 };
    }

    return { team1: 0.5, team2: 0.5, confidence: 0.0 };
  }

  /**
   * Calculate recent form factor on specific map
   * @private
   */
  async _calculateRecentMapFormFactor(team1, team2, mapName) {
    try {
      const [team1Form, team2Form] = await Promise.all([
        this._getTeamRecentMapForm(team1.team._id, mapName),
        this._getTeamRecentMapForm(team2.team._id, mapName),
      ]);

      const team1Rate = team1Form.winRate;
      const team2Rate = team2Form.winRate;

      // Weight by recency and sample size
      const team1Weight = Math.min(1.0, team1Form.totalMaps / 5);
      const team2Weight = Math.min(1.0, team2Form.totalMaps / 5);

      const adjustedTeam1Rate = team1Rate * team1Weight + 0.5 * (1 - team1Weight);
      const adjustedTeam2Rate = team2Rate * team2Weight + 0.5 * (1 - team2Weight);

      // Normalize
      const total = adjustedTeam1Rate + adjustedTeam2Rate;
      return {
        team1: adjustedTeam1Rate / total,
        team2: adjustedTeam2Rate / total,
        confidence: (team1Weight + team2Weight) / 2,
      };
    } catch (error) {
      this.logger.warn('Error calculating recent form factor:', error);
      return { team1: 0.5, team2: 0.5, confidence: 0.0 };
    }
  }

  /**
   * Get team's recent form on specific map (last 30 days)
   * @private
   */
  async _getTeamRecentMapForm(teamId, mapName) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // Last 30 days

    const matches = await CS2Match.find({
      'teams.team': teamId,
      'maps.name': mapName,
      status: 'finished',
      date: { $gte: cutoffDate },
    })
      .select('teams maps')
      .lean();

    let wins = 0;
    let totalMaps = 0;

    matches.forEach((match) => {
      match.maps.forEach((map) => {
        if (map.name === mapName && map.winner) {
          if (map.winner.toString() === teamId.toString()) {
            wins++;
          }
          totalMaps++;
        }
      });
    });

    return {
      winRate: totalMaps > 0 ? wins / totalMaps : 0.5,
      totalMaps,
      wins,
    };
  }

  /**
   * Calculate head-to-head factor on specific map
   * @private
   */
  async _calculateHeadToHeadMapFactor(team1, team2, mapName) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 365); // Last year

      const matches = await CS2Match.find({
        'teams.team': { $all: [team1.team._id, team2.team._id] },
        'maps.name': mapName,
        status: 'finished',
        date: { $gte: cutoffDate },
      })
        .select('teams maps')
        .lean();

      let team1Wins = 0;
      let team2Wins = 0;

      matches.forEach((match) => {
        match.maps.forEach((map) => {
          if (map.name === mapName && map.winner) {
            if (map.winner.toString() === team1.team._id.toString()) {
              team1Wins++;
            } else if (map.winner.toString() === team2.team._id.toString()) {
              team2Wins++;
            }
          }
        });
      });

      const totalMaps = team1Wins + team2Wins;
      if (totalMaps === 0) {
        return { team1: 0.5, team2: 0.5, confidence: 0.0 };
      }

      return {
        team1: team1Wins / totalMaps,
        team2: team2Wins / totalMaps,
        confidence: Math.min(1.0, totalMaps / 5), // More confident with more data
      };
    } catch (error) {
      this.logger.warn('Error calculating head-to-head factor:', error);
      return { team1: 0.5, team2: 0.5, confidence: 0.0 };
    }
  }

  /**
   * Calculate tournament tier factor
   * @private
   */
  _calculateTournamentTierFactor(team1, team2, match) {
    const tier = match.tournament?.tier;
    if (!tier) {
      return { team1: 0.5, team2: 0.5, confidence: 0.0 };
    }

    // Higher tier tournaments favor higher ranked teams more
    const tierMultiplier =
      {
        S: 1.2,
        A: 1.1,
        B: 1.0,
        C: 0.9,
        D: 0.8,
      }[tier] || 1.0;

    const ranking1 = team1.team.ranking?.current || 50;
    const ranking2 = team2.team.ranking?.current || 50;

    const rankingDiff = (ranking2 - ranking1) * tierMultiplier;
    const maxDiff = 30;

    const normalizedDiff = Math.max(-maxDiff, Math.min(maxDiff, rankingDiff)) / maxDiff;

    return {
      team1: 0.5 + normalizedDiff * 0.1,
      team2: 0.5 - normalizedDiff * 0.1,
      confidence: 0.5,
    };
  }

  /**
   * Calculate final map winner prediction from factors
   * @private
   */
  _calculateMapWinnerPrediction(factors, team1, team2) {
    let team1Score = 0;
    let team2Score = 0;
    let totalWeight = 0;
    let totalConfidence = 0;

    factors.forEach((factor) => {
      const weight = factor.weight;
      const confidence = factor.value.confidence || 1.0;
      const adjustedWeight = weight * confidence;

      team1Score += factor.value.team1 * adjustedWeight;
      team2Score += factor.value.team2 * adjustedWeight;
      totalWeight += adjustedWeight;
      totalConfidence += confidence * weight;
    });

    // Normalize scores
    if (totalWeight > 0) {
      team1Score /= totalWeight;
      team2Score /= totalWeight;
    } else {
      team1Score = 0.5;
      team2Score = 0.5;
    }

    // Determine winner and confidence
    const winnerTeamId = team1Score > team2Score ? team1.team._id : team2.team._id;
    const winnerName = team1Score > team2Score ? team1.team.name : team2.team.name;
    const confidence = Math.abs(team1Score - team2Score);

    // Normalize confidence based on factor reliability
    const factorConfidence = totalConfidence / factors.reduce((sum, f) => sum + f.weight, 0);
    const normalizedConfidence = Math.max(0.5, Math.min(1.0, 0.5 + confidence * factorConfidence));

    return {
      winner: winnerTeamId,
      winnerName,
      confidence: normalizedConfidence,
      probabilities: {
        team1: team1Score,
        team2: team2Score,
      },
      factors,
      keyFactors: this._identifyKeyFactors(factors),
      timestamp: new Date(),
    };
  }

  /**
   * Identify key influencing factors for the prediction
   * @private
   */
  _identifyKeyFactors(factors) {
    return factors
      .map((factor) => ({
        name: factor.name,
        influence: Math.abs(factor.value.team1 - factor.value.team2) * factor.weight,
        confidence: factor.value.confidence || 1.0,
      }))
      .sort((a, b) => b.influence - a.influence)
      .slice(0, 3); // Top 3 most influential factors
  }

  /**
   * Predict best-of-3 series outcome after first map completion
   * @param {string} matchId - The match HLTV ID
   * @param {Object} options - Prediction options
   * @returns {Promise<Object>} Prediction result with series outcome probabilities
   */
  async predictSeriesOutcome(matchId) {
    try {
      this.logger.info(`Predicting series outcome for match ${matchId}`);

      // Get current match data
      const match = await CS2Match.findOne({ hltvId: matchId })
        .populate('teams.team', 'name ranking.current')
        .lean();

      if (!match) {
        throw new Error(`Match ${matchId} not found`);
      }

      if (match.format !== 'bo3') {
        throw new Error(`Match ${matchId} is not a best-of-3 series`);
      }

      if (!match.maps || match.maps.length === 0) {
        throw new Error(`No completed maps found for match ${matchId}`);
      }

      // Check if at least one map is completed
      const completedMaps = match.maps.filter((map) => map.winner);
      if (completedMaps.length === 0) {
        throw new Error(`No completed maps found for series prediction in match ${matchId}`);
      }

      const team1 = match.teams[0];
      const team2 = match.teams[1];

      // Calculate prediction factors
      const factors = await this._calculateSeriesOutcomeFactors(team1, team2, match, completedMaps);

      // Calculate weighted prediction
      const prediction = this._calculateSeriesOutcomePrediction(
        factors,
        team1,
        team2,
        completedMaps,
      );

      // Store prediction in database
      await this._storeSeriesPrediction(matchId, prediction);

      this.logger.info(`Series outcome prediction completed for match ${matchId}`, {
        outcome: prediction.outcome,
        winner: prediction.winnerName,
        confidence: prediction.confidence,
      });

      return prediction;
    } catch (error) {
      this.logger.error(`Error predicting series outcome for match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate factors that influence series outcome predictions
   * @private
   */
  async _calculateSeriesOutcomeFactors(team1, team2, match, completedMaps) {
    const factors = [];

    // Current series momentum
    const momentumFactor = this._calculateSeriesMomentumFactor(team1, team2, completedMaps);
    factors.push({
      name: 'series_momentum',
      weight: 0.25,
      value: momentumFactor,
    });

    // Mental resilience and comeback ability
    const resilienceFactor = await this._calculateMentalResilienceFactor(team1, team2);
    factors.push({
      name: 'mental_resilience',
      weight: 0.2,
      value: resilienceFactor,
    });

    // Remaining map pool advantage
    const mapPoolFactor = await this._calculateRemainingMapPoolFactor(
      team1,
      team2,
      match,
      completedMaps,
    );
    factors.push({
      name: 'remaining_map_pool',
      weight: 0.2,
      value: mapPoolFactor,
    });

    // Historical series performance
    const seriesHistoryFactor = await this._calculateSeriesHistoryFactor(team1, team2);
    factors.push({
      name: 'series_history',
      weight: 0.15,
      value: seriesHistoryFactor,
    });

    // Team ranking and overall strength
    const strengthFactor = this._calculateTeamStrengthFactor(team1, team2);
    factors.push({
      name: 'team_strength',
      weight: 0.1,
      value: strengthFactor,
    });

    // Fatigue and match length factor
    const fatigueFactor = this._calculateFatigueFactor(match, completedMaps);
    factors.push({
      name: 'fatigue_factor',
      weight: 0.1,
      value: fatigueFactor,
    });

    return factors;
  }

  /**
   * Calculate series momentum factor based on completed maps
   * @private
   */
  _calculateSeriesMomentumFactor(team1, team2, completedMaps) {
    let team1Wins = 0;
    let team2Wins = 0;

    completedMaps.forEach((map) => {
      if (map.winner) {
        if (map.winner.toString() === team1.team._id.toString()) {
          team1Wins++;
        } else if (map.winner.toString() === team2.team._id.toString()) {
          team2Wins++;
        }
      }
    });

    const totalMaps = team1Wins + team2Wins;
    if (totalMaps === 0) {
      return { team1: 0.5, team2: 0.5, confidence: 0.0 };
    }

    // Calculate momentum based on map wins and recency
    let momentum1 = team1Wins / totalMaps;
    let momentum2 = team2Wins / totalMaps;

    // Weight recent maps more heavily
    if (completedMaps.length > 1) {
      const lastMap = completedMaps[completedMaps.length - 1];
      const lastMapWinner = lastMap.winner?.toString();

      if (lastMapWinner === team1.team._id.toString()) {
        momentum1 += 0.1; // Bonus for winning last map
      } else if (lastMapWinner === team2.team._id.toString()) {
        momentum2 += 0.1;
      }
    }

    // Normalize
    const total = momentum1 + momentum2;
    return {
      team1: momentum1 / total,
      team2: momentum2 / total,
      confidence: Math.min(1.0, totalMaps / 2), // More confident with more completed maps
    };
  }

  /**
   * Calculate mental resilience and comeback ability factor
   * @private
   */
  async _calculateMentalResilienceFactor(team1, team2) {
    try {
      const [team1Resilience, team2Resilience] = await Promise.all([
        this._getTeamResilienceStats(team1.team._id),
        this._getTeamResilienceStats(team2.team._id),
      ]);

      const team1Rate = team1Resilience.comebackRate;
      const team2Rate = team2Resilience.comebackRate;

      // Weight by sample size
      const team1Weight = Math.min(1.0, team1Resilience.totalSeries / 10);
      const team2Weight = Math.min(1.0, team2Resilience.totalSeries / 10);

      const adjustedTeam1Rate = team1Rate * team1Weight + 0.5 * (1 - team1Weight);
      const adjustedTeam2Rate = team2Rate * team2Weight + 0.5 * (1 - team2Weight);

      // Normalize
      const total = adjustedTeam1Rate + adjustedTeam2Rate;
      return {
        team1: adjustedTeam1Rate / total,
        team2: adjustedTeam2Rate / total,
        confidence: (team1Weight + team2Weight) / 2,
      };
    } catch (error) {
      this.logger.warn('Error calculating mental resilience factor:', error);
      return { team1: 0.5, team2: 0.5, confidence: 0.0 };
    }
  }

  /**
   * Get team resilience statistics (comeback ability)
   * @private
   */
  async _getTeamResilienceStats(teamId) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 180); // Last 6 months

    const matches = await CS2Match.find({
      'teams.team': teamId,
      format: 'bo3',
      status: 'finished',
      date: { $gte: cutoffDate },
    })
      .select('teams maps')
      .lean();

    let comebacks = 0;
    let totalSeries = 0;

    matches.forEach((match) => {
      const teamData = match.teams.find((t) => t.team.toString() === teamId.toString());
      if (!teamData) return;

      const completedMaps = match.maps.filter((map) => map.winner);
      if (completedMaps.length < 2) return; // Need at least 2 maps for comeback analysis

      let teamWins = 0;
      let opponentWins = 0;

      completedMaps.forEach((map) => {
        if (map.winner.toString() === teamId.toString()) {
          teamWins++;
        } else {
          opponentWins++;
        }
      });

      // Check for comeback scenarios
      if (teamData.isWinner && opponentWins > 0) {
        // Team won series after losing at least one map
        if (completedMaps.length === 3 && opponentWins === 1) {
          comebacks++; // 2-1 comeback
        }
      }

      totalSeries++;
    });

    return {
      comebackRate: totalSeries > 0 ? comebacks / totalSeries : 0.5,
      totalSeries,
      comebacks,
    };
  }

  /**
   * Calculate remaining map pool advantage factor
   * @private
   */
  async _calculateRemainingMapPoolFactor(team1, team2, match, completedMaps) {
    try {
      const completedMapNames = completedMaps.map((map) => map.name);
      const allMaps = [
        'de_mirage',
        'de_inferno',
        'de_dust2',
        'de_overpass',
        'de_vertigo',
        'de_nuke',
        'de_ancient',
      ];
      const remainingMaps = allMaps.filter((map) => !completedMapNames.includes(map));

      if (remainingMaps.length === 0) {
        return { team1: 0.5, team2: 0.5, confidence: 0.0 };
      }

      // Calculate average performance on remaining maps
      const [team1MapStats, team2MapStats] = await Promise.all([
        Promise.all(remainingMaps.map((map) => this._getTeamMapStats(team1.team._id, map))),
        Promise.all(remainingMaps.map((map) => this._getTeamMapStats(team2.team._id, map))),
      ]);

      let team1AvgRate = 0;
      let team2AvgRate = 0;
      let totalWeight = 0;

      remainingMaps.forEach((map, index) => {
        const team1Stats = team1MapStats[index];
        const team2Stats = team2MapStats[index];

        const weight = Math.min(team1Stats.totalMaps, team2Stats.totalMaps, 10) / 10;

        team1AvgRate += team1Stats.winRate * weight;
        team2AvgRate += team2Stats.winRate * weight;
        totalWeight += weight;
      });

      if (totalWeight === 0) {
        return { team1: 0.5, team2: 0.5, confidence: 0.0 };
      }

      team1AvgRate /= totalWeight;
      team2AvgRate /= totalWeight;

      // Normalize
      const total = team1AvgRate + team2AvgRate;
      return {
        team1: team1AvgRate / total,
        team2: team2AvgRate / total,
        confidence: totalWeight,
      };
    } catch (error) {
      this.logger.warn('Error calculating remaining map pool factor:', error);
      return { team1: 0.5, team2: 0.5, confidence: 0.0 };
    }
  }

  /**
   * Calculate historical series performance factor
   * @private
   */
  async _calculateSeriesHistoryFactor(team1, team2) {
    try {
      const [team1SeriesStats, team2SeriesStats] = await Promise.all([
        this._getTeamSeriesStats(team1.team._id),
        this._getTeamSeriesStats(team2.team._id),
      ]);

      const team1Rate = team1SeriesStats.winRate;
      const team2Rate = team2SeriesStats.winRate;

      // Weight by sample size
      const team1Weight = Math.min(1.0, team1SeriesStats.totalSeries / 20);
      const team2Weight = Math.min(1.0, team2SeriesStats.totalSeries / 20);

      const adjustedTeam1Rate = team1Rate * team1Weight + 0.5 * (1 - team1Weight);
      const adjustedTeam2Rate = team2Rate * team2Weight + 0.5 * (1 - team2Weight);

      // Normalize
      const total = adjustedTeam1Rate + adjustedTeam2Rate;
      return {
        team1: adjustedTeam1Rate / total,
        team2: adjustedTeam2Rate / total,
        confidence: (team1Weight + team2Weight) / 2,
      };
    } catch (error) {
      this.logger.warn('Error calculating series history factor:', error);
      return { team1: 0.5, team2: 0.5, confidence: 0.0 };
    }
  }

  /**
   * Get team series statistics
   * @private
   */
  async _getTeamSeriesStats(teamId) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 180); // Last 6 months

    const matches = await CS2Match.find({
      'teams.team': teamId,
      format: 'bo3',
      status: 'finished',
      date: { $gte: cutoffDate },
    })
      .select('teams')
      .lean();

    let wins = 0;
    let totalSeries = 0;

    matches.forEach((match) => {
      const teamData = match.teams.find((t) => t.team.toString() === teamId.toString());
      if (teamData) {
        if (teamData.isWinner) wins++;
        totalSeries++;
      }
    });

    return {
      winRate: totalSeries > 0 ? wins / totalSeries : 0.5,
      totalSeries,
      wins,
    };
  }

  /**
   * Calculate team strength factor
   * @private
   */
  _calculateTeamStrengthFactor(team1, team2) {
    const ranking1 = team1.team.ranking?.current || 50;
    const ranking2 = team2.team.ranking?.current || 50;

    // Lower ranking number is better
    const rankingDiff = ranking2 - ranking1;
    const maxDiff = 30;

    const normalizedDiff = Math.max(-maxDiff, Math.min(maxDiff, rankingDiff)) / maxDiff;

    return {
      team1: 0.5 + normalizedDiff * 0.2, // Slightly higher influence for series
      team2: 0.5 - normalizedDiff * 0.2,
      confidence: 0.8,
    };
  }

  /**
   * Calculate fatigue factor based on match length
   * @private
   */
  _calculateFatigueFactor(match, completedMaps) {
    // Simple fatigue model based on total rounds played
    let totalRounds = 0;
    completedMaps.forEach((map) => {
      totalRounds += (map.score?.team1 || 0) + (map.score?.team2 || 0);
    });

    // Fatigue starts to matter after 60 rounds
    const fatigueThreshold = 60;
    if (totalRounds <= fatigueThreshold) {
      return { team1: 0.5, team2: 0.5, confidence: 0.0 };
    }

    // Favor the team with better physical conditioning (approximated by ranking)
    const ranking1 = match.teams[0].team.ranking?.current || 50;
    const ranking2 = match.teams[1].team.ranking?.current || 50;

    const fatigueImpact = Math.min(0.1, (totalRounds - fatigueThreshold) / 100);
    const rankingAdvantage = (ranking2 - ranking1) / 100; // Better ranked team handles fatigue better

    return {
      team1: 0.5 + rankingAdvantage * fatigueImpact,
      team2: 0.5 - rankingAdvantage * fatigueImpact,
      confidence: Math.min(1.0, fatigueImpact * 5),
    };
  }

  /**
   * Calculate final series outcome prediction from factors
   * @private
   */
  _calculateSeriesOutcomePrediction(factors, team1, team2, completedMaps) {
    let team1Score = 0;
    let team2Score = 0;
    let totalWeight = 0;
    let totalConfidence = 0;

    factors.forEach((factor) => {
      const weight = factor.weight;
      const confidence = factor.value.confidence || 1.0;
      const adjustedWeight = weight * confidence;

      team1Score += factor.value.team1 * adjustedWeight;
      team2Score += factor.value.team2 * adjustedWeight;
      totalWeight += adjustedWeight;
      totalConfidence += confidence * weight;
    });

    // Normalize scores
    if (totalWeight > 0) {
      team1Score /= totalWeight;
      team2Score /= totalWeight;
    } else {
      team1Score = 0.5;
      team2Score = 0.5;
    }

    // Determine current series state
    let team1MapWins = 0;
    let team2MapWins = 0;

    completedMaps.forEach((map) => {
      if (map.winner) {
        if (map.winner.toString() === team1.team._id.toString()) {
          team1MapWins++;
        } else if (map.winner.toString() === team2.team._id.toString()) {
          team2MapWins++;
        }
      }
    });

    // Calculate outcome probabilities
    const outcomes = this._calculateSeriesOutcomeProbabilities(
      team1Score,
      team2Score,
      team1MapWins,
      team2MapWins,
    );

    // Determine most likely outcome and winner
    const mostLikelyOutcome = Object.keys(outcomes).reduce((a, b) =>
      outcomes[a] > outcomes[b] ? a : b,
    );

    const winner = team1Score > team2Score ? team1.team._id : team2.team._id;
    const winnerName = team1Score > team2Score ? team1.team.name : team2.team.name;

    // Calculate overall confidence
    const factorConfidence = totalConfidence / factors.reduce((sum, f) => sum + f.weight, 0);
    const outcomeConfidence = Math.max(...Object.values(outcomes));
    const normalizedConfidence = Math.max(0.5, Math.min(1.0, outcomeConfidence * factorConfidence));

    return {
      outcome: mostLikelyOutcome,
      winner,
      winnerName,
      confidence: normalizedConfidence,
      probabilities: {
        team1: team1Score,
        team2: team2Score,
      },
      outcomes,
      currentState: {
        team1MapWins,
        team2MapWins,
        mapsRemaining: 3 - (team1MapWins + team2MapWins),
      },
      factors,
      keyFactors: this._identifyKeyFactors(factors),
      timestamp: new Date(),
    };
  }

  /**
   * Calculate specific series outcome probabilities (2-0, 2-1, etc.)
   * @private
   */
  _calculateSeriesOutcomeProbabilities(team1Prob, team2Prob, team1Wins, team2Wins) {
    const outcomes = {};

    // If series is already decided
    if (team1Wins === 2) {
      outcomes['2-0'] = team1Wins === 2 && team2Wins === 0 ? 1.0 : 0.0;
      outcomes['2-1'] = team1Wins === 2 && team2Wins === 1 ? 1.0 : 0.0;
      return outcomes;
    }

    if (team2Wins === 2) {
      outcomes['2-0'] = team2Wins === 2 && team1Wins === 0 ? 1.0 : 0.0;
      outcomes['2-1'] = team2Wins === 2 && team1Wins === 1 ? 1.0 : 0.0;
      return outcomes;
    }

    // Calculate probabilities for remaining scenarios
    if (team1Wins === 1 && team2Wins === 0) {
      // Team1 leads 1-0
      outcomes['2-0'] = team1Prob; // Team1 wins next map
      outcomes['2-1'] = team2Prob * team1Prob; // Team2 wins next, Team1 wins final
    } else if (team1Wins === 0 && team2Wins === 1) {
      // Team2 leads 1-0
      outcomes['2-0'] = team2Prob; // Team2 wins next map
      outcomes['2-1'] = team1Prob * team2Prob; // Team1 wins next, Team2 wins final
    } else if (team1Wins === 1 && team2Wins === 1) {
      // Series tied 1-1
      outcomes['2-1'] = team1Prob + team2Prob; // Either team can win 2-1
    } else {
      // Series just started (0-0)
      outcomes['2-0'] = team1Prob * team1Prob + team2Prob * team2Prob;
      outcomes['2-1'] = 2 * team1Prob * team2Prob;
    }

    // Normalize probabilities
    const total = Object.values(outcomes).reduce((sum, prob) => sum + prob, 0);
    if (total > 0) {
      Object.keys(outcomes).forEach((key) => {
        outcomes[key] /= total;
      });
    }

    return outcomes;
  }

  /**
   * Store series prediction in database
   * @private
   */
  async _storeSeriesPrediction(matchId, prediction) {
    const updateData = {
      'predictions.seriesOutcome.predicted': true,
      'predictions.seriesOutcome.outcome': prediction.outcome,
      'predictions.seriesOutcome.winner': prediction.winner,
      'predictions.seriesOutcome.confidence': prediction.confidence,
      'predictions.seriesOutcome.factors': prediction.factors,
    };

    await CS2Match.findOneAndUpdate({ hltvId: matchId }, { $set: updateData }, { new: true });
  }

  /**
   * Store prediction in database
   * @private
   */
  async _storePrediction(matchId, predictionType, prediction) {
    const updateData = {
      [`predictions.${predictionType}.predicted`]: true,
      [`predictions.${predictionType}.winner`]: prediction.winner,
      [`predictions.${predictionType}.confidence`]: prediction.confidence,
      [`predictions.${predictionType}.factors`]: prediction.factors,
    };

    await CS2Match.findOneAndUpdate({ hltvId: matchId }, { $set: updateData }, { new: true });
  }
}

module.exports = CS2PredictionEngine;
