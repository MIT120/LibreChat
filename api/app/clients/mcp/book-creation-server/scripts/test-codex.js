#!/usr/bin/env node

/**
 * Codex Test Script - Verify Codex RAG functionality
 * Tests all aspects of the Codex system to ensure proper operation
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

const logger = new Logger('CodexTest');
const codexService = new CodexRagService(logger);

/**
 * Test system health and connectivity
 */
async function testSystemHealth() {
    console.log('🏥 Testing System Health');
    console.log('-'.repeat(40));
    
    try {
        // Test RAG service health
        const health = await codexService.performHealthCheck();
        console.log(`✅ RAG Service: ${health.status}`);
        console.log(`🔗 RAG API Connected: ${health.ragApiConnected ? 'Yes' : 'No'}`);
        
        if (!health.ragApiConnected) {
            console.log(`❌ RAG API URL: ${process.env.RAG_API_URL || 'Not configured'}`);
            throw new Error('RAG API not accessible');
        }
        
        console.log(`🌐 RAG API URL: ${process.env.RAG_API_URL}`);
        
        return true;
    } catch (error) {
        console.error(`❌ Health check failed: ${error.message}`);
        return false;
    }
}

/**
 * Test database connectivity and data
 */
async function testDatabaseContent() {
    console.log('\n📚 Testing Database Content');
    console.log('-'.repeat(40));
    
    try {
        // Count books
        const bookCount = await Book.countDocuments();
        console.log(`📖 Total Books: ${bookCount}`);
        
        // Count narrative elements
        const characterCount = await CharacterReference.countDocuments();
        const worldElementCount = await WorldElementReference.countDocuments();
        const timelineEventCount = await TimelineEvent.countDocuments();
        
        console.log(`👤 Characters: ${characterCount}`);
        console.log(`🌍 World Elements: ${worldElementCount}`);
        console.log(`⏰ Timeline Events: ${timelineEventCount}`);
        
        const totalElements = characterCount + worldElementCount + timelineEventCount;
        console.log(`📊 Total Story Elements: ${totalElements}`);
        
        if (totalElements === 0) {
            console.log('⚠️  No story elements found. Create some characters, locations, or events first.');
            return null;
        }
        
        // Find a book with elements for testing
        const booksWithElements = await Book.aggregate([
            {
                $lookup: {
                    from: 'characterreferences',
                    localField: '_id',
                    foreignField: 'bookId',
                    as: 'characters'
                }
            },
            {
                $lookup: {
                    from: 'worldelementreferences',
                    localField: '_id',
                    foreignField: 'bookId',
                    as: 'worldElements'
                }
            },
            {
                $lookup: {
                    from: 'timelineevents',
                    localField: '_id',
                    foreignField: 'bookId',
                    as: 'timelineEvents'
                }
            },
            {
                $addFields: {
                    totalElements: {
                        $add: [
                            { $size: '$characters' },
                            { $size: '$worldElements' },
                            { $size: '$timelineEvents' }
                        ]
                    }
                }
            },
            {
                $match: { totalElements: { $gt: 0 } }
            },
            {
                $sort: { totalElements: -1 }
            },
            {
                $limit: 1
            }
        ]);
        
        if (booksWithElements.length === 0) {
            console.log('⚠️  No books with story elements found.');
            return null;
        }
        
        const testBook = booksWithElements[0];
        console.log(`🎯 Test Book: "${testBook.title}" (${testBook.totalElements} elements)`);
        
        return testBook;
        
    } catch (error) {
        console.error(`❌ Database test failed: ${error.message}`);
        return null;
    }
}

/**
 * Test Codex sync functionality
 */
async function testCodexSync(testBook) {
    console.log('\n🔄 Testing Codex Sync');
    console.log('-'.repeat(40));
    
    try {
        const bookId = testBook._id.toString();
        
        console.log(`📖 Syncing book: ${testBook.title}`);
        console.log(`🆔 Book ID: ${bookId}`);
        
        const result = await codexService.syncBookToCodex(bookId, 'test-session');
        
        if (result.success) {
            console.log(`✅ Sync successful: ${result.syncedElements} elements synced`);
            return result.syncedElements > 0;
        } else {
            console.log(`⚠️  Partial sync: ${result.syncedElements} synced, ${result.errors.length} errors`);
            result.errors.slice(0, 3).forEach(error => {
                console.log(`   ❌ ${error}`);
            });
            return result.syncedElements > 0;
        }
        
    } catch (error) {
        console.error(`❌ Sync test failed: ${error.message}`);
        return false;
    }
}

/**
 * Test context querying
 */
async function testContextQuery(testBook) {
    console.log('\n🔍 Testing Context Queries');
    console.log('-'.repeat(40));
    
    const bookId = testBook._id.toString();
    
    // Test queries
    const queries = [
        { query: 'character', description: 'Character search' },
        { query: 'main character', description: 'Main character search' },
        { query: 'location', description: 'Location search' },
        { query: 'palace castle', description: 'Specific location search' },
        { query: 'event battle', description: 'Event search' },
        { query: 'relationship love', description: 'Relationship search' }
    ];
    
    let successfulQueries = 0;
    
    for (const { query, description } of queries) {
        try {
            console.log(`🔎 ${description}: "${query}"`);
            
            const results = await codexService.queryCodexContext(query, bookId, {
                limit: 3,
                minRelevance: 0.5
            });
            
            console.log(`   📊 Results: ${results.length} items found`);
            
            if (results.length > 0) {
                successfulQueries++;
                const topResult = results[0];
                console.log(`   🏆 Top result: ${topResult.name} (${(topResult.relevance * 100).toFixed(0)}% relevance)`);
            } else {
                console.log(`   ⭕ No results found`);
            }
            
        } catch (error) {
            console.error(`   ❌ Query failed: ${error.message}`);
        }
    }
    
    console.log(`\n📈 Query Success Rate: ${successfulQueries}/${queries.length} (${(successfulQueries/queries.length*100).toFixed(0)}%)`);
    
    return successfulQueries > 0;
}

/**
 * Test reference detection
 */
async function testReferenceDetection(testBook) {
    console.log('\n🎯 Testing Reference Detection');
    console.log('-'.repeat(40));
    
    const bookId = testBook._id.toString();
    
    // Test texts with potential references
    const testTexts = [
        "The main character walked through the castle gardens.",
        "Alex met with the king in the throne room.",
        "The protagonist visited the ancient library.",
        "In the market square, Sarah bought some apples.",
        "The battle at the fortress was fierce and bloody.",
        "During the festival, everyone celebrated in the town center."
    ];
    
    let totalDetections = 0;
    
    for (let i = 0; i < testTexts.length; i++) {
        const text = testTexts[i];
        console.log(`📝 Text ${i + 1}: "${text}"`);
        
        try {
            const detections = await codexService.detectReferences(text, bookId, 'test-session');
            
            console.log(`   🎯 Detections: ${detections.length}`);
            totalDetections += detections.length;
            
            detections.forEach(detection => {
                console.log(`     - "${detection.text}" (${detection.type}, ${(detection.confidence * 100).toFixed(0)}% confidence)`);
            });
            
            if (detections.length === 0) {
                console.log(`     ⭕ No references detected`);
            }
            
        } catch (error) {
            console.error(`   ❌ Detection failed: ${error.message}`);
        }
    }
    
    console.log(`\n📊 Total Detections: ${totalDetections} across ${testTexts.length} texts`);
    console.log(`📈 Average Detections per Text: ${(totalDetections / testTexts.length).toFixed(1)}`);
    
    return totalDetections > 0;
}

/**
 * Test element preview functionality
 */
async function testElementPreview(testBook) {
    console.log('\n👁️  Testing Element Previews');
    console.log('-'.repeat(40));
    
    const bookId = testBook._id.toString();
    
    // Get sample elements to test
    const [sampleCharacter, sampleWorldElement, sampleEvent] = await Promise.all([
        CharacterReference.findOne({ bookId }).lean(),
        WorldElementReference.findOne({ bookId }).lean(),
        TimelineEvent.findOne({ bookId }).lean()
    ]);
    
    const testElements = [
        { element: sampleCharacter, type: 'character', name: sampleCharacter?.coreIdentity?.name },
        { element: sampleWorldElement, type: 'world_element', name: sampleWorldElement?.name },
        { element: sampleEvent, type: 'timeline_event', name: sampleEvent?.name }
    ].filter(test => test.element && test.name);
    
    let successfulPreviews = 0;
    
    for (const { name, type } of testElements) {
        try {
            console.log(`🔍 Testing preview for ${type}: "${name}"`);
            
            const results = await codexService.queryCodexContext(name, bookId, {
                limit: 1,
                types: [type],
                minRelevance: 0.3
            });
            
            if (results.length > 0) {
                const preview = results[0];
                console.log(`   ✅ Found: ${(preview.relevance * 100).toFixed(0)}% relevance`);
                console.log(`   📝 Summary: ${preview.summary.substring(0, 100)}...`);
                successfulPreviews++;
            } else {
                console.log(`   ⭕ No preview found`);
            }
            
        } catch (error) {
            console.error(`   ❌ Preview failed: ${error.message}`);
        }
    }
    
    console.log(`\n📈 Preview Success Rate: ${successfulPreviews}/${testElements.length} (${testElements.length > 0 ? (successfulPreviews/testElements.length*100).toFixed(0) : 0}%)`);
    
    return successfulPreviews > 0;
}

/**
 * Print test summary
 */
function printTestSummary(results) {
    console.log('\n' + '='.repeat(50));
    console.log('📊 CODEX TEST SUMMARY');
    console.log('='.repeat(50));
    
    const tests = [
        { name: 'System Health', passed: results.health },
        { name: 'Database Content', passed: results.database !== null },
        { name: 'Codex Sync', passed: results.sync },
        { name: 'Context Queries', passed: results.query },
        { name: 'Reference Detection', passed: results.detection },
        { name: 'Element Previews', passed: results.preview }
    ];
    
    tests.forEach(test => {
        const status = test.passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${test.name}`);
    });
    
    const passedTests = tests.filter(test => test.passed).length;
    const totalTests = tests.length;
    const successRate = (passedTests / totalTests * 100).toFixed(0);
    
    console.log('\n' + '-'.repeat(50));
    console.log(`🎯 Overall Success Rate: ${passedTests}/${totalTests} (${successRate}%)`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! Codex is ready for use.');
    } else if (passedTests >= totalTests * 0.8) {
        console.log('⚠️  Most tests passed. Minor issues may exist.');
    } else {
        console.log('❌ Multiple test failures. Check configuration and dependencies.');
    }
    
    console.log('='.repeat(50));
}

/**
 * Main test execution
 */
async function main() {
    console.log('🧪 Codex RAG System Test Suite');
    console.log('===============================\n');
    
    const results = {
        health: false,
        database: null,
        sync: false,
        query: false,
        detection: false,
        preview: false
    };
    
    try {
        // Connect to MongoDB
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/librechat');
        console.log('✅ Connected to database\n');
        
        // Run tests in sequence
        results.health = await testSystemHealth();
        
        if (results.health) {
            results.database = await testDatabaseContent();
            
            if (results.database) {
                results.sync = await testCodexSync(results.database);
                
                if (results.sync) {
                    results.query = await testContextQuery(results.database);
                    results.detection = await testReferenceDetection(results.database);
                    results.preview = await testElementPreview(results.database);
                }
            }
        }
        
        // Print summary
        printTestSummary(results);
        
    } catch (error) {
        console.error('\n💥 Test suite failed:', error);
        process.exit(1);
    } finally {
        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log('\n📡 Disconnected from database');
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n🛑 Test interrupted by user');
    await mongoose.disconnect();
    process.exit(0);
});

// Run the test suite
main().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
});
