# 📋 Codex Implementation Checklist

## 🚦 Prerequisites (VERIFY FIRST)

### ✅ Environment Setup
- [ ] **RAG System Running**: LibreChat RAG API is accessible at `http://rag_api:8000`
- [ ] **PostgreSQL + pgvector**: Vector database is configured and running
- [ ] **MongoDB**: Book creation server database is accessible
- [ ] **Environment Variables**: RAG_API_URL is configured correctly

```bash
# Check these environment variables
echo "RAG_API_URL: $RAG_API_URL"
echo "MONGODB_URI: $MONGODB_URI"

# Should show:
# RAG_API_URL: http://rag_api:8000 (or your RAG API endpoint)
# MONGODB_URI: mongodb://localhost:27017/librechat (or your MongoDB URI)
```

### ✅ Dependencies
- [ ] **Node.js**: Version 18+ installed
- [ ] **NPM packages**: All dependencies installed (`npm install`)
- [ ] **TypeScript**: Code compiled (`npm run build`)

---

## 🏗️ Phase 1: Setup & Testing (START HERE)

### Step 1: Install Dependencies
```bash
cd api/app/clients/mcp/book-creation-server
npm install
npm install form-data  # Additional dependency for RAG uploads
```

### Step 2: Build the Project
```bash
npm run build
```

### Step 3: Test Codex System
```bash
# Test all Codex functionality
npm run codex:test
```

**Expected Output:**
```
✅ RAG Service: healthy
✅ RAG API Connected: Yes
✅ Total Books: X
✅ Characters: X
✅ World Elements: X
✅ Timeline Events: X
🎯 Overall Success Rate: 100%
```

**If tests fail:**
- Check RAG_API_URL environment variable
- Verify RAG containers are running: `docker ps | grep rag`
- Check MongoDB connection
- Ensure you have story elements in your database

---

## 📚 Phase 2: Data Extraction & Sync

### Step 4: List Available Books
```bash
# See all books that can be synced
npm run codex:list-books
```

### Step 5: Sync Single Book (Recommended First)
```bash
# Replace with actual book ID from the list
npm run codex:sync-book 507f1f77bcf86cd799439011
```

**Expected Output:**
```
✅ Success: X elements synced
🔍 Query test: Found X character-related results
🎯 Reference test: Found X references in test text
🎉 Book sync completed successfully!
```

### Step 6: Sync All Books (When Ready)
```bash
# Interactive mode (asks for confirmation)
npm run codex:sync-all

# OR automatic mode (no confirmation)
npm run codex:sync-all-auto
```

---

## 🧪 Phase 3: Verify Functionality

### Step 7: Test MCP Tools
Open LibreChat and test these MCP tools:

#### Test 1: Query Story Context
```json
{
  "tool": "query_codex_context",
  "args": {
    "query": "main character",
    "bookId": "your-book-id",
    "limit": 3
  }
}
```

#### Test 2: Detect References
```json
{
  "tool": "detect_story_references",
  "args": {
    "content": "Alex walked through the palace gardens with Sarah.",
    "bookId": "your-book-id",
    "conversationId": "test-session"
  }
}
```

#### Test 3: Get Element Preview
```json
{
  "tool": "get_element_preview",
  "args": {
    "elementName": "Alex",
    "bookId": "your-book-id",
    "elementType": "character"
  }
}
```

### Step 8: Verify Data in RAG
```bash
# Re-run test to verify everything is working
npm run codex:test
```

---

## 🎨 Phase 4: UI Integration (OPTIONAL)

### Step 9: Add Context Sidebar to BookPreview

Create a new component for story context:

```typescript
// client/src/components/BookPreview/CodexSidebar.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';

interface CodexSidebarProps {
  bookId: string;
  onElementSelect: (element: any) => void;
}

export const CodexSidebar: React.FC<CodexSidebarProps> = ({ bookId, onElementSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchCodex = async (query: string) => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      // Call query_codex_context MCP tool
      const response = await fetch('/api/mcp/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'query_codex_context',
          args: { query, bookId, limit: 10 }
        })
      });
      
      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error('Codex search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-80 border-l border-gray-200 bg-gray-50 p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">📚 Story Codex</h3>
        <Input
          placeholder="Search characters, locations, events..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && searchCodex(searchQuery)}
        />
        <Button 
          onClick={() => searchCodex(searchQuery)}
          disabled={loading}
          className="mt-2 w-full"
        >
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </div>
      
      <div className="space-y-2">
        {results.map((result, index) => (
          <Card key={index} className="cursor-pointer hover:bg-gray-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {result.type === 'character' ? '👤' : 
                 result.type === 'world_element' ? '🌍' : '⏰'} {result.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-600">{result.summary}</p>
              <p className="text-xs text-blue-600 mt-1">
                {(result.relevance * 100).toFixed(0)}% relevance
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
```

### Step 10: Add Reference Highlighting

Enhance the BookPreview component to highlight story references:

```typescript
// Add to BookPreview component
const highlightReferences = async (content: string) => {
  try {
    const response = await fetch('/api/mcp/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'detect_story_references',
        args: { content, bookId, conversationId }
      })
    });
    
    const data = await response.json();
    return data.detections || [];
  } catch (error) {
    console.error('Reference detection failed:', error);
    return [];
  }
};
```

---

## 🔍 Troubleshooting Guide

### Common Issues & Solutions

#### ❌ "RAG API not accessible"
**Problem**: RAG service not running or misconfigured
**Solutions**:
```bash
# Check RAG containers
docker ps | grep rag

# Check environment
echo $RAG_API_URL

# Restart RAG services
docker-compose restart rag_api vectordb
```

#### ❌ "No story elements found"
**Problem**: Books exist but no characters/locations/events
**Solutions**:
1. Create story elements using existing MCP tools
2. Use character creation tools to add characters
3. Use world building tools to add locations
4. Use timeline tools to add events

#### ❌ "Sync failed with errors"
**Problem**: Some elements couldn't be synced
**Solutions**:
1. Check individual error messages in sync output
2. Verify element data integrity in MongoDB
3. Try syncing individual books instead of batch
4. Check RAG API logs for detailed error info

#### ❌ "Low reference detection accuracy"
**Problem**: System not detecting character/location names
**Solutions**:
1. Ensure character names match exactly (case-sensitive)
2. Check that elements were successfully synced
3. Try variations of names in queries
4. Verify element names don't conflict with common words

---

## 📊 Success Metrics

### After Implementation, You Should See:

#### ✅ Technical Metrics
- **RAG Response Time**: < 200ms for context queries
- **Sync Success Rate**: > 95% for book-to-RAG sync  
- **Reference Detection**: Finds character/location mentions
- **Context Relevance**: > 70% relevance scores for queries

#### ✅ User Experience
- **Instant Context**: Hover over names for quick info
- **Smart Search**: Find story elements by description
- **Consistency Help**: Detect when descriptions conflict
- **Writing Flow**: No interruption to writing process

#### ✅ Data Validation
```bash
# These should all return data
curl "$RAG_API_URL/health"  # Should return healthy
npm run codex:test          # Should pass all tests
```

---

## 🎯 Quick Start Commands

```bash
# Complete setup in one go
npm install && npm run build
npm run codex:test
npm run codex:list-books
npm run codex:sync-book <bookId>

# Test functionality
curl -X POST http://localhost:3080/api/mcp/call \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "query_codex_context",
    "args": {
      "query": "main character",
      "bookId": "your-book-id"
    }
  }'
```

---

## 🚀 What You Get

After completing this checklist:

1. **📚 Story Bible**: All characters, locations, events searchable
2. **🔍 Context Search**: Find story elements by meaning, not just name
3. **🎯 Reference Detection**: Auto-detect mentions in text
4. **💡 Smart Suggestions**: Context-aware writing assistance
5. **✅ Consistency Checking**: Maintain story coherence
6. **🔄 Real-time Updates**: Sync new elements automatically

**You now have a NovelCrafter-like Codex system integrated with AI-powered writing assistance!** 🎉
