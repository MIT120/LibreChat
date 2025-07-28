/**
 * Data Validator for HLTV Scraped Data
 * 
 * Provides schema validation for scraped data before database storage
 * with comprehensive validation rules and error reporting.
 */

const { HLTVParsingError } = require('../errors');

class DataValidator {
  constructor() {
    this.schemas = {
      match: this.getMatchSchema(),
      team: this.getTeamSchema(),
      player: this.getPlayerSchema()
    };
  }

  /**
   * Validate match data
   * @param {Object} data - Match data to validate
   * @returns {Object} Validation result
   */
  validateMatch(data) {
    return this.validate(data, this.schemas.match, 'match');
  }

  /**
   * Validate team data
   * @param {Object} data - Team data to validate
   * @returns {Object} Validation result
   */
  validateTeam(data) {
    return this.validate(data, this.schemas.team, 'team');
  }

  /**
   * Validate player data
   * @param {Object} data - Player data to validate
   * @returns {Object} Validation result
   */
  validatePlayer(data) {
    return this.validate(data, this.schemas.player, 'player');
  }

  /**
   * Generic validation method
   * @param {Object} data - Data to validate
   * @param {Object} schema - Validation schema
   * @param {string} type - Data type for error reporting
   * @returns {Object} Validation result
   */
  validate(data, schema, type) {
    const errors = [];
    const warnings = [];

    try {
      this.validateObject(data, schema, '', errors, warnings);
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        data: this.sanitizeData(data, schema)
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed for ${type}: ${error.message}`],
        warnings,
        data: null
      };
    }
  }

  /**
   * Validate object against schema
   * @param {any} data - Data to validate
   * @param {Object} schema - Schema definition
   * @param {string} path - Current validation path
   * @param {Array} errors - Error accumulator
   * @param {Array} warnings - Warning accumulator
   */
  validateObject(data, schema, path, errors, warnings) {
    if (schema.type === 'object') {
      if (data === null || data === undefined) {
        if (schema.required) {
          errors.push(`${path || 'root'} is required but is ${data}`);
        }
        return;
      }

      if (typeof data !== 'object' || Array.isArray(data)) {
        errors.push(`${path || 'root'} must be an object, got ${typeof data}`);
        return;
      }

      // Validate required properties
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          const propPath = path ? `${path}.${key}` : key;
          const propValue = data[key];

          if (propSchema.required && (propValue === undefined || propValue === null)) {
            errors.push(`${propPath} is required`);
          } else if (propValue !== undefined && propValue !== null) {
            this.validateObject(propValue, propSchema, propPath, errors, warnings);
          }
        }
      }

      // Check for unexpected properties
      if (schema.additionalProperties === false && schema.properties) {
        const allowedKeys = Object.keys(schema.properties);
        const dataKeys = Object.keys(data);
        const unexpectedKeys = dataKeys.filter(key => !allowedKeys.includes(key));
        
        if (unexpectedKeys.length > 0) {
          warnings.push(`Unexpected properties found: ${unexpectedKeys.join(', ')}`);
        }
      }
    } else if (schema.type === 'array') {
      if (!Array.isArray(data)) {
        errors.push(`${path} must be an array, got ${typeof data}`);
        return;
      }

      if (schema.minItems && data.length < schema.minItems) {
        errors.push(`${path} must have at least ${schema.minItems} items, got ${data.length}`);
      }

      if (schema.maxItems && data.length > schema.maxItems) {
        warnings.push(`${path} has ${data.length} items, maximum recommended is ${schema.maxItems}`);
      }

      // Validate array items
      if (schema.items) {
        data.forEach((item, index) => {
          this.validateObject(item, schema.items, `${path}[${index}]`, errors, warnings);
        });
      }
    } else {
      // Primitive type validation
      this.validatePrimitive(data, schema, path, errors, warnings);
    }
  }

  /**
   * Validate primitive values
   * @param {any} data - Data to validate
   * @param {Object} schema - Schema definition
   * @param {string} path - Current validation path
   * @param {Array} errors - Error accumulator
   * @param {Array} warnings - Warning accumulator
   */
  validatePrimitive(data, schema, path, errors, warnings) {
    // Type validation
    if (schema.type && typeof data !== schema.type) {
      errors.push(`${path} must be of type ${schema.type}, got ${typeof data}`);
      return;
    }

    // String validations
    if (schema.type === 'string') {
      if (schema.minLength && data.length < schema.minLength) {
        errors.push(`${path} must be at least ${schema.minLength} characters long`);
      }
      
      if (schema.maxLength && data.length > schema.maxLength) {
        warnings.push(`${path} is ${data.length} characters, recommended maximum is ${schema.maxLength}`);
      }
      
      if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
        errors.push(`${path} does not match required pattern`);
      }
      
      if (schema.enum && !schema.enum.includes(data)) {
        errors.push(`${path} must be one of: ${schema.enum.join(', ')}`);
      }
    }

    // Number validations
    if (schema.type === 'number') {
      if (schema.minimum !== undefined && data < schema.minimum) {
        errors.push(`${path} must be at least ${schema.minimum}`);
      }
      
      if (schema.maximum !== undefined && data > schema.maximum) {
        warnings.push(`${path} is ${data}, recommended maximum is ${schema.maximum}`);
      }
      
      if (schema.integer && !Number.isInteger(data)) {
        errors.push(`${path} must be an integer`);
      }
    }
  }

  /**
   * Sanitize data according to schema
   * @param {Object} data - Data to sanitize
   * @param {Object} schema - Schema definition
   * @returns {Object} Sanitized data
   */
  sanitizeData(data, schema) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = {};

    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (data[key] !== undefined) {
          if (propSchema.type === 'string' && typeof data[key] === 'string') {
            // Trim strings and handle empty strings
            sanitized[key] = data[key].trim();
            if (sanitized[key] === '' && propSchema.default !== undefined) {
              sanitized[key] = propSchema.default;
            }
          } else if (propSchema.type === 'object') {
            sanitized[key] = this.sanitizeData(data[key], propSchema);
          } else if (propSchema.type === 'array' && Array.isArray(data[key])) {
            sanitized[key] = data[key].map(item => 
              propSchema.items ? this.sanitizeData(item, propSchema.items) : item
            );
          } else {
            sanitized[key] = data[key];
          }
        } else if (propSchema.default !== undefined) {
          sanitized[key] = propSchema.default;
        }
      }
    }

    return sanitized;
  }

  /**
   * Get match validation schema
   * @returns {Object} Match schema
   */
  getMatchSchema() {
    return {
      type: 'object',
      required: true,
      properties: {
        hltvId: {
          type: 'string',
          required: true,
          pattern: '^\\d+$',
          minLength: 1
        },
        teams: {
          type: 'array',
          required: true,
          minItems: 2,
          maxItems: 2,
          items: {
            type: 'string',
            minLength: 1,
            maxLength: 50
          }
        },
        date: {
          type: 'object',
          required: false
        },
        tournament: {
          type: 'string',
          required: false,
          maxLength: 100,
          default: ''
        },
        status: {
          type: 'string',
          required: true,
          enum: ['upcoming', 'live', 'finished']
        },
        scores: {
          type: 'array',
          required: false,
          items: {
            type: 'string'
          }
        },
        maps: {
          type: 'array',
          required: false,
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                required: true,
                minLength: 1
              },
              scores: {
                type: 'array',
                items: {
                  type: 'number',
                  minimum: 0,
                  maximum: 30
                }
              }
            }
          }
        }
      },
      additionalProperties: false
    };
  }

  /**
   * Get team validation schema
   * @returns {Object} Team schema
   */
  getTeamSchema() {
    return {
      type: 'object',
      required: true,
      properties: {
        hltvId: {
          type: 'string',
          required: false,
          pattern: '^\\d+$'
        },
        name: {
          type: 'string',
          required: true,
          minLength: 1,
          maxLength: 50
        },
        ranking: {
          type: 'number',
          required: false,
          minimum: 1,
          maximum: 100,
          integer: true
        },
        players: {
          type: 'array',
          required: false,
          maxItems: 10,
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                required: true,
                minLength: 1,
                maxLength: 30
              },
              country: {
                type: 'string',
                required: false,
                maxLength: 50
              },
              role: {
                type: 'string',
                required: false,
                enum: ['IGL', 'AWPer', 'Entry', 'Support', 'Lurker', 'Rifler']
              }
            }
          }
        },
        logo: {
          type: 'string',
          required: false,
          maxLength: 500
        },
        recentMatches: {
          type: 'array',
          required: false,
          maxItems: 20,
          items: {
            type: 'object',
            properties: {
              opponent: {
                type: 'string',
                required: true
              },
              result: {
                type: 'string',
                required: false
              },
              date: {
                type: 'string',
                required: false
              }
            }
          }
        }
      },
      additionalProperties: true
    };
  }

  /**
   * Get player validation schema
   * @returns {Object} Player schema
   */
  getPlayerSchema() {
    return {
      type: 'object',
      required: true,
      properties: {
        hltvId: {
          type: 'string',
          required: false,
          pattern: '^\\d+$'
        },
        name: {
          type: 'string',
          required: true,
          minLength: 1,
          maxLength: 30
        },
        realName: {
          type: 'string',
          required: false,
          maxLength: 100
        },
        age: {
          type: 'number',
          required: false,
          minimum: 16,
          maximum: 50,
          integer: true
        },
        country: {
          type: 'string',
          required: false,
          maxLength: 50
        },
        team: {
          type: 'string',
          required: false,
          maxLength: 50
        },
        image: {
          type: 'string',
          required: false,
          maxLength: 500
        },
        stats: {
          type: 'object',
          required: false,
          additionalProperties: true
        },
        achievements: {
          type: 'array',
          required: false,
          maxItems: 50,
          items: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                required: true
              },
              date: {
                type: 'string',
                required: false
              },
              tournament: {
                type: 'string',
                required: false
              }
            }
          }
        }
      },
      additionalProperties: true
    };
  }

  /**
   * Validate and throw error if invalid
   * @param {Object} data - Data to validate
   * @param {string} type - Data type
   * @throws {HLTVParsingError} If validation fails
   */
  validateAndThrow(data, type) {
    const result = this.validate(data, this.schemas[type], type);
    
    if (!result.isValid) {
      throw new HLTVParsingError(
        `Invalid ${type} data: ${result.errors.join(', ')}`,
        'validation',
        { errors: result.errors, warnings: result.warnings }
      );
    }

    return result.data;
  }
}

module.exports = DataValidator;