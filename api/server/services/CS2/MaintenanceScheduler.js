const cron = require('node-cron');
const DataMaintenanceService = require('./DataMaintenanceService');
const logger = require('~/utils/logger');

/**
 * Scheduler for automated data maintenance tasks
 */
class MaintenanceScheduler {
  constructor() {
    this.maintenanceService = new DataMaintenanceService();
    this.scheduledTasks = new Map();
    this.isRunning = false;
  }

  /**
   * Start all scheduled maintenance tasks
   * @param {Object} config - Scheduler configuration
   */
  start(config = {}) {
    if (this.isRunning) {
      logger.warn('Maintenance scheduler is already running');
      return;
    }

    const {
      // Daily maintenance at 2 AM
      dailyMaintenanceCron = '0 2 * * *',
      // Weekly deep maintenance on Sundays at 3 AM
      weeklyMaintenanceCron = '0 3 * * 0',
      // Monthly archival on 1st of month at 4 AM
      monthlyArchivalCron = '0 4 1 * *',
      // Enable/disable specific tasks
      enableDailyMaintenance = true,
      enableWeeklyMaintenance = true,
      enableMonthlyArchival = true,
    } = config;

    try {
      // Schedule daily maintenance (light cleanup)
      if (enableDailyMaintenance) {
        const dailyTask = cron.schedule(
          dailyMaintenanceCron,
          () => this.runDailyMaintenance(),
          {
            scheduled: false,
            timezone: 'UTC',
          },
        );
        this.scheduledTasks.set('daily', dailyTask);
        dailyTask.start();
        logger.info('Daily maintenance scheduled', { cron: dailyMaintenanceCron });
      }

      // Schedule weekly maintenance (comprehensive cleanup)
      if (enableWeeklyMaintenance) {
        const weeklyTask = cron.schedule(
          weeklyMaintenanceCron,
          () => this.runWeeklyMaintenance(),
          {
            scheduled: false,
            timezone: 'UTC',
          },
        );
        this.scheduledTasks.set('weekly', weeklyTask);
        weeklyTask.start();
        logger.info('Weekly maintenance scheduled', { cron: weeklyMaintenanceCron });
      }

      // Schedule monthly archival (data archival and cleanup)
      if (enableMonthlyArchival) {
        const monthlyTask = cron.schedule(
          monthlyArchivalCron,
          () => this.runMonthlyArchival(),
          {
            scheduled: false,
            timezone: 'UTC',
          },
        );
        this.scheduledTasks.set('monthly', monthlyTask);
        monthlyTask.start();
        logger.info('Monthly archival scheduled', { cron: monthlyArchivalCron });
      }

      this.isRunning = true;
      logger.info('Maintenance scheduler started successfully');
    } catch (error) {
      logger.error('Failed to start maintenance scheduler', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop all scheduled maintenance tasks
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Maintenance scheduler is not running');
      return;
    }

    try {
      for (const [taskName, task] of this.scheduledTasks) {
        task.stop();
        task.destroy();
        logger.info(`Stopped ${taskName} maintenance task`);
      }

      this.scheduledTasks.clear();
      this.isRunning = false;
      logger.info('Maintenance scheduler stopped successfully');
    } catch (error) {
      logger.error('Error stopping maintenance scheduler', { error: error.message });
      throw error;
    }
  }

  /**
   * Run daily maintenance routine (light cleanup)
   */
  async runDailyMaintenance() {
    logger.info('Starting daily maintenance routine');
    const startTime = Date.now();

    try {
      const results = await this.maintenanceService.runMaintenanceRoutine({
        includeDuplicateRemoval: true,
        includeConsistencyCheck: true,
        includeArchival: false, // Skip archival for daily runs
        includeIndexOptimization: false, // Skip index optimization for daily runs
      });

      const duration = Date.now() - startTime;
      logger.info('Daily maintenance completed', {
        duration,
        duplicatesRemoved: results.duplicatesRemoved,
        inconsistenciesFixed: results.inconsistenciesFixed,
        errors: results.errors.length,
      });

      // Send alert if there were significant issues
      if (results.errors.length > 0) {
        await this.sendMaintenanceAlert('daily', results);
      }

      return results;
    } catch (error) {
      logger.error('Daily maintenance failed', { error: error.message });
      await this.sendMaintenanceAlert('daily', { error: error.message });
      throw error;
    }
  }

  /**
   * Run weekly maintenance routine (comprehensive cleanup)
   */
  async runWeeklyMaintenance() {
    logger.info('Starting weekly maintenance routine');
    const startTime = Date.now();

    try {
      const results = await this.maintenanceService.runMaintenanceRoutine({
        includeDuplicateRemoval: true,
        includeConsistencyCheck: true,
        includeArchival: false, // Archival runs monthly
        includeIndexOptimization: true,
      });

      const duration = Date.now() - startTime;
      logger.info('Weekly maintenance completed', {
        duration,
        duplicatesRemoved: results.duplicatesRemoved,
        inconsistenciesFixed: results.inconsistenciesFixed,
        indexesOptimized: results.indexesOptimized,
        errors: results.errors.length,
      });

      // Generate weekly maintenance report
      await this.generateMaintenanceReport('weekly', results);

      // Send alert if there were significant issues
      if (results.errors.length > 0) {
        await this.sendMaintenanceAlert('weekly', results);
      }

      return results;
    } catch (error) {
      logger.error('Weekly maintenance failed', { error: error.message });
      await this.sendMaintenanceAlert('weekly', { error: error.message });
      throw error;
    }
  }

  /**
   * Run monthly archival routine (data archival and deep cleanup)
   */
  async runMonthlyArchival() {
    logger.info('Starting monthly archival routine');
    const startTime = Date.now();

    try {
      const results = await this.maintenanceService.runMaintenanceRoutine({
        includeDuplicateRemoval: true,
        includeConsistencyCheck: true,
        includeArchival: true,
        includeIndexOptimization: true,
      });

      const duration = Date.now() - startTime;
      logger.info('Monthly archival completed', {
        duration,
        duplicatesRemoved: results.duplicatesRemoved,
        inconsistenciesFixed: results.inconsistenciesFixed,
        recordsArchived: results.recordsArchived,
        indexesOptimized: results.indexesOptimized,
        errors: results.errors.length,
      });

      // Generate monthly maintenance report
      await this.generateMaintenanceReport('monthly', results);

      // Get database health metrics after archival
      const healthMetrics = await this.maintenanceService.getDatabaseHealth();
      logger.info('Database health after monthly archival', { healthMetrics });

      // Send alert if there were significant issues
      if (results.errors.length > 0) {
        await this.sendMaintenanceAlert('monthly', results);
      }

      return results;
    } catch (error) {
      logger.error('Monthly archival failed', { error: error.message });
      await this.sendMaintenanceAlert('monthly', { error: error.message });
      throw error;
    }
  }

  /**
   * Run maintenance on demand
   * @param {Object} options - Maintenance options
   * @returns {Promise<Object>} Maintenance results
   */
  async runMaintenanceOnDemand(options = {}) {
    logger.info('Starting on-demand maintenance', { options });

    try {
      const results = await this.maintenanceService.runMaintenanceRoutine(options);
      logger.info('On-demand maintenance completed', { results });
      return results;
    } catch (error) {
      logger.error('On-demand maintenance failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate maintenance report
   * @param {string} type - Report type (daily, weekly, monthly)
   * @param {Object} results - Maintenance results
   */
  async generateMaintenanceReport(type, results) {
    try {
      const report = {
        type,
        timestamp: new Date(),
        duration: results.duration,
        summary: {
          duplicatesRemoved: results.duplicatesRemoved,
          inconsistenciesFixed: results.inconsistenciesFixed,
          recordsArchived: results.recordsArchived || 0,
          indexesOptimized: results.indexesOptimized || 0,
        },
        errors: results.errors,
        healthMetrics: await this.maintenanceService.getDatabaseHealth(),
        maintenanceStats: this.maintenanceService.getMaintenanceStats(),
      };

      logger.info(`${type} maintenance report generated`, { report });

      // Here you could save the report to database or send to monitoring system
      // await this.saveMaintenanceReport(report);

      return report;
    } catch (error) {
      logger.error('Failed to generate maintenance report', { error: error.message });
    }
  }

  /**
   * Send maintenance alert for issues
   * @param {string} type - Maintenance type
   * @param {Object} results - Maintenance results with errors
   */
  async sendMaintenanceAlert(type, results) {
    try {
      const alert = {
        type: 'maintenance_alert',
        severity: results.errors?.length > 5 ? 'high' : 'medium',
        timestamp: new Date(),
        maintenanceType: type,
        errors: results.errors || [results.error],
        message: `${type} maintenance encountered ${results.errors?.length || 1} error(s)`,
      };

      logger.warn('Maintenance alert generated', { alert });

      // Here you could integrate with alerting systems like:
      // - Email notifications
      // - Slack/Discord webhooks
      // - PagerDuty
      // - Custom monitoring systems
      // await this.sendAlert(alert);

      return alert;
    } catch (error) {
      logger.error('Failed to send maintenance alert', { error: error.message });
    }
  }

  /**
   * Get scheduler status
   * @returns {Object} Scheduler status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      scheduledTasks: Array.from(this.scheduledTasks.keys()),
      maintenanceStats: this.maintenanceService.getMaintenanceStats(),
      nextRuns: this.getNextRunTimes(),
    };
  }

  /**
   * Get next run times for scheduled tasks
   * @returns {Object} Next run times for each task
   */
  getNextRunTimes() {
    const nextRuns = {};

    for (const [taskName, task] of this.scheduledTasks) {
      try {
        // Note: node-cron doesn't provide direct access to next run time
        // This is a simplified implementation
        nextRuns[taskName] = 'Scheduled (check cron expression)';
      } catch (error) {
        nextRuns[taskName] = 'Error getting next run time';
      }
    }

    return nextRuns;
  }

  /**
   * Update scheduler configuration
   * @param {Object} config - New configuration
   */
  updateConfig(config) {
    logger.info('Updating maintenance scheduler configuration', { config });

    // Stop current scheduler
    if (this.isRunning) {
      this.stop();
    }

    // Start with new configuration
    this.start(config);
  }

  /**
   * Get database health on demand
   * @returns {Promise<Object>} Database health metrics
   */
  async getDatabaseHealth() {
    return await this.maintenanceService.getDatabaseHealth();
  }

  /**
   * Reset maintenance statistics
   */
  resetStats() {
    this.maintenanceService.resetMaintenanceStats();
    logger.info('Maintenance statistics reset');
  }
}

module.exports = MaintenanceScheduler;