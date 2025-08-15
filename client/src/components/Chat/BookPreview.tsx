import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw, ExternalLink, Download } from 'lucide-react';
import { Button } from '~/components/ui';
import { useBookContext } from '~/components/SidePanel/Books';
import { useStaticExports } from '~/hooks/useStaticExports';
import { useAuthContext } from '~/hooks/AuthContext';

type BookPreviewProps = {
  className?: string;
};

export default function BookPreview({ className = '' }: BookPreviewProps) {
  const { conversationId } = useParams();
  const { selectedBookId, previewUrl } = useBookContext();
  const { user } = useAuthContext();
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [userSelectedFile, setUserSelectedFile] = useState<string | null>(null);

  // Construct server base URL for static exports
  const serverBase = useMemo(() => {
    if (typeof window !== 'undefined') {
      const { protocol, hostname } = window.location;
      // Use environment variable for port or default to 3080
      const port = process.env.REACT_APP_BACKEND_PORT || '3080';
      return `${protocol}//${hostname}:${port}`;
    }
    return '';
  }, []);

  // Use static exports hook
  const {
    staticExports,
    isLoading: isLoadingStaticExports,
    refresh: refreshStaticExports,
  } = useStaticExports({
    enabled: !!user?.id,
  });

  // Set preview URL based on static exports
  useEffect(() => {
    // Clear any previous errors when trying to load a new preview
    setPreviewError(null);

    if (previewUrl) {
      setCurrentPreviewUrl(previewUrl);
      return;
    }

    // Don't automatically change URL if user has manually selected a file
    if (userSelectedFile) {
      return;
    }

    // Use static exports if available
    if (staticExports.length > 0) {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

      // Look for files that might match this conversation or are recent
      let matchingExport = conversationId
        ? staticExports.find((exp) => exp.filename.includes(conversationId))
        : undefined;

      // If no direct conversation match, try date-based matching
      if (!matchingExport) {
        matchingExport = staticExports.find(
          (exp) => exp.dateCreated === today || exp.dateCreated === yesterday,
        );
      }

      // If still no match, use the most recent file (sorted by filename which includes date)
      if (!matchingExport && staticExports.length > 0) {
        const sortedExports = [...staticExports].sort((a, b) =>
          b.filename.localeCompare(a.filename),
        );
        matchingExport = sortedExports[0];
      }

      if (matchingExport) {
        const staticExportUrl = `${serverBase}/c/exports/${matchingExport.filename}`;
        setCurrentPreviewUrl(staticExportUrl);
      }
    }
  }, [previewUrl, staticExports, conversationId, serverBase, userSelectedFile]);

  // Debug effect to track URL changes
  useEffect(() => {
    console.log('🔄 currentPreviewUrl changed to:', currentPreviewUrl);
  }, [currentPreviewUrl]);

  // Debug effect to track user selection
  useEffect(() => {
    console.log('👤 userSelectedFile changed to:', userSelectedFile);
  }, [userSelectedFile]);

  const handleRefreshPreview = async () => {
    setIsLoading(true);
    try {
      // Clear current preview URL to force reload
      setCurrentPreviewUrl('');

      // Clear user selection to allow automatic URL selection after refresh
      setUserSelectedFile(null);

      // Refresh static exports
      await refreshStaticExports();

      // The useEffect will automatically set the new URL when exports are refreshed
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error refreshing preview:', error);
      setIsLoading(false);
    }
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
        {isLoadingStaticExports && (
          <div className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
            <div className="h-3 w-3 animate-spin rounded-full border border-gray-300 border-t-transparent"></div>
            <span>Loading exports...</span>
          </div>
        )}

        {/* Static Exports Section */}
        {!isLoadingStaticExports && staticExports.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span>📁 Available Exports: {staticExports.length}</span>
              {staticExports[0]?.dateCreated && (
                <>
                  <span>•</span>
                  <span>Latest: {staticExports[0].dateCreated}</span>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {staticExports.map((exp) => {
                const isCurrentlyViewed = currentPreviewUrl.includes(exp.filename);
                return (
                  <button
                    key={exp.filename}
                    onClick={() => {
                      console.log('=== BUTTON CLICKED ===');
                      console.log('Filename:', exp.filename);
                      console.log('Current preview URL before:', currentPreviewUrl);
                      console.log('Server base:', serverBase);

                      setPreviewError(null);

                      // Mark this file as user-selected to prevent automatic URL changes
                      setUserSelectedFile(exp.filename);

                      // Clear current URL first to force iframe reload
                      console.log('Clearing current URL...');
                      setCurrentPreviewUrl('');

                      // Set new URL after a brief delay
                      setTimeout(() => {
                        const fullUrl = `${serverBase}/c/exports/${exp.filename}`;
                        console.log('Constructed URL:', fullUrl);
                        console.log('Setting preview URL to:', fullUrl);
                        setCurrentPreviewUrl(fullUrl);
                      }, 100);
                    }}
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-green-200 dark:hover:bg-green-800 ${
                      isCurrentlyViewed
                        ? 'bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100'
                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    }`}
                    title={`${exp.title || exp.filename} - Click to preview`}
                  >
                    <span>📄</span>
                    <span>{exp.title || exp.filename.replace('.html', '')}</span>
                    {exp.dateCreated && (
                      <span className="text-green-600 dark:text-green-300">{exp.dateCreated}</span>
                    )}
                  </button>
                );
              })}
              {staticExports.length > 4 && (
                <span className="text-xs text-text-secondary">
                  +{staticExports.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* No exports message */}
        {!isLoadingStaticExports && staticExports.length === 0 && conversationId && (
          <div className="mt-2 text-xs text-text-secondary">
            <span>📄 No exports available</span>
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

        {conversationId && (isLoading || isLoadingStaticExports) && (
          <div className="flex h-full items-center justify-center text-gray-500">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-lg">Loading preview...</span>
            </div>
          </div>
        )}

        {conversationId &&
          !isLoading &&
          !isLoadingStaticExports &&
          currentPreviewUrl &&
          !previewError && (
            <div className="h-full w-full">
              <iframe
                key={currentPreviewUrl} // Force re-render when URL changes
                title="book-preview"
                src={currentPreviewUrl}
                className="h-full w-full border-0"
                referrerPolicy="no-referrer"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                style={{ backgroundColor: 'white' }}
                onLoad={() => {
                  setPreviewError(null);
                  console.log('✅ IFRAME LOADED SUCCESSFULLY:', currentPreviewUrl);
                }}
                onError={(e) => {
                  setPreviewError('Failed to load preview');
                  console.error('❌ IFRAME FAILED TO LOAD:', currentPreviewUrl);
                  console.error('Error details:', e);
                }}
              />
            </div>
          )}

        {conversationId && !isLoading && !isLoadingStaticExports && previewError && (
          <div className="flex h-full items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="mb-4 text-6xl">❌</div>
              <h3 className="mb-2 text-xl font-medium text-gray-900 dark:text-gray-100">
                Preview Error
              </h3>
              <p className="mb-4 text-gray-600 dark:text-gray-400">{previewError}</p>
              <Button
                onClick={() => {
                  setPreviewError(null);
                  handleRefreshPreview();
                }}
                className="flex items-center gap-1"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            </div>
          </div>
        )}

        {conversationId &&
          !isLoading &&
          !isLoadingStaticExports &&
          !currentPreviewUrl &&
          !previewError && (
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
