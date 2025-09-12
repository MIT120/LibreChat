/**
 * Utility functions for CSV export functionality
 */

export interface CsvExportData {
    filename: string;
    content: string;
    size: number;
    rowCount: number;
    columnCount: number;
    downloadUrl?: string;
    chatReference?: string;
}

/**
 * Detects if a given object contains CSV export data
 */
export function isCsvExportData(data: any): data is CsvExportData {
    return (
        data &&
        typeof data === 'object' &&
        typeof data.filename === 'string' &&
        typeof data.content === 'string' &&
        typeof data.size === 'number' &&
        typeof data.rowCount === 'number' &&
        typeof data.columnCount === 'number'
    );
}

/**
 * Extracts CSV export data from various possible locations in a response object
 */
export function extractCsvExportData(data: any): CsvExportData | null {
    if (!data || typeof data !== 'object') {
        return null;
    }

    // Direct CSV export data
    if (isCsvExportData(data)) {
        return data;
    }

    // CSV export in csvExport property
    if (data.csvExport && isCsvExportData(data.csvExport)) {
        return data.csvExport;
    }

    // CSV export in result property
    if (data.result && data.result.csvExport && isCsvExportData(data.result.csvExport)) {
        return data.result.csvExport;
    }

    // CSV export in nested structures
    if (data.summary && data.csvExport && isCsvExportData(data.csvExport)) {
        return data.csvExport;
    }

    return null;
}

/**
 * Parses CSV content into headers and rows
 */
export function parseCsvContent(csvContent: string): { headers: string[]; rows: string[][] } {
    if (!csvContent) {
        return { headers: [], rows: [] };
    }

    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
        return { headers: [], rows: [] };
    }

    const headers = parseCsvLine(lines[0]);
    const rows = lines.slice(1).map(line => parseCsvLine(line));

    return { headers, rows };
}

/**
 * Parses a single CSV line, handling quoted values
 */
function parseCsvLine(line: string): string[] {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim().replace(/^"(.*)"$/, '$1'));
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim().replace(/^"(.*)"$/, '$1'));

    return values;
}

/**
 * Formats file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Creates a download link for CSV data
 */
export function downloadCsv(csvData: CsvExportData): void {
    const link = document.createElement('a');

    if (csvData.downloadUrl) {
        // Use the server-provided download URL
        link.setAttribute('href', csvData.downloadUrl);
        link.setAttribute('download', csvData.filename);
    } else {
        // Fallback: create blob from content
        const blob = new Blob([csvData.content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', csvData.filename);

        // Clean up the blob URL after download
        link.addEventListener('click', () => {
            setTimeout(() => URL.revokeObjectURL(url), 100);
        });
    }

    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
