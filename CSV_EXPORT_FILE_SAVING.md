# CSV Export File Saving Implementation

This document describes the enhanced CSV export functionality that saves files to disk and provides download links, following the same pattern as the book export system.

## 🚀 Features

### File Management
- **Persistent Storage**: CSV files are saved to the `/exports` directory
- **Unique Filenames**: Generated with timestamp and UUID to prevent conflicts
- **Download URLs**: Direct links to download exported files
- **File Metadata**: Complete file information including size, path, and export ID

### Export Types
- **Query Results**: Export any Looker query result to CSV
- **Table Data**: Export structured tabular data to CSV
- **Electricity Analysis**: Export electricity analysis results to CSV
- **Look Exports**: Export saved Looks to CSV format
- **Dashboard Exports**: Export dashboard elements to CSV files

## 📁 File Structure

```
/exports/
├── employee_data_2025-01-27_a1b2c3d4.csv
├── electricity_analysis_2025-01-27_e5f6g7h8.csv
├── looker_report_2025-01-27_i9j0k1l2.csv
└── ...
```

## 🔧 Implementation Details

### Backend Changes

#### 1. LookerCsvExportService Updates
- **File Saving**: Added `saveCsvToFile()` method to write files to disk
- **Directory Management**: Added `ensureExportsDirectory()` to create exports folder
- **Filename Generation**: Added `generateFilename()` with timestamp and UUID
- **Download URLs**: Added `createDownloadUrl()` to generate `/c/exports/` URLs

#### 2. CsvExportResult Interface
```typescript
export interface CsvExportResult {
    filename: string;           // Generated filename
    content: string;           // CSV content
    size: number;              // File size in bytes
    rowCount: number;          // Number of data rows
    columnCount: number;       // Number of columns
    filepath: string;          // Full file path on disk
    downloadUrl: string;       // Download URL for client
    exportId: string;          // Unique export identifier
    metadata?: {               // Optional export metadata
        exportDate: string;
        query?: LookerQuery;
        options: CsvExportOptions;
    };
    chatReference?: string;    // Formatted chat message
}
```

#### 3. Tool Handlers Updates
- **File Integration**: All CSV export tools now save files and return download URLs
- **Chat References**: Enhanced chat messages with download links
- **Error Handling**: Improved error handling for file operations

### Frontend Changes

#### 1. CSV Download Enhancement
- **Server URLs**: Updated `downloadCsv()` to use server-provided download URLs
- **Fallback Support**: Maintains blob download as fallback
- **File Management**: Proper cleanup of temporary URLs

#### 2. Chat Integration
- **Download Links**: CSV exports now include clickable download links
- **File Information**: Display file size, row count, and column count
- **Preview Support**: Maintains existing CSV preview functionality

## 🎯 Usage Examples

### 1. Export Query Result
```typescript
const result = await lookerService.exportQueryResultToCsv({
    queryResult: queryData,
    title: 'sales_report',
    description: 'Monthly sales data',
    options: {
        includeHeaders: true,
        delimiter: ',',
        includeMetadata: true
    }
});

// Result includes:
// - result.filename: "sales_report_2025-01-27_a1b2c3d4.csv"
// - result.filepath: "/path/to/exports/sales_report_2025-01-27_a1b2c3d4.csv"
// - result.downloadUrl: "/c/exports/sales_report_2025-01-27_a1b2c3d4.csv"
// - result.exportId: "unique-export-id"
```

### 2. Export Table Data
```typescript
const result = await lookerService.exportTableToCsv({
    data: [
        { name: 'John', age: 30, department: 'Engineering' },
        { name: 'Jane', age: 28, department: 'Marketing' }
    ],
    title: 'employee_list',
    options: {
        includeHeaders: true,
        delimiter: ','
    }
});
```

### 3. MCP Tool Usage
```json
{
    "name": "looker-export-query-csv",
    "arguments": {
        "model": "metering_data",
        "explore": "billing_measurement_latest_v2",
        "dimensions": ["metering_data.measurement_date"],
        "measures": ["metering_data.consumption_kwh"],
        "title": "energy_consumption_report",
        "options": {
            "includeHeaders": true,
            "delimiter": ","
        }
    }
}
```

## 🔗 Download URLs

### URL Format
- **Pattern**: `/c/exports/{filename}`
- **Example**: `/c/exports/energy_consumption_2025-01-27_a1b2c3d4.csv`

### Server Integration
- **Route**: Uses existing `/api/exports/download/:exportId` endpoint
- **Authentication**: Requires JWT authentication
- **Headers**: Proper Content-Type and Content-Disposition headers
- **Caching**: 1-hour cache for better performance

## 📊 Chat Integration

### CSV Export Messages
When a CSV is exported, the chat displays:
```
📊 CSV Export Ready
✅ 150 rows × 5 columns
📁 File: energy_consumption_2025-01-27_a1b2c3d4.csv
💾 Size: 12.5 KB
🔗 Download CSV
```

### Interactive Features
- **Preview Toggle**: Show/hide CSV preview
- **Download Button**: Direct download with proper filename
- **File Information**: Complete file metadata display

## 🧪 Testing

### Test File
Run the test to verify functionality:
```bash
cd api/app/clients/mcp/toki-looker-server
npm test -- CsvExportFileSavingTest
```

### Test Coverage
- ✅ File creation and saving
- ✅ Filename generation
- ✅ Download URL generation
- ✅ File content verification
- ✅ Directory management
- ✅ Error handling

## 🔒 Security Considerations

### File Access
- **Authentication**: All downloads require valid JWT tokens
- **User Isolation**: Users can only access their own exports
- **File Cleanup**: Consider implementing cleanup for old files

### File Validation
- **Content Sanitization**: CSV content is properly escaped
- **Filename Sanitization**: Filenames are sanitized to prevent path traversal
- **Size Limits**: Consider implementing file size limits

## 🚀 Future Enhancements

### Planned Features
- **File Cleanup**: Automatic cleanup of old export files
- **Export History**: Track and manage export history
- **Batch Exports**: Support for multiple file exports
- **Compression**: Optional file compression for large exports
- **Cloud Storage**: Integration with cloud storage providers

### Performance Optimizations
- **Streaming**: Stream large files instead of loading into memory
- **Caching**: Implement file caching for frequently accessed exports
- **Compression**: Add gzip compression for CSV files

## 📝 Migration Notes

### Breaking Changes
- **Interface Updates**: `CsvExportResult` now includes `filepath`, `downloadUrl`, and `exportId`
- **Method Signatures**: Some method signatures have been updated

### Backward Compatibility
- **Fallback Support**: Client-side fallback to blob downloads
- **Optional Fields**: New fields are required but old code will work with type assertions

## 🎉 Conclusion

The CSV export file saving implementation provides a robust, scalable solution for exporting data to CSV files with persistent storage and direct download capabilities. It follows the same patterns as the existing book export system, ensuring consistency and maintainability.

The implementation includes comprehensive error handling, security considerations, and testing coverage, making it production-ready for immediate use.
