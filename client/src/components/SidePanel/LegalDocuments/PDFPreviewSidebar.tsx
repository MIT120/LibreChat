import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Download, Eye, Trash2, FileText, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '~/components/ui';
import { useToastContext } from '~/Providers';

interface PDFDocument {
  filename: string;
  path: string;
  size: number;
  created: Date;
  modified: Date;
  type?: 'case_law' | 'legal_analysis' | 'contract';
  preview?: string;
}

interface PDFPreviewSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentDocumentData?: any;
  autoExportEnabled?: boolean;
  onAutoExportToggle?: (enabled: boolean) => void;
}

export const PDFPreviewSidebar: React.FC<PDFPreviewSidebarProps> = ({
  isOpen,
  onClose,
  currentDocumentData,
  autoExportEnabled = false,
  onAutoExportToggle,
}) => {
  const [pdfDocuments, setPdfDocuments] = useState<PDFDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState<PDFDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { showToast } = useToastContext();

  // Fetch PDF documents list
  const fetchPDFDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // This would normally be an API call to the MCP server
      // For now, we'll simulate the data structure
      const response = await fetch('/api/mcp/legal-documents/pdfs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'list_exported_pdfs',
          arguments: {}
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch PDF documents');
      }

      const data = await response.json();
      
      if (data.content && data.content[0]?.text) {
        // Parse the text response from MCP server
        const pdfList = parsePDFListFromText(data.content[0].text);
        setPdfDocuments(pdfList);
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error('Error fetching PDF documents:', err);
      setError('Failed to load PDF documents');
      showToast({
        title: 'Error',
        description: 'Failed to load PDF documents',
        status: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Parse PDF list from MCP server text response
  const parsePDFListFromText = (text: string): PDFDocument[] => {
    const lines = text.split('\n');
    const pdfs: PDFDocument[] = [];
    let currentPdf: Partial<PDFDocument> = {};

    for (const line of lines) {
      if (line.match(/^\d+\.\s*📄/)) {
        // New PDF entry
        if (currentPdf.filename) {
          pdfs.push(currentPdf as PDFDocument);
        }
        currentPdf = {
          filename: line.replace(/^\d+\.\s*📄\s*/, '').trim()
        };
      } else if (line.includes('💾 Размер:')) {
        const sizeMatch = line.match(/(\d+)\s*KB/);
        if (sizeMatch) {
          currentPdf.size = parseInt(sizeMatch[1]) * 1024;
        }
      } else if (line.includes('📅 Създаден:')) {
        const dateStr = line.replace(/.*📅 Създаден:\s*/, '').trim();
        currentPdf.created = new Date(dateStr);
      } else if (line.includes('🔄 Модифициран:')) {
        const dateStr = line.replace(/.*🔄 Модифициран:\s*/, '').trim();
        currentPdf.modified = new Date(dateStr);
      } else if (line.includes('📍 Път:')) {
        currentPdf.path = line.replace(/.*📍 Път:\s*/, '').trim();
      }
    }

    // Add the last PDF
    if (currentPdf.filename) {
      pdfs.push(currentPdf as PDFDocument);
    }

    return pdfs;
  };

  // Auto-export current document data
  const autoExportDocument = useCallback(async () => {
    if (!currentDocumentData || !autoExportEnabled) return;

    try {
      let exportTool = '';
      let exportArgs: any = {};

      // Determine export type based on document data
      if (currentDocumentData.results && Array.isArray(currentDocumentData.results)) {
        // Case law data
        exportTool = 'export_case_law_to_pdf';
        exportArgs = {
          caseLawData: currentDocumentData,
          title: `Анализ на съдебна практика - ${new Date().toLocaleDateString('bg-BG')}`,
          template: 'professional',
          includeSummary: true,
          includeAnalysis: true
        };
      } else if (currentDocumentData.analysis) {
        // Legal analysis data
        exportTool = 'export_legal_analysis_to_pdf';
        exportArgs = {
          analysisData: currentDocumentData,
          title: `Правен анализ - ${new Date().toLocaleDateString('bg-BG')}`
        };
      } else if (currentDocumentData.content || currentDocumentData.clauses) {
        // Contract data
        exportTool = 'export_contract_to_pdf';
        exportArgs = {
          contractData: currentDocumentData,
          title: `Договор - ${new Date().toLocaleDateString('bg-BG')}`
        };
      }

      if (exportTool) {
        const response = await fetch('/api/mcp/legal-documents/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: exportTool,
            arguments: exportArgs
          })
        });

        if (response.ok) {
          // Refresh the PDF list
          await fetchPDFDocuments();
          showToast({
            title: 'Success',
            description: 'Document exported to PDF automatically',
            status: 'success',
          });
        }
      }
    } catch (err) {
      console.error('Auto-export error:', err);
    }
  }, [currentDocumentData, autoExportEnabled, fetchPDFDocuments, showToast]);

  // Delete PDF document
  const deletePDF = async (filename: string) => {
    try {
      const response = await fetch('/api/mcp/legal-documents/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'delete_exported_pdf',
          arguments: { filename }
        })
      });

      if (response.ok) {
        await fetchPDFDocuments();
        setSelectedPdf(null);
        showToast({
          title: 'Success',
          description: 'PDF document deleted successfully',
          status: 'success',
        });
      } else {
        throw new Error('Failed to delete PDF');
      }
    } catch (err) {
      console.error('Delete error:', err);
      showToast({
        title: 'Error',
        description: 'Failed to delete PDF document',
        status: 'error',
      });
    }
  };

  // Download PDF document
  const downloadPDF = (document: PDFDocument) => {
    const link = document.createElement('a');
    link.href = `/api/mcp/legal-documents/download/${document.filename}`;
    link.download = document.filename;
    link.click();
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  };

  // Get file type icon
  const getFileTypeIcon = (filename: string) => {
    if (filename.includes('case_law')) return '⚖️';
    if (filename.includes('legal_analysis')) return '📋';
    if (filename.includes('contract')) return '📄';
    return '📄';
  };

  // Effect for auto-refresh
  useEffect(() => {
    if (isOpen) {
      fetchPDFDocuments();
      
      // Set up auto-refresh every 30 seconds
      intervalRef.current = setInterval(fetchPDFDocuments, 30000);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isOpen, fetchPDFDocuments]);

  // Effect for auto-export
  useEffect(() => {
    if (autoExportEnabled && currentDocumentData) {
      const debounceTimer = setTimeout(autoExportDocument, 2000);
      return () => clearTimeout(debounceTimer);
    }
  }, [autoExportDocument, autoExportEnabled, currentDocumentData]);

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-800 shadow-xl z-50 flex flex-col border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            PDF Documents
          </h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="p-1"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Auto-export toggle */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Auto-export on changes
          </span>
          <button
            onClick={() => onAutoExportToggle?.(!autoExportEnabled)}
            className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              autoExportEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block w-3 h-3 transform bg-white rounded-full transition-transform ${
                autoExportEnabled ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Automatically export documents when chat makes changes
        </p>
      </div>

      {/* Refresh controls */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Last updated: {lastUpdate.toLocaleTimeString('bg-BG')}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchPDFDocuments}
            disabled={isLoading}
            className="p-1"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* PDF list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && pdfDocuments.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : pdfDocuments.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No PDF documents found</p>
            <p className="text-xs mt-1">Documents will appear here after export</p>
          </div>
        ) : (
          <div className="p-2">
            {pdfDocuments.map((pdf, index) => (
              <div
                key={pdf.filename}
                className={`p-3 mb-2 rounded-lg border transition-colors cursor-pointer ${
                  selectedPdf?.filename === pdf.filename
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
                onClick={() => setSelectedPdf(pdf)}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg">{getFileTypeIcon(pdf.filename)}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {pdf.filename}
                    </h3>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <div>{formatFileSize(pdf.size)}</div>
                      <div>{pdf.created?.toLocaleDateString('bg-BG')}</div>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadPDF(pdf);
                    }}
                    className="p-1 h-6 w-6"
                    title="Download PDF"
                  >
                    <Download className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Open preview in modal or new tab
                      window.open(`/api/mcp/legal-documents/preview/${pdf.filename}`, '_blank');
                    }}
                    className="p-1 h-6 w-6"
                    title="Preview PDF"
                  >
                    <Eye className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Are you sure you want to delete ${pdf.filename}?`)) {
                        deletePDF(pdf.filename);
                      }
                    }}
                    className="p-1 h-6 w-6 text-red-600 hover:text-red-700"
                    title="Delete PDF"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Current document status */}
      {currentDocumentData && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="text-sm">
            <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
              Current Document
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              {currentDocumentData.results ? 'Case Law Analysis' :
               currentDocumentData.analysis ? 'Legal Analysis' :
               currentDocumentData.content ? 'Contract' : 'Document'}
            </div>
            {autoExportEnabled && (
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                ✓ Auto-export enabled
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFPreviewSidebar;
