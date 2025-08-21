#!/usr/bin/env node

/**
 * Batch Sync Script - Sync all books to Codex RAG system
 * This script extracts existing story data and populates the RAG database
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

const logger = new Logger('BatchSync');
const codexService = new CodexRagService(logger);

// Statistics tracking
const stats = {
    totalBooks: 0,
    syncedBooks: 0,
    failedBooks: 0,
    totalElements: 0,
    syncedElements: 0,
    errors: [],
    startTime: Date.now()
};

/**
 * Get all books with narrative elements
 */
async function getAllBooksWithElements() {
    try {
        console.log('📚 Finding books with story elements...');
        
        // Get all books
        const allBooks = await Book.find({}).lean();
        console.log(`Found ${allBooks.length} total books`);
        
        // Check which books have narrative elements
        const booksWithElements = [];
        
        for (const book of allBooks) {
            const bookId = book._id.toString();
            
            // Count narrative elements for this book
            const [characterCount, worldElementCount, timelineEventCount] = await Promise.all([
                CharacterReference.countDocuments({ bookId }),
                WorldElementReference.countDocuments({ bookId }),
                TimelineEvent.countDocuments({ bookId })
            ]);
            
            const totalElements = characterCount + worldElementCount + timelineEventCount;
            
            if (totalElements > 0) {
                booksWithElements.push({
                    ...book,
                    elementCounts: {
                        characters: characterCount,
                        worldElements: worldElementCount,
                        timelineEvents: timelineEventCount,
                        total: totalElements
                    }
                });
                
                console.log(`  📖 ${book.title}: ${totalElements} elements (${characterCount} chars, ${worldElementCount} world, ${timelineEventCount} events)`);
            }
        }
        
        console.log(`\n✅ Found ${booksWithElements.length} books with story elements`);
        stats.totalBooks = booksWithElements.length;
        
        return booksWithElements;
        
    } catch (error) {
        console.error('❌ Error finding books:', error);
        throw error;
    }
}

/**
 * Sync a single book to Codex
 */
async function syncBookToCodex(book) {
    const bookId = book._id.toString();
    const bookTitle = book.title || 'Untitled Book';
    
    try {
        console.log(`\n📖 Syncing: "${bookTitle}" (${book.elementCounts.total} elements)`);
        console.log(`   Characters: ${book.elementCounts.characters}`);
        console.log(`   World Elements: ${book.elementCounts.worldElements}`);
        console.log(`   Timeline Events: ${book.elementCounts.timelineEvents}`);
        
        // Sync to Codex
        const result = await codexService.syncBookToCodex(bookId, 'batch-sync-session');
        
        if (result.success) {
            console.log(`   ✅ Success: ${result.syncedElements} elements synced`);
            stats.syncedBooks++;
            stats.syncedElements += result.syncedElements;
            stats.totalElements += book.elementCounts.total;
        } else {
            console.log(`   ⚠️  Partial success: ${result.syncedElements} synced, ${result.errors.length} errors`);
            stats.syncedBooks++;
            stats.syncedElements += result.syncedElements;
            stats.totalElements += book.elementCounts.total;
            
            // Log first few errors
            result.errors.slice(0, 3).forEach(error => {
                console.log(`     - ${error}`);
                stats.errors.push(`${bookTitle}: ${error}`);
            });
            
            if (result.errors.length > 3) {
                console.log(`     - ... and ${result.errors.length - 3} more errors`);
            }
        }
        
        return result;
        
    } catch (error) {
        console.error(`   ❌ Failed to sync "${bookTitle}":`, error.message);
        stats.failedBooks++;
        stats.errors.push(`${bookTitle}: ${error.message}`);
        return null;
    }
}

/**
 * Test Codex functionality
 */
async function testCodexFunctionality() {
    try {
        console.log('\n🔍 Testing Codex functionality...');
        
        // Test health check
        const health = await codexService.performHealthCheck();
        console.log(`   Health: ${health.status} (RAG: ${health.ragApiConnected ? 'Connected' : 'Disconnected'})`);
        
        if (!health.ragApiConnected) {
            throw new Error('RAG API is not available. Check RAG_API_URL environment variable.');
        }
        
        // Find a book to test with
        const testBook = await Book.findOne({}).lean();
        if (!testBook) {
            console.log('   ⚠️  No books found for testing');
            return;
        }
        
        const bookId = testBook._id.toString();
        
        // Test context query
        console.log(`   Testing context query with book: ${testBook.title}`);
        const results = await codexService.queryCodexContext('character', bookId, { limit: 3 });
        console.log(`   Query results: ${results.length} items found`);
        
        // Test reference detection
        const testText = "The main character walked through the city.";
        const detections = await codexService.detectReferences(testText, bookId, 'test-session');
        console.log(`   Reference detection: ${detections.length} references found in test text`);
        
        console.log('   ✅ Codex functionality test completed');
        
    } catch (error) {
        console.error('   ❌ Codex test failed:', error.message);
        throw error;
    }
}

/**
 * Print final statistics
 */
function printStatistics() {
    const duration = ((Date.now() - stats.startTime) / 1000).toFixed(1);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 BATCH SYNC STATISTICS');
    console.log('='.repeat(60));
    console.log(`📚 Total Books: ${stats.totalBooks}`);
    console.log(`✅ Successfully Synced: ${stats.syncedBooks}`);
    console.log(`❌ Failed to Sync: ${stats.failedBooks}`);
    console.log(`📝 Total Story Elements: ${stats.totalElements}`);
    console.log(`🔄 Elements Synced to RAG: ${stats.syncedElements}`);
    console.log(`⏱️  Total Duration: ${duration} seconds`);
    
    if (stats.syncedBooks > 0) {
        const avgElementsPerBook = (stats.syncedElements / stats.syncedBooks).toFixed(1);
        console.log(`📈 Average Elements per Book: ${avgElementsPerBook}`);
    }
    
    if (stats.errors.length > 0) {
        console.log(`\n⚠️  ERRORS (${stats.errors.length}):`);
        stats.errors.slice(0, 10).forEach((error, index) => {
            console.log(`   ${index + 1}. ${error}`);
        });
        if (stats.errors.length > 10) {
            console.log(`   ... and ${stats.errors.length - 10} more errors`);
        }
    }
    
    console.log('='.repeat(60));
    
    // Success rate
    if (stats.totalBooks > 0) {
        const successRate = ((stats.syncedBooks / stats.totalBooks) * 100).toFixed(1);
        console.log(`🎯 Success Rate: ${successRate}%`);
    }
    
    if (stats.totalElements > 0) {
        const syncRate = ((stats.syncedElements / stats.totalElements) * 100).toFixed(1);
        console.log(`📊 Element Sync Rate: ${syncRate}%`);
    }
}

/**
 * Main execution function
 */
async function main() {
    try {
        console.log('🚀 Starting Codex RAG Batch Sync');
        console.log('=====================================\n');
        
        // Connect to MongoDB
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/librechat');
        console.log('✅ Connected to database');
        
        // Test Codex functionality first
        await testCodexFunctionality();
        
        // Get all books with story elements
        const books = await getAllBooksWithElements();
        
        if (books.length === 0) {
            console.log('\n📄 No books with story elements found. Nothing to sync.');
            return;
        }
        
        // Confirm before proceeding
        console.log(`\n❓ Ready to sync ${books.length} books to Codex RAG system.`);
        console.log('   This will create vector embeddings for all story elements.');
        console.log('   Continue? (This will take some time for large books)\n');
        
        // For automated execution, skip confirmation
        if (process.argv.includes('--auto')) {
            console.log('🤖 Auto mode enabled, proceeding...');
        } else {
            // In manual mode, you could add readline confirmation here
            console.log('🤖 Proceeding with sync (use --auto flag to confirm automatically)...');
        }
        
        // Sync all books
        console.log('\n🔄 Starting batch sync...');
        
        for (let i = 0; i < books.length; i++) {
            const book = books[i];
            console.log(`\n[${i + 1}/${books.length}] Processing book...`);
            
            await syncBookToCodex(book);
            
            // Add small delay to avoid overwhelming the RAG API
            if (i < books.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        console.log('\n🎉 Batch sync completed!');
        
    } catch (error) {
        console.error('\n💥 Batch sync failed:', error);
        stats.failedBooks = stats.totalBooks - stats.syncedBooks;
        process.exit(1);
    } finally {
        // Print statistics
        printStatistics();
        
        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log('\n📡 Disconnected from database');
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n🛑 Received interrupt signal. Cleaning up...');
    printStatistics();
    await mongoose.disconnect();
    process.exit(0);
});

// Run the script
main().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
});
