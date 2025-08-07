# RAG Integration for Bulgarian Legal MCP Server

This document describes how the Bulgarian Legal MCP Server integrates with LibreChat's RAG (Retrieval-Augmented Generation) system to provide persistent storage and enhanced search capabilities for legal documents.

## Overview

The RAG integration enables:
- **Persistent storage** of scraped legal documents for faster future retrieval
- **Vector embeddings** for semantic search capabilities
- **Hybrid search** combining stored knowledge with live scraping
- **Progressive knowledge building** as the system accumulates legal data over time

## Architecture

```
User Query → MCP Tool → RAG Service → Vector DB (PostgreSQL + pgvector)
                ↓
         Live Scraping (lex.bg/APIS) → Store New Results → RAG System
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# RAG API Configuration
RAG_API_URL=http://rag_api:8000
RAG_USE_FULL_CONTEXT=false

# PostgreSQL Vector DB (from docker-compose.yml)
DB_HOST=vectordb
DB_PORT=5432
POSTGRES_DB=mydatabase
POSTGRES_USER=myuser
POSTGRES_PASSWORD=mypassword
```

### Docker Compose Setup

The RAG system is already configured in `docker-compose.yml`:

```yaml
vectordb:
  container_name: vectordb
  image: ankane/pgvector:latest
  environment:
    POSTGRES_DB: mydatabase
    POSTGRES_USER: myuser
    POSTGRES_PASSWORD: mypassword
  restart: always
  volumes:
    - pgdata2:/var/lib/postgresql/data

rag_api:
  container_name: rag_api
  build:
    context: ../rag_api
    dockerfile: Dockerfile
  environment:
    - DB_HOST=vectordb
    - RAG_PORT=${RAG_PORT:-8000}
  restart: always
  depends_on:
    - vectordb
  env_file:
    - .env
```

## New MCP Tools

### 1. `query_rag_legal_documents`

Search previously stored legal documents using vector similarity.

**Parameters:**
- `query` (string): Search query
- `limit` (integer): Max results (default: 10)
- `minSimilarity` (number): Minimum similarity score (default: 0.7)

**Example:**
```json
{
  "query": "договор за продажба на недвижимо имущество",
  "limit": 5,
  "minSimilarity": 0.8
}
```

### 2. `store_legal_document_in_rag`

Manually store a legal document in the RAG system.

**Parameters:**
- `title` (string): Document title
- `content` (string): Full document content
- `metadata` (object): Additional metadata (url, date, type, etc.)
- `source` (string): Source identifier

**Example:**
```json
{
  "title": "Решение № 123/2024 на ВКС",
  "content": "Съдебно решение относно...",
  "metadata": {
    "court": "ВКС",
    "date": "2024-01-15",
    "caseNumber": "123/2024"
  },
  "source": "vks.bg"
}
```

### 3. `enhanced_legal_search`

Perform hybrid search combining RAG retrieval with live scraping.

**Parameters:**
- `query` (string): Search query
- `sources` (array): Sources to search ['lex.bg', 'apis', 'both']
- `useRagFirst` (boolean): Check RAG before live search (default: true)
- `storeResults` (boolean): Store new results in RAG (default: true)
- `limit` (integer): Max total results (default: 20)

**Example:**
```json
{
  "query": "чл. 220 ЗЗД неустойка",
  "sources": ["both"],
  "useRagFirst": true,
  "storeResults": true,
  "limit": 15
}
```

## Enhanced Existing Tools

All existing search tools now support RAG integration:

### `search_lex_bg`
- Automatically checks RAG first if available
- Stores new results for future use
- Add `useRag: false` to disable RAG integration

### `search_apis_legislation`
- Same RAG integration as lex.bg search
- Categorizes documents by database type

### `get_legal_news`
- Automatically stores top news items in RAG
- Add `storeInRag: false` to disable storage

## Data Flow

### 1. First Search (Cold Start)
```
User Query → No RAG Results → Live Scraping → Store Results → Return Combined
```

### 2. Subsequent Searches (Warm System)
```
User Query → RAG Results Found → (Optional) Live Scraping → Combine & Rank → Return
```

### 3. Document Storage
```
Scraped Document → Format for RAG → Create Temp File → Upload to RAG API → Vector Embedding → PostgreSQL Storage
```

## Benefits

### Performance
- **Faster responses** for repeated queries
- **Reduced load** on external legal websites
- **Parallel processing** of RAG and live searches

### Knowledge Building
- **Accumulated legal knowledge** grows over time
- **Semantic relationships** between legal concepts
- **Historical tracking** of legal changes

### Reliability
- **Fallback to live search** if RAG is unavailable
- **Redundant data sources** for better coverage
- **Graceful degradation** when services are down

## Best Practices

### For Lawyers
1. Use `enhanced_legal_search` for comprehensive research
2. Store important documents manually with `store_legal_document_in_rag`
3. Use `query_rag_legal_documents` for quick reference searches

### For System Administrators
1. Monitor RAG API status with `test_data_sources`
2. Regularly backup PostgreSQL vector database
3. Monitor disk space for document storage
4. Set appropriate similarity thresholds based on use case

## Troubleshooting

### RAG System Not Available
```
❌ RAG система не е налична. Моля, настройте RAG_API_URL.
```
**Solution:** Check RAG_API_URL environment variable and RAG container status.

### Vector Embedding Failed
```
❌ Грешка при съхраняването: File embedding failed
```
**Solution:** Check document content length and file format compatibility.

### No RAG Results
```
❗ Няма намерени документи в RAG системата.
```
**Solution:** Use `enhanced_legal_search` to populate RAG with new documents.

## Integration Points

### With LibreChat
- Uses LibreChat's authentication system
- Follows LibreChat's file handling patterns
- Integrates with existing RAG infrastructure

### With Legal Sources
- **lex.bg**: Real-time scraping + RAG storage
- **APIS**: Legislation search + RAG storage
- **News feeds**: Automatic categorization and storage

## Future Enhancements

1. **Smart Caching**: Time-based cache invalidation for news and updates
2. **Legal Entity Recognition**: Automatic extraction of legal entities for better search
3. **Document Similarity Scoring**: ML-based relevance ranking
4. **User-specific Collections**: Personal document libraries for individual lawyers
5. **Analytics Dashboard**: Usage statistics and knowledge base growth metrics

## Security Considerations

- All RAG operations use LibreChat's authentication
- Sensitive legal documents are encrypted in storage
- Access logs maintained for audit purposes
- User permissions respected for document access
