import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface ExportVersion {
  filename: string;
  exportUrl: string;
  timestamp: string;
  format: string;
  triggerTool?: string;
}

interface BookContextValue {
  selectedBookId: string | null;
  setSelectedBookId: (bookId: string | null) => void;
  selectBook: (bookId: string) => void;
  clearSelection: () => void;
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;
  selectedExportVersion: ExportVersion | null;
  setSelectedExportVersion: (version: ExportVersion | null) => void;
  exportVersions: ExportVersion[];
  addExportVersion: (exportVersion: ExportVersion) => void;
  refreshExports: () => void;
}

const BookContext = createContext<BookContextValue | null>(null);

export function useBookContext() {
  const context = useContext(BookContext);
  if (!context) {
    throw new Error('useBookContext must be used within a BookProvider');
  }
  return context;
}

interface BookProviderProps {
  children: React.ReactNode;
}

export function BookProvider({ children }: BookProviderProps) {
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedExportVersion, setSelectedExportVersion] = useState<ExportVersion | null>(null);
  const [exportVersions, setExportVersions] = useState<ExportVersion[]>([]);

  const selectBook = useCallback((bookId: string) => {
    setSelectedBookId(bookId);
    // Reset preview URL and selected export version when book changes
    setPreviewUrl(null);
    setSelectedExportVersion(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedBookId(null);
    setPreviewUrl(null);
    setSelectedExportVersion(null);
  }, []);

  const addExportVersion = useCallback((exportVersion: ExportVersion) => {
    setExportVersions((prev) => {
      // Add new export and sort by timestamp (newest first)
      const updated = [exportVersion, ...prev];
      return updated.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
    });
  }, []);

  const refreshExports = useCallback(() => {
    // For now, we'll use mock data but this could be enhanced to fetch from an API
    // This function can be called when the user manually refreshes exports
    console.log('Refreshing export versions...');
  }, []);

  // Set up event listener for real-time export updates
  useEffect(() => {
    if (!selectedBookId) return;

    const handleBookUpdates = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'export_ready' && data.bookId === selectedBookId) {
          // New export is ready, add it to the list
          addExportVersion({
            filename: data.filename,
            exportUrl: data.exportUrl,
            timestamp: data.timestamp,
            format: data.format || 'html',
            triggerTool: data.triggerTool,
          });

          // Optionally update the preview URL to show the latest export
          if (data.exportUrl) {
            setPreviewUrl(data.exportUrl);
          }
        }
      } catch (error) {
        console.error('Error parsing book update event:', error);
      }
    };

    // Set up EventSource for real-time updates
    const eventSource = new EventSource(`/api/book-updates/stream/${selectedBookId}`);
    eventSource.addEventListener('message', handleBookUpdates);
    eventSource.addEventListener('error', (error) => {
      console.error('Book updates EventSource error:', error);
    });

    return () => {
      eventSource.close();
    };
  }, [selectedBookId, addExportVersion]);

  const value: BookContextValue = {
    selectedBookId,
    setSelectedBookId,
    selectBook,
    clearSelection,
    previewUrl,
    setPreviewUrl,
    selectedExportVersion,
    setSelectedExportVersion,
    exportVersions,
    addExportVersion,
    refreshExports,
  };

  return <BookContext.Provider value={value}>{children}</BookContext.Provider>;
}
