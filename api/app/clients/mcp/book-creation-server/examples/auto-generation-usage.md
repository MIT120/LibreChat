# Auto-Generation of Author ID and Conversation ID

This document demonstrates how to use the new auto-generation functionality for `authorId` and `conversationId` in book creation.

## Overview

The MCP book creation server now automatically generates default values for:
- `authorId` - Identifies the book's author
- `conversationId` - Links the book to a conversation context

Users no longer need to provide these values every time they create a book. The system will generate sensible defaults that can be updated later if needed.

## New Utility Tools

### 1. `get_user_info`
Get default IDs and user information:

```json
{
  "name": "get_user_info",
  "arguments": {
    "userId": "optional_user_id"
  }
}
```

**Response:**
```json
{
  "success": true,
  "userInfo": {
    "userId": "user_1234567890123",
    "defaultAuthorId": "author_1234567890123",
    "defaultWorkspaceId": "workspace_1234567890123",
    "suggestedConversationId": "conv_1234567890123_abc123def",
    "preferences": {
      "autoGenerateIds": true,
      "defaultWritingStyle": {
        "tone": "conversational",
        "voice": "third_person",
        "vocabulary": "intermediate",
        "sentenceStructure": "varied"
      }
    }
  }
}
```

### 2. `generate_defaults`
Generate fresh default IDs:

```json
{
  "name": "generate_defaults",
  "arguments": {
    "prefix": "myproject",
    "includeTimestamp": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "defaults": {
    "authorId": "myproject_author_1234567890123",
    "conversationId": "conv_1234567890123_xyz789abc",
    "workspaceId": "workspace_myproject_1234567890123"
  }
}
```

### 3. `list_user_books`
List books to find Book IDs:

```json
{
  "name": "list_user_books",
  "arguments": {
    "authorId": "optional_author_id",
    "limit": 10,
    "status": "writing"
  }
}
```

### 4. `list_conversations`
Find conversation IDs for linking:

```json
{
  "name": "list_conversations",
  "arguments": {
    "bookId": "optional_book_id",
    "userId": "optional_user_id",
    "status": "active",
    "limit": 10
  }
}
```

### 5. `update_book_ids`
Update authorId or conversationId after creation:

```json
{
  "name": "update_book_ids",
  "arguments": {
    "bookId": "book_123",
    "newAuthorId": "new_author_456",
    "newConversationId": "new_conv_789"
  }
}
```

## Updated Book Creation

### Before (Required Fields)
```json
{
  "name": "create_book",
  "arguments": {
    "title": "My Book",
    "theme": "Adventure",
    "genre": "Fiction",
    "authorId": "must_provide_this",
    "conversationId": "must_provide_this_too",
    "writingStyle": {
      "tone": "conversational",
      "voice": "third_person",
      "vocabulary": "intermediate",
      "sentenceStructure": "varied"
    }
  }
}
```

### After (Auto-Generated)
```json
{
  "name": "create_book",
  "arguments": {
    "title": "My Book",
    "theme": "Adventure", 
    "genre": "Fiction",
    "writingStyle": {
      "tone": "conversational",
      "voice": "third_person",
      "vocabulary": "intermediate",
      "sentenceStructure": "varied"
    }
    // authorId and conversationId will be auto-generated!
  }
}
```

The system will automatically generate:
- `authorId`: `"author_1234567890123"`
- `conversationId`: `"conv_1234567890123_abc123def"`

## Workflow Examples

### Quick Book Creation
1. Call `create_book` with just title, theme, genre, and writing style
2. System auto-generates authorId and conversationId
3. Start writing immediately!

### Custom IDs
1. Call `get_user_info` to get suggested defaults
2. Modify the IDs as needed
3. Call `create_book` with your custom IDs

### Managing Existing Books
1. Call `list_user_books` to see your books
2. Use `update_book_ids` to change authorId or conversationId if needed
3. Call `list_conversations` to find conversation contexts

### Finding Resources
1. Use `list_user_books` to find specific book IDs
2. Use `list_conversations` to find conversation IDs for linking
3. Use `get_user_info` to get your default author information

## Benefits

- **Faster book creation**: No need to think about IDs every time
- **Consistent authorship**: Auto-generated authorIds maintain consistency
- **Easy management**: Tools to list and update IDs when needed
- **Backward compatibility**: Can still provide custom IDs if desired
- **Better UX**: Focus on writing, not administrative details

## Migration

Existing books and tools continue to work unchanged. The new functionality only affects:
- New book creation (when IDs are not provided)
- New chapter creation (when conversationId is not provided)  
- New page creation (when conversationId is not provided)

All existing books retain their current authorId and conversationId values.
