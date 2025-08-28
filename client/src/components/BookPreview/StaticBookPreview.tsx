/**
 * Static Book Preview - Preview for exported books (HTML, PDF, etc.)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import { Separator } from '~/components/ui/separator';
import { cn } from '~/utils';

// Icons
import {
    ArrowLeft,
    Download,
    ExternalLink,
    FileText,
    AlertTriangle,
    BookOpen,
    Eye,
    Loader2,
} from 'lucide-react';

interface StaticBookPreviewProps {
    className?: string;
}

export default function StaticBookPreview({ className }: StaticBookPreviewProps) {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [bookContent, setBookContent] = useState<string | null>(null);

    // Get parameters from URL
    const exportUrl = searchParams.get('export');
    const bookTitle = searchParams.get('title') || 'Untitled Book';

    // Determine if this is a viewable format
    const isViewable = useMemo(() => {
        if (!exportUrl) return false;
        return exportUrl.toLowerCase().includes('.html') || exportUrl.includes('format=html');
    }, [exportUrl]);

    // Load book content if it's an HTML export
    useEffect(() => {
        if (!exportUrl || !isViewable) return;

        const loadBookContent = async () => {
            setIsLoading(true);
            setError(null);

            try {
                // For HTML exports, we can fetch and display the content
                const response = await fetch(exportUrl);

                if (!response.ok) {
                    throw new Error(`Failed to load book: ${response.status} ${response.statusText}`);
                }

                const htmlContent = await response.text();

                // Clean up the HTML content for display
                // Remove script tags and potentially unsafe content
                const cleanedContent = htmlContent
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/<link[^>]*stylesheet[^>]*>/gi, '')
                    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

                setBookContent(cleanedContent);
            } catch (err) {
                console.error('Failed to load book content:', err);
                setError(err instanceof Error ? err.message : 'Failed to load book content');
            } finally {
                setIsLoading(false);
            }
        };

        loadBookContent();
    }, [exportUrl, isViewable]);

    const handleDownload = () => {
        if (exportUrl) {
            window.open(exportUrl, '_blank');
        }
    };

    const handleGoBack = () => {
        navigate(-1);
    };

    if (!exportUrl) {
        return (
            <div className={cn("flex h-full items-center justify-center", className)}>
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                            No Book Selected
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-gray-600 mb-4">
                            No book export URL was provided. Please select a book from the Books panel.
                        </p>
                        <Button onClick={handleGoBack} variant="outline" className="w-full">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Go Back
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className={cn("flex h-full flex-col", className)}>
            {/* Header */}
            <div className="flex-shrink-0 border-b bg-white p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleGoBack}
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back
                        </Button>
                        <div>
                            <h1 className="text-xl font-semibold">{bookTitle}</h1>
                            <p className="text-sm text-gray-600">Book Preview</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownload}
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                        </Button>
                        {!isViewable && (
                            <Button
                                size="sm"
                                onClick={handleDownload}
                            >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open File
                            </Button>
                        )}
                    </div>
                </div>
            </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="p-4">
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800 mb-1">Error Loading Book</h4>
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-3 text-gray-600">Loading book content...</span>
          </div>
        )}

        {!isViewable && !isLoading && !error && (
          <div className="flex items-center justify-center py-12">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  File Preview Not Available
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  This file format cannot be previewed in the browser. Click the download button to open it with your default application.
                </p>
                <Button onClick={handleDownload} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download & Open
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {isViewable && bookContent && !isLoading && !error && (
          <div className="max-w-4xl mx-auto p-8">
            <div className="prose prose-lg max-w-none">
              <div
                className="book-content"
                dangerouslySetInnerHTML={{ __html: bookContent }}
              />
            </div>
          </div>
        )}

        {isViewable && !bookContent && !isLoading && !error && (
          <div className="flex items-center justify-center py-12">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  No Content Available
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  The book content could not be loaded for preview.
                </p>
                <Button onClick={handleDownload} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download File
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
