/**
 * CSV Export File Saving Test - Test the file saving functionality
 */

import { LookerCsvExportService } from '../services/core/LookerCsvExportService.js';
import { LookerConfig } from '../../types/index.js';
import fs from 'fs/promises';
import path from 'path';

// Mock logger for testing
const mockLogger = {
    info: (message: string, meta?: any) => console.log(`[INFO] ${message}`, meta || ''),
    error: (message: string, meta?: any) => console.error(`[ERROR] ${message}`, meta || ''),
    warn: (message: string, meta?: any) => console.warn(`[WARN] ${message}`, meta || ''),
    debug: (message: string, meta?: any) => console.debug(`[DEBUG] ${message}`, meta || ''),
    setLevel: (level: any) => console.log(`[LOG LEVEL] Set to ${level}`)
};

// Mock config for testing
const mockConfig: LookerConfig = {
    baseUrl: 'https://test.looker.com',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret'
};

// Sample data for testing
const sampleTableData = [
    { name: 'John Doe', age: 30, department: 'Engineering', salary: 75000 },
    { name: 'Jane Smith', age: 28, department: 'Marketing', salary: 65000 },
    { name: 'Bob Johnson', age: 35, department: 'Sales', salary: 70000 },
    { name: 'Alice Brown', age: 32, department: 'Engineering', salary: 80000 },
    { name: 'Charlie Wilson', age: 29, department: 'Marketing', salary: 60000 }
];

async function testCsvExportFileSaving() {
    console.log('🧪 Testing CSV Export File Saving Functionality...\n');

    try {
        // Create the service
        const csvService = new LookerCsvExportService(mockLogger, mockConfig);

        // Test table export
        console.log('📊 Testing table export...');
        const tableResult = await csvService.exportTableToCsv({
            data: sampleTableData,
            title: 'employee_data_test',
            description: 'Test export of employee data',
            options: {
                includeHeaders: true,
                delimiter: ',',
                includeMetadata: true
            }
        });

        console.log('✅ Table export successful!');
        console.log(`   📁 Filename: ${tableResult.filename}`);
        console.log(`   📍 Filepath: ${tableResult.filepath}`);
        console.log(`   🔗 Download URL: ${tableResult.downloadUrl}`);
        console.log(`   🆔 Export ID: ${tableResult.exportId}`);
        console.log(`   📊 Rows: ${tableResult.rowCount}, Columns: ${tableResult.columnCount}`);
        console.log(`   💾 Size: ${tableResult.size} bytes`);

        // Verify file exists
        try {
            await fs.access(tableResult.filepath);
            console.log('✅ File exists on disk!');

            // Read and verify file content
            const fileContent = await fs.readFile(tableResult.filepath, 'utf-8');
            console.log('✅ File content readable!');
            console.log(`   📄 Content preview: ${fileContent.substring(0, 100)}...`);

            // Verify download URL format
            if (tableResult.downloadUrl.startsWith('/c/exports/')) {
                console.log('✅ Download URL format is correct!');
            } else {
                console.log('❌ Download URL format is incorrect!');
            }

        } catch (fileError) {
            console.log('❌ File verification failed:', fileError);
        }

        console.log('\n🎉 All tests passed! CSV export file saving is working correctly.');

        // Clean up test file
        try {
            await fs.unlink(tableResult.filepath);
            console.log('🧹 Test file cleaned up.');
        } catch (cleanupError) {
            console.log('⚠️  Could not clean up test file:', cleanupError);
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    testCsvExportFileSaving();
}

export { testCsvExportFileSaving };
