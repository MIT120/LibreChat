# 🔧 Codex Configuration Guide

## Environment Variables Setup

Create or update your `.env` file with these required settings:

```bash
# === REQUIRED: RAG System Configuration ===
RAG_API_URL=http://rag_api:8000

# === REQUIRED: Database Configuration ===
MONGODB_URI=mongodb://localhost:27017/librechat

# === OPTIONAL: Advanced Settings ===
RAG_USE_FULL_CONTEXT=false
CODEX_BATCH_SIZE=50
CODEX_MIN_RELEVANCE=0.7
CODEX_DETECTION_CONFIDENCE=0.8
CODEX_DEBUG=false
```

## Quick Configuration Test

```bash
# 1. Verify environment variables
echo "RAG_API_URL: $RAG_API_URL"
echo "MONGODB_URI: $MONGODB_URI"

# 2. Test RAG connectivity
curl $RAG_API_URL/health

# 3. Test complete Codex system
npm run codex:test
```

## Docker Compose Integration

Ensure your `docker-compose.yml` includes:

```yaml
services:
  vectordb:
    image: ankane/pgvector:latest
    environment:
      POSTGRES_DB: mydatabase
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypassword
    volumes:
      - pgdata2:/var/lib/postgresql/data

  rag_api:
    image: ghcr.io/danny-avila/librechat-rag-api-dev-lite:latest
    environment:
      - DB_HOST=vectordb
      - RAG_PORT=8000
    depends_on:
      - vectordb
    env_file:
      - .env
```

## Configuration Validation

Run this checklist before using Codex:

✅ **RAG API Accessible**: `curl $RAG_API_URL/health` returns `200 OK`
✅ **MongoDB Connected**: `npm run codex:test` shows database content  
✅ **Story Elements Exist**: Books have characters, locations, or events
✅ **Docker Services Running**: `docker ps | grep rag` shows containers
✅ **Environment Complete**: All required variables are set
