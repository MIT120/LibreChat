/**
 * Interactive Book Preview - Book preview with inline revision request capabilities
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import SimpleBadge from '~/components/ui/SimpleBadge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/Dialog';
import { Input } from '~/components/ui/Input';
import { Textarea } from '~/components/ui/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/Tabs';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { Separator } from '~/components/ui/separator';
import { Progress } from '~/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/DropdownMenu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/Tooltip';
import { cn } from '~/utils';

// Icons
import {
    Edit,
    Wand2,
    MessageSquare,
    RefreshCw,
    Check,
    X,
    Clock,
    AlertTriangle,
    ChevronDown,
    MoreVertical,
    Eye,
    EyeOff,
    Settings,
    History,
    BookOpen,
    Zap,
    Sparkles,
    Target,
    Type,
    Volume2,
    Maximize2,
    Copy,
    Download
} from 'lucide-react';

// Types
interface TextSelection {
    startOffset: number;
    endOffset: number;
    selectedText: string;
    contextBefore?: string;
    contextAfter?: string;
}

interface RevisionRequest {
    id: string;
    selection: TextSelection;
    instruction: {
        type: 'rewrite' | 'expand' | 'condense' | 'improve_tone' | 'fix_grammar' | 'change_style' | 'add_detail' | 'custom';
        description: string;
        targetTone?: string;
        targetLength?: string;
    };
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'applied';
    result?: {
        generatedText: string;
        alternativeVersions: Array<{
            text: string;
            variant: string;
            confidence: number;
        }>;
    };
    createdAt: Date;
    priority: 'low' | 'normal' | 'high' | 'urgent';
}

interface BookChapter {
    id: string;
    title: string;
    content: string;
    wordCount: number;
    status: string;
    revisions: RevisionRequest[];
}

interface InteractiveBookPreviewProps {
    bookId: string;
    conversationId: string;
    chapters: BookChapter[];
    activeChapterId?: string;
    onRevisionRequest: (request: Omit<RevisionRequest, 'id' | 'createdAt' | 'status'>) => Promise<void>;
    onRevisionApply: (revisionId: string, version?: string) => Promise<void>;
    onRevisionCancel: (revisionId: string) => Promise<void>;
    onChapterSelect: (chapterId: string) => void;
    className?: string;
}

const REVISION_TYPES = [
    { value: 'rewrite', label: 'Rewrite', icon: RefreshCw, description: 'Completely rewrite the selected text' },
    { value: 'expand', label: 'Expand', icon: Maximize2, description: 'Add more detail and expand the content' },
    { value: 'condense', label: 'Condense', icon: Target, description: 'Make the text shorter and more concise' },
    { value: 'improve_tone', label: 'Improve Tone', icon: Volume2, description: 'Adjust the tone and style' },
    { value: 'fix_grammar', label: 'Fix Grammar', icon: Check, description: 'Correct grammar and syntax' },
    { value: 'change_style', label: 'Change Style', icon: Type, description: 'Modify the writing style' },
    { value: 'add_detail', label: 'Add Detail', icon: Sparkles, description: 'Add more descriptive details' },
    { value: 'custom', label: 'Custom', icon: Wand2, description: 'Custom revision instructions' }
];

const TONE_OPTIONS = ['formal', 'casual', 'dramatic', 'humorous', 'serious', 'poetic', 'conversational'];
const LENGTH_OPTIONS = ['much_shorter', 'shorter', 'same', 'longer', 'much_longer'];

export default function InteractiveBookPreview({
    bookId,
    conversationId,
    chapters,
    activeChapterId,
    onRevisionRequest,
    onRevisionApply,
    onRevisionCancel,
    onChapterSelect,
    className
}: InteractiveBookPreviewProps) {
    // State
    const [selectedText, setSelectedText] = useState<TextSelection | null>(null);
    const [showRevisionDialog, setShowRevisionDialog] = useState(false);
    const [revisionInProgress, setRevisionInProgress] = useState<string | null>(null);
    const [showRevisionResults, setShowRevisionResults] = useState<string | null>(null);
    const [showRevisionsPanel, setShowRevisionsPanel] = useState(true);
    const [fontSize, setFontSize] = useState(16);
    const [lineHeight, setLineHeight] = useState(1.6);
    const [showWordCount, setShowWordCount] = useState(true);
    const [highlightRevisions, setHighlightRevisions] = useState(true);

    // Revision form state
    const [revisionType, setRevisionType] = useState<string>('rewrite');
    const [revisionDescription, setRevisionDescription] = useState('');
    const [targetTone, setTargetTone] = useState('');
    const [targetLength, setTargetLength] = useState('same');
    const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');

    // Refs
    const contentRef = useRef<HTMLDivElement>(null);
    const selectionRef = useRef<Selection | null>(null);

    // Get active chapter
    const activeChapter = useMemo(() => {
        return chapters.find(c => c.id === activeChapterId) || chapters[0];
    }, [chapters, activeChapterId]);

    // Handle text selection
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
        const startOffset = this.getTextOffset(contentElement, range.startContainer, range.startOffset);
        const endOffset = this.getTextOffset(contentElement, range.endContainer, range.endOffset);

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

    // Handle revision request creation
    const handleCreateRevision = useCallback(async () => {
        if (!selectedText || !activeChapter) return;

        const request = {
            selection: selectedText,
            instruction: {
                type: revisionType as any,
                description: revisionDescription,
                targetTone: targetTone || undefined,
                targetLength: targetLength !== 'same' ? targetLength : undefined
            },
            priority
        };

        try {
            await onRevisionRequest(request);
            setShowRevisionDialog(false);
            setSelectedText(null);
            setRevisionDescription('');
            setTargetTone('');
            setTargetLength('same');
            setPriority('normal');

            // Clear selection
            if (selectionRef.current) {
                selectionRef.current.removeAllRanges();
            }
        } catch (error) {
            console.error('Failed to create revision request:', error);
        }
    }, [selectedText, activeChapter, revisionType, revisionDescription, targetTone, targetLength, priority, onRevisionRequest]);

    // Render text with revision highlights
    const renderContentWithRevisions = useCallback((content: string, revisions: RevisionRequest[]) => {
        if (!highlightRevisions || revisions.length === 0) {
            return <div dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br />') }} />;
        }

        // Sort revisions by start offset
        const sortedRevisions = [...revisions].sort((a, b) => a.selection.startOffset - b.selection.startOffset);

        let offset = 0;
        let result = '';

        sortedRevisions.forEach((revision, index) => {
            // Add text before this revision
            result += content.substring(offset, revision.selection.startOffset);

            // Add revision span
            const revisionClass = cn(
                'revision-highlight inline-block relative cursor-pointer',
                {
                    'bg-yellow-100 border-b-2 border-yellow-400': revision.status === 'pending',
                    'bg-blue-100 border-b-2 border-blue-400': revision.status === 'processing',
                    'bg-green-100 border-b-2 border-green-400': revision.status === 'completed',
                    'bg-red-100 border-b-2 border-red-400': revision.status === 'failed',
                    'bg-purple-100 border-b-2 border-purple-400': revision.status === 'applied'
                }
            );

            result += `<span class="${revisionClass}" data-revision-id="${revision.id}" title="Click to view revision">`;
            result += content.substring(revision.selection.startOffset, revision.selection.endOffset);
            result += '</span>';

            offset = revision.selection.endOffset;
        });

        // Add remaining text
        result += content.substring(offset);

        return <div dangerouslySetInnerHTML={{ __html: result.replace(/\n/g, '<br />') }} />;
    }, [highlightRevisions]);

    // Handle revision click
    const handleRevisionClick = useCallback((revisionId: string) => {
        setShowRevisionResults(revisionId);
    }, []);

    // Get revision by ID
    const getRevisionById = useCallback((revisionId: string): RevisionRequest | undefined => {
        return activeChapter?.revisions.find(r => r.id === revisionId);
    }, [activeChapter]);

    // Effect to add event listeners
    useEffect(() => {
        const contentElement = contentRef.current;
        if (!contentElement) return;

        // Handle text selection
        const handleMouseUp = () => {
            setTimeout(handleTextSelection, 10);
        };

        // Handle revision clicks
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const revisionElement = target.closest('[data-revision-id]');
            if (revisionElement) {
                const revisionId = revisionElement.getAttribute('data-revision-id');
                if (revisionId) {
                    handleRevisionClick(revisionId);
                }
            }
        };

        contentElement.addEventListener('mouseup', handleMouseUp);
        contentElement.addEventListener('click', handleClick);

        return () => {
            contentElement.removeEventListener('mouseup', handleMouseUp);
            contentElement.removeEventListener('click', handleClick);
        };
    }, [handleTextSelection, handleRevisionClick]);

    if (!activeChapter) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500">
                No chapter content available
            </div>
        );
    }

    return (
        <div className={cn("interactive-book-preview flex h-full", className)}>
            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="border-b bg-white p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-semibold">{activeChapter.title}</h2>
                            {showWordCount && (
                                <p className="text-sm text-gray-600">
                                    {activeChapter.wordCount.toLocaleString()} words
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Selection Actions */}
                            {selectedText && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-lg">
                                    <span className="text-sm text-blue-700">
                                        {selectedText.selectedText.length} chars selected
                                    </span>
                                    <Button
                                        size="sm"
                                        onClick={() => setShowRevisionDialog(true)}
                                        className="h-7"
                                    >
                                        <Edit className="h-3 w-3 mr-1" />
                                        Request Revision
                                    </Button>
                                </div>
                            )}

                            {/* Settings */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                        <Settings className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <div className="p-3 space-y-3">
                                        <div>
                                            <Label className="text-xs">Font Size</Label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setFontSize(f => Math.max(12, f - 2))}
                                                >
                                                    -
                                                </Button>
                                                <span className="text-sm w-8 text-center">{fontSize}</span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setFontSize(f => Math.min(24, f + 2))}
                                                >
                                                    +
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs">Show Word Count</Label>
                                            <Switch
                                                checked={showWordCount}
                                                onCheckedChange={setShowWordCount}
                                                size="sm"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs">Highlight Revisions</Label>
                                            <Switch
                                                checked={highlightRevisions}
                                                onCheckedChange={setHighlightRevisions}
                                                size="sm"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs">Revisions Panel</Label>
                                            <Switch
                                                checked={showRevisionsPanel}
                                                onCheckedChange={setShowRevisionsPanel}
                                                size="sm"
                                            />
                                        </div>
                                    </div>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto">
                    <div className="max-w-4xl mx-auto p-8">
                        <div
                            ref={contentRef}
                            className="prose prose-lg max-w-none select-text"
                            style={{
                                fontSize: `${fontSize}px`,
                                lineHeight: lineHeight,
                                fontFamily: '"Georgia", "Times New Roman", serif'
                            }}
                        >
                            {renderContentWithRevisions(activeChapter.content, activeChapter.revisions)}
                        </div>
                    </div>
                </div>
            </div>

            {/* Revisions Panel */}
            {showRevisionsPanel && (
                <div className="w-80 border-l bg-gray-50 flex flex-col">
                    <div className="p-4 border-b bg-white">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">Revisions</h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowRevisionsPanel(false)}
                            >
                                <EyeOff className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-4 space-y-3">
                        {activeChapter.revisions.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">
                                <MessageSquare className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                                <p className="text-sm">No revisions yet</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    Select text to request revisions
                                </p>
                            </div>
                        ) : (
                            activeChapter.revisions.map((revision) => (
                                <Card
                                    key={revision.id}
                                    className={cn(
                                        "cursor-pointer transition-colors hover:bg-gray-50",
                                        showRevisionResults === revision.id && "ring-2 ring-blue-500"
                                    )}
                                    onClick={() => handleRevisionClick(revision.id)}
                                >
                                    <CardContent className="p-3">
                                        <div className="flex items-start justify-between mb-2">
                                            <SimpleBadge
                                                className={`text-xs ${
                                                    revision.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                                        revision.status === 'processing' ? 'bg-gray-100 text-gray-800' :
                                                            revision.status === 'failed' ? 'bg-red-100 text-red-800' :
                                                                'bg-gray-100 text-gray-800'
                                                }`}
                                            >
                                                {revision.status}
                                            </SimpleBadge>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                        <MoreVertical className="h-3 w-3" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    {revision.status === 'completed' && (
                                                        <DropdownMenuItem onClick={() => onRevisionApply(revision.id)}>
                                                            <Check className="h-4 w-4 mr-2" />
                                                            Apply Revision
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem onClick={() => onRevisionCancel(revision.id)}>
                                                        <X className="h-4 w-4 mr-2" />
                                                        Cancel
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="text-xs text-gray-600">
                                                {REVISION_TYPES.find(t => t.value === revision.instruction.type)?.label}
                                            </div>

                                            <p className="text-sm line-clamp-2">
                                                "{revision.selection.selectedText}"
                                            </p>

                                            <p className="text-xs text-gray-500 line-clamp-2">
                                                {revision.instruction.description}
                                            </p>

                                            <div className="text-xs text-gray-400">
                                                {new Date(revision.createdAt).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Revision Request Dialog */}
            <Dialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Request Revision</DialogTitle>
                        <DialogDescription>
                            Describe how you'd like the selected text to be revised
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Selected Text Preview */}
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <Label className="text-xs text-gray-600">Selected Text:</Label>
                            <p className="text-sm mt-1 italic">
                                "{selectedText?.selectedText}"
                            </p>
                        </div>

                        {/* Revision Type */}
                        <div className="space-y-2">
                            <Label>Revision Type</Label>
                            <Select value={revisionType} onValueChange={setRevisionType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {REVISION_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                            <div className="flex items-center gap-2">
                                                <type.icon className="h-4 w-4" />
                                                <div>
                                                    <div>{type.label}</div>
                                                    <div className="text-xs text-gray-500">{type.description}</div>
                                                </div>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label>Instructions</Label>
                            <Textarea
                                value={revisionDescription}
                                onChange={(e) => setRevisionDescription(e.target.value)}
                                placeholder="Describe how you want the text to be revised..."
                                rows={3}
                            />
                        </div>

                        {/* Additional Options */}
                        <div className="grid grid-cols-2 gap-4">
                            {(revisionType === 'improve_tone' || revisionType === 'change_style') && (
                                <div className="space-y-2">
                                    <Label>Target Tone</Label>
                                    <Select value={targetTone} onValueChange={setTargetTone}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select tone..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TONE_OPTIONS.map((tone) => (
                                                <SelectItem key={tone} value={tone}>
                                                    {tone.charAt(0).toUpperCase() + tone.slice(1)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {(revisionType === 'expand' || revisionType === 'condense') && (
                                <div className="space-y-2">
                                    <Label>Target Length</Label>
                                    <Select value={targetLength} onValueChange={setTargetLength}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {LENGTH_OPTIONS.map((length) => (
                                                <SelectItem key={length} value={length}>
                                                    {length.replace('_', ' ').charAt(0).toUpperCase() + length.replace('_', ' ').slice(1)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Priority</Label>
                                <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="normal">Normal</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <Button variant="outline" onClick={() => setShowRevisionDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateRevision}
                            disabled={!revisionDescription.trim()}
                        >
                            <Wand2 className="h-4 w-4 mr-2" />
                            Request Revision
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Revision Results Dialog */}
            {showRevisionResults && (
                <Dialog open={!!showRevisionResults} onOpenChange={() => setShowRevisionResults(null)}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Revision Results</DialogTitle>
                        </DialogHeader>

                        {(() => {
                            const revision = getRevisionById(showRevisionResults);
                            if (!revision || !revision.result) return null;

                            return (
                                <div className="space-y-4">
                                    {/* Original Text */}
                                    <div>
                                        <Label className="text-sm font-medium">Original Text:</Label>
                                        <div className="p-3 bg-gray-50 rounded-lg mt-2">
                                            <p className="text-sm italic">"{revision.selection.selectedText}"</p>
                                        </div>
                                    </div>

                                    {/* Generated Revision */}
                                    <div>
                                        <Label className="text-sm font-medium">Revised Text:</Label>
                                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg mt-2">
                                            <p className="text-sm">{revision.result.generatedText}</p>
                                        </div>
                                    </div>

                                    {/* Alternative Versions */}
                                    {revision.result.alternativeVersions && revision.result.alternativeVersions.length > 0 && (
                                        <div>
                                            <Label className="text-sm font-medium">Alternative Versions:</Label>
                                            <div className="space-y-2 mt-2">
                                                {revision.result.alternativeVersions.map((alt, index) => (
                                                    <div key={index} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <SimpleBadge className="bg-gray-100 text-gray-800">{alt.variant}</SimpleBadge>
                                                            <span className="text-xs text-gray-500">{alt.confidence}% confidence</span>
                                                        </div>
                                                        <p className="text-sm">{alt.text}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end gap-3">
                                        <Button variant="outline" onClick={() => setShowRevisionResults(null)}>
                                            Close
                                        </Button>
                                        <Button onClick={() => onRevisionApply(revision.id)}>
                                            <Check className="h-4 w-4 mr-2" />
                                            Apply Revision
                                        </Button>
                                    </div>
                                </div>
                            );
                        })()}
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
