const MaintenanceScheduler = require('./MaintenanceScheduler');
const DataMaintenanceService = require('./DataMaintenanceService');
const cron = require('node-cron');

// Mock dependencies
jest.mock('./DataMaintenanceService');
jest.mock('node-cron');
jest.mock('~/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('MaintenanceScheduler', () => {
  let scheduler;
  let mockMaintenanceService;
  let mockCronTask;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock cron task
    mockCronTask = {
      start: jest.fn(),
      stop: jest.fn(),
      destroy: jest.fn(),
    };

    cron.schedule.mockReturnValue(mockCronTask);

    // Mock maintenance service
    mockMaintenanceService = {
      runMaintenanceRoutine: jest.fn(),
      getDatabaseHealth: jest.fn(),
      getMaintenanceStats: jest.fn(),
      resetMaintenanceStats: jest.fn(),
    };

    DataMaintenanceService.mockImplementation(() => mockMaintenanceService);

    scheduler = new MaintenanceScheduler();
  });

  describe('start', () => {
    it('should start all scheduled tasks with default configuration', () => {
      scheduler.start();

      expect(cron.schedule).toHaveBeenCalledTimes(3);
      expect(mockCronTask.start).toHaveBeenCalledTimes(3);
      expect(scheduler.isRunning).toBe(true);
      expect(scheduler.scheduledTasks.size).toBe(3);
    });

    it('should start only enabled tasks', () => {
      scheduler.start({
        enableDailyMaintenance: true,
        enableWeeklyMaintenance: false,
        enableMonthlyArchival: false,
      });

      expect(cron.schedule).toHaveBeenCalledTimes(1);
      expect(mockCronTask.start).toHaveBeenCalledTimes(1);
      expect(scheduler.scheduledTasks.size).toBe(1);
    });

    it('should use custom cron expressions', () => {
      const customConfig = {
        dailyMaintenanceCron: '0 3 * * *',
        weeklyMaintenanceCron: '0 4 * * 1',
        monthlyArchivalCron: '0 5 2 * *',
      };

      scheduler.start(customConfig);

      expect(cron.schedule).toHaveBeenCalledWith(
        '0 3 * * *',
        expect.any(Function),
        expect.any(Object),
      );
      expect(cron.schedule).toHaveBeenCalledWith(
        '0 4 * * 1',
        expect.any(Function),
        expect.any(Object),
      );
      expect(cron.schedule).toHaveBeenCalledWith(
        '0 5 2 * *',
        expect.any(Function),
        expect.any(Object),
      );
    });

    it('should not start if already running', () => {
      scheduler.isRunning = true;

      scheduler.start();

      expect(cron.schedule).not.toHaveBeenCalled();
    });

    it('should handle start errors', () => {
      const error = new Error('Cron error');
      cron.schedule.mockImplementation(() => {
        throw error;
      });

      expect(() => scheduler.start()).toThrow('Cron error');
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      scheduler.start();
    });

    it('should stop all scheduled tasks', () => {
      scheduler.stop();

      expect(mockCronTask.stop).toHaveBeenCalledTimes(3);
      expect(mockCronTask.destroy).toHaveBeenCalledTimes(3);
      expect(scheduler.isRunning).toBe(false);
      expect(scheduler.scheduledTasks.size).toBe(0);
    });

    it('should not stop if not running', () => {
      scheduler.isRunning = false;
      scheduler.scheduledTasks.clear();

      scheduler.stop();

      expect(mockCronTask.stop).not.toHaveBeenCalled();
    });

    it('should handle stop errors', () => {
      mockCronTask.stop.mockImplementation(() => {
        throw new Error('Stop error');
      });

      expect(() => scheduler.stop()).toThrow('Stop error');
    });
  });

  describe('runDailyMaintenance', () => {
    it('should run daily maintenance with correct options', async () => {
      const mockResults = {
        duplicatesRemoved: 5,
        inconsistenciesFixed: 3,
        errors: [],
        duration: 1000,
      };

      mockMaintenanceService.runMaintenanceRoutine.mockResolvedValue(mockResults);

      const result = await scheduler.runDailyMaintenance();

      expect(mockMaintenanceService.runMaintenanceRoutine).toHaveBeenCalledWith({
        includeDuplicateRemoval: true,
        includeConsistencyCheck: true,
        includeArchival: false,
        includeIndexOptimization: false,
      });

      expect(result).toEqual(mockResults);
    });

    it('should send alert on errors', async () => {
      const mockResults = {
        duplicatesRemoved: 0,
        inconsistenciesFixed: 0,
        errors: ['Error 1', 'Error 2'],
        duration: 1000,
      };

      mockMaintenanceService.runMaintenanceRoutine.mockResolvedValue(mockResults);
      scheduler.sendMaintenanceAlert = jest.fn();

      await scheduler.runDailyMaintenance();

      expect(scheduler.sendMaintenanceAlert).toHaveBeenCalledWith('daily', mockResults);
    });

    it('should handle maintenance errors', async () => {
      const error = new Error('Maintenance failed');
      mockMaintenanceService.runMaintenanceRoutine.mockRejectedValue(error);
      scheduler.sendMaintenanceAlert = jest.fn();

      await expect(scheduler.runDailyMaintenance()).rejects.toThrow('Maintenance failed');
      expect(scheduler.sendMaintenanceAlert).toHaveBeenCalledWith('daily', {
        error: 'Maintenance failed',
      });
    });
  });

  describe('runWeeklyMaintenance', () => {
    it('should run weekly maintenance with correct options', async () => {
      const mockResults = {
        duplicatesRemoved: 10,
        inconsistenciesFixed: 5,
        indexesOptimized: 3,
        errors: [],
        duration: 5000,
      };

      mockMaintenanceService.runMaintenanceRoutine.mockResolvedValue(mockResults);
      scheduler.generateMaintenanceReport = jest.fn();

      const result = await scheduler.runWeeklyMaintenance();

      expect(mockMaintenanceService.runMaintenanceRoutine).toHaveBeenCalledWith({
        includeDuplicateRemoval: true,
        includeConsistencyCheck: true,
        includeArchival: false,
        includeIndexOptimization: true,
      });

      expect(scheduler.generateMaintenanceReport).toHaveBeenCalledWith('weekly', mockResults);
      expect(result).toEqual(mockResults);
    });
  });

  describe('runMonthlyArchival', () => {
    it('should run monthly archival with all options enabled', async () => {
      const mockResults = {
        duplicatesRemoved: 15,
        inconsistenciesFixed: 8,
        recordsArchived: 100,
        indexesOptimized: 3,
        errors: [],
        duration: 10000,
      };

      const mockHealthMetrics = { database: { collections: 3 } };

      mockMaintenanceService.runMaintenanceRoutine.mockResolvedValue(mockResults);
      mockMaintenanceService.getDatabaseHealth.mockResolvedValue(mockHealthMetrics);
      scheduler.generateMaintenanceReport = jest.fn();

      const result = await scheduler.runMonthlyArchival();

      expect(mockMaintenanceService.runMaintenanceRoutine).toHaveBeenCalledWith({
        includeDuplicateRemoval: true,
        includeConsistencyCheck: true,
        includeArchival: true,
        includeIndexOptimization: true,
      });

      expect(scheduler.generateMaintenanceReport).toHaveBeenCalledWith('monthly', mockResults);
      expect(mockMaintenanceService.getDatabaseHealth).toHaveBeenCalled();
      expect(result).toEqual(mockResults);
    });
  });

  describe('runMaintenanceOnDemand', () => {
    it('should run maintenance with custom options', async () => {
      const customOptions = {
        includeDuplicateRemoval: false,
        includeConsistencyCheck: true,
        dryRun: true,
      };

      const mockResults = { fixed: 0, errors: [] };
      mockMaintenanceService.runMaintenanceRoutine.mockResolvedValue(mockResults);

      const result = await scheduler.runMaintenanceOnDemand(customOptions);

      expect(mockMaintenanceService.runMaintenanceRoutine).toHaveBeenCalledWith(customOptions);
      expect(result).toEqual(mockResults);
    });

    it('should handle on-demand maintenance errors', async () => {
      const error = new Error('On-demand failed');
      mockMaintenanceService.runMaintenanceRoutine.mockRejectedValue(error);

      await expect(scheduler.runMaintenanceOnDemand()).rejects.toThrow('On-demand failed');
    });
  });

  describe('generateMaintenanceReport', () => {
    it('should generate comprehensive maintenance report', async () => {
      const mockResults = {
        duration: 5000,
        duplicatesRemoved: 10,
        inconsistenciesFixed: 5,
        recordsArchived: 20,
        indexesOptimized: 3,
        errors: [],
      };

      const mockHealthMetrics = { database: { collections: 3 } };
      const mockMaintenanceStats = { lastMaintenanceRun: new Date() };

      mockMaintenanceService.getDatabaseHealth.mockResolvedValue(mockHealthMetrics);
      mockMaintenanceService.getMaintenanceStats.mockReturnValue(mockMaintenanceStats);

      const report = await scheduler.generateMaintenanceReport('weekly', mockResults);

      expect(report).toEqual({
        type: 'weekly',
        timestamp: expect.any(Date),
        duration: 5000,
        summary: {
          duplicatesRemoved: 10,
          inconsistenciesFixed: 5,
          recordsArchived: 20,
          indexesOptimized: 3,
        },
        errors: [],
        healthMetrics: mockHealthMetrics,
        maintenanceStats: mockMaintenanceStats,
      });
    });

    it('should handle report generation errors', async () => {
      const error = new Error('Health check failed');
      mockMaintenanceService.getDatabaseHealth.mockRejectedValue(error);

      const result = await scheduler.generateMaintenanceReport('daily', {});

      expect(result).toBeUndefined();
    });
  });

  describe('sendMaintenanceAlert', () => {
    it('should generate alert for maintenance errors', async () => {
      const results = {
        errors: ['Error 1', 'Error 2', 'Error 3'],
      };

      const alert = await scheduler.sendMaintenanceAlert('daily', results);

      expect(alert).toEqual({
        type: 'maintenance_alert',
        severity: 'medium',
        timestamp: expect.any(Date),
        maintenanceType: 'daily',
        errors: ['Error 1', 'Error 2', 'Error 3'],
        message: 'daily maintenance encountered 3 error(s)',
      });
    });

    it('should set high severity for many errors', async () => {
      const results = {
        errors: new Array(10).fill('Error'),
      };

      const alert = await scheduler.sendMaintenanceAlert('weekly', results);

      expect(alert.severity).toBe('high');
    });

    it('should handle single error format', async () => {
      const results = {
        error: 'Single error message',
      };

      const alert = await scheduler.sendMaintenanceAlert('monthly', results);

      expect(alert.errors).toEqual(['Single error message']);
      expect(alert.message).toBe('monthly maintenance encountered 1 error(s)');
    });
  });

  describe('getStatus', () => {
    it('should return scheduler status', () => {
      scheduler.start();
      mockMaintenanceService.getMaintenanceStats.mockReturnValue({
        duplicatesRemoved: 10,
        lastMaintenanceRun: new Date(),
      });

      const status = scheduler.getStatus();

      expect(status).toEqual({
        isRunning: true,
        scheduledTasks: ['daily', 'weekly', 'monthly'],
        maintenanceStats: {
          duplicatesRemoved: 10,
          lastMaintenanceRun: expect.any(Date),
        },
        nextRuns: {
          daily: 'Scheduled (check cron expression)',
          weekly: 'Scheduled (check cron expression)',
          monthly: 'Scheduled (check cron expression)',
        },
      });
    });
  });

  describe('updateConfig', () => {
    it('should stop and restart with new configuration', () => {
      scheduler.start();
      scheduler.stop = jest.fn();
      scheduler.start = jest.fn();

      const newConfig = { enableDailyMaintenance: false };
      scheduler.updateConfig(newConfig);

      expect(scheduler.stop).toHaveBeenCalled();
      expect(scheduler.start).toHaveBeenCalledWith(newConfig);
    });

    it('should not stop if not running', () => {
      scheduler.isRunning = false;
      scheduler.stop = jest.fn();
      scheduler.start = jest.fn();

      scheduler.updateConfig({});

      expect(scheduler.stop).not.toHaveBeenCalled();
      expect(scheduler.start).toHaveBeenCalled();
    });
  });

  describe('getDatabaseHealth', () => {
    it('should return database health metrics', async () => {
      const mockHealth = { database: { collections: 3 } };
      mockMaintenanceService.getDatabaseHealth.mockResolvedValue(mockHealth);

      const health = await scheduler.getDatabaseHealth();

      expect(health).toEqual(mockHealth);
      expect(mockMaintenanceService.getDatabaseHealth).toHaveBeenCalled();
    });
  });

  describe('resetStats', () => {
    it('should reset maintenance statistics', () => {
      scheduler.resetStats();

      expect(mockMaintenanceService.resetMaintenanceStats).toHaveBeenCalled();
    });
  });
});