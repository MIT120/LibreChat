#!/usr/bin/env node

import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Book } from '../models/Book.js';
import { Page } from '../models/Page.js';

async function cleanupDatabase() {
  try {
    // Get connection string from environment or use Docker default
    const mongoUri =
      process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://mongodb:27017/LibreChat';

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    console.log('\n🔧 Starting comprehensive database cleanup...\n');

    // === CLEANUP PAGES ===
    console.log('📄 Checking pages collection...');
    const pagesWithNullPageId = await Page.find({
      $or: [{ pageId: null }, { pageId: { $exists: false } }, { pageId: '' }],
    });

    console.log(`Found ${pagesWithNullPageId.length} pages with null/missing pageId`);

    if (pagesWithNullPageId.length > 0) {
      // Update each page with a new UUID
      for (const page of pagesWithNullPageId) {
        const newPageId = uuidv4();
        await Page.findByIdAndUpdate(page._id, { pageId: newPageId });
        console.log(`  ✓ Updated page ${page._id} with new pageId: ${newPageId}`);
      }
      console.log(`✅ Successfully updated ${pagesWithNullPageId.length} pages`);
    } else {
      console.log('✅ No pages with null pageId found');
    }

    // === CLEANUP BOOKS ===
    console.log('\n📚 Checking books collection...');

    // First, try to remove the orphaned bookId index
    try {
      const db = mongoose.connection.db;
      const booksCollection = db.collection('books');

      // Check if the problematic index exists
      const indexes = await booksCollection.indexes();
      const hasBookIdIndex = indexes.some((index) => index.name === 'bookId_1');

      if (hasBookIdIndex) {
        console.log('🗑️  Removing orphaned bookId index...');
        await booksCollection.dropIndex('bookId_1');
        console.log('✅ Orphaned bookId index removed');
      } else {
        console.log('✅ No orphaned bookId index found');
      }
    } catch (indexError) {
      if (indexError.message.includes('index not found')) {
        console.log('✅ No orphaned bookId index found');
      } else {
        console.log(`⚠️  Could not remove bookId index: ${indexError.message}`);
      }
    }

    // Remove bookId field from any existing documents
    const booksWithBookId = await Book.find({
      $or: [{ bookId: { $exists: true } }, { bookId: null }, { bookId: '' }],
    });

    console.log(`Found ${booksWithBookId.length} books with bookId field`);

    if (booksWithBookId.length > 0) {
      // Remove the bookId field from each book
      for (const book of booksWithBookId) {
        await Book.findByIdAndUpdate(book._id, { $unset: { bookId: 1 } });
        console.log(`  ✓ Removed bookId field from book ${book._id}`);
      }
      console.log(`✅ Successfully cleaned ${booksWithBookId.length} books`);
    } else {
      console.log('✅ No books with bookId field found');
    }

    // === FINAL VERIFICATION ===
    console.log('\n🔍 Verifying cleanup results...');

    // Verify pages
    const remainingNullPages = await Page.find({
      $or: [{ pageId: null }, { pageId: { $exists: false } }, { pageId: '' }],
    });

    // Verify books
    const remainingBooksWithBookId = await Book.find({
      $or: [{ bookId: { $exists: true } }, { bookId: null }, { bookId: '' }],
    });

    if (remainingNullPages.length === 0 && remainingBooksWithBookId.length === 0) {
      console.log('✅ Database cleanup completed successfully!');
      console.log('📊 Summary:');
      console.log(`   • Fixed ${pagesWithNullPageId.length} pages`);
      console.log(`   • Cleaned ${booksWithBookId.length} books`);
      console.log('   • Removed orphaned index');
    } else {
      console.log('⚠️  Warning: Some issues remain:');
      if (remainingNullPages.length > 0) {
        console.log(`   • ${remainingNullPages.length} pages still have null pageId`);
      }
      if (remainingBooksWithBookId.length > 0) {
        console.log(`   • ${remainingBooksWithBookId.length} books still have bookId field`);
      }
    }
  } catch (error) {
    console.error('❌ Database cleanup failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the cleanup if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupDatabase()
    .then(() => {
      console.log('Cleanup process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Cleanup process failed:', error);
      process.exit(1);
    });
}

export { cleanupDatabase };
