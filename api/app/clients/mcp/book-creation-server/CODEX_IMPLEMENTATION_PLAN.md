# 📚 Codex RAG Implementation Plan & Checklist

## 🎯 Phase 1: Core Codex Functionality (COMPLETED ✅)

### Backend Services
- [x] **CodexRagService** - RAG integration for story bible elements
- [x] **CodexToolHandlers** - MCP tools for codex operations
- [x] **Service Registration** - Dependency injection setup
- [x] **Integration Testing** - Basic functionality verification

### Available MCP Tools
- [x] `sync_book_to_codex` - Sync story elements to RAG
- [x] `query_codex_context` - Search story bible semantically
- [x] `detect_story_references` - Auto-detect character/location mentions
- [x] `get_element_preview` - Detailed context for specific elements

---

## 🚀 Phase 2: Data Extraction & RAG Population (IN PROGRESS)

### 2.1 Story Data Extraction Checklist

#### **Character Data Extraction**
- [ ] **Identify Characters**: Find all characters from books in database
- [ ] **Extract Profiles**: Get character details (personality, appearance, relationships)
- [ ] **Format for RAG**: Convert to searchable text format
- [ ] **Upload to RAG**: Create vector embeddings for semantic search

#### **World Element Extraction**
- [ ] **Identify Locations**: Extract all world building elements
- [ ] **Extract Descriptions**: Get visual details, properties, connections
- [ ] **Format for RAG**: Convert to searchable documents
- [ ] **Upload to RAG**: Create embeddings for location context

#### **Timeline Event Extraction**
- [ ] **Identify Events**: Find all timeline events and plot points
- [ ] **Extract Context**: Get participants, causality, significance
- [ ] **Format for RAG**: Convert to chronological documents
- [ ] **Upload to RAG**: Create embeddings for event context

### 2.2 Batch Processing Implementation

```typescript
// Example batch sync script
const syncAllBooksToCodex = async () => {
  const books = await Book.find({});
  
  for (const book of books) {
    console.log(`Syncing book: ${book.title}`);
    
    try {
      const result = await codexService.syncBookToCodex(
        book._id.toString(),
        'batch-sync-session'
      );
      
      console.log(`✅ Synced ${result.syncedElements} elements`);
      if (result.errors.length > 0) {
        console.log(`⚠️  ${result.errors.length} errors occurred`);
      }
    } catch (error) {
      console.error(`❌ Failed to sync ${book.title}:`, error);
    }
  }
};
```

---

## 🎨 Phase 3: UI Integration (NEXT PRIORITY)

### 3.1 BookPreview Component Enhancements

#### **Context Sidebar**
- [ ] **Add Codex Panel**: New sidebar section for story context
- [ ] **Character Cards**: Quick character reference cards
- [ ] **Location Cards**: World element context cards
- [ ] **Timeline View**: Event timeline with context

#### **Inline Context Detection**
- [ ] **Reference Highlighting**: Highlight character/location mentions
- [ ] **Context Tooltips**: Hover previews for story elements
- [ ] **Smart Suggestions**: Auto-complete for character names

#### **Context Search Interface**
- [ ] **Search Bar**: Query story bible from UI
- [ ] **Filter Options**: Filter by element type (character/location/event)
- [ ] **Results Display**: Show relevant context with relevance scores

### 3.2 Writing Enhancement Features

#### **Real-time Context Assistance**
- [ ] **Auto-Detection**: Detect references as user types
- [ ] **Context Hints**: Show relevant character/location info
- [ ] **Consistency Warnings**: Alert when descriptions conflict

#### **Smart Autocomplete**
- [ ] **Character Names**: Auto-complete character names
- [ ] **Location Names**: Auto-complete location references
- [ ] **Relationship Hints**: Suggest character relationships

---

## 📊 Phase 4: Advanced Features

### 4.1 Visual Story Bible
- [ ] **Character Gallery**: Visual character profiles with images
- [ ] **World Map**: Interactive map with location markers
- [ ] **Timeline Visualization**: Interactive timeline with events
- [ ] **Relationship Graph**: Character relationship network

### 4.2 Advanced Analytics
- [ ] **Context Usage Analytics**: Track which elements are referenced most
- [ ] **Consistency Scoring**: Rate story consistency across chapters
- [ ] **Gap Analysis**: Identify missing character/location descriptions

---

## 🛠️ Implementation Scripts

### Script 1: Batch Sync Existing Books

```bash
# Create batch sync script
cat > scripts/sync-books-to-codex.js << 'EOF'
import { CodexRagService } from '../src/services/CodexRagService.js';
import { Logger } from '../src/core/Logger.js';
import { Book } from '../models/Book.js';
import mongoose from 'mongoose';

const logger = new Logger('BatchSync');
const codexService = new CodexRagService(logger);

const syncAllBooks = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const books = await Book.find({}).limit(10); // Start with 10 books
    console.log(`Found ${books.length} books to sync`);
    
    for (const book of books) {
      console.log(`\n📖 Syncing: ${book.title}`);
      
      const result = await codexService.syncBookToCodex(
        book._id.toString(),
        'batch-sync'
      );
      
      console.log(`  ✅ Synced: ${result.syncedElements} elements`);
      if (result.errors.length > 0) {
        console.log(`  ⚠️  Errors: ${result.errors.length}`);
        result.errors.forEach(err => console.log(`    - ${err}`));
      }
    }
    
    console.log('\n🎉 Batch sync completed!');
  } catch (error) {
    console.error('❌ Batch sync failed:', error);
  } finally {
    await mongoose.disconnect();
  }
};

syncAllBooks();
EOF

# Make executable
chmod +x scripts/sync-books-to-codex.js
```

### Script 2: Test Codex Functionality

```bash
# Create test script
cat > scripts/test-codex.js << 'EOF'
import { CodexRagService } from '../src/services/CodexRagService.js';
import { Logger } from '../src/core/Logger.js';

const logger = new Logger('CodexTest');
const codexService = new CodexRagService(logger);

const testCodex = async () => {
  // Test health check
  console.log('🔍 Testing Codex health...');
  const health = await codexService.performHealthCheck();
  console.log('Health:', health);
  
  // Test context query
  console.log('\n🔍 Testing context query...');
  const results = await codexService.queryCodexContext(
    'main character',
    'test-book-id',
    { limit: 3 }
  );
  console.log('Query results:', results.length);
  
  // Test reference detection
  console.log('\n🔍 Testing reference detection...');
  const detections = await codexService.detectReferences(
    'Alex walked through the palace gardens with Sarah.',
    'test-book-id',
    'test-conversation'
  );
  console.log('Detections:', detections.length);
};

testCodex();
EOF

chmod +x scripts/test-codex.js
```

---

## 📋 Priority Checklist

### **Immediate (This Week)**
- [ ] **Run batch sync** on existing books to populate RAG
- [ ] **Test context queries** to verify functionality  
- [ ] **Verify reference detection** works correctly
- [ ] **Check RAG API connectivity** and performance

### **Short Term (2-3 Weeks)**
- [ ] **Integrate context sidebar** in BookPreview component
- [ ] **Add reference highlighting** for character/location mentions
- [ ] **Implement context tooltips** on hover
- [ ] **Add search interface** for story bible

### **Medium Term (1-2 Months)**
- [ ] **Build visual story bible** with character galleries
- [ ] **Create timeline visualization** with interactive events
- [ ] **Implement relationship graphs** for character connections
- [ ] **Add advanced analytics** for story consistency

### **Long Term (3+ Months)**
- [ ] **Cross-book references** for series and shared universes
- [ ] **AI-powered suggestions** based on context
- [ ] **Collaborative editing** with shared story bibles
- [ ] **Export enhanced books** with embedded context

---

## 🎯 Success Metrics

### **Technical Metrics**
- **RAG Response Time**: < 200ms for context queries
- **Sync Success Rate**: > 95% for book-to-RAG sync
- **Reference Detection Accuracy**: > 85% for character/location mentions
- **Storage Efficiency**: < 10MB per book in RAG

### **User Experience Metrics**
- **Context Retrieval Speed**: Instant context display on hover
- **Writing Flow**: No interruption to writing process
- **Consistency Improvement**: Measurable reduction in story inconsistencies
- **User Adoption**: Active use of context features

---

## 🚨 Potential Issues & Solutions

### **RAG Performance Issues**
- **Problem**: Slow context queries
- **Solution**: Implement caching layer, optimize embeddings
- **Monitoring**: Track query response times

### **Reference Detection False Positives**
- **Problem**: Detecting common words as character names
- **Solution**: Improve confidence scoring, maintain exclusion lists
- **Enhancement**: Use NLP for better context understanding

### **Data Synchronization**
- **Problem**: Story elements out of sync with RAG
- **Solution**: Implement real-time sync triggers, periodic validation
- **Backup**: Manual resync functionality

### **Storage Costs**
- **Problem**: Large RAG storage requirements
- **Solution**: Compression, selective syncing, archive old versions
- **Optimization**: Smart chunking strategies

---

The Codex system is now **foundation-ready**! Focus on **Phase 2** to populate the RAG database, then **Phase 3** for UI integration to deliver the complete NovelCrafter-like experience.
