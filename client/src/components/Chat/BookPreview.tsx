import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw, ExternalLink, Download, Edit, Eye, Save, MessageSquare, Loader2, CheckCircle, X, AlertCircle } from 'lucide-react';
import { Button } from '~/components/ui';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/Dialog';
import { Input } from '~/components/ui/Input';
import { Textarea } from '~/components/ui/Textarea';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { useBookContext } from '~/components/SidePanel/Books';
import { useStaticExports } from '~/hooks/useStaticExports';
import { useExports, useAutoRefreshExports } from '~/hooks/useExports';
import { useAuthContext } from '~/hooks/AuthContext';
import { useChatContext } from '~/Providers/ChatContext';
import { debounce } from 'lodash';
import { cn } from '~/utils';

// React-Quill import with CSS and modules
import ReactQuill, { Quill } from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './QuillEditor.css';

// Import image resize module
import ImageResize from 'quill-image-resize-module-react';

// Register the image resize module
Quill.register('modules/imageResize', ImageResize);

type BookPreviewProps = {
  className?: string;
};

// Types for text editing
interface TextSelection {
  startOffset: number;
  endOffset: number;
  selectedText: string;
  contextBefore?: string;
  contextAfter?: string;
}

interface TextChange {
  id: string;
  selection: TextSelection;
  originalText: string;
  newText: string;
  reason?: string;
  timestamp: Date;
  status: 'pending' | 'applying' | 'applied' | 'failed';
}

export default function BookPreview({ className = '' }: BookPreviewProps) {
  const { conversationId } = useParams();
  const { selectedBookId, previewUrl, refreshExports } = useBookContext();
  const { user } = useAuthContext();
  const { ask } = useChatContext();

  // Existing state
  const [currentPreviewUrl, setCurrentPreviewUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [userSelectedFile, setUserSelectedFile] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasExpiredImages, setHasExpiredImages] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // New state for interactive editing
  const [isInteractiveMode, setIsInteractiveMode] = useState(false);
  const [selectedText, setSelectedText] = useState<TextSelection | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [newText, setNewText] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [isApplyingChange, setIsApplyingChange] = useState(false);
  const [recentChanges, setRecentChanges] = useState<TextChange[]>([]);
  const [parsedContent, setParsedContent] = useState<string>('');

  // Refs for interactive mode
  const contentRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Selection | null>(null);

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

  // Use conversation-specific exports hook
  const {
    exports: conversationExports,
    isLoading: isLoadingConversationExports,
    refresh: refreshConversationExports,
  } = useExports({
    conversationId,
    enabled: !!conversationId && !!user?.id,
  });

  // Auto-refresh exports when conversation changes
  const { refreshExports: autoRefreshExports } = useAutoRefreshExports(conversationId);

  // Create a ref for the Quill editor
  const quillRef = useRef<ReactQuill>(null);

  // Custom image handler for uploading images
  const imageHandler = useCallback(() => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = () => {
      const file = input.files?.[0];
      if (file && quillRef.current) {
        const reader = new FileReader();
        reader.onload = () => {
          const imageUrl = reader.result as string;
          const quill = quillRef.current?.getEditor();

          if (quill) {
            // Get the current cursor position
            const range = quill.getSelection();
            if (range) {
              // Insert the image at the cursor position
              quill.insertEmbed(range.index, 'image', imageUrl);
              // Move cursor to after the image
              quill.setSelection(range.index + 1, 0);
            }
          }
        };
        reader.readAsDataURL(file);
      }
    };
  }, []);

  // Handle text selection in interactive mode
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setSelectedText(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();

    if (selectedText.length === 0) {
      setSelectedText(null);
      return;
    }

    // Get the full content to calculate offsets
    const contentElement = contentRef.current;
    if (!contentElement) return;

    const textContent = contentElement.textContent || '';
    const startOffset = getTextOffset(contentElement, range.startContainer, range.startOffset);
    const endOffset = getTextOffset(contentElement, range.endContainer, range.endOffset);

    // Get context around selection
    const contextLength = 100;
    const contextBefore = textContent.substring(Math.max(0, startOffset - contextLength), startOffset);
    const contextAfter = textContent.substring(endOffset, Math.min(textContent.length, endOffset + contextLength));

    setSelectedText({
      startOffset,
      endOffset,
      selectedText,
      contextBefore,
      contextAfter
    });

    selectionRef.current = selection;
  }, []);

  // Helper function to get text offset
  const getTextOffset = (root: Node, node: Node, offset: number): number => {
    let textOffset = 0;
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let currentNode;
    while (currentNode = walker.nextNode()) {
      if (currentNode === node) {
        return textOffset + offset;
      }
      textOffset += currentNode.textContent?.length || 0;
    }
    return textOffset;
  };

  // Call MCP tool to update content
  const callMCPUpdateTool = useCallback(async (content: string) => {
    try {
      const response = await fetch(`/api/mcp/book-creation/tools/update_chapter/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          arguments: {
            chapterId: 'main', // Use a default chapter ID - this should be improved
            content,
            authorId: user?.id,
            conversationId
          }
        })
      });

      if (!response.ok) {
        throw new Error(`MCP call failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Failed to call MCP tool:', error);
      throw error;
    }
  }, [user?.id, conversationId]);

  // Send change to chat
  const sendChangeToChat = useCallback((change: TextChange) => {
    if (!ask || !conversationId) return;

    const changeMessage = `📝 **Book Edit Applied**

**Original text:** "${change.originalText}"

**Updated to:** "${change.newText}"

${change.reason ? `**Reason:** ${change.reason}` : ''}

**Applied at:** ${change.timestamp.toLocaleTimeString()}`;

    ask({
      text: changeMessage,
      conversationId
    });
  }, [ask, conversationId]);

  // Apply text change
  const applyTextChange = useCallback(async () => {
    if (!selectedText || !newText.trim()) return;

    const change: TextChange = {
      id: `change_${Date.now()}`,
      selection: selectedText,
      originalText: selectedText.selectedText,
      newText: newText.trim(),
      reason: changeReason.trim() || undefined,
      timestamp: new Date(),
      status: 'pending'
    };

    setRecentChanges(prev => [change, ...prev.slice(0, 9)]); // Keep last 10 changes
    setIsApplyingChange(true);

    try {
      // Update change status
      change.status = 'applying';
      setRecentChanges(prev => prev.map(c => c.id === change.id ? change : c));

      // Calculate new content with the change applied
      const newContent = parsedContent.substring(0, selectedText.startOffset) +
        newText +
        parsedContent.substring(selectedText.endOffset);

      // Call MCP to update the content
      await callMCPUpdateTool(newContent);

      // Update change status to applied
      change.status = 'applied';
      setRecentChanges(prev => prev.map(c => c.id === change.id ? change : c));

      // Update local content
      setParsedContent(newContent);

      // Send to chat
      sendChangeToChat(change);

      // Refresh exports to show updated content
      refreshExports();

      // Clean up
      setShowEditDialog(false);
      setSelectedText(null);
      setNewText('');
      setChangeReason('');

      // Clear selection
      if (selectionRef.current) {
        selectionRef.current.removeAllRanges();
      }

    } catch (error) {
      console.error('Failed to apply text change:', error);
      change.status = 'failed';
      setRecentChanges(prev => prev.map(c => c.id === change.id ? change : c));
    } finally {
      setIsApplyingChange(false);
    }
  }, [selectedText, newText, changeReason, parsedContent, callMCPUpdateTool, sendChangeToChat, refreshExports]);

  // Open edit dialog
  const openEditDialog = useCallback(() => {
    if (!selectedText) return;
    setNewText(selectedText.selectedText);
    setChangeReason('');
    setShowEditDialog(true);
  }, [selectedText]);

  // Parse HTML content for interactive mode
  const parseContentForInteractiveMode = useCallback(async () => {
    if (!currentPreviewUrl) return;

    try {
      const response = await fetch(currentPreviewUrl);
      if (response.ok) {
        const content = await response.text();

        // Parse the HTML document
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');

        // Extract text content from body, preserving some structure
        const bodyContent = doc.body;
        if (bodyContent) {
          // Convert HTML to readable text while preserving paragraph structure
          const textContent = bodyContent.innerText || bodyContent.textContent || '';
          setParsedContent(textContent);
        }
      }
    } catch (error) {
      console.error('Failed to parse content for interactive mode:', error);
    }
  }, [currentPreviewUrl]);

  // Effect to parse content when switching to interactive mode
  useEffect(() => {
    if (isInteractiveMode && currentPreviewUrl) {
      parseContentForInteractiveMode();
    }
  }, [isInteractiveMode, currentPreviewUrl, parseContentForInteractiveMode]);

  // Effect to add event listeners for text selection
  useEffect(() => {
    if (!isInteractiveMode) return;

    const contentElement = contentRef.current;
    if (!contentElement) return;

    // Handle text selection
    const handleMouseUp = () => {
      setTimeout(handleTextSelection, 10);
    };

    contentElement.addEventListener('mouseup', handleMouseUp);

    return () => {
      contentElement.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isInteractiveMode, handleTextSelection]);

  // Quill editor configuration with image support
  const quillModules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        [{ indent: '-1' }, { indent: '+1' }],
        ['blockquote', 'code-block'],
        ['link', 'image'],
        [{ align: [] }],
        [{ color: [] }, { background: [] }],
        ['clean'],
      ],
      handlers: {
        image: imageHandler,
      },
    },
    imageResize: {
      parchment: Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize', 'Toolbar'],
    },
  }), [imageHandler]);

  const quillFormats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'list',
    'bullet',
    'indent',
    'blockquote',
    'code-block',
    'link',
    'image',
    'align',
    'color',
    'background',
  ];

  // Load HTML content for editing
  const loadContentForEditing = async () => {
    if (!currentPreviewUrl) return;

    setIsLoading(true);
    try {
      const response = await fetch(currentPreviewUrl);
      if (response.ok) {
        const content = await response.text();
        console.log('🔍 Original HTML content:', content.substring(0, 500) + '...');

        // Parse the HTML document
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');

        // Handle image URLs and detect expired Azure blob URLs
        const images = doc.querySelectorAll('img[src]');
        let hasExpiredImages = false;

        images.forEach((img) => {
          const src = img.getAttribute('src');
          if (src) {
            // Check for expired Azure blob URLs
            if (src.includes('blob.core.windows.net') && src.includes('se=')) {
              // Extract expiry time from SAS token
              const seMatch = src.match(/se=([^&]+)/);
              if (seMatch) {
                const expiryTime = new Date(decodeURIComponent(seMatch[1]));
                const now = new Date();
                if (now > expiryTime) {
                  hasExpiredImages = true;
                  console.log('⚠️ Expired image detected:', src.substring(0, 100) + '...');
                  // Add a class to mark as expired
                  img.setAttribute('data-expired', 'true');
                  img.setAttribute('title', 'This image URL has expired and may not display correctly');
                }
              }
            }

            // Convert relative URLs to absolute
            if (!src.startsWith('http') && !src.startsWith('data:')) {
              const absoluteUrl = new URL(src, currentPreviewUrl).href;
              img.setAttribute('src', absoluteUrl);
              console.log('🖼️ Converting image URL:', src, '->', absoluteUrl);
            }
          }
        });

        if (hasExpiredImages) {
          console.log('⚠️ Some images have expired Azure blob URLs and may not display correctly');
          setHasExpiredImages(true);
        } else {
          setHasExpiredImages(false);
        }

        // Extract body content with absolute URLs
        const bodyContent = doc.body.innerHTML || content;
        console.log('📄 Processed body content:', bodyContent.substring(0, 300) + '...');
        setHtmlContent(bodyContent);
      } else {
        throw new Error('Failed to load content');
      }
    } catch (error) {
      console.error('Error loading content:', error);
      setPreviewError('Failed to load content for editing');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle edit mode
  const toggleEditMode = () => {
    if (!isEditMode) {
      loadContentForEditing();
    }
    setIsEditMode(!isEditMode);
  };

  // Save content to exports directory
  const saveContentToExports = async (content: string, filename?: string) => {
    if (!content) return;

    // Clear any previous save errors
    setSaveError(null);

    try {
      // Generate filename if not provided
      const saveFilename = filename || userSelectedFile || `book_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.html`;

      const response = await fetch('/api/exports/save-html', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          htmlContent: content,
          filename: saveFilename,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();
      console.log('Content saved successfully:', result);

      // Update last save time
      setLastSaveTime(new Date());

      // Refresh static exports to show the new file
      refreshStaticExports();

      return result;
    } catch (error) {
      console.error('Error saving content:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save content';
      setSaveError(errorMessage);
      throw error;
    }
  };

  // Manual save content function
  const saveContent = async () => {
    if (!htmlContent) return;

    setIsSaving(true);
    try {
      await saveContentToExports(htmlContent);
      setIsEditMode(false);
    } catch (_error) {
      // Error is already handled in saveContentToExports
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save function with debouncing
  const debouncedAutoSave = useMemo(
    () =>
      debounce(async (content: string) => {
        if (!content || !isEditMode) return;

        try {
          // Auto-save with a timestamp-based filename
          const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
          const autoSaveFilename = userSelectedFile
            ? userSelectedFile.replace('.html', `_autosave_${timestamp}.html`)
            : `book_autosave_${timestamp}.html`;

          await saveContentToExports(content, autoSaveFilename);
          console.log('Auto-saved content');
        } catch (error) {
          console.warn('Auto-save failed:', error);
          // Don't throw error for auto-save failures
        }
      }, 2000), // Auto-save after 2 seconds of inactivity
    [isEditMode, userSelectedFile, saveContentToExports],
  );

  // Trigger auto-save when content changes
  useEffect(() => {
    if (htmlContent && isEditMode) {
      debouncedAutoSave(htmlContent);
    }

    // Cleanup debounced function on unmount
    return () => {
      debouncedAutoSave.cancel();
    };
  }, [htmlContent, isEditMode, debouncedAutoSave]);

  // Set preview URL based on conversation exports first, then static exports
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

    // Prioritize conversation-specific exports
    if (conversationExports.length > 0) {
      // Use the most recent conversation export
      const sortedConversationExports = [...conversationExports].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      const latestExport = sortedConversationExports[0];

      // Use the direct download URL for conversation exports
      setCurrentPreviewUrl(latestExport.url);
      return;
    }

    // Fallback to static exports if no conversation exports
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
  }, [
    previewUrl,
    conversationExports,
    staticExports,
    conversationId,
    serverBase,
    userSelectedFile,
  ]);

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

      // Refresh both conversation exports and static exports
      await Promise.all([refreshConversationExports(), refreshStaticExports()]);

      // Also trigger the auto-refresh for conversation exports
      refreshExports();

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
                  onClick={toggleEditMode}
                  size="sm"
                  variant={isEditMode ? 'default' : 'outline'}
                  className="flex items-center gap-1 px-2 py-1 text-xs"
                  title={isEditMode ? 'Switch to preview mode' : 'Switch to edit mode'}
                >
                  {isEditMode ? <Eye className="h-3 w-3" /> : <Edit className="h-3 w-3" />}
                  {isEditMode ? 'Preview' : 'Edit'}
                </Button>
                {isEditMode && (
                  <Button
                    onClick={saveContent}
                    disabled={isSaving}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-1 px-2 py-1 text-xs"
                    title="Save changes"
                  >
                    <Save className={`h-3 w-3 ${isSaving ? 'animate-spin' : ''}`} />
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                )}
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



        {/* Save status info */}
        {isEditMode && (
          <div className="mt-2 space-y-1">
            {saveError && (
              <div className="flex items-center gap-2 text-xs text-red-600">
                <span>❌ Save error: {saveError}</span>
              </div>
            )}
            {lastSaveTime && !saveError && (
              <div className="flex items-center gap-2 text-xs text-green-600">
                <span>✅ Auto-saved at {lastSaveTime.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Export info */}
        {(isLoadingStaticExports || isLoadingConversationExports) && (
          <div className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
            <div className="h-3 w-3 animate-spin rounded-full border border-gray-300 border-t-transparent"></div>
            <span>Loading exports...</span>
          </div>
        )}

        {/* Conversation Exports Section */}
        {!isLoadingConversationExports && conversationExports.length > 0 && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span>📚 Conversation Exports: {conversationExports.length}</span>
              {conversationExports[0]?.createdAt && (
                <>
                  <span>•</span>
                  <span>
                    Latest: {new Date(conversationExports[0].createdAt).toLocaleDateString()}
                  </span>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {conversationExports.slice(0, 4).map((exp) => {
                const isCurrentlyViewed =
                  currentPreviewUrl.includes(exp._id) || currentPreviewUrl.includes(exp.filename);
                return (
                  <button
                    key={exp._id}
                    onClick={() => {
                      console.log('=== CONVERSATION EXPORT CLICKED ===');
                      console.log('Export ID:', exp._id);
                      console.log('Filename:', exp.filename);
                      console.log('URL:', exp.url);

                      setPreviewError(null);

                      // Mark this file as user-selected
                      setUserSelectedFile(exp.filename);

                      // Clear current URL first to force iframe reload
                      setCurrentPreviewUrl('');

                      // Set new URL after a brief delay
                      setTimeout(() => {
                        console.log('Setting conversation export URL:', exp.url);
                        setCurrentPreviewUrl(exp.url);
                      }, 100);
                    }}
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-blue-200 dark:hover:bg-blue-800 ${isCurrentlyViewed
                      ? 'bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      }`}
                    title={`${exp.filename} - Click to preview (${exp.format})`}
                  >
                    <span>📄</span>
                    <span>{exp.filename.replace('.html', '')}</span>
                    <span className="text-blue-600 dark:text-blue-300">v{exp.version}</span>
                  </button>
                );
              })}
              {conversationExports.length > 4 && (
                <span className="text-xs text-text-secondary">
                  +{conversationExports.length - 4} more
                </span>
              )}
            </div>
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
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-green-200 dark:hover:bg-green-800 ${isCurrentlyViewed
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
        {!isLoadingStaticExports &&
          !isLoadingConversationExports &&
          staticExports.length === 0 &&
          conversationExports.length === 0 &&
          conversationId && (
            <div className="mt-2 text-xs text-text-secondary">
              <span>📄 No exports available for this conversation</span>
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

        {conversationId &&
          (isLoading || isLoadingStaticExports || isLoadingConversationExports) && (
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
          !isLoadingConversationExports &&
          currentPreviewUrl &&
          !previewError && (
            <div className="h-full w-full flex">
              <div className="flex-1">
                {isInteractiveMode ? (
                  // Interactive Edit Mode - Text selection and editing
                  <div className="h-full flex flex-col bg-white">
                    {/* Header with selection info */}
                    {selectedText && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-200">
                        <span className="text-sm text-blue-700">
                          {selectedText.selectedText.length} chars selected
                        </span>
                        <Button
                          size="sm"
                          onClick={openEditDialog}
                          className="h-7"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Edit Text
                        </Button>
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 overflow-auto p-8">
                      <div
                        ref={contentRef}
                        className="prose prose-lg max-w-none select-text"
                        style={{
                          fontSize: '16px',
                          lineHeight: 1.6,
                          fontFamily: '"Georgia", "Times New Roman", serif'
                        }}
                      >
                        <div dangerouslySetInnerHTML={{ __html: parsedContent.replace(/\n/g, '<br />') }} />
                      </div>
                    </div>
                  </div>
                ) : isEditMode ? (
                  // Edit Mode - React-Quill Editor
                  <div className="book-editor h-full w-full bg-white">
                    {hasExpiredImages && (
                      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-2">
                        <div className="flex">
                          <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                              ⚠️ <strong>Some images may not display correctly</strong> - Azure blob URLs have expired.
                              You can replace them with new images using the image button in the toolbar.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    <ReactQuill
                      ref={quillRef}
                      value={htmlContent}
                      onChange={setHtmlContent}
                      modules={quillModules}
                      formats={quillFormats}
                      theme="snow"
                      placeholder="Click here to start editing... You can add text, images, and format content."
                    />
                  </div>
                ) : (
                  // Preview Mode - Regular Iframe
                  <iframe
                    ref={iframeRef}
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
                )}
              </div>

              {/* Changes Panel for Interactive Mode */}
              {isInteractiveMode && recentChanges.length > 0 && (
                <div className="w-80 border-l bg-gray-50 flex flex-col">
                  <div className="p-4 border-b bg-white">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Recent Changes</h3>
                      <span className="text-xs text-gray-500">{recentChanges.length} changes</span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto p-4 space-y-3">
                    {recentChanges.map((change) => (
                      <div key={change.id} className="bg-white p-3 rounded-lg border transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {change.status === 'pending' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                            {change.status === 'applying' && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
                            {change.status === 'applied' && <CheckCircle className="h-4 w-4 text-green-500" />}
                            {change.status === 'failed' && <X className="h-4 w-4 text-red-500" />}
                            <span className="text-xs font-medium capitalize">{change.status}</span>
                          </div>
                          <span className="text-xs text-gray-400">
                            {change.timestamp.toLocaleTimeString()}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-gray-600">Original:</p>
                            <p className="text-sm bg-red-50 p-2 rounded text-red-800 line-clamp-2">
                              "{change.originalText}"
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-600">Updated to:</p>
                            <p className="text-sm bg-green-50 p-2 rounded text-green-800 line-clamp-2">
                              "{change.newText}"
                            </p>
                          </div>

                          {change.reason && (
                            <div>
                              <p className="text-xs text-gray-600">Reason:</p>
                              <p className="text-xs text-gray-500 line-clamp-2">
                                {change.reason}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        {conversationId &&
          !isLoading &&
          !isLoadingStaticExports &&
          !isLoadingConversationExports &&
          previewError && (
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
          !isLoadingConversationExports &&
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

      {/* Edit Dialog for Interactive Mode */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Selected Text</DialogTitle>
            <DialogDescription>
              Make changes to the selected text. Your changes will be applied to the book and sent to the chat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Original Text Preview */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <Label className="text-xs text-gray-600">Original Text:</Label>
              <p className="text-sm mt-1 italic">
                "{selectedText?.selectedText}"
              </p>
            </div>

            {/* New Text */}
            <div className="space-y-2">
              <Label>New Text</Label>
              <Textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="Enter the new text..."
                rows={4}
                className="resize-none"
              />
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label>Reason for Change (Optional)</Label>
              <Input
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Why are you making this change?"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={applyTextChange}
              disabled={!newText.trim() || newText === selectedText?.selectedText || isApplyingChange}
            >
              {isApplyingChange ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Apply Change
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
