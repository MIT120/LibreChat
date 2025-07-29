const ModelPerformanceMonitor = require('./ModelPerformanceMonitor');
const { CS2Match } = require('~/models/CS2');

// Mock the logger
jest.mock('~/config/winston', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock the CS2Match model
jest.mock('~/models/CS2', () => ({
  CS2Match: {
    find: jest.fn(),
  },
}));

describe('ModelPerformanceMonitor', () => {
  let monitor;
  let mockMatches;

  beforeEach(() => {
    monitor = new ModelPerformanceMonitor({
      halfTimeAccuracy: 0.7,
      mapWinnerAccuracy: 0.75,
      seriesOutcomeAccuracy: 0.68,
      minimumSampleSize: 10,
      alertCooldown: 1000, // 1 second for testing
      monitoringInterval: 100, // 100ms for testing
    });

    // Mock match data
    mockMatches = [
      {
        status: 'completed',
        endTime: new Date(),
        predictions: {
          halfTime: { prediction: 'team1' },
          mapWinner: { prediction: 'team1' },
          seriesOutcome: { prediction: 'team1' },
        },
        actualResults: {
          halfTime: { winner: 'team1' },
          mapWinner: { winner: 'team1' },
          seriesOutcome: { winner: 'team1' },
        },
      },
      {
        status: 'completed',
        endTime: new Date(),
        predictions: {
          halfTime: { prediction: 'team1' },
          mapWinner: { prediction: 'team1' },
          seriesOutcome: { prediction: 'team1' },
        },
        actualResults: {
          halfTime: { winner: 'team2' },
          mapWinner: { winner: 'team2' },
          seriesOutcome: { winner: 'team2' },
        },
      },
    ];

    CS2Match.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockMatches),
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    monitor.stopMonitoring();
  });

  describe('constructor', () => {
    it('should initialize with default thresholds', () => {
      const defaultMonitor = new ModelPerformanceMonitor();

      expect(defaultMonitor.thresholds.halfTimeAccuracy).toBe(0.65);
      expect(defaultMonitor.thresholds.mapWinnerAccuracy).toBe(0.7);
      expect(defaultMonitor.thresholds.seriesOutcomeAccuracy).toBe(0.68);
      expect(defaultMonitor.thresholds.minimumSampleSize).toBe(50);
    });

    it('should accept custom thresholds', () => {
      expect(monitor.thresholds.halfTimeAccuracy).toBe(0.7);
      expect(monitor.thresholds.mapWinnerAccuracy).toBe(0.75);
      expect(monitor.thresholds.minimumSampleSize).toBe(10);
    });
  });

  describe('startMonitoring and stopMonitoring', () => {
    it('should start monitoring with interval', () => {
      expect(monitor.isMonitoring).toBe(false);

      monitor.startMonitoring();

      expect(monitor.isMonitoring).toBe(true);
      expect(monitor.intervalId).toBeDefined();
    });

    it('should not start monitoring if already monitoring', () => {
      monitor.startMonitoring();
      const firstIntervalId = monitor.intervalId;

      monitor.startMonitoring();

      expect(monitor.intervalId).toBe(firstIntervalId);
    });

    it('should stop monitoring', () => {
      monitor.startMonitoring();
      expect(monitor.isMonitoring).toBe(true);

      monitor.stopMonitoring();

      expect(monitor.isMonitoring).toBe(false);
      expect(monitor.intervalId).toBe(null);
    });
  });

  describe('calculateCurrentMetrics', () => {
    it('should calculate accuracy metrics correctly', async () => {
      const metrics = await monitor.calculateCurrentMetrics();

      expect(metrics.accuracy.halfTime).toBe(0.5); // 1 correct out of 2
      expect(metrics.accuracy.mapWinner).toBe(0.5);
      expect(metrics.accuracy.seriesOutcome).toBe(0.5);
      expect(metrics.sampleSizes.halfTime).toBe(2);
      expect(metrics.totalMatches).toBe(2);
    });

    it('should handle matches without predictions', async () => {
      CS2Match.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            status: 'completed',
            endTime: new Date(),
            predictions: {},
            actualResults: {},
          },
        ]),
      });

      const metrics = await monitor.calculateCurrentMetrics();

      expect(metrics.accuracy).toEqual({});
      expect(metrics.sampleSizes).toEqual({});
      expect(metrics.totalMatches).toBe(1);
    });

    it('should filter by time window', async () => {
      const spy = jest.spyOn(CS2Match, 'find');

      await monitor.calculateCurrentMetrics(14);

      const callArgs = spy.mock.calls[0][0];
      expect(callArgs.endTime.$gte).toBeInstanceOf(Date);
    });
  });

  describe('triggerAlert', () => {
    it('should trigger alert for poor performance', async () => {
      const alertPromise = new Promise((resolve) => {
        monitor.once('performanceAlert', resolve);
      });

      await monitor.triggerAlert('halfTime', 0.6, 0.7, 20);

      const alertData = await alertPromise;
      expect(alertData.type).toBe('model_performance_degradation');
      expect(alertData.predictionType).toBe('halfTime');
      expect(alertData.currentAccuracy).toBe(60);
      expect(alertData.threshold).toBe(70);
      expect(alertData.severity).toBe('medium');
    });

    it('should respect cooldown period', async () => {
      let alertCount = 0;
      monitor.on('performanceAlert', () => alertCount++);

      await monitor.triggerAlert('halfTime', 0.6, 0.7, 20);
      await monitor.triggerAlert('halfTime', 0.6, 0.7, 20);

      expect(alertCount).toBe(1);
    });

    it('should allow alerts after cooldown', async () => {
      let alertCount = 0;
      monitor.on('performanceAlert', () => alertCount++);

      await monitor.triggerAlert('halfTime', 0.6, 0.7, 20);

      // Wait for cooldown to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      await monitor.triggerAlert('halfTime', 0.6, 0.7, 20);

      expect(alertCount).toBe(2);
    });
  });

  describe('calculateSeverity', () => {
    it('should calculate severity levels correctly', () => {
      expect(monitor.calculateSeverity(0.5, 0.7)).toBe('critical'); // 0.20 difference
      expect(monitor.calculateSeverity(0.55, 0.7)).toBe('high'); // 0.15 difference
      expect(monitor.calculateSeverity(0.62, 0.7)).toBe('medium'); // 0.08 difference
      expect(monitor.calculateSeverity(0.67, 0.7)).toBe('low'); // 0.03 difference
    });
  });

  describe('generateRecommendations', () => {
    it('should generate general recommendations', () => {
      const recommendations = monitor.generateRecommendations('halfTime', 0.6, 0.7);

      expect(recommendations).toContain('Review recent prediction failures for patterns');
      expect(recommendations).toContain('Check if HLTV data structure has changed');
    });

    it('should generate specific recommendations for half-time predictions', () => {
      const recommendations = monitor.generateRecommendations('halfTime', 0.6, 0.7);

      expect(recommendations).toContain('Review half-time momentum calculation algorithm');
      expect(recommendations).toContain('Check if economy tracking is accurate');
    });

    it('should generate specific recommendations for map winner predictions', () => {
      const recommendations = monitor.generateRecommendations('mapWinner', 0.6, 0.7);

      expect(recommendations).toContain('Verify map-specific team performance data');
      expect(recommendations).toContain('Review pick/ban strategy analysis');
    });

    it('should suggest retraining for large accuracy drops', () => {
      const recommendations = monitor.generateRecommendations('halfTime', 0.5, 0.7);

      expect(recommendations).toContain('Consider retraining the model with recent data');
      expect(recommendations).toContain('Investigate potential data quality issues');
    });
  });

  describe('checkPerformance', () => {
    it('should check performance and trigger alerts', async () => {
      // Set up low accuracy data
      CS2Match.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(
          Array(15).fill({
            status: 'completed',
            endTime: new Date(),
            predictions: { halfTime: { prediction: 'team1' } },
            actualResults: { halfTime: { winner: 'team2' } },
          }),
        ),
      });

      const alertPromise = new Promise((resolve) => {
        monitor.once('performanceAlert', resolve);
      });

      await monitor.checkPerformance();

      const alertData = await alertPromise;
      expect(alertData.predictionType).toBe('halfTime');
    });

    it('should emit performance update', async () => {
      const updatePromise = new Promise((resolve) => {
        monitor.once('performanceUpdate', resolve);
      });

      await monitor.checkPerformance();

      const metrics = await updatePromise;
      expect(metrics.accuracy).toBeDefined();
      expect(metrics.sampleSizes).toBeDefined();
    });
  });

  describe('getDashboardData', () => {
    it('should generate dashboard data for multiple time windows', async () => {
      const dashboard = await monitor.getDashboardData([1, 7]);

      expect(dashboard.timeWindows['1d']).toBeDefined();
      expect(dashboard.timeWindows['7d']).toBeDefined();
      expect(dashboard.timeWindows['1d'].accuracy).toBeDefined();
      expect(dashboard.timeWindows['1d'].status).toBeDefined();
    });

    it('should handle errors in dashboard generation', async () => {
      CS2Match.find.mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      const dashboard = await monitor.getDashboardData([1]);

      expect(dashboard.timeWindows['1d'].error).toBe('Database error');
    });
  });

  describe('getOverallStatus', () => {
    it('should return healthy status when all metrics above threshold', () => {
      const metrics = {
        accuracy: { halfTime: 0.8, mapWinner: 0.85 },
        sampleSizes: { halfTime: 20, mapWinner: 25 },
      };

      const status = monitor.getOverallStatus(metrics);
      expect(status).toBe('healthy');
    });

    it('should return warning status for some metrics below threshold', () => {
      // Test with one metric below threshold
      const metrics = {
        accuracy: { halfTime: 0.6, mapWinner: 0.8, seriesOutcome: 0.75 },
        sampleSizes: { halfTime: 20, mapWinner: 25, seriesOutcome: 15 },
      };

      const status = monitor.getOverallStatus(metrics);
      // halfTime: 0.60 < 0.70 (below threshold) = 1 below
      // mapWinner: 0.80 > 0.75 (above threshold) = 0 below
      // seriesOutcome: 0.75 > 0.68 (above threshold) = 0 below
      // Ratio: 1/3 = 0.333... which is > 0.33, so it's 'degraded'
      expect(status).toBe('degraded');
    });

    it('should return insufficient_data for small sample sizes', () => {
      const metrics = {
        accuracy: { halfTime: 0.6 },
        sampleSizes: { halfTime: 5 },
      };

      const status = monitor.getOverallStatus(metrics);
      expect(status).toBe('insufficient_data');
    });
  });

  describe('triggerRetraining', () => {
    it('should trigger retraining event', async () => {
      const retrainingPromise = new Promise((resolve) => {
        monitor.once('retrainingRequired', resolve);
      });

      await monitor.triggerRetraining('performance_degradation');

      const event = await retrainingPromise;
      expect(event.type).toBe('model_retraining_required');
      expect(event.reason).toBe('performance_degradation');
      expect(event.currentMetrics).toBeDefined();
    });
  });
});
