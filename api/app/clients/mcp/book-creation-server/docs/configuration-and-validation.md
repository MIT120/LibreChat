# Configuration Service and Validation Utilities

This document describes the configuration management and validation system for the Book Creation MCP Server.

## Overview

The configuration and validation system consists of two main components:

1. **ConfigService** - Manages book creation settings, validation, and configuration schemas
2. **Validation Utilities** - Provides validation functions for all MCP tool parameters

## ConfigService

The `ConfigService` class handles all configuration-related operations for book creation.

### Key Features

- **Default Configuration Management**: Provides sensible defaults for all book creation settings
- **Configuration Validation**: Validates user-provided configurations against defined rules
- **Configuration Merging**: Merges user configurations with defaults
- **Tool-Specific Configuration**: Provides specialized configurations for different MCP tools
- **Requirements Validation**: Validates configurations against specific requirements (3.1-3.5)

### Usage Examples

```javascript
const ConfigService = require('./services/ConfigService.js');
const configService = new ConfigService();

// Get default configuration
const defaults = configService.getDefaultConfiguration();

// Validate user configuration
const userConfig = {
  content: { chapterCount: 15 },
  style: { writingStyle: 'academic' }
};

const result = configService.prepareConfiguration(userConfig);
if (result.isValid) {
  console.log('Configuration is valid:', result.config);
} else {
  console.log('Validation errors:', result.errors);
}

// Validate against specific requirements
const requirementCheck = configService.validateAgainstRequirements(
  result.config, 
  ['3.1', '3.2', '3.3', '3.4', '3.5']
);
```

### Configuration Schema

The configuration is organized into four main sections:

#### Content Configuration
- `chapterCount`: Number of chapters (3-50, default: 10)
- `averageChapterLength`: Target words per chapter (500-10000, default: 2000)
- `includeIntroduction`: Include introduction chapter (boolean, default: true)
- `includeConclusion`: Include conclusion chapter (boolean, default: true)
- `includeBibliography`: Include bibliography (boolean, default: false)

#### Style Configuration
- `writingStyle`: Overall writing style (formal|casual|academic|creative, default: casual)
- `tone`: Tone of writing (professional|friendly|authoritative|conversational, default: friendly)
- `perspective`: Narrative perspective (first-person|second-person|third-person, default: third-person)
- `targetAudience`: Target audience description (string, required)

#### Formatting Configuration
- `font`: Font family (string, default: Arial)
- `fontSize`: Font size in points (8-24, default: 12)
- `lineSpacing`: Line spacing multiplier (1|1.15|1.5|2, default: 1.5)
- `margins`: Page margins (top|bottom|left|right: 0.5-3, default: 1)

#### Generation Configuration
- `aiModel`: AI model to use (string, default: gpt-4)
- `temperature`: AI generation temperature (0-2, default: 0.7)
- `maxTokensPerChapter`: Maximum tokens per chapter (1000-8000, default: 4000)
- `includeOutlineInContext`: Include outline in context (boolean, default: true)
- `summaryLength`: Chapter summary length (brief|detailed, default: brief)

## Validation Utilities

The validation utilities provide comprehensive parameter validation for all MCP tools.

### Available Validators

#### Book Creation Parameters
```javascript
const { validateCreateBookParams } = require('./utils/validators.js');

const params = {
  theme: 'Science Fiction Adventure',
  title: 'Journey to Mars',
  genre: 'fiction', // fiction|non-fiction|technical|educational
  chapterCount: 12, // optional, 3-50
  writingStyle: 'creative', // optional, formal|casual|academic|creative
  targetAudience: 'young adults' // optional
};

const result = validateCreateBookParams(params);
```

#### Chapter Management Parameters
```javascript
const { 
  validateApproveChapterParams,
  validateRegenerateChapterParams 
} = require('./utils/validators.js');

// Approve chapter
const approveParams = {
  bookId: 'book-123',
  chapterId: 'chapter-1',
  feedback: 'Great chapter!' // optional
};

// Regenerate chapter
const regenParams = {
  bookId: 'book-123',
  chapterId: 'chapter-1',
  feedback: 'Please make it more exciting' // required
};
```

#### Book Management Parameters
```javascript
const {
  validateListBooksParams,
  validateGetBookProgressParams,
  validateExportBookParams,
  validateDeleteBookParams
} = require('./utils/validators.js');

// List books with filters
const listParams = {
  status: 'in_progress', // optional filter
  genre: 'fiction', // optional filter
  limit: 10 // optional limit (1-100)
};

// Export book
const exportParams = {
  bookId: 'book-123',
  format: 'pdf' // markdown|html|pdf|docx|txt
};

// Delete book (requires confirmation)
const deleteParams = {
  bookId: 'book-123',
  confirm: true // must be true
};
```

### Utility Functions

#### Input Sanitization
```javascript
const { sanitizeString, sanitizeAndValidate } = require('./utils/validators.js');

// Sanitize individual string
const clean = sanitizeString('  <script>alert("xss")</script>  ');
// Result: 'scriptalert("xss")/script'

// Sanitize and validate parameters
const result = sanitizeAndValidate(params, validateCreateBookParams);
```

#### Error Formatting
```javascript
const { formatValidationErrors } = require('./utils/validators.js');

const errors = ['Field is required', 'Invalid format'];
const formatted = formatValidationErrors(errors, 'Book creation');
// Result: 'Book creation failed with 2 errors:\n1. Field is required\n2. Invalid format'
```

#### Multiple Parameter Validation
```javascript
const { validateMultiple } = require('./utils/validators.js');

const validationMap = {
  bookId: validateBookId,
  chapterId: validateChapterId
};

const params = { bookId: 'book-123', chapterId: 'chapter-1' };
const result = validateMultiple(validationMap, params);
```

## Requirements Compliance

This implementation addresses the following requirements:

### Requirement 3.1 - Chapter Count Configuration
- ✅ Allows configuration of chapter count (3-50 range)
- ✅ Validates chapter count against allowed ranges
- ✅ Provides default value (10 chapters)

### Requirement 3.2 - Writing Style and Tone Selection
- ✅ Supports writing style selection (formal, casual, academic, creative)
- ✅ Supports tone selection (professional, friendly, authoritative, conversational)
- ✅ Validates style and tone against allowed values

### Requirement 3.3 - Formatting Preferences
- ✅ Supports font, font size, and line spacing configuration
- ✅ Supports margin configuration
- ✅ Validates formatting values against allowed ranges

### Requirement 3.4 - Settings Validation
- ✅ Validates all settings against allowed ranges and values
- ✅ Provides detailed error messages for invalid settings
- ✅ Supports nested object validation (e.g., margins)

### Requirement 3.5 - Settings Application
- ✅ Ensures settings are applied throughout the book generation process
- ✅ Provides configuration merging with defaults
- ✅ Supports tool-specific configuration application

## Error Handling

The system provides comprehensive error handling:

- **Validation Errors**: Detailed field-level error messages
- **Type Errors**: Clear messages for incorrect data types
- **Range Errors**: Specific messages for out-of-range values
- **Enum Errors**: Lists of valid values for enum fields
- **Required Field Errors**: Clear indication of missing required fields

## Testing

The implementation includes comprehensive test coverage:

- **Unit Tests**: 95 test cases covering all functions and edge cases
- **Integration Tests**: End-to-end validation scenarios
- **Error Handling Tests**: Validation of error conditions and messages
- **Requirements Tests**: Specific tests for each requirement (3.1-3.5)

## Usage in MCP Tools

The configuration service and validators are designed to be used throughout the MCP server:

```javascript
// In MCP tool implementations
const configService = new ConfigService();
const { sanitizeAndValidate, validateCreateBookParams } = require('./utils/validators.js');

// Tool handler example
async function handleCreateBook(params) {
  // Sanitize and validate input
  const validation = sanitizeAndValidate(params, validateCreateBookParams);
  if (!validation.isValid) {
    throw new Error(formatValidationErrors(validation.errors, 'Book creation'));
  }

  // Prepare configuration
  const configResult = configService.prepareConfiguration(params.config);
  if (!configResult.isValid) {
    throw new Error(formatValidationErrors(configResult.errors, 'Configuration'));
  }

  // Use validated parameters and configuration
  return await createBook(validation.params, configResult.config);
}
```

This system ensures that all MCP tool parameters are properly validated and all book creation settings are correctly configured and applied throughout the generation process.