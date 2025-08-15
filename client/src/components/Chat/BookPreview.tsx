import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw, ExternalLink, Download } from 'lucide-react';
import { Button } from '~/components/ui';
import { useBookContext } from '~/components/SidePanel/Books';
import { useExports, useAutoRefreshExports } from '~/hooks/useExports';
import { useAuthContext } from '~/hooks/AuthContext';

type BookPreviewProps = {
  className?: string;
};

export default function BookPreview({ className = '' }: BookPreviewProps) {
  const { conversationId } = useParams();
  const { selectedBookId, previewUrl, selectedExportVersion } = useBookContext();
  const { user } = useAuthContext();
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Use the new exports hook
  const {
    exports: availableExports,
    isLoading: isLoadingExports,
    refresh: refreshExports,
  } = useExports({
    conversationId,
    format: 'html', // Priority for HTML exports in preview
    enabled: !!conversationId && !!user?.id,
  });

  // Auto-refresh exports after chat completion
  useAutoRefreshExports(conversationId);

  // Set preview URL based on available exports
  useEffect(() => {
    if (previewUrl) {
      setCurrentPreviewUrl(previewUrl);
      return;
    }

    // If no specific preview URL is set, use the latest HTML export from the conversation
    if (availableExports.length > 0) {
      const latestHtmlExport = availableExports.find((exp) => exp.format === 'html') || availableExports[0];
      if (latestHtmlExport?.url) {
        setCurrentPreviewUrl(latestHtmlExport.url);
      }
    } else {
      setCurrentPreviewUrl('');
    }
  }, [previewUrl, availableExports]);

  // Set up Server-Sent Events for real-time export updates
  useEffect(() => {
    // Clean up previous connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (!conversationId) {
      return;
    }

    const handleExportUpdate = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        // Handle export ready events
        if (data.type === 'export_ready') {
          console.log('Export update received:', data);

          // Refresh export data using the new hook
          refreshExports();

          // Update preview URL if this is an HTML export
          if (data.format === 'html' && data.exportUrl) {
            setCurrentPreviewUrl(data.exportUrl + '?t=' + Date.now());
          }
        }
      } catch (error) {
        console.error('Error parsing export update event:', error);
      }
    };

    // Set up EventSource for conversation updates (using conversationId instead of bookId)
    const eventSource = new EventSource(`/api/book-updates/stream/${conversationId}`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('message', handleExportUpdate);
    eventSource.addEventListener('error', (error) => {
      console.error('Export updates EventSource error:', error);
    });

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [conversationId, refreshExports]);

  const handleRefreshPreview = async () => {
    setIsLoading(true);

    // Refresh export data using the new hook
    refreshExports();

    // Force iframe reload by changing URL slightly
    const currentUrl = currentPreviewUrl;
    setCurrentPreviewUrl('');
    setTimeout(() => {
      setCurrentPreviewUrl(currentUrl + '?t=' + Date.now());
      setIsLoading(false);
    }, 100);
  };

  const handleOpenInNewTab = () => {
    if (currentPreviewUrl) {
      window.open(currentPreviewUrl, '_blank');
    }
  };

  const handleDownload = () => {
    if (currentPreviewUrl) {
      const link = document.createElement('a');
      link.href = currentPreviewUrl;
      link.download = 'book-preview.html';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className={`flex h-full w-full flex-col ${className}`}>
      {/* Header */}
      <div className="border-b border-border-light bg-surface-secondary px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-text-primary">Book Preview</h2>
            {selectedBookId && (
              <span className="rounded bg-blue-100 px-2 py-1 font-mono text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {selectedBookId.substring(0, 8)}...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentPreviewUrl && (
              <>
                <Button
                  onClick={handleRefreshPreview}
                  disabled={isLoading}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1 px-2 py-1 text-xs"
                  title="Refresh preview"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button
                  onClick={handleOpenInNewTab}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1 px-2 py-1 text-xs"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open
                </Button>
                <Button
                  onClick={handleDownload}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1 px-2 py-1 text-xs"
                  title="Download"
                >
                  <Download className="h-3 w-3" />
                  Download
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Export info */}
        {isLoadingExports && (
          <div className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
            <div className="h-3 w-3 animate-spin rounded-full border border-gray-300 border-t-transparent"></div>
            <span>Loading export history...</span>
          </div>
        )}
        {!isLoadingExports && availableExports.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span>📄 {availableExports.length} export(s) available</span>
              <span>•</span>
              <span>Latest: {new Date(availableExports[0].createdAt).toLocaleString()}</span>
            </div>
            {selectedExportVersion && (
              <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-300">
                <span>🎯 Viewing: {selectedExportVersion.format.toUpperCase()}</span>
                <span>•</span>
                <span>{new Date(selectedExportVersion.timestamp).toLocaleString()}</span>
              </div>
            )}
            {!selectedExportVersion && (
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-300">
                <span>📄 Showing latest export</span>
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {availableExports.slice(0, 5).map((exp) => (
                <span
                  key={exp._id}
                  className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                  title={`${exp.filename} - Version ${exp.version} (${exp.format.toUpperCase()})`}
                >
                  <span>{exp.format.toUpperCase()}</span>
                  <span className="text-blue-600 dark:text-blue-300">v{exp.version}</span>
                </span>
              ))}
              {availableExports.length > 5 && (
                <span className="text-xs text-text-secondary">
                  +{availableExports.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}
        {!isLoadingExports && availableExports.length === 0 && conversationId && (
          <div className="mt-2 text-xs text-text-secondary">
            <span>📄 No exports available for this conversation</span>
          </div>
        )}
      </div>

      {/* Preview Content */}
      <div className="flex-1 bg-white">
        {!conversationId && (
          <div className="flex h-full items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="mb-4 text-6xl">📖</div>
              <h3 className="mb-2 text-xl font-medium text-gray-900 dark:text-gray-100">
                Book Preview
              </h3>
              <p className="mb-4 text-gray-600 dark:text-gray-400">
                Start a conversation to view book exports and previews
              </p>
              <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                <p className="mb-2 font-medium">💡 Quick Tip:</p>
                <p>Book exports from this conversation will appear here automatically when:</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-left">
                  <li>You create or edit books in the chat</li>
                  <li>Export operations complete</li>
                  <li>Generated content is ready for preview</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {conversationId && (isLoading || isLoadingExports) && (
          <div className="flex h-full items-center justify-center text-gray-500">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-lg">Loading preview...</span>
            </div>
          </div>
        )}

        {conversationId && !isLoading && !isLoadingExports && currentPreviewUrl && (
          <div className="h-full w-full">
            <iframe
              key={currentPreviewUrl} // Force re-render when URL changes
              title="book-preview"
              src={currentPreviewUrl}
              className="h-full w-full border-0"
              referrerPolicy="no-referrer"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              style={{ backgroundColor: 'white' }}
            />
          </div>
        )}

        {conversationId && !isLoading && !isLoadingExports && !currentPreviewUrl && (
          <div className="flex h-full items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="mb-4 text-6xl">⚠️</div>
              <h3 className="mb-2 text-xl font-medium text-gray-900 dark:text-gray-100">
                Preview Unavailable
              </h3>
              <p className="mb-4 text-gray-600 dark:text-gray-400">
                No book exports available for this conversation
              </p>
              <Button onClick={handleRefreshPreview} className="flex items-center gap-1">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
