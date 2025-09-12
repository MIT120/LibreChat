/**
 * CSV Export Test - Simple test to verify CSV export functionality
 */

import { LookerCsvExportService } from '../services/core/LookerCsvExportService.js';
import { LookerConfig } from '../../types/index.js';

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
    { id: 1, name: 'John Doe', email: 'john@example.com', age: 30, department: 'Engineering' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25, department: 'Marketing' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', age: 35, department: 'Sales' },
    { id: 4, name: 'Alice Brown', email: 'alice@example.com', age: 28, department: 'Engineering' }
];

const sampleQueryResult = {
    data: [
        { timestamp: '2024-01-01T00:00:00Z', consumption_kwh: 150.5, generation_kwh: 75.2, cost_eur: 25.30 },
        { timestamp: '2024-01-01T01:00:00Z', consumption_kwh: 120.3, generation_kwh: 80.1, cost_eur: 20.15 },
        { timestamp: '2024-01-01T02:00:00Z', consumption_kwh: 95.7, generation_kwh: 65.8, cost_eur: 16.20 },
        { timestamp: '2024-01-01T03:00:00Z', consumption_kwh: 110.2, generation_kwh: 70.5, cost_eur: 18.75 }
    ],
    fields: [
        { name: 'timestamp', label: 'Timestamp', type: 'date_time' },
        { name: 'consumption_kwh', label: 'Consumption (kWh)', type: 'number' },
        { name: 'generation_kwh', label: 'Generation (kWh)', type: 'number' },
        { name: 'cost_eur', label: 'Cost (EUR)', type: 'number' }
    ]
};

const sampleElectricityData = [
    { timestamp: '2024-01-01T00:00:00Z', consumption_kwh: 150.5, generation_kwh: 75.2, net_consumption: 75.3, cost_eur: 25.30, carbon_emissions_kg: 12.5 },
    { timestamp: '2024-01-01T01:00:00Z', consumption_kwh: 120.3, generation_kwh: 80.1, net_consumption: 40.2, cost_eur: 20.15, carbon_emissions_kg: 10.2 },
    { timestamp: '2024-01-01T02:00:00Z', consumption_kwh: 95.7, generation_kwh: 65.8, net_consumption: 29.9, cost_eur: 16.20, carbon_emissions_kg: 8.1 },
    { timestamp: '2024-01-01T03:00:00Z', consumption_kwh: 110.2, generation_kwh: 70.5, net_consumption: 39.7, cost_eur: 18.75, carbon_emissions_kg: 9.3 }
];

async function testCsvExport() {
    console.log('🧪 Starting CSV Export Tests...\n');

    const csvService = new LookerCsvExportService(mockLogger, mockConfig);

    try {
        // Test 1: Export table data
        console.log('📊 Test 1: Export Table Data');
        const tableResult = await csvService.exportTableToCsv({
            data: sampleTableData,
            title: 'employee_data',
            description: 'Sample employee data export',
            options: {
                includeHeaders: true,
                delimiter: ',',
                includeMetadata: true
            }
        });

        console.log(`✅ Table export successful:`);
        console.log(`   - Filename: ${tableResult.filename}`);
        console.log(`   - Rows: ${tableResult.rowCount}`);
        console.log(`   - Columns: ${tableResult.columnCount}`);
        console.log(`   - Size: ${tableResult.size} bytes`);
        console.log(`   - Content preview: ${tableResult.content.substring(0, 200)}...`);
        console.log(`   - Download URL: ${tableResult.downloadUrl}`);
        console.log(`   - Chat Reference: ${csvService.createChatReference(tableResult)}`);
        console.log('');

        // Test 2: Export query result
        console.log('📈 Test 2: Export Query Result');
        const queryResult = await csvService.exportQueryResultToCsv({
            queryResult: sampleQueryResult,
            title: 'electricity_consumption_report',
            description: 'Hourly electricity consumption data',
            options: {
                includeHeaders: true,
                delimiter: ',',
                includeMetadata: true
            }
        });

        console.log(`✅ Query result export successful:`);
        console.log(`   - Filename: ${queryResult.filename}`);
        console.log(`   - Rows: ${queryResult.rowCount}`);
        console.log(`   - Columns: ${queryResult.columnCount}`);
        console.log(`   - Size: ${queryResult.size} bytes`);
        console.log(`   - Content preview: ${queryResult.content.substring(0, 200)}...`);
        console.log(`   - Download URL: ${queryResult.downloadUrl}`);
        console.log(`   - Chat Reference: ${csvService.createChatReference(queryResult)}`);
        console.log('');

        // Test 3: Export electricity analysis
        console.log('⚡ Test 3: Export Electricity Analysis');
        const analysisResult = await csvService.exportElectricityAnalysisToCsv(
            sampleElectricityData,
            'electricity_analysis_2024',
            {
                includeHeaders: true,
                delimiter: ',',
                includeMetadata: true
            }
        );

        console.log(`✅ Electricity analysis export successful:`);
        console.log(`   - Filename: ${analysisResult.filename}`);
        console.log(`   - Rows: ${analysisResult.rowCount}`);
        console.log(`   - Columns: ${analysisResult.columnCount}`);
        console.log(`   - Size: ${analysisResult.size} bytes`);
        console.log(`   - Content preview: ${analysisResult.content.substring(0, 200)}...`);
        console.log(`   - Download URL: ${analysisResult.downloadUrl}`);
        console.log(`   - Chat Reference: ${csvService.createChatReference(analysisResult)}`);
        console.log('');

        // Test 4: Test with custom options
        console.log('🔧 Test 4: Custom CSV Options');
        const customResult = await csvService.exportTableToCsv({
            data: sampleTableData,
            title: 'custom_format_test',
            options: {
                delimiter: ';',
                includeHeaders: false,
                includeMetadata: false
            }
        });

        console.log(`✅ Custom format export successful:`);
        console.log(`   - Filename: ${customResult.filename}`);
        console.log(`   - Rows: ${customResult.rowCount}`);
        console.log(`   - Columns: ${customResult.columnCount}`);
        console.log(`   - Size: ${customResult.size} bytes`);
        console.log(`   - Content preview: ${customResult.content.substring(0, 200)}...`);
        console.log('');

        // Test 5: Test empty data
        console.log('📭 Test 5: Empty Data Export');
        const emptyResult = await csvService.exportTableToCsv({
            data: [],
            title: 'empty_data_test',
            options: {
                includeHeaders: true
            }
        });

        console.log(`✅ Empty data export successful:`);
        console.log(`   - Filename: ${emptyResult.filename}`);
        console.log(`   - Rows: ${emptyResult.rowCount}`);
        console.log(`   - Columns: ${emptyResult.columnCount}`);
        console.log(`   - Size: ${emptyResult.size} bytes`);
        console.log(`   - Content: "${emptyResult.content}"`);
        console.log('');

        console.log('🎉 All CSV Export Tests Passed!');
        console.log('\n📋 Summary:');
        console.log('   ✅ Table data export');
        console.log('   ✅ Query result export');
        console.log('   ✅ Electricity analysis export');
        console.log('   ✅ Custom CSV options');
        console.log('   ✅ Empty data handling');
        console.log('   ✅ Download URL generation');
        console.log('   ✅ Chat reference generation');

    } catch (error) {
        console.error('❌ CSV Export Test Failed:', error);
        throw error;
    }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testCsvExport().catch(console.error);
}

export { testCsvExport };
