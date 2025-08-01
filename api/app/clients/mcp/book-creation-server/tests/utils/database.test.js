const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { DatabaseConnection, dbConnection } = require('../../utils/database');

describe('DatabaseConnection', () => {
  let mongoServer;
  let mongoUri;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    mongoUri = mongoServer.getUri();
  });

  afterAll(async () => {
    await mongoServer.stop();
  });

  afterEach(async () => {
    // Ensure clean state after each test
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      const db = new DatabaseConnection();
      expect(db.isConnected).toBe(false);
      expect(db.connection).toBeNull();
    });
  });

  describe('connect', () => {
    it('should connect to database successfully', async () => {
      const db = new DatabaseConnection();
      
      await db.connect(mongoUri);
      
      expect(db.isConnected).toBe(true);
      expect(mongoose.connection.readyState).toBe(1);
    });

    it('should not reconnect if already connected', async () => {
      const db = new DatabaseConnection();
      
      await db.connect(mongoUri);
      expect(db.isConnected).toBe(true);
      
      // Try to connect again
      await db.connect(mongoUri);
      expect(db.isConnected).toBe(true);
    });

    it('should use custom connection options', async () => {
      const db = new DatabaseConnection();
      const customOptions = {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 3000,
      };
      
      await db.connect(mongoUri, customOptions);
      
      expect(db.isConnected).toBe(true);
    });

    it('should throw error on invalid connection string', async () => {
      const db = new DatabaseConnection();
      
      await expect(db.connect('invalid-uri')).rejects.toThrow();
      expect(db.isConnected).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should disconnect from database successfully', async () => {
      const db = new DatabaseConnection();
      
      await db.connect(mongoUri);
      expect(db.isConnected).toBe(true);
      
      await db.disconnect();
      expect(db.isConnected).toBe(false);
      expect(mongoose.connection.readyState).toBe(0);
    });

    it('should handle disconnect when not connected', async () => {
      const db = new DatabaseConnection();
      
      // Should not throw error
      await expect(db.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('isHealthy', () => {
    it('should return true when connected', async () => {
      const db = new DatabaseConnection();
      
      await db.connect(mongoUri);
      expect(db.isHealthy()).toBe(true);
    });

    it('should return false when not connected', () => {
      const db = new DatabaseConnection();
      expect(db.isHealthy()).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return correct status when connected', async () => {
      const db = new DatabaseConnection();
      
      await db.connect(mongoUri);
      const status = db.getStatus();
      
      expect(status.isConnected).toBe(true);
      expect(status.readyState).toBe(1);
      expect(status.host).toBeDefined();
      expect(status.port).toBeDefined();
      expect(status.name).toBeDefined();
    });

    it('should return correct status when not connected', () => {
      const db = new DatabaseConnection();
      const status = db.getStatus();
      
      expect(status.isConnected).toBe(false);
      expect(status.readyState).toBe(0);
    });
  });

  describe('healthCheck', () => {
    it('should return true when database is healthy', async () => {
      const db = new DatabaseConnection();
      
      await db.connect(mongoUri);
      const isHealthy = await db.healthCheck();
      
      expect(isHealthy).toBe(true);
    });

    it('should return false when not connected', async () => {
      const db = new DatabaseConnection();
      const isHealthy = await db.healthCheck();
      
      expect(isHealthy).toBe(false);
    });
  });

  describe('transaction methods', () => {
    let db;

    beforeEach(async () => {
      db = new DatabaseConnection();
      await db.connect(mongoUri);
    });

    describe('startTransaction', () => {
      it('should start a transaction successfully', async () => {
        const session = await db.startTransaction();
        
        expect(session).toBeDefined();
        expect(session.inTransaction()).toBe(true);
        
        await session.endSession();
      });

      it('should throw error when not connected', async () => {
        const disconnectedDb = new DatabaseConnection();
        
        await expect(disconnectedDb.startTransaction()).rejects.toThrow('Database not connected');
      });
    });

    describe('commitTransaction', () => {
      it('should commit transaction successfully', async () => {
        const session = await db.startTransaction();
        
        await expect(db.commitTransaction(session)).resolves.toBeUndefined();
      });
    });

    describe('abortTransaction', () => {
      it('should abort transaction successfully', async () => {
        const session = await db.startTransaction();
        
        await expect(db.abortTransaction(session)).resolves.toBeUndefined();
      });
    });

    describe('withTransaction', () => {
      it('should execute function within transaction and commit', async () => {
        const mockFn = jest.fn().mockResolvedValue('success');
        
        const result = await db.withTransaction(mockFn);
        
        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledWith(expect.any(Object));
      });

      it('should abort transaction when function throws error', async () => {
        const mockFn = jest.fn().mockRejectedValue(new Error('Test error'));
        
        await expect(db.withTransaction(mockFn)).rejects.toThrow('Test error');
        expect(mockFn).toHaveBeenCalledWith(expect.any(Object));
      });
    });
  });

  describe('singleton instance', () => {
    it('should provide a singleton instance', () => {
      expect(dbConnection).toBeInstanceOf(DatabaseConnection);
      expect(dbConnection.isConnected).toBe(false);
    });
  });

  describe('connection event handling', () => {
    it('should handle connection events', async () => {
      const db = new DatabaseConnection();
      
      // Mock console methods to avoid test output pollution
      const originalError = console.error;
      const originalWarn = console.warn;
      const originalInfo = console.info;
      
      console.error = jest.fn();
      console.warn = jest.fn();
      console.info = jest.fn();
      
      try {
        await db.connect(mongoUri);
        
        // Simulate connection events
        mongoose.connection.emit('error', new Error('Test error'));
        expect(db.isConnected).toBe(false);
        
        mongoose.connection.emit('disconnected');
        expect(db.isConnected).toBe(false);
        
        mongoose.connection.emit('reconnected');
        expect(db.isConnected).toBe(true);
        
      } finally {
        // Restore console methods
        console.error = originalError;
        console.warn = originalWarn;
        console.info = originalInfo;
      }
    });
  });
});