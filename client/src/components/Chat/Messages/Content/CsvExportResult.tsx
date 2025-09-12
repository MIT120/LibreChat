import React from 'react';
import CsvViewer from './CsvViewer';
import { extractCsvExportData } from '~/utils/csvUtils';

interface CsvExportResultProps {
    data: any;
    className?: string;
}

const CsvExportResult: React.FC<CsvExportResultProps> = ({ data, className }) => {
    const csvData = extractCsvExportData(data);

    if (!csvData) {
        return null;
    }

    return (
        <div className={className}>
            <CsvViewer csvData={csvData} />
        </div>
    );
};

export default CsvExportResult;
