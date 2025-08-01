/**
 * Tests for Book Creation MCP Server
 */

const BookCreationMCPServer = require('../index.js');

describe('BookCreationMCPServer', () => {
  let server;

  beforeEach(() => {
    server = new BookCreationMCPServer();
  });

  afterEach(async () => {
    if (server && server.isInitialized) {
      await server.shutdown();
    }
    // Remove process listeners to avoid memory leaks in tests
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
  });

  describe('Constructor', () => {
    it('should create a server instance with correct properties', () => {
      expect(server).toBeInstanceOf(BookCreationMCPServer);
      expect(server.server).toBeDefined();
      expect(server.tools).toBeInstanceOf(Map);
      expect(server.isInitialized).toBe(false);
    });

    it('should initialize with empty tools map', () => {
      expect(server.tools.size).toBe(0);
    });
  });

  describe('Tool Registration', () => {
    it('should register a tool successfully', () => {
      const mockTool = {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: { type: 'object', properties: {} },
        execute: jest.fn(),
      };

      server.registerTool(mockTool);
      expect(server.tools.has('test_tool')).toBe(true);
      expect(server.tools.get('test_tool')).toBe(mockTool);
    });

    it('should throw error when registering invalid tool', () => {
      const invalidTool = {
        name: 'invalid_tool',
        description: 'Missing required properties',
        // Missing inputSchema and execute
      };

      expect(() => server.registerTool(invalidTool)).toThrow(
        'Tool must have name, description, inputSchema, and execute properties',
      );
    });
  });

  describe('Server Handlers', () => {
    it('should have request handlers set up', () => {
      // The handlers are set up in the constructor via setupHandlers()
      // We can verify the server has the necessary structure
      expect(server.server).toBeDefined();
      expect(typeof server.setupHandlers).toBe('function');
    });

    it('should call setupHandlers during construction', () => {
      const setupSpy = jest.spyOn(BookCreationMCPServer.prototype, 'setupHandlers');
      const testServer = new BookCreationMCPServer();
      expect(setupSpy).toHaveBeenCalled();
      setupSpy.mockRestore();
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await server.initialize();
      expect(server.isInitialized).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      // Mock console.error to avoid noise in test output
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock an initialization error by overriding the method
      server.initializeDatabase = jest
        .fn()
        .mockRejectedValue(new Error('Database connection failed'));

      await expect(server.initialize()).rejects.toThrow('Database connection failed');

      consoleSpy.mockRestore();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await server.shutdown();

      expect(consoleSpy).toHaveBeenCalledWith('Shutting down Book Creation MCP Server...');
      expect(consoleSpy).toHaveBeenCalledWith('Book Creation MCP Server shut down successfully');

      consoleSpy.mockRestore();
    });

    it('should handle shutdown errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock server.close to throw an error
      server.server.close = jest.fn().mockRejectedValue(new Error('Close failed'));

      await server.shutdown();

      expect(consoleSpy).toHaveBeenCalledWith('Error during shutdown:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });
});
