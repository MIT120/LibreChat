import { useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { BookOpen, RefreshCw, Plus, Download, ExternalLink, FileText } from 'lucide-react';
import { Button } from '~/components/ui';
import { useUserBooks, useBookStatusHelpers, useRefreshBooks } from '~/hooks/useBooks';
import { useBookContext } from './BookContext';

type BookCreationPanelProps = {
  className?: string;
};

export default function BookCreationPanel({ className = '' }: BookCreationPanelProps) {
  const { conversationId } = useParams();
  const {
    selectedBookId,
    selectBook,
    setPreviewUrl,
    selectedExportVersion,
    setSelectedExportVersion,
    exportVersions,
  } = useBookContext();

  // Use custom hooks
  const {
    data: books = [],
    isLoading: isLoadingBooks,
    refetch: refetchBooks,
  } = useUserBooks(conversationId);
  const refreshBooks = useRefreshBooks();
  const { getStatusIcon, getStatusColor } = useBookStatusHelpers();

  // Auto-select first book if none selected
  useEffect(() => {
    if (books.length > 0 && !selectedBookId) {
      console.log('BookCreationPanel: Auto-selecting first book:', books[0]._id);
      selectBook(books[0]._id);
    }
  }, [books, selectedBookId, selectBook]);

  const handleRefresh = useCallback(() => {
    refreshBooks();
    refetchBooks();
  }, [refreshBooks, refetchBooks]);

  const handleCreateBook = useCallback(() => {
    // TODO: Implement book creation functionality
    console.log('Create new book');
  }, []);

  const handleBookSelect = useCallback(
    (bookId: string) => {
      selectBook(bookId);
    },
    [selectBook],
  );

  const handlePreviewBook = useCallback(
    async (bookId: string) => {
      selectBook(bookId);
      // Set the preview URL to the default export
      setPreviewUrl('/c/exports/cruel-hearts-preview.html');
    },
    [selectBook, setPreviewUrl],
  );

  const handleExportPreview = useCallback(
    async (url: string, bookId?: string, filename?: string) => {
      // First select the book to ensure proper context
      if (bookId) {
        selectBook(bookId);
      }

      if (url.includes('/api/mcp/') && bookId && filename) {
        // Call backend API to generate export, then set preview URL
        try {
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
              // Set preview URL to the generated export file with cache buster
              setPreviewUrl(`/c/exports/${filename}?t=${Date.now()}`);
            } else {
              console.error('Export failed:', result.error);
            }
          }
        } catch (error) {
          console.error('Export error:', error);
        }
      } else {
        // Direct URL - set as preview URL with cache buster to force reload
        const urlWithCacheBuster = url.includes('?')
          ? `${url}&t=${Date.now()}`
          : `${url}?t=${Date.now()}`;
        setPreviewUrl(urlWithCacheBuster);
      }
    },
    [setPreviewUrl, selectBook],
  );

  const handleDownloadExport = useCallback(
    async (url: string, filename: string, bookId?: string) => {
      if (url.includes('/api/mcp/') && bookId) {
        // Call backend API to generate export, then download
        try {
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
              // Download the generated export file
              const exportUrl = `/c/exports/${filename}`;
              const link = document.createElement('a');
              link.href = exportUrl;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            } else {
              console.error('Export failed:', result.error);
            }
          }
        } catch (error) {
          console.error('Export error:', error);
        }
      } else {
        // Direct URL - download directly
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    },
    [],
  );

  // Set default preview URL when a book is selected
  useEffect(() => {
    if (selectedBookId) {
      // Set the default preview URL when a book is selected
      setPreviewUrl('/c/exports/cruel-hearts-preview.html');
    }
  }, [selectedBookId, setPreviewUrl]);

  return (
    <div className={`flex h-full w-full flex-col ${className}`}>
      {/* Header */}
      <div className="border-b border-border-light bg-surface-secondary px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-text-primary" />
            <h2 className="font-semibold text-text-primary">Book Creation</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCreateBook}
              size="sm"
              variant="outline"
              className="flex items-center gap-1 px-2 py-1 text-xs"
              title="Create new book"
            >
              <Plus className="h-3 w-3" />
              New
            </Button>
            <Button
              onClick={handleRefresh}
              disabled={isLoadingBooks}
              size="sm"
              variant="outline"
              className="flex items-center gap-1 px-2 py-1 text-xs"
              title="Refresh book list"
            >
              <RefreshCw className={`h-3 w-3 ${isLoadingBooks ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Book List */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoadingBooks && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-2 text-text-secondary">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-sm">Loading books...</span>
            </div>
          </div>
        )}

        {!isLoadingBooks && books.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
            <div className="mb-3 text-4xl">📚</div>
            <p className="text-center text-sm font-medium">No books found</p>
            <p className="mt-1 text-center text-xs">Create a book to get started</p>
            <Button
              onClick={handleCreateBook}
              size="sm"
              variant="default"
              className="mt-3 flex items-center gap-1 px-3 py-1 text-xs"
            >
              <Plus className="h-3 w-3" />
              Create Your First Book
            </Button>
          </div>
        )}

        {!isLoadingBooks && books.length > 0 && (
          <div className="space-y-2">
            {books.map((book) => (
              <div
                key={book._id}
                className={`group cursor-pointer rounded-lg border-2 p-3 transition-all duration-200 ${
                  selectedBookId === book._id
                    ? 'border-blue-300 bg-blue-50 shadow-sm dark:border-blue-600 dark:bg-blue-900/20'
                    : 'border-transparent bg-surface-secondary hover:border-gray-200 hover:bg-surface-tertiary hover:shadow-sm'
                }`}
              >
                <div onClick={() => handleBookSelect(book._id)} className="flex items-start gap-2">
                  <span className="text-lg">{getStatusIcon(book.status)}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium text-text-primary">{book.title}</h3>
                    <p className="truncate text-xs text-text-secondary">{book.theme}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`text-xs font-medium ${getStatusColor(book.status)}`}>
                        {book.status}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {book.currentWordCount?.toLocaleString() || 0} words
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-text-secondary">
                      ID: {book._id.substring(0, 8)}...
                    </p>
                  </div>
                </div>

                {/* Action buttons - show on hover or when selected */}
                <div
                  className={`mt-2 flex items-center gap-1 transition-opacity ${
                    selectedBookId === book._id
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreviewBook(book._id);
                    }}
                    size="sm"
                    variant="outline"
                    className="px-2 py-1 text-xs"
                  >
                    Preview
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Implement edit functionality
                      console.log('Edit book:', book._id);
                    }}
                    size="sm"
                    variant="outline"
                    className="px-2 py-1 text-xs"
                  >
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export Versions Section */}
      {selectedBookId && exportVersions.length > 0 && (
        <div className="border-t border-border-light bg-surface-secondary p-3">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-text-primary">
            <Download className="h-4 w-4" />
            Export Versions
          </h3>
          <div className="space-y-2">
            {exportVersions.map((exportItem, index) => (
              <div
                key={index}
                className="rounded-md border border-border-light bg-surface-primary p-2"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3 text-blue-500" />
                      <span className="truncate text-xs font-medium text-text-primary">
                        {exportItem.format.toUpperCase()}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-text-secondary">
                      {new Date(exportItem.timestamp).toLocaleDateString()}{' '}
                      {new Date(exportItem.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      onClick={() => {
                        // Set the selected export version and update preview
                        setSelectedExportVersion(exportItem);
                        handleExportPreview(
                          exportItem.exportUrl,
                          selectedBookId,
                          exportItem.filename,
                        );
                      }}
                      size="sm"
                      variant={
                        selectedExportVersion?.filename === exportItem.filename
                          ? 'default'
                          : 'outline'
                      }
                      className="px-1.5 py-0.5 text-xs"
                      title="Load this version in preview"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                    <Button
                      onClick={() =>
                        handleDownloadExport(
                          exportItem.exportUrl,
                          exportItem.filename,
                          selectedBookId,
                        )
                      }
                      size="sm"
                      variant="outline"
                      className="px-1.5 py-0.5 text-xs"
                      title="Download file"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-border-light bg-surface-secondary p-3">
        <div className="text-xs text-text-secondary">
          <p className="mb-1 font-medium">Available Actions:</p>
          <ul className="space-y-0.5 text-xs">
            <li>• Create and manage books</li>
            <li>• Preview book content</li>
            <li>• Export to various formats</li>
            <li>• Track writing progress</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
