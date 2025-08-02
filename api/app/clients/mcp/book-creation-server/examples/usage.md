# Book Creation MCP Server - Usage Examples

This document provides practical examples of how to use the Book Creation MCP server with Anthropic models.

## Basic Book Creation

### Example 1: Create a Technical Non-Fiction Book

```json
{
  "tool": "create_book",
  "arguments": {
    "title": "The Complete Guide to Machine Learning",
    "subtitle": "From Theory to Production",
    "theme": "machine learning and artificial intelligence for practitioners",
    "genre": "technical non-fiction",
    "targetAudience": "software engineers and data scientists",
    "writingStyle": {
      "tone": "academic",
      "voice": "third_person",
      "vocabulary": "technical",
      "sentenceStructure": "complex",
      "perspective": "Expert teaching practitioners with real-world examples",
      "specialInstructions": "Include code examples, mathematical explanations, and practical case studies. Use clear headings and maintain technical accuracy."
    },
    "description": "A comprehensive guide covering machine learning fundamentals, algorithms, implementation techniques, and deployment strategies for production environments.",
    "targetWordCount": 120000,
    "estimatedPages": 400,
    "authorId": "author_12345"
  }
}
```

### Example 2: Create a Fiction Novel

```json
{
  "tool": "create_book",
  "arguments": {
    "title": "The Last Digital Nomad",
    "theme": "dystopian future where remote work is outlawed",
    "genre": "science fiction",
    "targetAudience": "young adults and tech professionals",
    "writingStyle": {
      "tone": "serious",
      "voice": "first_person",
      "vocabulary": "intermediate",
      "sentenceStructure": "varied",
      "perspective": "Protagonist struggling against authoritarian system",
      "specialInstructions": "Build tension gradually, include tech details that feel authentic, focus on human connections in digital age."
    },
    "description": "In 2045, the government bans remote work to control the population. Maya, a underground developer, leads a resistance movement while hiding her digital nomad lifestyle.",
    "targetWordCount": 80000,
    "estimatedPages": 320,
    "authorId": "author_12345"
  }
}
```

### Example 3: Create a Business Self-Help Book

```json
{
  "tool": "create_book",
  "arguments": {
    "title": "Leading with Purpose",
    "subtitle": "How to Build Authentic Leadership in the Modern Workplace",
    "theme": "authentic leadership and team building",
    "genre": "business",
    "targetAudience": "managers, executives, and aspiring leaders",
    "writingStyle": {
      "tone": "inspirational",
      "voice": "second_person",
      "vocabulary": "intermediate",
      "sentenceStructure": "simple",
      "perspective": "Experienced mentor guiding the reader's leadership journey",
      "specialInstructions": "Include actionable frameworks, real case studies, and reflection exercises. Use 'you' to engage readers directly."
    },
    "description": "A practical guide to developing authentic leadership skills, building high-performing teams, and creating positive workplace culture in today's evolving business environment.",
    "targetWordCount": 65000,
    "estimatedPages": 250,
    "authorId": "author_12345"
  }
}
```

## Managing Your Books

### List All Books for an Author

```json
{
  "tool": "list_books",
  "arguments": {
    "authorId": "author_12345",
    "limit": 10,
    "offset": 0
  }
}
```

### Get Book Details with Chapters

```json
{
  "tool": "get_book",
  "arguments": {
    "bookId": "book_abc123",
    "includeChapters": true,
    "includePages": false
  }
}
```

### Update Book Status and Writing Style

```json
{
  "tool": "update_book",
  "arguments": {
    "bookId": "book_abc123",
    "updates": {
      "status": "writing",
      "writingStyle": {
        "tone": "conversational",
        "specialInstructions": "Include more real-world examples and case studies from recent interviews."
      }
    }
  }
}
```

### Get Progress Statistics

```json
{
  "tool": "get_book_statistics",
  "arguments": {
    "bookId": "book_abc123"
  }
}
```

## Export Options

### Export as PDF

```json
{
  "tool": "export_book",
  "arguments": {
    "bookId": "book_abc123",
    "format": "pdf",
    "authorId": "author_12345",
    "includeMetadata": true
  }
}
```

### Export as EPUB for eBook Readers

```json
{
  "tool": "export_book",
  "arguments": {
    "bookId": "book_abc123",
    "format": "epub",
    "authorId": "author_12345",
    "includeMetadata": true
  }
}
```

## Writing Style Guidelines

### Academic Writing Style
```json
{
  "tone": "academic",
  "voice": "third_person",
  "vocabulary": "advanced",
  "sentenceStructure": "complex",
  "specialInstructions": "Cite sources, use formal language, include research findings and evidence-based conclusions."
}
```

### Conversational Writing Style
```json
{
  "tone": "conversational",
  "voice": "second_person",
  "vocabulary": "intermediate",
  "sentenceStructure": "varied",
  "specialInstructions": "Use contractions, ask rhetorical questions, include personal anecdotes and relatable examples."
}
```

### Technical Writing Style
```json
{
  "tone": "formal",
  "voice": "third_person",
  "vocabulary": "technical",
  "sentenceStructure": "simple",
  "specialInstructions": "Define technical terms, use numbered lists, include code examples and step-by-step procedures."
}
```

## Integration with Anthropic Models

When using this MCP server with Anthropic models like Claude, the AI will:

1. **Maintain Consistency**: Use the defined writing style throughout the book
2. **Follow Theme**: Keep content focused on the specified theme
3. **Respect Structure**: Organize content into proper chapters and pages
4. **Track Progress**: Update word counts and completion status
5. **Enable Collaboration**: Allow multiple AI sessions to work on the same book

## Best Practices

### 1. Define Clear Writing Styles
- Be specific about tone, voice, and vocabulary
- Include detailed special instructions
- Consider your target audience when setting complexity

### 2. Plan Your Book Structure
- Set realistic word count targets
- Plan chapter breakdown before writing
- Use descriptive titles and themes

### 3. Track Progress Regularly
- Use `get_book_statistics` to monitor progress
- Update status as you move through writing phases
- Export drafts for review at different stages

### 4. Leverage Export Options
- Export in multiple formats for different use cases
- Use HTML exports for web publishing
- Generate PDFs for print reviews

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure the `authorId` matches the book creator
2. **Export Failures**: Check that the book has content before exporting
3. **Database Connections**: Verify MongoDB is running and accessible
4. **Large Exports**: Be patient with books containing extensive content

### Error Messages

- `"Missing required fields"`: Check that all required parameters are provided
- `"Book not found"`: Verify the book ID is correct and the book exists
- `"Unauthorized"`: Ensure you're using the correct author ID
- `"Export format not supported"`: Use one of: pdf, epub, docx, html, txt