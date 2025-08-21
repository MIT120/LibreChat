#!/usr/bin/env node

/**
 * Single Book Sync Script - Sync a specific book to Codex RAG system
 * Usage: node sync-book.js [bookId] [conversationId]
 */

import mongoose from 'mongoose';
import { Logger } from '../src/core/Logger.js';
import { CodexRagService } from '../src/services/CodexRagService.js';
import { Book } from '../models/Book.js';
import { CharacterReference } from '../models/NarrativeElements.js';
import { WorldElementReference } from '../models/NarrativeElements.js';
import { TimelineEvent } from '../models/NarrativeElements.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const logger = new Logger('BookSync');
const codexService = new CodexRagService(logger);

/**
 * Get book details with element counts
 */
async function getBookDetails(bookId) {
    try {
        const book = await Book.findById(bookId).lean();
        if (!book) {
            throw new Error(`Book not found: ${bookId}`);
        }
        
        // Count narrative elements
        const [characterCount, worldElementCount, timelineEventCount] = await Promise.all([
            CharacterReference.countDocuments({ bookId }),
            WorldElementReference.countDocuments({ bookId }),
            TimelineEvent.countDocuments({ bookId })
        ]);
        
        return {
            ...book,
            elementCounts: {
                characters: characterCount,
                worldElements: worldElementCount,
                timelineEvents: timelineEventCount,
                total: characterCount + worldElementCount + timelineEventCount
            }
        };
        
    } catch (error) {
        throw new Error(`Failed to get book details: ${error.message}`);
    }
}

/**
 * Show book details before sync
 */
function displayBookInfo(book) {
    console.log('📖 Book Information');
    console.log('-'.repeat(40));
    console.log(`Title: ${book.title || 'Untitled'}`);
    console.log(`ID: ${book._id}`);
    console.log(`Author: ${book.authorId || 'Unknown'}`);
    console.log(`Genre: ${book.genre || 'Not specified'}`);
    console.log(`Status: ${book.status || 'Unknown'}`);
    
    console.log('\n📊 Story Elements');
    console.log('-'.repeat(40));
    console.log(`👤 Characters: ${book.elementCounts.characters}`);
    console.log(`🌍 World Elements: ${book.elementCounts.worldElements}`);
    console.log(`⏰ Timeline Events: ${book.elementCounts.timelineEvents}`);
    console.log(`📝 Total Elements: ${book.elementCounts.total}`);
    
    if (book.elementCounts.total === 0) {
        console.log('\n⚠️  Warning: This book has no story elements to sync.');
        console.log('   Create characters, locations, or events before syncing.');
    }
}

/**
 * List all books for selection
 */
async function listAllBooks() {
    try {
        console.log('📚 Available Books');
        console.log('-'.repeat(50));
        
        const books = await Book.find({}).lean();
        
        if (books.length === 0) {
            console.log('No books found in database.');
            return [];
        }
        
        for (let i = 0; i < books.length; i++) {
            const book = books[i];
            const bookId = book._id.toString();
            
            // Get element counts
            const [characterCount, worldElementCount, timelineEventCount] = await Promise.all([
                CharacterReference.countDocuments({ bookId }),
                WorldElementReference.countDocuments({ bookId }),
                TimelineEvent.countDocuments({ bookId })
            ]);
            
            const totalElements = characterCount + worldElementCount + timelineEventCount;
            
            console.log(`${i + 1}. ${book.title || 'Untitled'}`);
            console.log(`   ID: ${bookId}`);
            console.log(`   Elements: ${totalElements} (${characterCount} chars, ${worldElementCount} world, ${timelineEventCount} events)`);
            console.log(`   Status: ${book.status || 'Unknown'}`);
            console.log('');
        }
        
        return books;
        
    } catch (error) {
        throw new Error(`Failed to list books: ${error.message}`);
    }
}

/**
 * Sync the book to Codex
 */
async function syncBook(bookId, conversationId) {
    try {
        console.log('\n🔄 Starting Codex Sync');
        console.log('-'.repeat(40));
        
        const startTime = Date.now();
        
        console.log(`📡 Syncing to RAG system...`);
        console.log(`🆔 Book ID: ${bookId}`);
        console.log(`💬 Conversation ID: ${conversationId}`);
        
        const result = await codexService.syncBookToCodex(bookId, conversationId);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        console.log('\n📊 Sync Results');
        console.log('-'.repeat(40));
        console.log(`⏱️  Duration: ${duration} seconds`);
        console.log(`📝 Elements Synced: ${result.syncedElements}`);
        console.log(`✅ Success: ${result.success ? 'Yes' : 'No'}`);
        
        if (result.errors.length > 0) {
            console.log(`❌ Errors: ${result.errors.length}`);
            console.log('\nError Details:');
            result.errors.slice(0, 5).forEach((error, index) => {
                console.log(`  ${index + 1}. ${error}`);
            });
            if (result.errors.length > 5) {
                console.log(`  ... and ${result.errors.length - 5} more errors`);
            }
        }
        
        return result;
        
    } catch (error) {
        throw new Error(`Sync failed: ${error.message}`);
    }
}

/**
 * Test the synced data
 */
async function testSyncedData(bookId) {
    try {
        console.log('\n🧪 Testing Synced Data');
        console.log('-'.repeat(40));
        
        // Test a simple query
        const results = await codexService.queryCodexContext('character', bookId, { limit: 3 });
        console.log(`🔍 Query test: Found ${results.length} character-related results`);
        
        if (results.length > 0) {
            console.log(`🏆 Top result: ${results[0].name} (${(results[0].relevance * 100).toFixed(0)}% relevance)`);
        }
        
        // Test reference detection
        const testText = "The main character walked through the castle.";
        const detections = await codexService.detectReferences(testText, bookId, 'test-session');
        console.log(`🎯 Reference test: Found ${detections.length} references in test text`);
        
        console.log('✅ Sync verification completed');
        
    } catch (error) {
        console.log(`⚠️  Sync verification failed: ${error.message}`);
    }
}

/**
 * Main execution function
 */
async function main() {
    console.log('📖 Single Book Codex Sync');
    console.log('==========================\n');
    
    const args = process.argv.slice(2);
    let bookId = args[0];
    let conversationId = args[1] || 'manual-sync-session';
    
    try {
        // Connect to MongoDB
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/librechat');
        console.log('✅ Connected to database\n');
        
        // If no book ID provided, show list
        if (!bookId) {
            const books = await listAllBooks();
            
            if (books.length === 0) {
                console.log('❌ No books available to sync.');
                return;
            }
            
            console.log('Usage: node sync-book.js <bookId> [conversationId]');
            console.log('Copy a book ID from the list above to sync it.\n');
            console.log('Example: node sync-book.js 507f1f77bcf86cd799439011 my-session');
            return;
        }
        
        // Validate book ID format
        if (!mongoose.Types.ObjectId.isValid(bookId)) {
            console.log('❌ Invalid book ID format. Use a valid MongoDB ObjectId.');
            return;
        }
        
        // Get book details
        console.log(`🔍 Loading book: ${bookId}`);
        const book = await getBookDetails(bookId);
        
        // Display book information
        displayBookInfo(book);
        
        if (book.elementCounts.total === 0) {
            console.log('\n🛑 Cannot sync book with no story elements.');
            return;
        }
        
        // Confirm sync
        console.log('\n❓ Ready to sync this book to Codex RAG system?');
        console.log(`   This will create vector embeddings for ${book.elementCounts.total} story elements.`);
        
        if (process.argv.includes('--force')) {
            console.log('🤖 Force flag detected, proceeding automatically...');
        } else {
            console.log('🤖 Use --force flag to skip confirmation, proceeding...');
        }
        
        // Test RAG connectivity first
        console.log('\n🔍 Testing RAG connectivity...');
        const health = await codexService.performHealthCheck();
        
        if (!health.ragApiConnected) {
            throw new Error('RAG API not accessible. Check RAG_API_URL configuration.');
        }
        
        console.log('✅ RAG system is healthy');
        
        // Perform sync
        const result = await syncBook(bookId, conversationId);
        
        if (result.success || result.syncedElements > 0) {
            // Test the synced data
            await testSyncedData(bookId);
            
            console.log('\n🎉 Book sync completed successfully!');
            console.log('\n💡 Next steps:');
            console.log('   - Use query_codex_context MCP tool to search story elements');
            console.log('   - Use detect_story_references to find references in text');
            console.log('   - Use get_element_preview for detailed element information');
        } else {
            console.log('\n❌ Book sync failed or had major errors.');
        }
        
    } catch (error) {
        console.error('\n💥 Sync failed:', error.message);
        process.exit(1);
    } finally {
        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log('\n📡 Disconnected from database');
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n🛑 Sync interrupted by user');
    await mongoose.disconnect();
    process.exit(0);
});

// Run the script
main().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
});
