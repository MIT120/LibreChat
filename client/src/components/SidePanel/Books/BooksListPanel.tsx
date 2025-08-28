import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSetRecoilState } from 'recoil';
import { QueryKeys, Constants } from 'librechat-data-provider';
import type { TMessage } from 'librechat-data-provider';
import { Button } from '~/components/ui/Button';
import { Separator } from '~/components/ui/Separator';
import SimpleBadge from '~/components/ui/SimpleBadge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/Tooltip';
import { cn } from '~/utils';
import { useAuthContext } from '~/hooks';
import { useStaticExports } from '~/hooks/useStaticExports';
import store from '~/store';

// Icons
import {
    BookOpen,
    Download,
    Calendar,
    FileText,
    Eye,
    ChevronRight,
    ChevronDown,
    Loader2,
    FolderOpen,
    RefreshCw,
} from 'lucide-react';

interface BooksListPanelProps {
    className?: string;
}

interface ExportedBook {
    id: string;
    title: string;
    filename: string;
    format: string;
    size: number;
    createdAt: string;
    url: string;
    conversationId?: string;
    bookId?: string;
    metadata?: {
        bookTitle?: string;
        bookGenre?: string;
        bookTheme?: string;
    };
}

export default function BooksListPanel({ className }: BooksListPanelProps) {
    const navigate = useNavigate();
    const { user } = useAuthContext();
    const { staticExports, isLoading, refresh } = useStaticExports();

    const [expandedFormats, setExpandedFormats] = useState<string[]>(['html']);
    const [selectedBook, setSelectedBook] = useState<ExportedBook | null>(null);

    const toggleFormat = (format: string) => {
        setExpandedFormats((prev) =>
            prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format],
        );
    };

    const handleBookClick = useCallback((book: ExportedBook) => {
        setSelectedBook(book);

        // If it's an HTML book, we can preview it
        if (book.format === 'html') {
            // Navigate to book preview route with the export ID or URL
            navigate(`/d/books/preview?export=${encodeURIComponent(book.url)}&title=${encodeURIComponent(book.title)}`);
        } else {
            // For other formats, trigger download
            window.open(book.url, '_blank');
        }
    }, [navigate]);

    const handleDownload = useCallback((book: ExportedBook, e: React.MouseEvent) => {
        e.stopPropagation();
        window.open(book.url, '_blank');
    }, []);

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatDate = (dateString: string): string => {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Group exports by format
    const exportsByFormat = staticExports.reduce((acc, exportItem) => {
        const format = 'html'; // Static exports are currently HTML only
        if (!acc[format]) {
            acc[format] = [];
        }
        acc[format].push({
            id: exportItem.filename,
            title: exportItem.title || exportItem.filename.replace(/\.[^/.]+$/, ''),
            filename: exportItem.filename,
            format: format,
            size: exportItem.size || 0,
            createdAt: exportItem.dateCreated || new Date().toISOString(),
            url: exportItem.url,
            conversationId: undefined,
            bookId: undefined,
            metadata: {
                bookTitle: exportItem.title,
            },
        } as ExportedBook);
        return acc;
    }, {} as Record<string, ExportedBook[]>);

    const formatIcons: Record<string, React.ComponentType<any>> = {
        html: FileText,
        pdf: FileText,
        txt: FileText,
        epub: BookOpen,
        docx: FileText,
    };

    const FormatSection = ({
        format,
        books
    }: {
        format: string;
        books: ExportedBook[];
    }) => {
        const isExpanded = expandedFormats.includes(format);
        const Icon = formatIcons[format] || FileText;

        if (books.length === 0) return null;

        return (
            <div className="mb-4">
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        'h-8 w-full justify-start gap-2 text-sm font-medium',
                        'hover:bg-surface-hover text-text-primary',
                    )}
                    onClick={() => toggleFormat(format)}
                >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1 text-left capitalize">{format} Books</span>
                    <SimpleBadge variant="secondary" className="text-xs">
                        {books.length}
                    </SimpleBadge>
                    {isExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                    ) : (
                        <ChevronRight className="h-3 w-3" />
                    )}
                </Button>

                {isExpanded && (
                    <div className="mt-2 space-y-1 pl-6">
                        {books.map((book) => (
                            <BookCard key={book.id} book={book} onClick={handleBookClick} onDownload={handleDownload} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const BookCard = ({
        book,
        onClick,
        onDownload
    }: {
        book: ExportedBook;
        onClick: (book: ExportedBook) => void;
        onDownload: (book: ExportedBook, e: React.MouseEvent) => void;
    }) => {
        const canPreview = book.format === 'html';

        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div
                            className={cn(
                                'group cursor-pointer rounded-md border border-border-light bg-surface-primary p-3',
                                'hover:bg-surface-hover hover:border-border-medium transition-colors',
                            )}
                            onClick={() => onClick(book)}
                        >
                            <div className="flex items-start gap-3">
                                <BookOpen className="h-4 w-4 text-text-secondary flex-shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                    <h4 className="text-sm font-medium text-text-primary truncate">
                                        {book.title}
                                    </h4>
                                    <p className="text-xs text-text-secondary mt-1 truncate">
                                        {book.filename}
                                    </p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3 text-text-tertiary" />
                                            <span className="text-xs text-text-tertiary">
                                                {formatDate(book.createdAt)}
                                            </span>
                                        </div>
                                        <span className="text-xs text-text-tertiary">
                                            {formatFileSize(book.size)}
                                        </span>
                                        {book.metadata?.bookGenre && (
                                            <SimpleBadge variant="outline" className="text-xs">
                                                {book.metadata.bookGenre}
                                            </SimpleBadge>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1">
                                    {canPreview && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onClick(book);
                                            }}
                                        >
                                            <Eye className="h-3 w-3" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={(e) => onDownload(book, e)}
                                    >
                                        <Download className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <div className="text-xs">
                            <div className="font-medium">{book.title}</div>
                            <div className="text-text-secondary">{book.format.toUpperCase()} • {formatFileSize(book.size)}</div>
                            <div className="text-text-tertiary">{formatDate(book.createdAt)}</div>
                            {canPreview && <div className="text-accent-primary mt-1">Click to preview</div>}
                        </div>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    };

    return (
        <div className={cn('flex h-full flex-col bg-surface-primary', className)}>
            {/* Header */}
            <div className="flex-shrink-0 border-b border-border-light p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-text-primary" />
                        <h2 className="text-lg font-semibold text-text-primary">My Books</h2>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={refresh}
                        disabled={isLoading}
                        className="h-6 w-6 p-0"
                    >
                        {isLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <RefreshCw className="h-3 w-3" />
                        )}
                    </Button>
                </div>
                <p className="text-sm text-text-secondary mt-1">
                    Your exported books ready for preview and download
                </p>
            </div>

            {/* Book List */}
            <div className="flex-1 overflow-y-auto p-4">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
                        <span className="ml-2 text-sm text-text-secondary">Loading books...</span>
                    </div>
                ) : Object.keys(exportsByFormat).length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                        <FolderOpen className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                        <p className="text-sm">No exported books found</p>
                        <p className="text-xs text-gray-400 mt-1">
                            Create and export books to see them here
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {Object.entries(exportsByFormat)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([format, books]) => (
                                <FormatSection key={format} format={format} books={books} />
                            ))}
                    </div>
                )}

                {/* Footer Info */}
                {Object.keys(exportsByFormat).length > 0 && (
                    <>
                        <Separator className="my-6" />
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <BookOpen className="h-4 w-4 text-text-tertiary" />
                                <span className="text-sm font-medium text-text-secondary">
                                    {staticExports.length} Book{staticExports.length !== 1 ? 's' : ''} Available
                                </span>
                            </div>
                            <p className="text-xs text-text-tertiary">
                                Click HTML books to preview, or download any format
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
