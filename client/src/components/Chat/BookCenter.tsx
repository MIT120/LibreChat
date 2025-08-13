import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGetMessagesByConvoId, useGetStartupConfig } from '~/data-provider';
import { useAuthContext } from '~/hooks';

type BookCenterProps = {
  className?: string;
  title?: string;
  refreshKey?: number;
};

export default function BookCenter({ className = '', refreshKey }: BookCenterProps) {
  const { data: startup } = useGetStartupConfig();
  const { conversationId } = useParams();
  const { token, user } = useAuthContext();

  // Pull raw messages to heuristically detect the current bookId from tool outputs
  const { data: rawMessages } = useGetMessagesByConvoId(conversationId ?? '', {
    select: useCallback((msgs: any[]) => msgs ?? [], []),
    enabled: !!conversationId,
  });

  const serverBase = useMemo(() => {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    let base = '';
    if (startup?.serverDomain) {
      base = startup.serverDomain;
    } else if (isLocal) {
      base = 'http://localhost:3080';
    }
    console.log('BookCenter: Server base URL:', base);
    return base;
  }, [startup?.serverDomain]);

  const [bookId, setBookId] = useState<string>('');
  const [exportUrl, setExportUrl] = useState<string>('');

  // Heuristically extract a bookId from recent tool output texts
  useEffect(() => {
    if (!rawMessages || !Array.isArray(rawMessages)) return;
    for (let i = rawMessages.length - 1; i >= 0; i -= 1) {
      const text: string | undefined = rawMessages[i]?.text;
      if (!text) continue;
      const match = text.match(/\bID:\s*([a-zA-Z0-9_-]{6,})/);
      if (match && match[1]) {
        setBookId((prev) => prev || match[1]);
        break;
      }
    }
  }, [rawMessages]);

  // Get latest export from database
  const getLatestExport = useCallback(async () => {
    if (!bookId || !token || !user?.id || !serverBase) return null;

    try {
      const response = await fetch(`/api/mcp/book-creation-server/tools/get_latest_export/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          arguments: {
            bookId,
            format: 'html',
            authorId: user.id,
          },
        }),
      });

      console.log('BookCenter: Get latest export response:', response);
      if (response.ok) {
        const result = await response.json();
        if (result?.result?.content?.[0]?.text) {
          const exportText = result.result.content[0].text;

          // Try to extract URL first (most reliable)
          const urlMatch = exportText.match(/\*\*URL:\*\*\s*(.+)/);
          if (urlMatch && urlMatch[1]) {
            const url = urlMatch[1].trim();
            // Handle both absolute and relative URLs
            const fullUrl = url.startsWith('http')
              ? `${url}?t=${Date.now()}`
              : `${serverBase}${url}?t=${Date.now()}`;
            console.log('BookCenter: Extracted URL from get_latest_export:', fullUrl);
            return fullUrl;
          }

          // Fallback: Extract filename and build URL
          const filenameMatch = exportText.match(/\*\*Filename:\*\*\s*(.+)/);
          if (filenameMatch && filenameMatch[1]) {
            const filename = filenameMatch[1].trim();
            const fullUrl = `${serverBase}/c/exports/${filename}?t=${Date.now()}`;
            console.log('BookCenter: Built URL from filename (get_latest_export):', fullUrl);
            return fullUrl;
          }

          console.warn(
            'BookCenter: Could not extract URL or filename from get_latest_export response:',
            exportText.substring(0, 200),
          );
        } else {
          console.warn('BookCenter: get_latest_export response missing content:', result);
        }
      }
    } catch (error) {
      console.error('BookCenter: Failed to get latest export', error);
    }
    return null;
  }, [bookId, token, user?.id, serverBase]);

  // Trigger export and get the filename
  const triggerExport = useCallback(async () => {
    if (!conversationId || !bookId || !token || !user?.id || !serverBase) return;

    try {
      const response = await fetch(`/api/mcp/book-creation-server/tools/export_book/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          arguments: {
            bookId,
            format: 'html',
            authorId: user.id,
            includeMetadata: true,
            aliasFilename: `${conversationId}.html`,
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();

        console.log('BookCenter: Export result:', result);

        // Extract URL from the export result
        if (result?.result?.content?.[0]?.text) {
          const exportText = result.result.content[0].text;

          // Try to extract URL first (most reliable)
          const urlMatch = exportText.match(/\*\*URL:\*\*\s*(.+)/);
          if (urlMatch && urlMatch[1]) {
            const url = urlMatch[1].trim();
            // Handle both absolute and relative URLs
            const fullUrl = url.startsWith('http')
              ? `${url}?t=${Date.now()}`
              : `${serverBase}${url}?t=${Date.now()}`;
            console.log('BookCenter: Extracted URL from export_book:', fullUrl);
            setExportUrl(fullUrl);
            return;
          }

          // Fallback: Extract filename and build URL
          const filenameMatch = exportText.match(/\*\*Filename:\*\*\s*(.+)/);
          console.log('BookCenter: Filename match:', filenameMatch);
          if (filenameMatch && filenameMatch[1]) {
            const filename = filenameMatch[1].trim();
            const fullUrl = `${serverBase}/c/exports/${filename}?t=${Date.now()}`;
            console.log('BookCenter: Built URL from filename (export_book):', fullUrl);
            setExportUrl(fullUrl);
            return;
          }

          console.warn(
            'BookCenter: Could not extract URL or filename from export_book response:',
            exportText.substring(0, 200),
          );
        } else {
          console.warn('BookCenter: export_book response missing content:', result);
        }
      }
    } catch (error) {
      console.error('BookCenter: Export error', error);
    }
  }, [bookId, conversationId, token, user?.id, serverBase]);

  // Load export when bookId changes or on refresh
  useEffect(() => {
    // First try to get existing export from database
    getLatestExport().then((url) => {
      if (url) {
        setExportUrl(url);
      } else {
        // No existing export found, trigger a new one
        triggerExport();
      }
    });
  }, [bookId, getLatestExport, triggerExport, refreshKey]);

  return (
    <div className={`flex h-full w-full flex-col ${className}`}>
      {exportUrl ? (
        <iframe
          title="book-export"
          src={exportUrl}
          className="h-full w-full"
          referrerPolicy="no-referrer"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-gray-500">
          {bookId ? 'Generating preview...' : 'No book detected'}
        </div>
      )}
    </div>
  );
}
