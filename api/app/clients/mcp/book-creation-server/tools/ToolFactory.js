/**
 * Factory for creating MCP tools with consistent patterns
 */

const { handleServiceOperation, formatMCPError } = require('../utils/errorHandler');

/**
 * Base tool class with common functionality
 */
class BaseTool {
  constructor(name, description, inputSchema) {
    this.name = name;
    this.description = description;
    this.inputSchema = inputSchema;
  }

  /**
   * Validate user authentication
   * @param {Object} context - Execution context
   * @returns {string|null} User ID or null if invalid
   */
  validateAuth(context) {
    const userId = context?.user?.id || context?.userId;
    if (!userId) {
      return null;
    }
    return userId;
  }

  /**
   * Create standardized error response
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {Object} details - Additional details
   * @returns {Object} Error response
   */
  createErrorResponse(code, message, details = {}) {
    return {
      success: false,
      error: {
        code,
        message,
        details,
      },
    };
  }

  /**
   * Create standardized success response
   * @param {Object} data - Response data
   * @param {string} message - Success message
   * @returns {Object} Success response
   */
  createSuccessResponse(data, message) {
    return {
      success: true,
      data,
      message,
    };
  }

  /**
   * Execute tool with standardized error handling
   * @param {Object} params - Tool parameters
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Tool execution result
   */
  async execute(params, context) {
    throw new Error('execute method must be implemented by subclass');
  }
}

/**
 * Factory for creating tools with validation and error handling
 */
class ToolFactory {
  /**
   * Create a tool with standardized patterns
   * @param {Object} config - Tool configuration
   * @param {string} config.name - Tool name
   * @param {string} config.description - Tool description
   * @param {Object} config.inputSchema - Input schema
   * @param {Function} config.validator - Parameter validator
   * @param {Function} config.handler - Main execution handler
   * @returns {Object} MCP tool object
   */
  static createTool({ name, description, inputSchema, validator, handler }) {
    return {
      name,
      description,
      inputSchema,

      async execute(params, context) {
        try {
          // Validate authentication
          const userId = context?.user?.id || context?.userId;
          if (!userId) {
            return {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: `User authentication required for ${name}`,
              },
            };
          }

          // Validate and sanitize parameters
          if (validator) {
            const validationResult = validator(params);
            if (!validationResult.isValid) {
              return {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: `Invalid parameters for ${name}`,
                  details: {
                    errors: validationResult.errors,
                    receivedParams: Object.keys(params),
                  },
                },
              };
            }
            params = validationResult.params;
          }

          // Execute main handler with error handling
          return await handleServiceOperation(
            () => handler(params, userId, context),
            `${name}Tool`,
            console // Use console for now, could be injected
          );

        } catch (error) {
          return {
            success: false,
            error: formatMCPError(error),
          };
        }
      },
    };
  }

  /**
   * Create a CRUD tool with standard operations
   * @param {Object} config - CRUD tool configuration
   * @returns {Object} CRUD tool object
   */
  static createCRUDTool(config) {
    const { name, description, model, operations = ['create', 'read', 'update', 'delete'] } = config;

    const tools = {};

    if (operations.includes('create')) {
      tools[`create${name}`] = this.createTool({
        name: `create_${name.toLowerCase()}`,
        description: `Create a new ${name.toLowerCase()}`,
        inputSchema: config.createSchema,
        validator: config.createValidator,
        handler: async (params, userId) => {
          const result = await model.create({ ...params, user: userId });
          return {
            success: true,
            data: result,
            message: `${name} created successfully`,
          };
        },
      });
    }

    if (operations.includes('read')) {
      tools[`get${name}`] = this.createTool({
        name: `get_${name.toLowerCase()}`,
        description: `Get ${name.toLowerCase()} by ID`,
        inputSchema: config.readSchema,
        validator: config.readValidator,
        handler: async (params, userId) => {
          const result = await model.findByIdAndUser(params.id, userId);
          if (!result) {
            throw new Error(`${name} not found`);
          }
          return {
            success: true,
            data: result,
            message: `${name} retrieved successfully`,
          };
        },
      });
    }

    // Add update and delete operations similarly...

    return tools;
  }
}

module.exports = {
  BaseTool,
  ToolFactory,
};