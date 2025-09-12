import React, { useState, useMemo } from 'react';
import { Download, Eye, EyeOff, Table, FileText } from 'lucide-react';
import { Button } from '~/components/ui/Button';
import { cn } from '~/utils';
import { parseCsvContent, formatFileSize, downloadCsv, type CsvExportData } from '~/utils/csvUtils';

interface CsvViewerProps {
    csvData: CsvExportData;
    className?: string;
}

const CsvViewer: React.FC<CsvViewerProps> = ({ csvData, className }) => {
    const [showPreview, setShowPreview] = useState(false);
    const [previewRows, setPreviewRows] = useState(10);

    // Parse CSV content
    const parsedData = useMemo(() => {
        return parseCsvContent(csvData.content);
    }, [csvData.content]);

    const handleDownload = () => {
        downloadCsv(csvData);
    };

    const displayRows = showPreview ? parsedData.rows.slice(0, previewRows) : parsedData.rows;

    return (
        <div className={cn('rounded-lg border border-border-medium bg-surface-primary-alt p-4', className)}>
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-text-primary" />
                    <div>
                        <h3 className="font-semibold text-text-primary">{csvData.filename}</h3>
                        <p className="text-sm text-text-secondary">
                            {csvData.rowCount} rows × {csvData.columnCount} columns • {formatFileSize(csvData.size)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPreview(!showPreview)}
                        className="flex items-center gap-1"
                    >
                        {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {showPreview ? 'Hide' : 'Preview'}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleDownload}
                        className="flex items-center gap-1"
                    >
                        <Download className="h-4 w-4" />
                        Download
                    </Button>
                </div>
            </div>

            {/* CSV Preview */}
            {showPreview && (
                <div className="mb-4">
                    <div className="overflow-x-auto rounded-lg border border-border-light">
                        <table className="w-full text-sm">
                            <thead className="bg-surface-secondary">
                                <tr>
                                    {parsedData.headers.map((header, index) => (
                                        <th
                                            key={index}
                                            className="border-b border-border-light px-3 py-2 text-left font-medium text-text-primary"
                                        >
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {displayRows.map((row, rowIndex) => (
                                    <tr key={rowIndex} className="hover:bg-surface-secondary/50">
                                        {row.map((cell, cellIndex) => (
                                            <td
                                                key={cellIndex}
                                                className="border-b border-border-light px-3 py-2 text-text-primary"
                                            >
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {parsedData.rows.length > previewRows && (
                        <div className="mt-2 text-center">
                            <p className="text-sm text-text-secondary">
                                Showing {previewRows} of {parsedData.rows.length} rows
                            </p>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setPreviewRows(prev => Math.min(prev + 10, parsedData.rows.length))}
                                className="mt-1"
                            >
                                Show More
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Chat Reference */}
            {csvData.chatReference && (
                <div className="rounded-md bg-surface-secondary p-3">
                    <div className="flex items-start gap-2">
                        <Table className="h-4 w-4 mt-0.5 text-text-secondary" />
                        <div className="text-sm text-text-secondary">
                            <div dangerouslySetInnerHTML={{ __html: csvData.chatReference }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CsvViewer;
