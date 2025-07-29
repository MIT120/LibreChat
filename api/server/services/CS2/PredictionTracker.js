const { CS2Match } = require('~/db/models');
const logger = require('~/utils/logger');

/**
 * CS2 Prediction Tracker
 * Tracks prediction accuracy and provides evaluation metrics
 */
class PredictionTracker {
  constructor() {
    this.logger = logger.child({ service: 'CS2PredictionTracker' });
  }

  /**
   * Store a prediction with timestamp and confidence level
   * @param {string} matchId - The match HLTV ID
   * @param {string} predictionType - Type of prediction (halfTime, mapWinner, seriesOutcome)
   * @param {Object} prediction - The prediction data
   * @returns {Promise<Object>} Updated match document
   */
  async storePrediction(matchId, predictionType, prediction) {
    try {
      this.logger.info(`Storing ${predictionType} prediction for match ${matchId}`);

      const updateData = {
        [`predictions.${predictionType}`]: {
          ...prediction,
          predicted: true,
          timestamp: new Date(),
          evaluated: false,
        },
        'metadata.lastUpdated': new Date(),
      };

      const updatedMatch = await CS2Match.findOneAndUpdate(
        { hltvId: matchId },
        { $set: updateData },
        { new: true, lean: true },
      );

      if (!updatedMatch) {
        throw new Error(`Match ${matchId} not found`);
      }

      this.logger.info(`${predictionType} prediction stored for match ${matchId}`, {
        confidence: prediction.confidence,
        winner: prediction.winner || prediction.winnerName,
      });

      return updatedMatch;
    } catch (error) {
      this.logger.error(`Error storing ${predictionType} prediction for match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Evaluate predictions against actual results when matches conclude
   * @param {string} matchId - The match HLTV ID
   * @returns {Promise<Object>} Evaluation results
   */
  async evaluatePredictions(matchId) {
    try {
      this.logger.info(`Evaluating predictions for match ${matchId}`);

      const match = await CS2Match.findOne({ hltvId: matchId })
        .populate('teams.team', 'name')
        .lean();

      if (!match) {
        throw new Error(`Match ${matchId} not found`);
      }

      if (match.status !== 'finished') {
        throw new Error(`Match ${matchId} is not finished yet`);
      }

      const evaluationResults = {};

      // Evaluate half-time predictions
      if (match.predictions?.halfTime?.predicted && !match.predictions.halfTime.evaluated) {
        evaluationResults.halfTime = await this._evaluateHalfTimePrediction(match);
      }

      // Evaluate map winner predictions
      if (match.predictions?.mapWinner?.predicted && !match.predictions.mapWinner.evaluated) {
        evaluationResults.mapWinner = await this._evaluateMapWinnerPrediction(match);
      }

      // Evaluate series outcome predictions
      if (
        match.predictions?.seriesOutcome?.predicted &&
        !match.predictions.seriesOutcome.evaluated
      ) {
        evaluationResults.seriesOutcome = await this._evaluateSeriesOutcomePrediction(match);
      }

      // Update match with evaluation results
      if (Object.keys(evaluationResults).length > 0) {
        await this._updateMatchWithEvaluations(matchId, evaluationResults);
      }

      this.logger.info(`Prediction evaluation completed for match ${matchId}`, evaluationResults);

      return evaluationResults;
    } catch (error) {
      this.logger.error(`Error evaluating predictions for match ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Evaluate half-time prediction accuracy
   * @private
   */
  async _evaluateHalfTimePrediction(match) {
    const prediction = match.predictions.halfTime;

    // Find the actual half-time winner from the first map
    const firstMap = match.maps[0];
    if (!firstMap || !firstMap.rounds || firstMap.rounds.length < 15) {
      return {
        accurate: false,
        reason: 'insufficient_data',
        confidence: prediction.confidence,
        timestamp: new Date(),
      };
    }

    // Calculate actual half-time winner (first 15 rounds)
    const firstHalfRounds = firstMap.rounds.slice(0, 15);
    let team1Rounds = 0;
    let team2Rounds = 0;

    firstHalfRounds.forEach((round) => {
      // Simplified logic - in reality we'd need proper side tracking
      if (round.winner === 'CT') {
        team1Rounds++;
      } else {
        team2Rounds++;
      }
    });

    const actualWinner = team1Rounds > team2Rounds ? 'team1' : 'team2';
    const predictedWinner = prediction.winner;
    const accurate = actualWinner === predictedWinner;

    return {
      accurate,
      actualWinner,
      predictedWinner,
      confidence: prediction.confidence,
      actualScore: { team1: team1Rounds, team2: team2Rounds },
      timestamp: new Date(),
    };
  }

  /**
   * Evaluate map winner prediction accuracy
   * @private
   */
  async _evaluateMapWinnerPrediction(match) {
    const prediction = match.predictions.mapWinner;

    // Find the actual map winner
    const targetMap = match.maps[0]; // Assuming first map for now
    if (!targetMap || !targetMap.winner) {
      return {
        accurate: false,
        reason: 'no_winner_data',
        confidence: prediction.confidence,
        timestamp: new Date(),
      };
    }

    const actualWinner = targetMap.winner.toString();
    const predictedWinner = prediction.winner.toString();
    const accurate = actualWinner === predictedWinner;

    return {
      accurate,
      actualWinner,
      predictedWinner,
      confidence: prediction.confidence,
      mapName: targetMap.name,
      actualScore: targetMap.score,
      timestamp: new Date(),
    };
  }

  /**
   * Evaluate series outcome prediction accuracy
   * @private
   */
  async _evaluateSeriesOutcomePrediction(match) {
    const prediction = match.predictions.seriesOutcome;

    if (match.format !== 'bo3') {
      return {
        accurate: false,
        reason: 'not_bo3_series',
        confidence: prediction.confidence,
        timestamp: new Date(),
      };
    }

    // Calculate actual series outcome
    const completedMaps = match.maps.filter((map) => map.winner);
    if (completedMaps.length < 2) {
      return {
        accurate: false,
        reason: 'insufficient_maps',
        confidence: prediction.confidence,
        timestamp: new Date(),
      };
    }

    let team1Wins = 0;
    let team2Wins = 0;

    completedMaps.forEach((map) => {
      if (map.winner.toString() === match.teams[0].team._id.toString()) {
        team1Wins++;
      } else if (map.winner.toString() === match.teams[1].team._id.toString()) {
        team2Wins++;
      }
    });

    const actualOutcome = (team1Wins === 2 || team2Wins === 2) && completedMaps.length === 2 ? '2-0' : '2-1';
    const actualWinner = team1Wins > team2Wins ? match.teams[0].team._id : match.teams[1].team._id;

    const predictedOutcome = prediction.outcome;
    const predictedWinner = prediction.winner;

    const outcomeAccurate = actualOutcome === predictedOutcome;
    const winnerAccurate = actualWinner.toString() === predictedWinner.toString();
    const accurate = outcomeAccurate && winnerAccurate;

    return {
      accurate,
      outcomeAccurate,
      winnerAccurate,
      actualOutcome,
      predictedOutcome,
      actualWinner: actualWinner.toString(),
      predictedWinner: predictedWinner.toString(),
      confidence: prediction.confidence,
      seriesScore: { team1: team1Wins, team2: team2Wins },
      timestamp: new Date(),
    };
  }

  /**
   * Update match document with evaluation results
   * @private
   */
  async _updateMatchWithEvaluations(matchId, evaluationResults) {
    const updateData = {};

    Object.keys(evaluationResults).forEach((predictionType) => {
      const evaluation = evaluationResults[predictionType];
      updateData[`predictions.${predictionType}.evaluation`] = evaluation;
      updateData[`predictions.${predictionType}.evaluated`] = true;
    });

    updateData['metadata.lastUpdated'] = new Date();

    await CS2Match.findOneAndUpdate({ hltvId: matchId }, { $set: updateData }, { new: true });
  }

  /**
   * Calculate accuracy metrics across different prediction types and time periods
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Accuracy metrics
   */
  async calculateAccuracyMetrics(options = {}) {
    try {
      const {
        predictionType = 'all',
        timeframe = '30d',
        minConfidence = 0.0,
        maxConfidence = 1.0,
      } = options;

      this.logger.info('Calculating accuracy metrics', { predictionType, timeframe });

      const dateFilter = this._getDateFilter(timeframe);
      const metrics = {};

      if (predictionType === 'all' || predictionType === 'halfTime') {
        metrics.halfTime = await this._calculatePredictionTypeMetrics(
          'halfTime',
          dateFilter,
          minConfidence,
          maxConfidence,
        );
      }

      if (predictionType === 'all' || predictionType === 'mapWinner') {
        metrics.mapWinner = await this._calculatePredictionTypeMetrics(
          'mapWinner',
          dateFilter,
          minConfidence,
          maxConfidence,
        );
      }

      if (predictionType === 'all' || predictionType === 'seriesOutcome') {
        metrics.seriesOutcome = await this._calculatePredictionTypeMetrics(
          'seriesOutcome',
          dateFilter,
          minConfidence,
          maxConfidence,
        );
      }

      // Calculate overall metrics
      if (predictionType === 'all') {
        metrics.overall = this._calculateOverallMetrics(metrics);
      }

      this.logger.info('Accuracy metrics calculated', metrics);
      return metrics;
    } catch (error) {
      this.logger.error('Error calculating accuracy metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate metrics for a specific prediction type
   * @private
   */
  async _calculatePredictionTypeMetrics(predictionType, dateFilter, minConfidence, maxConfidence) {
    const pipeline = [
      {
        $match: {
          status: 'finished',
          [`predictions.${predictionType}.predicted`]: true,
          [`predictions.${predictionType}.evaluated`]: true,
          [`predictions.${predictionType}.confidence`]: {
            $gte: minConfidence,
            $lte: maxConfidence,
          },
          ...dateFilter,
        },
      },
      {
        $project: {
          prediction: `$predictions.${predictionType}`,
          date: 1,
        },
      },
      {
        $group: {
          _id: null,
          totalPredictions: { $sum: 1 },
          accuratePredictions: {
            $sum: { $cond: ['$prediction.evaluation.accurate', 1, 0] },
          },
          averageConfidence: { $avg: '$prediction.confidence' },
          confidenceSum: { $sum: '$prediction.confidence' },
          accurateConfidenceSum: {
            $sum: {
              $cond: ['$prediction.evaluation.accurate', '$prediction.confidence', 0],
            },
          },
        },
      },
    ];

    const result = await CS2Match.aggregate(pipeline);
    const data = result[0] || {
      totalPredictions: 0,
      accuratePredictions: 0,
      averageConfidence: 0,
      confidenceSum: 0,
      accurateConfidenceSum: 0,
    };

    const accuracy =
      data.totalPredictions > 0 ? data.accuratePredictions / data.totalPredictions : 0;
    const confidenceWeightedAccuracy =
      data.confidenceSum > 0 ? data.accurateConfidenceSum / data.confidenceSum : 0;

    return {
      totalPredictions: data.totalPredictions,
      accuratePredictions: data.accuratePredictions,
      accuracy: Math.round(accuracy * 10000) / 100, // Percentage with 2 decimal places
      averageConfidence: Math.round(data.averageConfidence * 100) / 100,
      confidenceWeightedAccuracy: Math.round(confidenceWeightedAccuracy * 10000) / 100,
    };
  }

  /**
   * Calculate overall metrics across all prediction types
   * @private
   */
  _calculateOverallMetrics(metrics) {
    let totalPredictions = 0;
    let totalAccurate = 0;
    let totalConfidenceSum = 0;
    let totalAccurateConfidenceSum = 0;

    Object.keys(metrics).forEach((type) => {
      const typeMetrics = metrics[type];
      totalPredictions += typeMetrics.totalPredictions;
      totalAccurate += typeMetrics.accuratePredictions;

      // Approximate confidence sums for overall calculation
      const avgConf = typeMetrics.averageConfidence / 100;
      const confSum = typeMetrics.totalPredictions * avgConf;
      const accConfSum = typeMetrics.accuratePredictions * avgConf;

      totalConfidenceSum += confSum;
      totalAccurateConfidenceSum += accConfSum;
    });

    const overallAccuracy = totalPredictions > 0 ? totalAccurate / totalPredictions : 0;
    const overallConfidenceWeightedAccuracy =
      totalConfidenceSum > 0 ? totalAccurateConfidenceSum / totalConfidenceSum : 0;

    return {
      totalPredictions,
      accuratePredictions: totalAccurate,
      accuracy: Math.round(overallAccuracy * 10000) / 100,
      confidenceWeightedAccuracy: Math.round(overallConfidenceWeightedAccuracy * 10000) / 100,
    };
  }

  /**
   * Get date filter for timeframe
   * @private
   */
  _getDateFilter(timeframe) {
    const now = new Date();
    const cutoffDate = new Date();

    switch (timeframe) {
      case '7d':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        cutoffDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        cutoffDate.setDate(now.getDate() - 30);
    }

    return { date: { $gte: cutoffDate } };
  }

  /**
   * Get detailed accuracy breakdown by confidence ranges
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Accuracy breakdown by confidence ranges
   */
  async getAccuracyByConfidenceRange(options = {}) {
    try {
      const { predictionType = 'all', timeframe = '30d' } = options;

      this.logger.info('Getting accuracy breakdown by confidence range', {
        predictionType,
        timeframe,
      });

      const dateFilter = this._getDateFilter(timeframe);
      const confidenceRanges = [
        { min: 0.5, max: 0.6, label: '50-60%' },
        { min: 0.6, max: 0.7, label: '60-70%' },
        { min: 0.7, max: 0.8, label: '70-80%' },
        { min: 0.8, max: 0.9, label: '80-90%' },
        { min: 0.9, max: 1.0, label: '90-100%' },
      ];

      const breakdown = {};

      for (const range of confidenceRanges) {
        if (predictionType === 'all') {
          breakdown[range.label] = {
            halfTime: await this._calculatePredictionTypeMetrics(
              'halfTime',
              dateFilter,
              range.min,
              range.max,
            ),
            mapWinner: await this._calculatePredictionTypeMetrics(
              'mapWinner',
              dateFilter,
              range.min,
              range.max,
            ),
            seriesOutcome: await this._calculatePredictionTypeMetrics(
              'seriesOutcome',
              dateFilter,
              range.min,
              range.max,
            ),
          };
        } else {
          breakdown[range.label] = await this._calculatePredictionTypeMetrics(
            predictionType,
            dateFilter,
            range.min,
            range.max,
          );
        }
      }

      return breakdown;
    } catch (error) {
      this.logger.error('Error getting accuracy breakdown by confidence range:', error);
      throw error;
    }
  }

  /**
   * Get accuracy trends over time
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Accuracy trends data
   */
  async getAccuracyTrends(options = {}) {
    try {
      const { predictionType = 'all', period = 'daily', days = 30 } = options;

      this.logger.info('Getting accuracy trends', { predictionType, period, days });

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);

      const groupBy =
        period === 'daily'
          ? { $dateToString: { format: '%Y-%m-%d', date: '$date' } }
          : { $dateToString: { format: '%Y-%m', date: '$date' } };

      const pipeline = [
        {
          $match: {
            status: 'finished',
            date: { $gte: startDate, $lte: endDate },
            $or: [
              { 'predictions.halfTime.predicted': true, 'predictions.halfTime.evaluated': true },
              { 'predictions.mapWinner.predicted': true, 'predictions.mapWinner.evaluated': true },
              {
                'predictions.seriesOutcome.predicted': true,
                'predictions.seriesOutcome.evaluated': true,
              },
            ],
          },
        },
        {
          $group: {
            _id: groupBy,
            totalPredictions: { $sum: 1 },
            halfTimeAccurate: {
              $sum: { $cond: ['$predictions.halfTime.evaluation.accurate', 1, 0] },
            },
            halfTimeTotal: {
              $sum: { $cond: ['$predictions.halfTime.predicted', 1, 0] },
            },
            mapWinnerAccurate: {
              $sum: { $cond: ['$predictions.mapWinner.evaluation.accurate', 1, 0] },
            },
            mapWinnerTotal: {
              $sum: { $cond: ['$predictions.mapWinner.predicted', 1, 0] },
            },
            seriesOutcomeAccurate: {
              $sum: { $cond: ['$predictions.seriesOutcome.evaluation.accurate', 1, 0] },
            },
            seriesOutcomeTotal: {
              $sum: { $cond: ['$predictions.seriesOutcome.predicted', 1, 0] },
            },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ];

      const results = await CS2Match.aggregate(pipeline);

      return results.map((result) => ({
        date: result._id,
        halfTime: {
          accuracy:
            result.halfTimeTotal > 0 ? (result.halfTimeAccurate / result.halfTimeTotal) * 100 : 0,
          total: result.halfTimeTotal,
        },
        mapWinner: {
          accuracy:
            result.mapWinnerTotal > 0
              ? (result.mapWinnerAccurate / result.mapWinnerTotal) * 100
              : 0,
          total: result.mapWinnerTotal,
        },
        seriesOutcome: {
          accuracy:
            result.seriesOutcomeTotal > 0
              ? (result.seriesOutcomeAccurate / result.seriesOutcomeTotal) * 100
              : 0,
          total: result.seriesOutcomeTotal,
        },
        overall: {
          accuracy:
            result.totalPredictions > 0
              ? ((result.halfTimeAccurate +
                  result.mapWinnerAccurate +
                  result.seriesOutcomeAccurate) /
                  (result.halfTimeTotal + result.mapWinnerTotal + result.seriesOutcomeTotal)) *
                100
              : 0,
          total: result.totalPredictions,
        },
      }));
    } catch (error) {
      this.logger.error('Error getting accuracy trends:', error);
      throw error;
    }
  }

  /**
   * Batch evaluate predictions for multiple matches
   * @param {Array} matchIds - Array of match HLTV IDs
   * @returns {Promise<Object>} Batch evaluation results
   */
  async batchEvaluatePredictions(matchIds) {
    try {
      this.logger.info(`Batch evaluating predictions for ${matchIds.length} matches`);

      const results = {
        successful: [],
        failed: [],
        summary: {
          total: matchIds.length,
          evaluated: 0,
          errors: 0,
        },
      };

      for (const matchId of matchIds) {
        try {
          const evaluation = await this.evaluatePredictions(matchId);
          results.successful.push({ matchId, evaluation });
          results.summary.evaluated++;
        } catch (error) {
          results.failed.push({ matchId, error: error.message });
          results.summary.errors++;
        }
      }

      this.logger.info('Batch evaluation completed', results.summary);
      return results;
    } catch (error) {
      this.logger.error('Error in batch evaluation:', error);
      throw error;
    }
  }
}

module.exports = PredictionTracker;
