# Book Creation MCP Server

An MCP (Model Context Protocol) server for creating and managing books with themes, writing styles, chapters, and pages. Designed to work with Anthropic models for generating high-quality, consistent book content.

## Features

- **Book Creation**: Create books with customizable themes, genres, and writing styles
- **Content Management**: Organize content into chapters and pages
- **Export Functionality**: Export books in multiple formats (PDF, EPUB, DOCX, HTML, TXT)
- **Author Management**: Track authorship and permissions
- **Progress Tracking**: Monitor word counts, completion status, and statistics
- **Writing Style Configuration**: Maintain consistent tone, voice, and style across the book

## Installation

1. Navigate to the server directory:
   ```bash
   cd api/app/clients/mcp/book-creation-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   export MONGODB_URI="mongodb://localhost:27017/librechat"
   export EXPORT_DIR="./exports"
   ```

## Usage

### Starting the Server

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

### MCP Tools

The server provides the following tools:

#### create_book
Creates a new book with specified theme, genre, and writing style.

**Parameters:**
- `title` (required): Book title
- `theme` (required): Main theme or subject matter
- `genre` (required): Book genre
- `writingStyle` (required): Writing style configuration
- `authorId` (required): Author identifier
- `subtitle` (optional): Book subtitle
- `targetAudience` (optional): Target audience description
- `description` (optional): Book description
- `targetWordCount` (optional): Target word count
- `estimatedPages` (optional): Estimated page count

**Example:**
```json
{
  "name": "create_book",
  "arguments": {
    "title": "The Future of AI",
    "theme": "artificial intelligence and its impact on society",
    "genre": "non-fiction",
    "writingStyle": {
      "tone": "academic",
      "voice": "third_person",
      "vocabulary": "advanced",
      "sentenceStructure": "complex"
    },
    "authorId": "user123",
    "targetWordCount": 80000
  }
}
```

#### get_book
Retrieves a book by ID with optional chapter and page content.

**Parameters:**
- `bookId` (required): Book identifier
- `includeChapters` (optional): Include chapter information
- `includePages` (optional): Include page content

#### list_books
Lists books for an author with filtering options.

**Parameters:**
- `authorId` (required): Author identifier
- `status` (optional): Filter by book status
- `genre` (optional): Filter by genre
- `limit` (optional): Maximum results (default: 20)
- `offset` (optional): Pagination offset (default: 0)

#### update_book
Updates book information and settings.

**Parameters:**
- `bookId` (required): Book identifier
- `updates` (required): Object containing fields to update

#### delete_book
Deletes a book and all associated content.

**Parameters:**
- `bookId` (required): Book identifier
- `authorId` (required): Author identifier for verification

#### export_book
Exports a book in the specified format.

**Parameters:**
- `bookId` (required): Book identifier
- `format` (required): Export format (pdf, epub, docx, html, txt)
- `authorId` (required): Author identifier for verification
- `includeMetadata` (optional): Include book metadata (default: true)

#### get_book_statistics
Retrieves detailed statistics about a book.

**Parameters:**
- `bookId` (required): Book identifier

## Writing Style Configuration

The writing style system ensures consistent content generation:

### Tone Options
- `formal`: Professional, serious tone
- `informal`: Casual, relaxed tone
- `academic`: Scholarly, research-oriented
- `conversational`: Friendly, dialogue-like
- `humorous`: Light-hearted, entertaining
- `serious`: Grave, important matters
- `inspirational`: Motivating, uplifting

### Voice Options
- `first_person`: "I", "we" perspective
- `second_person`: "you" perspective
- `third_person`: "he", "she", "they" perspective

### Vocabulary Levels
- `simple`: Basic, accessible language
- `intermediate`: Moderate complexity
- `advanced`: Sophisticated vocabulary
- `technical`: Specialized terminology

### Sentence Structure
- `simple`: Short, straightforward sentences
- `complex`: Longer, intricate sentences
- `varied`: Mix of simple and complex

## Database Schema

### Book Collection
- Basic information (title, theme, genre)
- Writing style configuration
- Author information
- Progress tracking
- Publishing information
- Metadata and settings

### Chapter Collection
- Chapter organization and numbering
- Content outline and description
- Progress status
- Word count tracking

### Page Collection
- Page content and numbering
- Individual page status
- Notes and annotations

## Configuration

The server can be configured via environment variables or a config.json file:

```json
{
  "database": {
    "uri": "mongodb://localhost:27017/librechat"
  },
  "export": {
    "outputDirectory": "./exports",
    "maxFileSize": 52428800
  },
  "limits": {
    "maxWordCount": 1000000,
    "maxChaptersPerBook": 100
  },
  "features": {
    "enableExport": true,
    "enableAutoSave": true
  }
}
```

## Error Handling

The server provides detailed error messages for:
- Invalid input parameters
- Database connection issues
- Permission violations
- Export failures
- Configuration problems

## Testing

Run the test suite:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Contributing

1. Follow the existing code structure
2. Add tests for new features
3. Update documentation
4. Ensure proper error handling

## License

This MCP server is part of the LibreChat project.