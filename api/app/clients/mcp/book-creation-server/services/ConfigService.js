/**
 * Configuration Service for Book Creation MCP Server
 * 
 * Manages book creation settings, validation, and configuration schemas.
 * Handles user preferences, default values, and configuration validation.
 */

class ConfigService {
  constructor() {
    this.defaultConfig = this.getDefaultConfiguration();
    this.validationRules = this.getValidationRules();
  }

  /**
   * Get default configuration for book creation
   * @returns {Object} Default configuration object
   */
  getDefaultConfiguration() {
    return {
      content: {
        chapterCount: 10,
        averageChapterLength: 2000, // words
        includeIntroduction: true,
        includeConclusion: true,
        includeBibliography: false
      },
      style: {
        writingStyle: 'casual',
        tone: 'friendly',
        perspective: 'third-person',
        targetAudience: 'general'
      },
      formatting: {
        font: 'Arial',
        fontSize: 12,
        lineSpacing: 1.5,
        margins: {
          top: 1,
          bottom: 1,
          left: 1,
          right: 1
        }
      },
      generation: {
        aiModel: 'gpt-4',
        temperature: 0.7,
        maxTokensPerChapter: 4000,
        includeOutlineInContext: true,
        summaryLength: 'brief'
      }
    };
  }

  /**
   * Get validation rules for configuration
   * @returns {Object} Validation rules object
   */
  getValidationRules() {
    return {
      content: {
        chapterCount: { type: 'number', min: 3, max: 50, required: true },
        averageChapterLength: { type: 'number', min: 500, max: 10000, required: false },
        includeIntroduction: { type: 'boolean', required: false },
        includeConclusion: { type: 'boolean', required: false },
        includeBibliography: { type: 'boolean', required: false }
      },
      style: {
        writingStyle: { 
          type: 'string', 
          enum: ['formal', 'casual', 'academic', 'creative'], 
          required: true 
        },
        tone: { 
          type: 'string', 
          enum: ['professional', 'friendly', 'authoritative', 'conversational'], 
          required: false 
        },
        perspective: { 
          type: 'string', 
          enum: ['first-person', 'second-person', 'third-person'], 
          required: false 
        },
        targetAudience: { type: 'string', required: true }
      },
      formatting: {
        font: { type: 'string', required: false },
        fontSize: { type: 'number', min: 8, max: 24, required: false },
        lineSpacing: { type: 'number', enum: [1, 1.15, 1.5, 2], required: false },
        margins: {
          type: 'object',
          properties: {
            top: { type: 'number', min: 0.5, max: 3, required: false },
            bottom: { type: 'number', min: 0.5, max: 3, required: false },
            left: { type: 'number', min: 0.5, max: 3, required: false },
            right: { type: 'number', min: 0.5, max: 3, required: false }
          },
          required: false
        }
      },
      generation: {
        aiModel: { type: 'string', required: false },
        temperature: { type: 'number', min: 0, max: 2, required: false },
        maxTokensPerChapter: { type: 'number', min: 1000, max: 8000, required: false },
        includeOutlineInContext: { type: 'boolean', required: false },
        summaryLength: { type: 'string', enum: ['brief', 'detailed'], required: false }
      }
    };
  }

  /**
   * Validate configuration object
   * @param {Object} config - Configuration to validate
   * @returns {Object} Validation result with isValid flag and errors array
   */
  validateConfiguration(config) {
    const errors = [];
    const result = { isValid: true, errors: [] };

    if (!config || typeof config !== 'object') {
      return {
        isValid: false,
        errors: ['Configuration must be an object']
      };
    }

    // Validate each section
    for (const [section, sectionRules] of Object.entries(this.validationRules)) {
      if (config[section]) {
        const sectionErrors = this.validateSection(config[section], sectionRules, section);
        errors.push(...sectionErrors);
      }
    }

    result.isValid = errors.length === 0;
    result.errors = errors;

    return result;
  }

  /**
   * Validate a configuration section
   * @param {Object} sectionData - Section data to validate
   * @param {Object} sectionRules - Validation rules for the section
   * @param {string} sectionName - Name of the section for error messages
   * @returns {Array} Array of validation errors
   */
  validateSection(sectionData, sectionRules, sectionName) {
    const errors = [];

    for (const [field, rules] of Object.entries(sectionRules)) {
      const value = sectionData[field];
      const fieldPath = `${sectionName}.${field}`;

      // Check required fields
      if (rules.required && (value === undefined || value === null)) {
        errors.push(`${fieldPath} is required`);
        continue;
      }

      // Skip validation if field is not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (rules.type && typeof value !== rules.type) {
        errors.push(`${fieldPath} must be of type ${rules.type}`);
        continue;
      }

      // Enum validation
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${fieldPath} must be one of: ${rules.enum.join(', ')}`);
        continue;
      }

      // Number range validation
      if (rules.type === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          errors.push(`${fieldPath} must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && value > rules.max) {
          errors.push(`${fieldPath} must be at most ${rules.max}`);
        }
      }

      // Object validation (for nested objects like margins)
      if (rules.type === 'object' && rules.properties) {
        const nestedErrors = this.validateSection(value, rules.properties, fieldPath);
        errors.push(...nestedErrors);
      }
    }

    return errors;
  }

  /**
   * Merge user configuration with defaults
   * @param {Object} userConfig - User-provided configuration
   * @returns {Object} Merged configuration with defaults applied
   */
  mergeWithDefaults(userConfig = {}) {
    return this.deepMerge(this.defaultConfig, userConfig);
  }

  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(target[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Validate and prepare configuration for book creation
   * @param {Object} userConfig - User-provided configuration
   * @returns {Object} Result with config and validation info
   */
  prepareConfiguration(userConfig = {}) {
    // Merge with defaults
    const mergedConfig = this.mergeWithDefaults(userConfig);

    // Validate the merged configuration
    const validation = this.validateConfiguration(mergedConfig);

    return {
      config: mergedConfig,
      validation: validation,
      isValid: validation.isValid,
      errors: validation.errors
    };
  }

  /**
   * Validate MCP tool configuration parameters
   * @param {string} toolName - Name of the MCP tool
   * @param {Object} params - Tool parameters to validate
   * @returns {Object} Validation result
   */
  validateToolConfiguration(toolName, params) {
    const errors = [];

    // Tool-specific validation
    switch (toolName) {
      case 'create_book_project':
        // Validate that configuration is compatible with book creation
        if (params.config) {
          const configValidation = this.validateConfiguration(params.config);
          if (!configValidation.isValid) {
            errors.push(...configValidation.errors.map(error => `config.${error}`));
          }
        }
        break;

      case 'approve_chapter':
      case 'regenerate_chapter':
        // Validate that chapter-specific settings are valid
        if (params.chapterSettings) {
          if (params.chapterSettings.wordCountTarget && 
              (params.chapterSettings.wordCountTarget < 500 || params.chapterSettings.wordCountTarget > 10000)) {
            errors.push('chapterSettings.wordCountTarget must be between 500 and 10000');
          }
        }
        break;

      case 'export_book':
        // Validate export-specific configuration
        if (params.exportConfig) {
          const validFormats = ['markdown', 'html', 'pdf', 'docx', 'txt'];
          if (params.exportConfig.format && !validFormats.includes(params.exportConfig.format)) {
            errors.push(`exportConfig.format must be one of: ${validFormats.join(', ')}`);
          }
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Get default configuration for a specific MCP tool
   * @param {string} toolName - Name of the MCP tool
   * @returns {Object} Tool-specific default configuration
   */
  getToolDefaultConfiguration(toolName) {
    const baseConfig = this.getDefaultConfiguration();

    switch (toolName) {
      case 'create_book_project':
        return {
          ...baseConfig,
          validation: {
            strictMode: true,
            requireAllFields: false
          }
        };

      case 'approve_chapter':
        return {
          generation: baseConfig.generation,
          chapterSettings: {
            wordCountTarget: baseConfig.content.averageChapterLength,
            allowRegeneration: true,
            maxRegenerationAttempts: 3
          }
        };

      case 'export_book':
        return {
          formatting: baseConfig.formatting,
          exportSettings: {
            includeMetadata: true,
            includeTableOfContents: true,
            includePageNumbers: true
          }
        };

      default:
        return baseConfig;
    }
  }

  /**
   * Validate configuration against specific requirements
   * @param {Object} config - Configuration to validate
   * @param {Array} requirements - Array of requirement IDs to validate against
   * @returns {Object} Validation result with requirement-specific errors
   */
  validateAgainstRequirements(config, requirements = []) {
    const errors = [];
    const warnings = [];

    // Validate against specific requirements
    for (const requirement of requirements) {
      switch (requirement) {
        case '3.1': // Chapter count configuration
          if (!config.content || config.content.chapterCount === undefined) {
            errors.push('Requirement 3.1: Chapter count configuration is required');
          }
          break;

        case '3.2': // Writing style and tone selection
          if (!config.style || !config.style.writingStyle || !config.style.tone) {
            errors.push('Requirement 3.2: Writing style and tone selection is required');
          }
          break;

        case '3.3': // Formatting preferences
          if (!config.formatting) {
            errors.push('Requirement 3.3: Formatting preferences are required');
          }
          break;

        case '3.4': // Settings validation against allowed ranges
          const baseValidation = this.validateConfiguration(config);
          if (!baseValidation.isValid) {
            errors.push(`Requirement 3.4: Configuration validation failed - ${baseValidation.errors.join(', ')}`);
          }
          break;

        case '3.5': // Settings application throughout generation
          if (!config.generation || !config.generation.includeOutlineInContext) {
            warnings.push('Requirement 3.5: Consider enabling outline context for consistent generation');
          }
          break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings
    };
  }

  /**
   * Get configuration schema for documentation/UI generation
   * @returns {Object} Configuration schema
   */
  getConfigurationSchema() {
    return {
      type: 'object',
      properties: {
        content: {
          type: 'object',
          description: 'Content-related configuration',
          properties: {
            chapterCount: {
              type: 'number',
              minimum: 3,
              maximum: 50,
              default: 10,
              description: 'Number of chapters in the book'
            },
            averageChapterLength: {
              type: 'number',
              minimum: 500,
              maximum: 10000,
              default: 2000,
              description: 'Target word count per chapter'
            },
            includeIntroduction: {
              type: 'boolean',
              default: true,
              description: 'Include an introduction chapter'
            },
            includeConclusion: {
              type: 'boolean',
              default: true,
              description: 'Include a conclusion chapter'
            },
            includeBibliography: {
              type: 'boolean',
              default: false,
              description: 'Include a bibliography section'
            }
          }
        },
        style: {
          type: 'object',
          description: 'Writing style configuration',
          properties: {
            writingStyle: {
              type: 'string',
              enum: ['formal', 'casual', 'academic', 'creative'],
              default: 'casual',
              description: 'Overall writing style'
            },
            tone: {
              type: 'string',
              enum: ['professional', 'friendly', 'authoritative', 'conversational'],
              default: 'friendly',
              description: 'Tone of the writing'
            },
            perspective: {
              type: 'string',
              enum: ['first-person', 'second-person', 'third-person'],
              default: 'third-person',
              description: 'Narrative perspective'
            },
            targetAudience: {
              type: 'string',
              default: 'general',
              description: 'Target audience for the book'
            }
          }
        },
        formatting: {
          type: 'object',
          description: 'Formatting preferences',
          properties: {
            font: {
              type: 'string',
              default: 'Arial',
              description: 'Font family'
            },
            fontSize: {
              type: 'number',
              minimum: 8,
              maximum: 24,
              default: 12,
              description: 'Font size in points'
            },
            lineSpacing: {
              type: 'number',
              enum: [1, 1.15, 1.5, 2],
              default: 1.5,
              description: 'Line spacing multiplier'
            }
          }
        },
        generation: {
          type: 'object',
          description: 'AI generation settings',
          properties: {
            aiModel: {
              type: 'string',
              default: 'gpt-4',
              description: 'AI model to use for generation'
            },
            temperature: {
              type: 'number',
              minimum: 0,
              maximum: 2,
              default: 0.7,
              description: 'AI generation temperature'
            },
            maxTokensPerChapter: {
              type: 'number',
              minimum: 1000,
              maximum: 8000,
              default: 4000,
              description: 'Maximum tokens per chapter'
            },
            summaryLength: {
              type: 'string',
              enum: ['brief', 'detailed'],
              default: 'brief',
              description: 'Length of chapter summaries'
            }
          }
        }
      }
    };
  }
}

module.exports = ConfigService;