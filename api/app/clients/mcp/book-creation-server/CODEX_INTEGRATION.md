# Codex RAG Integration - Story Bible for Context-Aware Writing

The Codex system integrates your book's story elements (characters, world elements, timeline events) into LibreChat's RAG (Retrieval-Augmented Generation) system, providing **context-aware writing assistance** similar to NovelCrafter's Codex feature.

## 🚀 Features

### **Automatic Story Bible**
- **Characters**: Physical descriptions, personality traits, relationships, appearances
- **World Elements**: Locations, cultures, organizations, rules, technology, magic systems
- **Timeline Events**: Plot points, character development, causality chains

### **Context Retrieval**
- **Semantic Search**: Find relevant story elements by meaning, not just exact text
- **Relevance Scoring**: Get the most relevant context for your current writing
- **Cross-References**: See relationships between characters, locations, and events

### **Reference Detection**
- **Automatic Recognition**: Detect character and location names in your text
- **Inline Previews**: Get context hints without switching tools
- **Consistency Checking**: Ensure story elements remain coherent

## 🛠️ How It Works

### **RAG Integration**
```
Story Elements → Formatted Documents → Vector Embeddings → PostgreSQL + pgvector
```

The system:
1. **Formats** your narrative elements into searchable documents
2. **Embeds** them using LibreChat's RAG API
3. **Stores** vectors in PostgreSQL with pgvector
4. **Retrieves** relevant context using semantic similarity

### **Data Flow**
```
Your Writing → Reference Detection → Context Query → RAG Database → Context Preview
```

## 📖 Available Tools

### `sync_book_to_codex`
Synchronize all story elements to the RAG-powered Codex.

```json
{
  "bookId": "your-book-id",
  "conversationId": "conversation-id",
  "force": false
}
```

**What it does:**
- Formats characters, world elements, and timeline events
- Uploads to RAG system with vector embeddings
- Creates searchable story bible

### `query_codex_context`
Search the Codex for relevant story elements.

```json
{
  "query": "main character palace throne room",
  "bookId": "your-book-id",
  "limit": 5,
  "types": ["character", "world_element"],
  "minRelevance": 0.7
}
```

**Use cases:**
- "Who is the main character?" → Character profiles
- "describe the royal palace" → Location details
- "the betrayal scene" → Timeline events

### `detect_story_references`
Automatically find references in your text.

```json
{
  "content": "Alex walked through the palace gardens...",
  "bookId": "your-book-id",
  "conversationId": "conversation-id",
  "includeDetails": true
}
```

**Returns:**
- Character mentions with context
- Location references with descriptions
- Event callbacks with significance

### `get_element_preview`
Get detailed preview of specific story element.

```json
{
  "elementName": "Alex",
  "bookId": "your-book-id",
  "elementType": "character"
}
```

## 🎯 Workflow Integration

### **Initial Setup**
1. **Create your story elements** using existing character, world, and timeline tools
2. **Sync to Codex** with `sync_book_to_codex`
3. **Start writing** with context-aware assistance

### **While Writing**
1. **Reference Detection**: System automatically detects story elements in your text
2. **Context Queries**: Ask about characters, locations, events
3. **Consistency Checking**: Ensure descriptions match previous mentions

### **Ongoing Maintenance**
- **Auto-sync**: New elements are automatically added to Codex
- **Updates**: Changes to characters/world elements update the story bible
- **Versioning**: Maintain consistency across story revisions

## 💡 Advantages Over NovelCrafter

### **AI-Native Integration**
- **Seamless AI writing**: Context is automatically available to AI models
- **Smart suggestions**: AI knows your story world and characters
- **Consistency checking**: AI can spot inconsistencies in real-time

### **Advanced Analytics**
- **Plot hole detection**: Find narrative inconsistencies
- **Character arc analysis**: Track character development
- **Relationship mapping**: Visualize character connections

### **Extensible System**
- **Custom elements**: Add any type of story element
- **Metadata rich**: Track appearances, relationships, causality
- **Cross-story**: Share elements between related books

## 🔧 Technical Details

### **Requirements**
- LibreChat with RAG system enabled
- PostgreSQL with pgvector extension
- RAG API service running
- Environment variable: `RAG_API_URL`

### **Data Storage**
- **Collections**: Each book gets its own collection (`book_codex_${bookId}`)
- **Metadata**: Rich metadata for filtering and cross-referencing
- **Versioning**: Track changes and updates to story elements

### **Performance**
- **Semantic search**: Find relevant context in milliseconds
- **Caching**: Frequently accessed elements are cached
- **Parallel processing**: Multiple elements processed simultaneously

## 🚀 Getting Started

1. **Ensure RAG is enabled** in your LibreChat setup
2. **Create a book** with characters, locations, and events
3. **Sync to Codex**:
   ```
   sync_book_to_codex: {
     "bookId": "your-book-id",
     "conversationId": "session-id"
   }
   ```
4. **Start querying**:
   ```
   query_codex_context: {
     "query": "tell me about the main character",
     "bookId": "your-book-id"
   }
   ```

## 🔮 Future Enhancements

- **Visual timeline**: Timeline visualization with context integration
- **Relationship graphs**: Interactive character/location relationship maps
- **Auto-suggestions**: Proactive context hints while writing
- **Cross-book references**: Share elements between related stories
- **Version diffing**: Track changes to story elements over time

The Codex system bridges the gap between NovelCrafter's reference management and AI-powered writing assistance, providing the best of both worlds.
