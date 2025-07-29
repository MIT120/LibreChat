const logger = require('~/config/winston');
const { CS2Match } = require('~/models/CS2');
const { EventEmitter } = require('events');

// Constants for better maintainability
const PREDICTION_TYPES = ['halfTime', 'mapWinner', 'seriesOutcome'];
const SEVERITY_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};
const STATUS_LEVELS = {
  HEALTHY: 'healthy',
  WARNING: 'warning',
  DEGRADED: 'degraded',
  CRITICAL: 'critical',
  INSUFFICIENT_DATA: 'insufficient_data',
};
const SEVERITY_THRESHOLDS = {
  CRITICAL: 0.15,
  HIGH: 0.1,
  MEDIUM: 0.05,
};

/**
 * ModelPerformanceMonitor - Monitors prediction accuracy and triggers alerts
 * when performance drops below acceptable thresholds
 */
class ModelPerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();

    this.thresholds = {
      halfTimeAccuracy: options.halfTimeAccuracy || 0.65,
      mapWinnerAccuracy: options.mapWinnerAccuracy || 0.7,
      seriesOutcomeAccuracy: options.seriesOutcomeAccuracy || 0.68,
      minimumSampleSize: options.minimumSampleSize || 50,
      ...options.thresholds,
    };

    this.alertCooldown = options.alertCooldown || 3600000; // 1 hour in ms
    this.lastAlerts = new Map();
    this.monitoringInterval = options.monitoringInterval || 300000; // 5 minutes
    this.isMonitoring = false;
    this.intervalId = null;
  }

  /**
   * Start continuous monitoring of model performance
   */
  startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('ModelPerformanceMonitor: Already monitoring');
      return;
    }

    this.isMonitoring = true;
    this.intervalId = setInterval(() => {
      this.checkPerformance().catch((error) => {
        logger.error('ModelPerformanceMonitor: Error during performance check', {
          error: error.message,
          stack: error.stack,
        });
        // Emit error event for external handling
        this.emit('monitoringError', error);
      });
    }, this.monitoringInterval);

    logger.info('ModelPerformanceMonitor: Started monitoring', {
      interval: this.monitoringInterval,
      thresholds: this.thresholds,
    });

    // Emit monitoring started event
    this.emit('monitoringStarted', { interval: this.monitoringInterval });
  }

  /**
   * Stop continuous monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    logger.info('ModelPerformanceMonitor: Stopped monitoring');
  }

  /**
   * Check current model performance and trigger alerts if needed
   */
  async checkPerformance() {
    try {
      const metrics = await this.calculateCurrentMetrics();

      // Check each prediction type
      for (const [predictionType, accuracy] of Object.entries(metrics.accuracy)) {
        const threshold = this.thresholds[`${predictionType}Accuracy`];
        const sampleSize = metrics.sampleSizes[predictionType];

        if (threshold && sampleSize >= this.thresholds.minimumSampleSize) {
          if (accuracy < threshold) {
            await this.triggerAlert(predictionType, accuracy, threshold, sampleSize);
          }
        }
      }

      // Emit performance update event
      this.emit('performanceUpdate', metrics);

      return metrics;
    } catch (error) {
      logger.error('ModelPerformanceMonitor: Error checking performance', { error });
      throw error;
    }
  }

  /**
   * Calculate current accuracy metrics for all prediction types
   */
  async calculateCurrentMetrics(timeWindow = 7) {
    // Input validation
    if (!Number.isInteger(timeWindow) || timeWindow <= 0 || timeWindow > 365) {
      throw new Error('timeWindow must be a positive integer between 1 and 365 days');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeWindow);

    try {
      const matches = await this._fetchMatchesForMetrics(cutoffDate);

      const metrics = {
        accuracy: {},
        sampleSizes: {},
        timeWindow,
        calculatedAt: new Date(),
        totalMatches: matches.length,
      };

      // Calculate accuracy for each prediction type
      for (const type of PREDICTION_TYPES) {
        const accuracy = this._calculatePredictionAccuracy(matches, type);
        if (accuracy) {
          metrics.accuracy[type] = accuracy.rate;
          metrics.sampleSizes[type] = accuracy.sampleSize;
        }
      }

      return metrics;
    } catch (error) {
      logger.error('ModelPerformanceMonitor: Error calculating metrics', { error });
      throw error;
    }
  }

  /**
   * Fetch matches for metrics calculation
   * @private
   */
  async _fetchMatchesForMetrics(cutoffDate) {
    return await CS2Match.find({
      status: 'completed',
      endTime: { $gte: cutoffDate },
      $or: [
        { 'predictions.halfTime': { $exists: true } },
        { 'predictions.mapWinner': { $exists: true } },
        { 'predictions.seriesOutcome': { $exists: true } },
      ],
    }).lean();
  }

  /**
   * Calculate accuracy for a specific prediction type
   * @private
   */
  _calculatePredictionAccuracy(matches, predictionType) {
    const predictions = matches.filter(
      (m) => m.predictions?.[predictionType] && m.actualResults?.[predictionType],
    );

    if (predictions.length === 0) {
      return null;
    }

    const correct = predictions.filter(
      (m) => m.predictions[predictionType].prediction === m.actualResults[predictionType].winner,
    ).length;

    return {
      rate: correct / predictions.length,
      sampleSize: predictions.length,
    };
  }

  /**
   * Trigger alert for poor model performance
   */
  async triggerAlert(predictionType, currentAccuracy, threshold, sampleSize) {
    const alertKey = `${predictionType}_accuracy`;
    const now = Date.now();

    // Check cooldown
    if (this.lastAlerts.has(alertKey)) {
      const lastAlert = this.lastAlerts.get(alertKey);
      if (now - lastAlert < this.alertCooldown) {
        return; // Still in cooldown
      }
    }

    const alertData = {
      type: 'model_performance_degradation',
      predictionType,
      currentAccuracy: Math.round(currentAccuracy * 10000) / 100, // Round to 2 decimal places
      threshold: Math.round(threshold * 10000) / 100,
      sampleSize,
      severity: this.calculateSeverity(currentAccuracy, threshold),
      timestamp: new Date(),
      recommendations: this.generateRecommendations(predictionType, currentAccuracy, threshold),
    };

    // Log the alert
    logger.warn('ModelPerformanceMonitor: Performance alert triggered', alertData);

    // Emit alert event
    this.emit('performanceAlert', alertData);

    // Update last alert time
    this.lastAlerts.set(alertKey, now);

    return alertData;
  }

  /**
   * Calculate alert severity based on how far below threshold the accuracy is
   */
  calculateSeverity(currentAccuracy, threshold) {
    const difference = threshold - currentAccuracy;

    if (difference >= SEVERITY_THRESHOLDS.CRITICAL) return SEVERITY_LEVELS.CRITICAL;
    if (difference >= SEVERITY_THRESHOLDS.HIGH) return SEVERITY_LEVELS.HIGH;
    if (difference >= SEVERITY_THRESHOLDS.MEDIUM) return SEVERITY_LEVELS.MEDIUM;
    return SEVERITY_LEVELS.LOW;
  }

  /**
   * Generate recommendations for improving model performance
   */
  generateRecommendations(predictionType, currentAccuracy, threshold) {
    const baseRecommendations = [
      'Review recent prediction failures for patterns',
      'Check if HLTV data structure has changed',
      'Verify feature extraction is working correctly',
    ];

    const typeSpecificRecommendations = this._getTypeSpecificRecommendations(predictionType);
    const severityRecommendations = this._getSeverityRecommendations(currentAccuracy, threshold);

    return [...baseRecommendations, ...typeSpecificRecommendations, ...severityRecommendations];
  }

  /**
   * Get prediction type specific recommendations
   * @private
   */
  _getTypeSpecificRecommendations(predictionType) {
    const recommendationMap = {
      halfTime: [
        'Review half-time momentum calculation algorithm',
        'Check if economy tracking is accurate',
      ],
      mapWinner: ['Verify map-specific team performance data', 'Review pick/ban strategy analysis'],
      seriesOutcome: ['Check series momentum calculation', 'Review mental resilience factors'],
    };

    return recommendationMap[predictionType] || [];
  }

  /**
   * Get severity-based recommendations
   * @private
   */
  _getSeverityRecommendations(currentAccuracy, threshold) {
    const difference = threshold - currentAccuracy;

    if (difference >= SEVERITY_THRESHOLDS.HIGH) {
      return [
        'Consider retraining the model with recent data',
        'Investigate potential data quality issues',
      ];
    }

    return [];
  }

  /**
   * Get performance dashboard data
   */
  async getDashboardData(timeWindows = [1, 7, 30]) {
    const dashboard = {
      generatedAt: new Date(),
      timeWindows: {},
    };

    for (const days of timeWindows) {
      try {
        const metrics = await this.calculateCurrentMetrics(days);
        dashboard.timeWindows[`${days}d`] = {
          ...metrics,
          status: this.getOverallStatus(metrics),
        };
      } catch (error) {
        logger.error(`ModelPerformanceMonitor: Error calculating ${days}d metrics`, { error });
        dashboard.timeWindows[`${days}d`] = { error: error.message };
      }
    }

    return dashboard;
  }

  /**
   * Determine overall system status based on metrics
   */
  getOverallStatus(metrics) {
    const accuracies = Object.entries(metrics.accuracy);

    if (accuracies.length === 0) {
      return STATUS_LEVELS.INSUFFICIENT_DATA;
    }

    let belowThreshold = 0;
    let totalChecked = 0;

    for (const [predictionType, accuracy] of accuracies) {
      const threshold = this.thresholds[`${predictionType}Accuracy`];
      const sampleSize = metrics.sampleSizes[predictionType];

      if (threshold && sampleSize >= this.thresholds.minimumSampleSize) {
        totalChecked++;
        if (accuracy < threshold) {
          belowThreshold++;
        }
      }
    }

    if (totalChecked === 0) {
      return STATUS_LEVELS.INSUFFICIENT_DATA;
    }

    const ratio = belowThreshold / totalChecked;

    if (ratio === 0) return STATUS_LEVELS.HEALTHY;
    if (ratio <= 0.33) return STATUS_LEVELS.WARNING;
    if (ratio <= 0.66) return STATUS_LEVELS.DEGRADED;
    return STATUS_LEVELS.CRITICAL;
  }

  /**
   * Force a model retraining trigger
   */
  async triggerRetraining(reason = 'manual_trigger') {
    const retrainingEvent = {
      type: 'model_retraining_required',
      reason,
      timestamp: new Date(),
      currentMetrics: await this.calculateCurrentMetrics(),
    };

    logger.info('ModelPerformanceMonitor: Triggering model retraining', retrainingEvent);
    this.emit('retrainingRequired', retrainingEvent);

    return retrainingEvent;
  }

  /**
   * Clean up resources and stop monitoring
   */
  cleanup() {
    this.stopMonitoring();
    this.lastAlerts.clear();
    this.removeAllListeners();

    logger.info('ModelPerformanceMonitor: Cleanup completed');
  }

  /**
   * Get current monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      monitoringInterval: this.monitoringInterval,
      alertCooldown: this.alertCooldown,
      thresholds: this.thresholds,
      activeAlerts: this.lastAlerts.size,
      uptime: this.intervalId ? Date.now() - (this.intervalId._idleStart || 0) : 0,
    };
  }
}

module.exports = ModelPerformanceMonitor;
