/**
 * Example demonstrating ConfigService and validation utilities usage
 * 
 * This example shows how to use the ConfigService and validators
 * for comprehensive MCP tool parameter validation.
 */

const ConfigService = require('../services/ConfigService.js');
const {
  validateCreateBookParams,
  validateApproveChapterParams,
  sanitizeAndValidate,
  formatValidationErrors,
  createValidationResult,
  validateMultiple
} = require('../utils/validators.js');

// Initialize ConfigService
const configService = new ConfigService();

console.log('=== Book Creation MCP Server - Validation Examples ===\n');

// Example 1: Basic book creation parameter validation
console.log('1. Basic Book Creation Parameter Validation:');
const bookParams = {
  theme: '  Artificial Intelligence and the Future  ',
  title: 'AI Revolution<script>alert("xss")</script>',
  genre: 'technical',
  chapterCount: 12,
  writingStyle: 'academic',
  targetAudience: 'software developers and researchers'
};

const bookValidation = sanitizeAndValidate(bookParams, validateCreateBookParams);
console.log('Input:', JSON.stringify(bookParams, null, 2));
console.log('Sanitized:', JSON.stringify(bookValidation.params, null, 2));
console.log('Valid:', bookValidation.isValid);
console.log('Errors:', bookValidation.errors);
console.log();

// Example 2: Configuration validation with requirements
console.log('2. Configuration Validation Against Requirements:');
const userConfig = {
  content: {
    chapterCount: 15,
    averageChapterLength: 2500,
    includeIntroduction: true,
    includeConclusion: true
  },
  style: {
    writingStyle: 'academic',
    tone: 'professional',
    targetAudience: 'graduate students'
  },
  formatting: {
    font: 'Times New Roman',
    fontSize: 11,
    lineSpacing: 1.5
  }
};

const configResult = configService.prepareConfiguration(userConfig);
console.log('Configuration valid:', configResult.isValid);
console.log('Merged config sample:', {
  chapterCount: configResult.config.content.chapterCount,
  writingStyle: configResult.config.style.writingStyle,
  aiModel: configResult.config.generation.aiModel
});

// Validate against specific requirements
const requirementValidation = configService.validateAgainstRequirements(
  configResult.config, 
  ['3.1', '3.2', '3.3', '3.4', '3.5']
);
console.log('Requirements validation:', requirementValidation.isValid);
console.log('Warnings:', requirementValidation.warnings);
console.log();

// Example 3: Tool-specific configuration validation
console.log('3. Tool-Specific Configuration Validation:');
const toolParams = {
  config: userConfig,
  chapterSettings: {
    wordCountTarget: 3000
  }
};

const toolValidation = configService.validateToolConfiguration('approve_chapter', toolParams);
console.log('Tool configuration valid:', toolValidation.isValid);
console.log('Tool errors:', toolValidation.errors);

const toolDefaults = configService.getToolDefaultConfiguration('approve_chapter');
console.log('Tool defaults:', JSON.stringify(toolDefaults.chapterSettings, null, 2));
console.log();

// Example 4: Multiple parameter validation
console.log('4. Multiple Parameter Validation:');
const multiParams = {
  bookId: 'my-ai-book-2024',
  chapterId: 'chapter-01-introduction',
  feedback: 'Please make it more engaging'
};

const validationMap = {
  bookId: (value) => ({ isValid: /^[a-zA-Z0-9-_]+$/.test(value), errors: value ? [] : ['Invalid book ID'] }),
  chapterId: (value) => ({ isValid: /^[a-zA-Z0-9-_]+$/.test(value), errors: value ? [] : ['Invalid chapter ID'] }),
  feedback: (value) => ({ isValid: typeof value === 'string' && value.length > 0, errors: value ? [] : ['Feedback required'] })
};

const multiValidation = validateMultiple(validationMap, multiParams);
console.log('Multiple validation result:', multiValidation.isValid);
console.log('Individual results:', Object.keys(multiValidation.individualResults));
console.log();

// Example 5: Error formatting
console.log('5. Error Formatting Examples:');
const invalidParams = {
  theme: '',
  title: '',
  genre: 'invalid-genre',
  chapterCount: 100
};

const invalidValidation = validateCreateBookParams(invalidParams);
const formattedErrors = formatValidationErrors(invalidValidation.errors, 'Book creation');
console.log('Formatted errors:');
console.log(formattedErrors);
console.log();

// Example 6: Comprehensive validation result
console.log('6. Comprehensive Validation Result:');
const comprehensiveResult = createValidationResult(
  false,
  ['Theme is required', 'Invalid genre specified'],
  ['Consider using a more specific target audience'],
  { 
    validatedFields: ['theme', 'genre', 'targetAudience'],
    timestamp: new Date().toISOString()
  }
);

console.log('Comprehensive result:', JSON.stringify(comprehensiveResult, null, 2));
console.log();

console.log('=== Validation Examples Complete ===');