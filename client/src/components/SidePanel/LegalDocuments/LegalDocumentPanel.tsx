import React, { useState, useEffect } from 'react';
import { useRecoilValue } from 'recoil';
import { FileText, BookOpen, Scale, Settings } from 'lucide-react';
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
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
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

  const renderBooksView = () => {
    if (BookCreationPanel) {
      return <BookCreationPanel {...props} />;
    }

    return (
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <BookOpen className="mb-4 h-12 w-12 text-gray-400" />
        <h4 className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">Book Creation</h4>
        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          Book creation panel is not available. Enable the book-creation MCP server to access book
          writing tools.
        </p>
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
