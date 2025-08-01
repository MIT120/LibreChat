/**
 * Integration tests for configuration and validation
 */

const ConfigService = require('../../services/ConfigService.js');
const { validateCreateBookParams, sanitizeAndValidate } = require('../../utils/validators.js');

describe('Configuration and Validation Integration', () => {
  let configService;

  beforeEach(() => {
    configService = new ConfigService();
  });

  describe('Book Creation Workflow', () => {
    it('should validate and prepare configuration for book creation', () => {
      // Simulate user input for book creation
      const userBookParams = {
        theme: '  Artificial Intelligence in Healthcare  ',
        title: 'AI Revolution<script>alert("xss")</script>in Medicine',
        genre: 'technical',
        chapterCount: 15,
        writingStyle: 'academic',
        targetAudience: 'medical professionals'
      };

      // Sanitize and validate book parameters
      const bookValidation = sanitizeAndValidate(userBookParams, validateCreateBookParams);
      expect(bookValidation.isValid).toBe(true);
      expect(bookValidation.params.theme).toBe('Artificial Intelligence in Healthcare');
      expect(bookValidation.params.title).toBe('AI Revolutionscriptalert("xss")/scriptin Medicine');

      // Prepare configuration with user preferences
      const userConfig = {
        content: {
          chapterCount: bookValidation.params.chapterCount,
          includeIntroduction: true,
          includeConclusion: true,
          includeBibliography: true // Technical book should have bibliography
        },
        style: {
          writingStyle: bookValidation.params.writingStyle,
          tone: 'professional',
          targetAudience: bookValidation.params.targetAudience
        },
        generation: {
          temperature: 0.3, // Lower temperature for technical content
          summaryLength: 'detailed'
        }
      };

      const configResult = configService.prepareConfiguration(userConfig);
      
      expect(configResult.isValid).toBe(true);
      expect(configResult.config.content.chapterCount).toBe(15);
      expect(configResult.config.style.writingStyle).toBe('academic');
      expect(configResult.config.style.tone).toBe('professional');
      expect(configResult.config.generation.temperature).toBe(0.3);
      
      // Verify defaults are preserved
      expect(configResult.config.formatting.font).toBe('Arial');
      expect(configResult.config.generation.aiModel).toBe('gpt-4');
    });

    it('should handle invalid book parameters and configuration', () => {
      // Invalid book parameters
      const invalidBookParams = {
        theme: '', // Empty theme
        title: 'Test Book',
        genre: 'invalid-genre',
        chapterCount: 100, // Too many chapters
        writingStyle: 'invalid-style'
      };

      const bookValidation = sanitizeAndValidate(invalidBookParams, validateCreateBookParams);
      expect(bookValidation.isValid).toBe(false);
      expect(bookValidation.errors.length).toBeGreaterThan(0);

      // Invalid configuration
      const invalidConfig = {
        content: {
          chapterCount: 2 // Below minimum
        },
        style: {
          writingStyle: 'nonexistent-style',
          tone: 'invalid-tone'
        },
        formatting: {
          fontSize: 50 // Too large
        }
      };

      const configResult = configService.prepareConfiguration(invalidConfig);
      expect(configResult.isValid).toBe(false);
      expect(configResult.errors.length).toBeGreaterThan(0);
    });

    it('should provide comprehensive error messages', () => {
      const invalidParams = {
        theme: 'Test',
        title: 'Test',
        genre: 'fiction',
        chapterCount: 'not-a-number'
      };

      const bookValidation = sanitizeAndValidate(invalidParams, validateCreateBookParams);
      expect(bookValidation.isValid).toBe(false);
      expect(bookValidation.errors.some(error => 
        error.includes('chapterCount must be a number')
      )).toBe(true);

      const invalidConfig = {
        style: {
          writingStyle: 'invalid'
        },
        formatting: {
          margins: {
            top: 10 // Too large
          }
        }
      };

      const configResult = configService.prepareConfiguration(invalidConfig);
      expect(configResult.isValid).toBe(false);
      
      const hasStyleError = configResult.errors.some(error => 
        error.includes('writingStyle must be one of')
      );
      const hasMarginError = configResult.errors.some(error => 
        error.includes('formatting.margins.top must be at most 3')
      );
      
      expect(hasStyleError).toBe(true);
      expect(hasMarginError).toBe(true);
    });
  });

  describe('Configuration Schema Usage', () => {
    it('should provide schema for UI generation', () => {
      const schema = configService.getConfigurationSchema();
      
      // Verify schema structure for potential UI generation
      expect(schema.properties.content.properties.chapterCount.minimum).toBe(3);
      expect(schema.properties.content.properties.chapterCount.maximum).toBe(50);
      expect(schema.properties.content.properties.chapterCount.description).toBeDefined();
      
      expect(schema.properties.style.properties.writingStyle.enum).toEqual([
        'formal', 'casual', 'academic', 'creative'
      ]);
      
      expect(schema.properties.generation.properties.temperature.minimum).toBe(0);
      expect(schema.properties.generation.properties.temperature.maximum).toBe(2);
    });
  });

  describe('Real-world Configuration Scenarios', () => {
    it('should handle fiction book configuration', () => {
      const fictionConfig = {
        content: {
          chapterCount: 20,
          includeIntroduction: false, // Fiction often starts directly
          includeConclusion: false,
          includeBibliography: false
        },
        style: {
          writingStyle: 'creative',
          tone: 'conversational',
          perspective: 'first-person',
          targetAudience: 'general readers'
        },
        generation: {
          temperature: 0.8, // Higher creativity for fiction
          summaryLength: 'brief'
        }
      };

      const result = configService.prepareConfiguration(fictionConfig);
      expect(result.isValid).toBe(true);
      expect(result.config.style.writingStyle).toBe('creative');
      expect(result.config.generation.temperature).toBe(0.8);
    });

    it('should handle academic book configuration', () => {
      const academicConfig = {
        content: {
          chapterCount: 12,
          includeIntroduction: true,
          includeConclusion: true,
          includeBibliography: true
        },
        style: {
          writingStyle: 'academic',
          tone: 'authoritative',
          perspective: 'third-person',
          targetAudience: 'researchers and students'
        },
        generation: {
          temperature: 0.2, // Lower creativity for academic content
          summaryLength: 'detailed'
        }
      };

      const result = configService.prepareConfiguration(academicConfig);
      expect(result.isValid).toBe(true);
      expect(result.config.style.writingStyle).toBe('academic');
      expect(result.config.generation.temperature).toBe(0.2);
    });
  });
});