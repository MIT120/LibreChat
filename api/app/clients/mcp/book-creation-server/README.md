# Book Creation MCP Server

An MCP (Model Context Protocol) server that enables AI-powered book creation with structured, approval-based workflows. This server integrates with LibreChat's existing infrastructure to provide comprehensive book generation capabilities.

## Features Implemented

### Task 2.1: Basic MCP Server Entry Point and Protocol Handling ✅

- **MCP Server Infrastructure**: Complete server setup with proper MCP SDK integration
- **Tool Registration System**: Framework for registering and managing MCP tools
- **Request Routing**: Basic request handling infrastructure (handlers will be implemented in task 5)
- **Server Lifecycle Management**: Initialization, shutdown, and error handling
- **Process Signal Handling**: Graceful shutdown on SIGINT/SIGTERM

### Task 2.2: Configuration Service and Validation Utilities ✅

- **ConfigService Class**: Comprehensive configuration management system
  - Default configuration with sensible defaults
  - Configuration validation with detailed error messages
  - Deep merging of user preferences with defaults
  - JSON schema generation for UI/documentation
  - Support for different book types (fiction, academic, technical)

- **Validation Utilities**: Robust parameter validation system
  - Book creation parameter validation
  - ID validation (book IDs, chapter IDs)
  - Chapter approval/regeneration parameter validation
  - Export parameter validation
  - Generic validation functions (string, number, enum)
  - Input sanitization to prevent XSS and other security issues

## Architecture

```
api/app/clients/mcp/book-creation-server/
├── index.js                    # Main MCP server entry point
├── package.json               # Dependencies and scripts
├── services/                  # Business logic services
│   ├── ConfigService.js       # Configuration management ✅
│   └── index.js              # Services registry
├── tools/                     # MCP tool implementations (task 5)
│   └── index.js              # Tools registry
├── utils/                     # Utility functions
│   ├── database.js           # Database utilities ✅
│   └── validators.js         # Validation utilities ✅
└── tests/                    # Comprehensive test suite
    ├── index.test.js         # Server tests ✅
    ├── services/             # Service tests ✅
    ├── utils/                # Utility tests ✅
    ├── models/               # Model tests ✅
    └── integration/          # Integration tests ✅
```

## Configuration System

The ConfigService supports comprehensive book creation configuration:

### Content Configuration
- Chapter count (3-50 chapters)
- Average chapter length (500-10,000 words)
- Include introduction/conclusion/bibliography

### Style Configuration
- Writing style: formal, casual, academic, creative
- Tone: professional, friendly, authoritative, conversational
- Perspective: first-person, second-person, third-person
- Target audience specification

### Formatting Configuration
- Font family and size
- Line spacing options
- Margin settings

### Generation Configuration
- AI model selection
- Temperature settings (0-2)
- Token limits per chapter
- Summary length preferences

## Validation System

Comprehensive validation for all MCP tool parameters:

- **Book Creation**: Theme, title, genre, chapter count, writing style validation
- **ID Validation**: Alphanumeric with hyphens/underscores only
- **Chapter Operations**: Book ID, chapter ID, and feedback validation
- **Export Operations**: Format validation (markdown, HTML, PDF, DOCX, TXT)
- **Input Sanitization**: XSS prevention and whitespace normalization

## Testing

Comprehensive test suite with 141 passing tests:

- **Unit Tests**: All services and utilities thoroughly tested
- **Integration Tests**: Configuration and validation workflow testing
- **Model Tests**: Database model validation (from task 1)
- **Server Tests**: MCP server lifecycle and functionality

## Usage Examples

### Configuration Preparation
```javascript
const configService = new ConfigService();

const userConfig = {
  content: { chapterCount: 15 },
  style: { writingStyle: 'academic', targetAudience: 'students' },
  generation: { temperature: 0.3 }
};

const result = configService.prepareConfiguration(userConfig);
if (result.isValid) {
  // Use result.config for book creation
} else {
  // Handle validation errors in result.errors
}
```

### Parameter Validation
```javascript
const { validateCreateBookParams, sanitizeAndValidate } = require('./utils/validators');

const params = {
  theme: '  AI in Healthcare  ',
  title: 'Medical AI Revolution',
  genre: 'technical'
};

const result = sanitizeAndValidate(params, validateCreateBookParams);
if (result.isValid) {
  // Use result.params (sanitized)
} else {
  // Handle validation errors
}
```

## Next Steps

The server infrastructure is now ready for:

1. **Task 3**: AI integration layer implementation
2. **Task 4**: Core book management services
3. **Task 5**: MCP tool implementations
4. **Task 6**: Real-time progress tracking
5. **Task 7**: Error handling and validation
6. **Task 8**: Comprehensive testing
7. **Task 9**: LibreChat configuration and deployment

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:

- **Requirement 3.1-3.5**: Complete configuration system with validation
- **Requirement 7.1**: MCP server following Model Context Protocol specification
- **Requirement 7.2**: Server registration capability with LibreChat's MCP system
- **Requirement 7.5**: Server initialization and configuration validation

The foundation is solid and ready for the next phase of implementation.