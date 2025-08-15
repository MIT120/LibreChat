import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthContext } from '~/hooks';
import { bookService } from '~/services/bookService';
import type { Book, ExportBookRequest, BookExportInfo } from '~/types/books';

// Query Keys
export const BOOK_QUERY_KEYS = {
  all: ['books'] as const,
  lists: () => [...BOOK_QUERY_KEYS.all, 'list'] as const,
  list: (authorId: string) => [...BOOK_QUERY_KEYS.lists(), authorId] as const,
  exports: () => [...BOOK_QUERY_KEYS.all, 'export'] as const,
  export: (bookId: string, format: string) =>
    [...BOOK_QUERY_KEYS.exports(), bookId, format] as const,
} as const;

/**
 * Hook to fetch user books
 */
export const useUserBooks = (conversationId?: string, options?: { enabled?: boolean }) => {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: BOOK_QUERY_KEYS.list(user?.id || ''),
    queryFn: () =>
      bookService.listUserBooks({
        authorId: user?.id || '',
        conversationId: conversationId || 'default',
      }),
    enabled: !!user?.id && !!conversationId && options?.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Hook to get latest export for a book
 */
export const useLatestExport = (
  bookId: string,
  format: 'html' | 'pdf' | 'docx' = 'html',
  options?: { enabled?: boolean },
) => {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: BOOK_QUERY_KEYS.export(bookId, format),
    queryFn: () =>
      bookService.getLatestExport({
        bookId,
        format,
        authorId: user?.id || '',
      }),
    enabled: !!user?.id && !!bookId && options?.enabled !== false,
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to export a book
 */
export const useExportBook = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: (params: Omit<ExportBookRequest, 'authorId'>) =>
      bookService.exportBook({
        ...params,
        authorId: user?.id || '',
      }),
    onSuccess: (data, variables) => {
      // Invalidate the export cache for this book
      queryClient.invalidateQueries({
        queryKey: BOOK_QUERY_KEYS.export(variables.bookId, variables.format),
      });
    },
  });
};

/**
 * Hook to refresh user books
 */
export const useRefreshBooks = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  return useCallback(() => {
    if (user?.id) {
      queryClient.invalidateQueries({
        queryKey: BOOK_QUERY_KEYS.list(user.id),
      });
    }
  }, [queryClient, user?.id]);
};

/**
 * Hook for book export URL management
 */
export const useBookExportUrl = (bookId: string, conversationId?: string) => {
  const { user } = useAuthContext();
  const { data: latestExport } = useLatestExport(bookId);
  const exportMutation = useExportBook();

  const serverBase = useMemo(() => {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const isLocal = host === 'localhost' || host === '127.0.0.1';

    if (isLocal) {
      return 'http://localhost:3080';
    }

    return '';
  }, []);

  const buildFullUrl = useCallback(
    (exportInfo: BookExportInfo | null): string | null => {
      if (!exportInfo || !serverBase) return null;

      // Use URL if available
      if (exportInfo.url) {
        const url = exportInfo.url.trim();
        return url.startsWith('http')
          ? `${url}?t=${Date.now()}`
          : `${serverBase}${url}?t=${Date.now()}`;
      }

      // Fallback to filename
      if (exportInfo.filename) {
        const filename = exportInfo.filename.trim();
        return `${serverBase}/c/exports/${filename}?t=${Date.now()}`;
      }

      return null;
    },
    [serverBase],
  );

  const getOrCreateExportUrl = useCallback(async (): Promise<string | null> => {
    if (!bookId || !user?.id) return null;

    // First try to get existing export
    if (latestExport) {
      const url = buildFullUrl(latestExport);
      if (url) return url;
    }

    // No existing export found, trigger a new one
    try {
      const newExport = await exportMutation.mutateAsync({
        bookId,
        format: 'html',
        includeMetadata: true,
        aliasFilename: conversationId ? `${conversationId}.html` : undefined,
      });

      return buildFullUrl(newExport);
    } catch (error) {
      console.error('Failed to create export:', error);
      return null;
    }
  }, [bookId, user?.id, latestExport, buildFullUrl, exportMutation, conversationId]);

  const exportUrl = useMemo(() => {
    return buildFullUrl(latestExport || null);
  }, [latestExport, buildFullUrl]);

  return {
    exportUrl,
    getOrCreateExportUrl,
    isCreatingExport: exportMutation.isLoading,
    createExportError: exportMutation.error,
  };
};

/**
 * Utility functions for book status
 */
export const useBookStatusHelpers = () => {
  const getStatusIcon = useCallback((status: Book['status']): string => {
    switch (status) {
      case 'planning':
        return '📋';
      case 'outlining':
        return '📝';
      case 'writing':
        return '✍️';
      case 'editing':
        return '✏️';
      case 'review':
        return '👀';
      case 'completed':
        return '✅';
      case 'published':
        return '📖';
      default:
        return '📚';
    }
  }, []);

  const getStatusColor = useCallback((status: Book['status']): string => {
    switch (status) {
      case 'planning':
        return 'text-blue-600';
      case 'outlining':
        return 'text-purple-600';
      case 'writing':
        return 'text-orange-600';
      case 'editing':
        return 'text-yellow-600';
      case 'review':
        return 'text-indigo-600';
      case 'completed':
        return 'text-green-600';
      case 'published':
        return 'text-emerald-600';
      default:
        return 'text-gray-600';
    }
  }, []);

  return {
    getStatusIcon,
    getStatusColor,
  };
};
