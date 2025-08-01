/**
 * Tests for ConfigService
 */

const ConfigService = require('../../services/ConfigService.js');

describe('ConfigService', () => {
  let configService;

  beforeEach(() => {
    configService = new ConfigService();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(configService.defaultConfig).toBeDefined();
      expect(configService.validationRules).toBeDefined();
    });

    it('should have all required configuration sections', () => {
      const config = configService.defaultConfig;
      expect(config.content).toBeDefined();
      expect(config.style).toBeDefined();
      expect(config.formatting).toBeDefined();
      expect(config.generation).toBeDefined();
    });
  });

  describe('getDefaultConfiguration', () => {
    it('should return valid default configuration', () => {
      const config = configService.getDefaultConfiguration();

      expect(config.content.chapterCount).toBe(10);
      expect(config.style.writingStyle).toBe('casual');
      expect(config.formatting.font).toBe('Arial');
      expect(config.generation.aiModel).toBe('gpt-4');
    });
  });

  describe('validateConfiguration', () => {
    it('should validate valid configuration', () => {
      const validConfig = configService.getDefaultConfiguration();
      const result = configService.validateConfiguration(validConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null or undefined configuration', () => {
      const result1 = configService.validateConfiguration(null);
      const result2 = configService.validateConfiguration(undefined);

      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
      expect(result1.errors[0]).toContain('Configuration must be an object');
    });

    it('should validate chapter count range', () => {
      const invalidConfig = {
        content: { chapterCount: 2 }, // Below minimum
      };

      const result = configService.validateConfiguration(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('chapterCount must be at least 3'))).toBe(
        true,
      );
    });

    it('should validate writing style enum', () => {
      const invalidConfig = {
        style: { writingStyle: 'invalid-style' },
      };

      const result = configService.validateConfiguration(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('writingStyle must be one of'))).toBe(
        true,
      );
    });

    it('should validate nested object properties', () => {
      const invalidConfig = {
        formatting: {
          margins: {
            top: 5, // Above maximum
          },
        },
      };

      const result = configService.validateConfiguration(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((error) => error.includes('formatting.margins.top must be at most 3')),
      ).toBe(true);
    });

    it('should validate required fields', () => {
      const invalidConfig = {
        style: {}, // Missing required writingStyle and targetAudience
      };

      const result = configService.validateConfiguration(invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('style.writingStyle is required'))).toBe(
        true,
      );
      expect(
        result.errors.some((error) => error.includes('style.targetAudience is required')),
      ).toBe(true);
    });
  });

  describe('mergeWithDefaults', () => {
    it('should merge user config with defaults', () => {
      const userConfig = {
        content: { chapterCount: 15 },
        style: { writingStyle: 'formal' },
      };

      const merged = configService.mergeWithDefaults(userConfig);

      expect(merged.content.chapterCount).toBe(15);
      expect(merged.style.writingStyle).toBe('formal');
      expect(merged.style.tone).toBe('friendly'); // Default value preserved
      expect(merged.formatting.font).toBe('Arial'); // Default section preserved
    });

    it('should handle empty user config', () => {
      const merged = configService.mergeWithDefaults({});
      const defaults = configService.getDefaultConfiguration();

      expect(merged).toEqual(defaults);
    });

    it('should handle nested object merging', () => {
      const userConfig = {
        formatting: {
          margins: { top: 2 },
        },
      };

      const merged = configService.mergeWithDefaults(userConfig);

      expect(merged.formatting.margins.top).toBe(2);
      expect(merged.formatting.margins.bottom).toBe(1); // Default preserved
      expect(merged.formatting.font).toBe('Arial'); // Other formatting preserved
    });
  });

  describe('prepareConfiguration', () => {
    it('should prepare valid configuration', () => {
      const userConfig = {
        content: { chapterCount: 12 },
        style: { writingStyle: 'academic', targetAudience: 'students' },
      };

      const result = configService.prepareConfiguration(userConfig);

      expect(result.isValid).toBe(true);
      expect(result.config.content.chapterCount).toBe(12);
      expect(result.config.style.writingStyle).toBe('academic');
      expect(result.config.style.tone).toBe('friendly'); // Default preserved
    });

    it('should handle invalid configuration', () => {
      const userConfig = {
        content: { chapterCount: 100 }, // Above maximum
        style: { writingStyle: 'invalid' },
      };

      const result = configService.prepareConfiguration(userConfig);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getConfigurationSchema', () => {
    it('should return valid JSON schema', () => {
      const schema = configService.getConfigurationSchema();

      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.properties.content).toBeDefined();
      expect(schema.properties.style).toBeDefined();
      expect(schema.properties.formatting).toBeDefined();
      expect(schema.properties.generation).toBeDefined();
    });

    it('should include property descriptions', () => {
      const schema = configService.getConfigurationSchema();

      expect(schema.properties.content.description).toBeDefined();
      expect(schema.properties.content.properties.chapterCount.description).toBeDefined();
    });

    it('should include validation constraints', () => {
      const schema = configService.getConfigurationSchema();

      const chapterCount = schema.properties.content.properties.chapterCount;
      expect(chapterCount.minimum).toBe(3);
      expect(chapterCount.maximum).toBe(50);

      const writingStyle = schema.properties.style.properties.writingStyle;
      expect(writingStyle.enum).toEqual(['formal', 'casual', 'academic', 'creative']);
    });
  });

  describe('deepMerge', () => {
    it('should merge simple objects', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };

      const result = configService.deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should merge nested objects', () => {
      const target = {
        a: { x: 1, y: 2 },
        b: 3,
      };
      const source = {
        a: { y: 4, z: 5 },
        c: 6,
      };

      const result = configService.deepMerge(target, source);

      expect(result).toEqual({
        a: { x: 1, y: 4, z: 5 },
        b: 3,
        c: 6,
      });
    });

    it('should handle arrays correctly', () => {
      const target = { arr: [1, 2, 3] };
      const source = { arr: [4, 5] };

      const result = configService.deepMerge(target, source);

      expect(result.arr).toEqual([4, 5]); // Arrays should be replaced, not merged
    });
  });

  describe('validateSection', () => {
    it('should validate section with all valid fields', () => {
      const sectionData = {
        chapterCount: 10,
        averageChapterLength: 2000,
      };
      const sectionRules = configService.validationRules.content;

      const errors = configService.validateSection(sectionData, sectionRules, 'content');

      expect(errors).toHaveLength(0);
    });

    it('should return errors for invalid fields', () => {
      const sectionData = {
        chapterCount: 'invalid', // Should be number
        averageChapterLength: 100, // Below minimum
      };
      const sectionRules = configService.validationRules.content;

      const errors = configService.validateSection(sectionData, sectionRules, 'content');

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.includes('must be of type number'))).toBe(true);
      expect(errors.some((error) => error.includes('must be at least'))).toBe(true);
    });
  });

  describe('validateToolConfiguration', () => {
    it('should validate create_book_project tool configuration', () => {
      const params = {
        config: configService.getDefaultConfiguration(),
      };

      const result = configService.validateToolConfiguration('create_book_project', params);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate approve_chapter tool configuration', () => {
      const params = {
        chapterSettings: {
          wordCountTarget: 2000,
        },
      };

      const result = configService.validateToolConfiguration('approve_chapter', params);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid chapter settings', () => {
      const params = {
        chapterSettings: {
          wordCountTarget: 50000, // Above maximum
        },
      };

      const result = configService.validateToolConfiguration('approve_chapter', params);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('wordCountTarget must be between'))).toBe(
        true,
      );
    });

    it('should validate export_book tool configuration', () => {
      const params = {
        exportConfig: {
          format: 'pdf',
        },
      };

      const result = configService.validateToolConfiguration('export_book', params);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('getToolDefaultConfiguration', () => {
    it('should return tool-specific configuration for create_book_project', () => {
      const config = configService.getToolDefaultConfiguration('create_book_project');

      expect(config.validation).toBeDefined();
      expect(config.validation.strictMode).toBe(true);
      expect(config.content).toBeDefined();
      expect(config.style).toBeDefined();
    });

    it('should return tool-specific configuration for approve_chapter', () => {
      const config = configService.getToolDefaultConfiguration('approve_chapter');

      expect(config.chapterSettings).toBeDefined();
      expect(config.chapterSettings.wordCountTarget).toBe(2000);
      expect(config.chapterSettings.allowRegeneration).toBe(true);
    });

    it('should return base configuration for unknown tools', () => {
      const config = configService.getToolDefaultConfiguration('unknown_tool');
      const baseConfig = configService.getDefaultConfiguration();

      expect(config).toEqual(baseConfig);
    });
  });

  describe('validateAgainstRequirements', () => {
    it('should validate configuration against requirement 3.1', () => {
      const config = {
        content: { chapterCount: 10 },
      };

      const result = configService.validateAgainstRequirements(config, ['3.1']);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation when requirement 3.1 is not met', () => {
      const config = {
        style: { writingStyle: 'casual' },
        // Missing content section
      };

      const result = configService.validateAgainstRequirements(config, ['3.1']);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((error) => error.includes('Requirement 3.1'))).toBe(true);
    });

    it('should validate configuration against requirement 3.2', () => {
      const config = {
        style: {
          writingStyle: 'casual',
          tone: 'friendly',
        },
      };

      const result = configService.validateAgainstRequirements(config, ['3.2']);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate configuration against requirement 3.3', () => {
      const config = {
        formatting: {
          font: 'Arial',
          fontSize: 12,
        },
      };

      const result = configService.validateAgainstRequirements(config, ['3.3']);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate configuration against requirement 3.4', () => {
      const config = configService.getDefaultConfiguration();

      const result = configService.validateAgainstRequirements(config, ['3.4']);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should provide warnings for requirement 3.5', () => {
      const config = {
        generation: {
          includeOutlineInContext: false,
        },
      };

      const result = configService.validateAgainstRequirements(config, ['3.5']);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((warning) => warning.includes('Requirement 3.5'))).toBe(true);
    });

    it('should validate against multiple requirements', () => {
      const config = configService.getDefaultConfiguration();

      const result = configService.validateAgainstRequirements(config, [
        '3.1',
        '3.2',
        '3.3',
        '3.4',
        '3.5',
      ]);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
