import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from 'librechat-data-provider';

export interface ExportItem {
  _id: string;
  bookId: string;
  conversationId: string;
  format: string;
  filename: string;
  size: number;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  downloadCount: number;
  lastDownloaded?: string;
  url: string;
  metadata?: any;
}

export interface ExportStats {
  byFormat: Array<{
    _id: string;
    count: number;
    totalSize: number;
    latestVersion: number;
    lastCreated: string;
  }>;
  totals: {
    totalExports: number;
    totalSize: number;
    totalDownloads: number;
  };
}

interface UseExportsOptions {
  conversationId?: string;
  format?: string;
  status?: string;
  limit?: number;
  skip?: number;
  enabled?: boolean;
}

interface UseExportsResult {
  exports: ExportItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<any>;
  refresh: () => void;
  downloadExport: (exportId: string) => void;
  getExportUrl: (exportId: string) => string;
}

const QUERY_KEY_PREFIX = 'exports';

/**
 * Hook to fetch exports for a conversation
 */
export function useExports(options: UseExportsOptions = {}): UseExportsResult {
  const {
    conversationId,
    format,
    status = 'completed',
    limit = 20,
    skip = 0,
    enabled = true,
  } = options;

  const queryClient = useQueryClient();

  const queryKey = [
    QUERY_KEY_PREFIX,
    'conversation',
    conversationId,
    { format, status, limit, skip },
  ];

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!conversationId) {
        return { data: [], pagination: { limit, skip, total: 0 } };
      }

      const params = new URLSearchParams({
        status,
        limit: limit.toString(),
        skip: skip.toString(),
      });

      if (format) {
        params.append('format', format);
      }

      const response = await request.get(
        `/api/exports/conversation/${conversationId}?${params.toString()}`,
      );

      return response as {
        data: ExportItem[];
        pagination: { limit: number; skip: number; total: number };
      };
    },
    enabled: enabled && !!conversationId,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });

  const exports = data?.data || [];

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY_PREFIX] });
  }, [queryClient]);

  const downloadExport = useCallback((exportId: string) => {
    const url = `/api/exports/download/${exportId}`;
    window.open(url, '_blank');
  }, []);

  const getExportUrl = useCallback((exportId: string) => {
    return `/api/exports/download/${exportId}`;
  }, []);

  return {
    exports,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
    refresh,
    downloadExport,
    getExportUrl,
  };
}

/**
 * Hook to fetch export statistics for a conversation
 */
export function useExportStats(conversationId?: string) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [QUERY_KEY_PREFIX, 'stats', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;

      const response = await request.get(`/api/exports/conversation/${conversationId}/stats`);
      return (response as { data: ExportStats }).data;
    },
    enabled: !!conversationId,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });

  return {
    stats: data,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
  };
}

/**
 * Hook to auto-refresh exports when specific events occur
 */
export function useAutoRefreshExports(conversationId?: string) {
  const queryClient = useQueryClient();
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());

  const refreshExports = useCallback(() => {
    if (conversationId) {
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEY_PREFIX, 'conversation', conversationId],
      });
      queryClient.invalidateQueries({
        queryKey: [QUERY_KEY_PREFIX, 'stats', conversationId],
      });
      setLastRefresh(Date.now());
    }
  }, [conversationId, queryClient]);

  // Auto-refresh exports after chat messages (when conversation changes)
  useEffect(() => {
    if (!conversationId) return;

    // Listen for custom events that indicate exports should be refreshed
    const handleExportRefresh = () => {
      refreshExports();
    };

    const handleChatComplete = () => {
      // Delay refresh to allow server processing
      setTimeout(refreshExports, 2000);
    };

    // Custom events
    window.addEventListener('exports:refresh', handleExportRefresh);
    window.addEventListener('chat:complete', handleChatComplete);

    return () => {
      window.removeEventListener('exports:refresh', handleExportRefresh);
      window.removeEventListener('chat:complete', handleChatComplete);
    };
  }, [conversationId, refreshExports]);

  return {
    refreshExports,
    lastRefresh,
  };
}

/**
 * Utility function to trigger export refresh from anywhere in the app
 */
export function triggerExportRefresh() {
  window.dispatchEvent(new CustomEvent('exports:refresh'));
}

/**
 * Utility function to indicate chat completion (trigger export refresh)
 */
export function triggerChatComplete() {
  window.dispatchEvent(new CustomEvent('chat:complete'));
}
