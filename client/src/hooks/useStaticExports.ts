import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from 'librechat-data-provider';

export interface StaticExportItem {
  filename: string;
  title?: string;
  dateCreated?: string;
  size?: number;
  url: string;
}

interface UseStaticExportsOptions {
  enabled?: boolean;
}

interface ApiExportFile {
  filename: string;
  size: number;
  created: string;
  modified: string;
  url: string;
  downloadUrl: string;
  directUrl: string;
  accessible: boolean;
}

interface UseStaticExportsResult {
  staticExports: StaticExportItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<any>;
  refresh: () => void;
}

const STATIC_EXPORTS_QUERY_KEY = 'static-exports';

/**
 * Hook to fetch static export files from the exports directory
 */
export function useStaticExports(options: UseStaticExportsOptions = {}): UseStaticExportsResult {
  const { enabled = true } = options;
  
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [STATIC_EXPORTS_QUERY_KEY],
    queryFn: async () => {
      const response = await request.get('/api/exports/static/list');
      return response as { success: boolean; files: ApiExportFile[]; count: number };
    },
    enabled,
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: false,
  });

  // Transform API response into StaticExportItem objects
  const staticExports: StaticExportItem[] = (data?.files || []).map((file: ApiExportFile) => {
    // Extract information from filename
    const titleMatch = file.filename.match(/^(.+?)_\d{4}-\d{2}-\d{2}\.html$/);
    const dateMatch = file.filename.match(/(\d{4}-\d{2}-\d{2})/);
    
    return {
      filename: file.filename,
      title: titleMatch ? titleMatch[1].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : file.filename,
      dateCreated: dateMatch ? dateMatch[1] : undefined,
      url: file.url,
      size: file.size,
    };
  });

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    staticExports,
    isLoading,
    isError,
    error: error as Error | null,
    refetch,
    refresh,
  };
}
