import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/Tabs';
import { useGetMessagesByConvoId, useGetStartupConfig } from '~/data-provider';
import { useAuthContext, useLocalize } from '~/hooks';
import { cn } from '~/utils';

type BookCenterProps = {
    className?: string;
    title?: string;
    refreshKey?: number;
};

export default function BookCenter({ className = '', title, refreshKey }: BookCenterProps) {
    const { data: startup } = useGetStartupConfig();
    const { conversationId } = useParams();
    const { token, user } = useAuthContext();
    const localize = useLocalize();

    // Pull raw messages to heuristically detect the current bookId from tool outputs
    const { data: rawMessages } = useGetMessagesByConvoId(conversationId ?? '', {
        select: useCallback((msgs: any[]) => msgs ?? [], []),
        enabled: !!conversationId,
    });

    const serverBase = useMemo(() => {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        const isLocal = host === 'localhost' || host === '127.0.0.1';
        if (startup?.serverDomain) return startup.serverDomain;
        if (isLocal) return 'http://localhost:3080';
        return '';
    }, [startup?.serverDomain]);

    const [resolvedUrl, setResolvedUrl] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'export' | 'images' | 'details'>('export');
    const [bookId, setBookId] = useState<string>('');

    const sanitizeTitle = useCallback((t: string) => {
        return t
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50);
    }, []);

    const dateStr = useCallback((d: Date) => d.toISOString().split('T')[0], []);

    const getCandidates = useCallback((): string[] => {
        const urls: string[] = [];
        if (conversationId) urls.push(`${serverBase}/c/exports/${conversationId}.html`);
        if (title && title.trim()) {
            const safe = sanitizeTitle(title);
            const today = new Date();
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
            urls.push(`${serverBase}/c/exports/${safe}_${dateStr(today)}.html`);
            urls.push(`${serverBase}/c/exports/${safe}_${dateStr(yesterday)}.html`);
        }
        return urls;
    }, [conversationId, serverBase, title, sanitizeTitle, dateStr]);

    const resolveUrl = useCallback(async (): Promise<string> => {
        const controller = new AbortController();
        try {
            const urls = getCandidates();
            for (const url of urls) {
                try {
                    const res = await fetch(url, {
                        method: 'HEAD',
                        signal: controller.signal,
                        credentials: 'include',
                    });
                    if (res.ok) {
                        const busted = `${url}?t=${Date.now()}`;
                        setResolvedUrl(busted);
                        return url;
                    }
                } catch {
                    // try next
                }
            }
            setResolvedUrl('');
            return '';
        } finally {
            controller.abort();
        }
    }, [getCandidates]);

    // Heuristically extract a bookId from recent tool output texts
    useEffect(() => {
        if (!rawMessages || !Array.isArray(rawMessages)) return;
        // Search newest to oldest for an ID line commonly returned by MCP tools
        for (let i = rawMessages.length - 1; i >= 0; i -= 1) {
            const text: string | undefined = rawMessages[i]?.text;
            if (!text) continue;
            // Matches: "- **ID:** <id>" or "ID: <id>"
            const match = text.match(/\bID:\s*([a-zA-Z0-9_-]{6,})/);
            if (match && match[1]) {
                setBookId((prev) => prev || match[1]);
                break;
            }
        }
    }, [rawMessages]);

    // Trigger an on-demand export tied to the current conversation to ensure the iframe has a fresh target
    const triggerExport = useCallback(async () => {
        if (!conversationId || !bookId || !token || !user?.id) return;
        try {
            await fetch(`/api/mcp/book-creation-server/tools/export_book/call`, {
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
        } catch {
            // noop; fallback to resolver will still attempt known filenames
        }
    }, [bookId, conversationId, token, user?.id]);

    // Resolve on mount and when identifiers change
    useEffect(() => {
        resolveUrl();
    }, [resolveUrl]);

    // Burst export + refresh after chat completion (refreshKey change)
    useEffect(() => {
        if (refreshKey == null) return;
        let cancelled = false;
        const run = async () => {
            // Best-effort export to create/refresh the alias file for this conversation
            if (!cancelled) {
                await triggerExport();
            }
            // Try up to 12 times over ~12s to catch freshly written/updated export
            for (let i = 0; i < 12 && !cancelled; i += 1) {
                const found = await resolveUrl();
                if (found) break;
                await new Promise((r) => setTimeout(r, 1000));
            }
        };
        run();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshKey, triggerExport]);

    // Periodic cache-bust to pick up same-file changes
    useEffect(() => {
        if (!resolvedUrl) return;
        const timer = setInterval(() => {
            setResolvedUrl((prev) => (prev ? `${prev.split('?')[0]}?t=${Date.now()}` : prev));
        }, 10000);
        return () => clearInterval(timer);
    }, [resolvedUrl]);

    return (
        <div className={cn('flex h-full w-full flex-col', className)}>
            <div className="flex items-center justify-between border-b border-border-light bg-surface-primary px-3 py-2 text-sm text-text-secondary">
                <div className="font-medium" aria-label="book-viewer">
                    {localize('com_ui_preview')}
                </div>
                <div className="truncate">{resolvedUrl || localize('com_ui_none')}</div>
            </div>
            <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as any)}
                className="flex h-full w-full flex-col"
            >
                <TabsList className="gap-2 px-2 py-2">
                    <TabsTrigger value="export">{localize('com_ui_preview')}</TabsTrigger>
                    <TabsTrigger value="images">{localize('com_ui_files')}</TabsTrigger>
                    <TabsTrigger value="details">{localize('com_ui_dashboard')}</TabsTrigger>
                </TabsList>

                <TabsContent value="export" className="mt-0 flex min-h-0 flex-1 p-0">
                    <div className="min-h-0 w-full flex-1 overflow-hidden bg-white">
                        {resolvedUrl ? (
                            <iframe
                                title="book-export"
                                src={resolvedUrl}
                                className="h-full w-full"
                                referrerPolicy="no-referrer"
                                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center text-text-secondary">
                                {localize('com_ui_empty_category')}
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="images" className="mt-0 min-h-0 flex-1 overflow-auto p-0">
                    <div className="flex h-full items-center justify-center px-4 py-6 text-text-secondary">
                        {localize('com_ui_empty_category')}
                    </div>
                </TabsContent>

                <TabsContent value="details" className="mt-0 min-h-0 flex-1 overflow-auto p-0">
                    <div className="flex h-full items-center justify-center px-4 py-6 text-text-secondary">
                        {localize('com_ui_empty_category')}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
