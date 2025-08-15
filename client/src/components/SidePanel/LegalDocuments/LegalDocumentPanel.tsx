import React, { useState, useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import {
  FileText,
  BookOpen,
  Scale,
  Settings,
  Download,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { Button } from '~/components/ui';
import PDFPreviewSidebar from './PDFPreviewSidebar';
import { usePDFSidebar } from '~/hooks/usePDFSidebar';
import { useMCPServerManager } from '~/hooks/MCP/useMCPServerManager';
import { BadgeRowProvider } from '~/Providers';
import store from '~/store';

// Import the book creation panel if it exists
let BookCreationPanel: React.ComponentType<any> | null = null;
try {
  BookCreationPanel = require('../../../components/SidePanel/Books/BookCreationPanel').default;
} catch {
  // Book panel doesn't exist, we'll show a placeholder
}

interface LegalDocumentPanelProps {
  // Add any props needed
}

export default function LegalDocumentPanel(props: LegalDocumentPanelProps) {
  const conversation = useRecoilValue(store.conversationByIndex(0));

  return (
    <BadgeRowProvider conversationId={conversation?.conversationId}>
      <LegalDocumentPanelContent {...props} />
    </BadgeRowProvider>
  );
}

function LegalDocumentPanelContent(props: LegalDocumentPanelProps) {
  const { mcpValues } = useMCPServerManager();
  const [activeView, setActiveView] = useState<'books' | 'legal'>('legal');
  const [exportVersions, setExportVersions] = useState<
    Array<{
      filename: string;
      url: string;
      format: string;
      timestamp: string;
      bookId: string;
    }>
  >([]);

  const {
    isOpen: isPDFSidebarOpen,
    autoExportEnabled,
    currentDocumentData,
    openSidebar: openPDFSidebar,
    closeSidebar: closePDFSidebar,
    toggleAutoExport,
  } = usePDFSidebar();

  // Determine which view to show based on active MCP servers
  useEffect(() => {
    if (mcpValues && mcpValues.length > 0) {
      // Check if legal MCP server is active
      const hasLegalServer = mcpValues.some(
        (server) =>
          server.includes('legal') || server.includes('bulgaria') || server.includes('law'),
      );

      // Check if book creation server is active
      const hasBookServer = mcpValues.some(
        (server) => server.includes('book') || server.includes('creation'),
      );

      // Prioritize legal server if both are active
      if (hasLegalServer) {
        setActiveView('legal');
      } else if (hasBookServer) {
        setActiveView('books');
      }
    }
  }, [mcpValues]);

  // Handle view switching
  const handleViewSwitch = (view: 'books' | 'legal') => {
    setActiveView(view);
    if (view === 'legal' && !isPDFSidebarOpen) {
      openPDFSidebar();
    } else if (view === 'books' && isPDFSidebarOpen) {
      closePDFSidebar();
    }
  };

  const renderViewSelector = () => (
    <div className="border-b border-gray-200 p-4 dark:border-gray-700">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Document Tools</h3>
        <Settings className="h-4 w-4 text-gray-500" />
      </div>

      <div className="flex gap-2">
        <Button
          variant={activeView === 'legal' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleViewSwitch('legal')}
          className="flex flex-1 items-center gap-2"
        >
          <Scale className="h-4 w-4" />
          Legal
        </Button>
        <Button
          variant={activeView === 'books' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleViewSwitch('books')}
          className="flex flex-1 items-center gap-2"
        >
          <BookOpen className="h-4 w-4" />
          Books
        </Button>
      </div>

      {/* Show active MCP servers */}
      {mcpValues && mcpValues.length > 0 && (
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          <div className="mb-1 font-medium">Active MCP Servers:</div>
          <div className="space-y-1">
            {mcpValues.map((server) => (
              <div key={server} className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span>{server}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderLegalView = () => (
    <div className="flex flex-1 flex-col">
      {/* Legal Document Controls */}
      <div className="border-b border-gray-200 p-4 dark:border-gray-700">
        <div className="mb-3 flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <h4 className="font-medium text-gray-900 dark:text-gray-100">Legal Documents</h4>
        </div>

        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={openPDFSidebar}
            className="w-full justify-start"
            disabled={isPDFSidebarOpen}
          >
            <FileText className="mr-2 h-4 w-4" />
            {isPDFSidebarOpen ? 'PDF Panel Open' : 'Open PDF Panel'}
          </Button>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Auto-export</span>
            <button
              onClick={() => toggleAutoExport(!autoExportEnabled)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                autoExportEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                  autoExportEnabled ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Current Document Status */}
      {currentDocumentData && (
        <div className="border-b border-gray-200 bg-blue-50 p-4 dark:border-gray-700 dark:bg-blue-900/20">
          <h5 className="mb-2 text-sm font-medium text-blue-900 dark:text-blue-100">
            Current Document
          </h5>
          <div className="text-xs text-blue-700 dark:text-blue-300">
            <div className="mb-1 flex items-center gap-2">
              <span className="font-medium">Type:</span>
              <span>
                {currentDocumentData.type === 'case_law'
                  ? 'Case Law Analysis'
                  : currentDocumentData.type === 'legal_analysis'
                    ? 'Legal Analysis'
                    : currentDocumentData.type === 'contract'
                      ? 'Contract'
                      : 'Document'}
              </span>
            </div>
            {autoExportEnabled && (
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span>Auto-export enabled</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legal Tools Information */}
      <div className="space-y-3 p-4 text-sm text-gray-600 dark:text-gray-400">
        <div>
          <h5 className="mb-2 font-medium text-gray-900 dark:text-gray-100">
            Available Legal Tools:
          </h5>
          <ul className="space-y-1 text-xs">
            <li>• Case law search with Firecrawl</li>
            <li>• Legal document analysis</li>
            <li>• Contract verification</li>
            <li>• PDF export and management</li>
            <li>• Real-time document updates</li>
          </ul>
        </div>

        <div className="border-t border-gray-200 pt-2 dark:border-gray-700">
          <p className="text-xs">
            Use the chat to search case law, analyze documents, or create contracts. Results will
            automatically appear in the PDF panel when auto-export is enabled.
          </p>
        </div>
      </div>
    </div>
  );

  // Fetch available export versions
  const fetchExportVersions = async () => {
    try {
      // For now, we'll use mock data. In a real implementation, this would fetch from an API
      const mockExports = [
        {
          filename: 'cruel-hearts-preview.html',
          url: '/api/mcp/book-creation/tools/export_book/call',
          format: 'html',
          timestamp: new Date().toISOString(),
          bookId: 'dee1e60a-616e-469f-887f-d3491e11f25b',
        },
        {
          filename: 'cruel-hearts-latest.html',
          url: '/api/mcp/book-creation/tools/export_book/call',
          format: 'html',
          timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          bookId: 'dee1e60a-616e-469f-887f-d3491e11f25b',
        },
      ];
      setExportVersions(mockExports);
    } catch (error) {
      console.error('Failed to fetch export versions:', error);
    }
  };

  // Load export versions when books view is active
  useEffect(() => {
    if (activeView === 'books') {
      fetchExportVersions();
    }
  }, [activeView]);

  const handleExportPreview = async (bookId: string, filename: string) => {
    try {
      // Call the backend API to generate export
      const response = await fetch('/api/mcp/book-creation/tools/export_book/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          arguments: {
            bookId: bookId,
            format: 'html',
            includeMetadata: true,
            aliasFilename: filename,
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Open the exported file in a new tab using the frontend URL
          const exportUrl = `/c/exports/${filename}`;
          window.open(exportUrl, '_blank');
        } else {
          console.error('Export failed:', result.error);
          alert('Export failed: ' + result.error);
        }
      } else {
        console.error('Export request failed:', response.status);
        alert('Export request failed');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export error: ' + error.message);
    }
  };

  const handleDownloadExport = async (bookId: string, filename: string) => {
    try {
      // Call the backend API to generate export
      const response = await fetch('/api/mcp/book-creation/tools/export_book/call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          arguments: {
            bookId: bookId,
            format: 'html',
            includeMetadata: true,
            aliasFilename: filename,
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Download the exported file using the frontend URL
          const exportUrl = `/c/exports/${filename}`;
          const link = document.createElement('a');
          link.href = exportUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          console.error('Export failed:', result.error);
          alert('Export failed: ' + result.error);
        }
      } else {
        console.error('Export request failed:', response.status);
        alert('Export request failed');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Export error: ' + error.message);
    }
  };

  const renderBooksView = () => {
    if (BookCreationPanel) {
      return <BookCreationPanel {...props} />;
    }

    return (
      <div className="flex h-full w-full flex-col">
        {/* Header */}
        <div className="border-b border-border-light bg-surface-secondary px-4 py-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-text-primary" />
            <h2 className="font-semibold text-text-primary">Book Creation</h2>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            Panel not available. Enable book-creation MCP server for full features.
          </p>
        </div>

        {/* Export Versions Section */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <Download className="h-4 w-4" />
              Available Exports
            </h3>
            <Button
              onClick={fetchExportVersions}
              size="sm"
              variant="outline"
              className="flex items-center gap-1 px-2 py-1 text-xs"
              title="Refresh export list"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </Button>
          </div>

          {exportVersions.length === 0 ? (
            <div className="text-center text-gray-500">
              <div className="mb-2 text-4xl">📄</div>
              <p className="text-sm">No exports found</p>
              <p className="text-xs text-gray-400">Create books to see exports here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {exportVersions.map((exportItem, index) => (
                <div
                  key={index}
                  className="rounded-md border border-border-light bg-surface-primary p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3 text-blue-500" />
                        <span className="text-sm font-medium text-text-primary">
                          {exportItem.format.toUpperCase()} Export
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-text-secondary">
                        {exportItem.filename}
                      </p>
                      <p className="mt-0.5 text-xs text-text-secondary">
                        {new Date(exportItem.timestamp).toLocaleDateString()}{' '}
                        {new Date(exportItem.timestamp).toLocaleTimeString()}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-text-secondary">
                        Book: {exportItem.bookId.substring(0, 8)}...
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        onClick={() => handleExportPreview(exportItem.bookId, exportItem.filename)}
                        size="sm"
                        variant="outline"
                        className="px-2 py-1 text-xs"
                        title="Preview export"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      <Button
                        onClick={() => handleDownloadExport(exportItem.bookId, exportItem.filename)}
                        size="sm"
                        variant="outline"
                        className="px-2 py-1 text-xs"
                        title="Download export"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with instructions */}
        <div className="border-t border-border-light bg-surface-secondary p-3">
          <div className="text-xs text-text-secondary">
            <p className="mb-1 font-medium">Available Actions:</p>
            <ul className="space-y-0.5 text-xs">
              <li>• Preview exports in new tab</li>
              <li>• Download HTML/PDF files</li>
              <li>• Access book content directly</li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  // If no MCP servers are active, show selection guide
  if (!mcpValues || mcpValues.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <FileText className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">
          No MCP Servers Active
        </h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Enable MCP servers to access document tools:
        </p>
        <div className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4" />
            <span>mcp-legal-bulgaria - For legal document tools</span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span>book-creation - For book writing tools</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-800">
      {renderViewSelector()}

      {activeView === 'legal' ? renderLegalView() : renderBooksView()}

      {/* PDF Preview Sidebar */}
      <PDFPreviewSidebar
        isOpen={isPDFSidebarOpen}
        onClose={closePDFSidebar}
        currentDocumentData={currentDocumentData}
        autoExportEnabled={autoExportEnabled}
        onAutoExportToggle={toggleAutoExport}
      />
    </div>
  );
}
