/**
 * Enhanced Book Preview - NovelCrafter-style interactive editor with AI text insertion
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/Dialog';
import { Input } from '~/components/ui/Input';
import { Textarea } from '~/components/ui/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/Tabs';
import OutlineEditor from '~/components/Planning/OutlineEditor';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { Separator } from '~/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '~/components/ui/DropdownMenu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/Tooltip';
import { cn } from '~/utils';
import { useAuthContext } from '~/hooks';
import { request } from 'librechat-data-provider';

// Icons
import {
    Edit,
    Wand2,
    MessageSquare,
    RefreshCw,
    Check,
    X,
    Plus,
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
    Download,
    Save,
    ArrowLeft,
    MoreVertical,
    MousePointer2,
    PlusCircle,
    FileText,
    Loader2,
    Map,
    List,
} from 'lucide-react';

interface TextSelection {
    startOffset: number;
    endOffset: number;
    selectedText: string;
    contextBefore?: string;
    contextAfter?: string;
}

interface AIInsertionRequest {
    id: string;
    position: number;
    instruction: string;
    context: {
        before: string;
        after: string;
    };
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: string;
    createdAt: Date;
}

interface EnhancedBookPreviewProps {
    className?: string;
}

const AI_INSERTION_PROMPTS = [
    {
        value: 'expand_scene',
        label: 'Expand this scene',
        icon: Maximize2,
        prompt: 'Please expand this scene with more descriptive details, dialogue, and character development. Make it more immersive and engaging.'
    },
    {
        value: 'add_dialogue',
        label: 'Add dialogue',
        icon: MessageSquare,
        prompt: 'Add natural, character-appropriate dialogue to this section that advances the story and reveals character.'
    },
    {
        value: 'describe_setting',
        label: 'Describe setting',
        icon: Target,
        prompt: 'Add vivid, sensory descriptions of the setting/environment to help readers visualize the scene.'
    },
    {
        value: 'build_tension',
        label: 'Build tension',
        icon: Zap,
        prompt: 'Add elements that build tension, suspense, or emotional intensity in this part of the story.'
    },
    {
        value: 'character_thoughts',
        label: 'Character thoughts',
        icon: MessageSquare,
        prompt: 'Add internal thoughts, emotions, or reflections for the character(s) in this scene.'
    },
    {
        value: 'transition',
        label: 'Add transition',
        icon: RefreshCw,
        prompt: 'Create a smooth transition between these sections or scenes.'
    },
    {
        value: 'custom',
        label: 'Custom request',
        icon: Wand2,
        prompt: 'Custom AI assistance request'
    }
];

// Fallback content generator when MCP API is not available
const generateFallbackContent = (instruction: string): string => {
    const responses = {
        dialogue: [
            '"This is remarkable," Marcus whispered, his eyes wide with amazement. "The ancient prophecies spoke of this day."',
            '"I never imagined it would be like this," she said, her voice barely above a whisper.',
            '"What happens now?" he asked, uncertainty clouding his features.',
        ],
        setting: [
            'The chamber around them seemed to pulse with an otherworldly energy. Ancient runes carved into the stone walls began to glow with a soft, azure light, casting dancing shadows across the floor.',
            'A gentle breeze carried the scent of jasmine and old parchment through the moonlit corridors.',
            'The air shimmered with possibilities, as if reality itself was waiting to be reshaped.',
        ],
        tension: [
            'A low rumble echoed through the corridors below, and the very air seemed to thicken with anticipation. Something was coming—something that would change everything.',
            'The silence stretched between them, heavy with unspoken words and mounting tension.',
            'Time seemed to slow as the gravity of the situation settled over them like a shroud.',
        ],
        expand: [
            'The moment stretched between them, heavy with unspoken possibilities and the weight of destiny that hung over Aethermoor like a gathering storm.',
            'Each second that passed brought them closer to a revelation that would alter the course of their lives forever.',
            'The implications of what they had discovered began to unfold in their minds like the petals of a night-blooming flower.',
        ],
        transition: [
            'As the sun began to set, casting long shadows across the ancient stones, they knew their journey was far from over.',
            'With renewed determination, they prepared to face whatever challenges lay ahead.',
            'The next chapter of their story was about to begin.',
        ]
    };

    // Determine response type based on instruction
    let responseType = 'expand'; // default
    if (instruction.toLowerCase().includes('dialogue') || instruction.toLowerCase().includes('conversation')) {
        responseType = 'dialogue';
    } else if (instruction.toLowerCase().includes('setting') || instruction.toLowerCase().includes('describe')) {
        responseType = 'setting';
    } else if (instruction.toLowerCase().includes('tension') || instruction.toLowerCase().includes('suspense')) {
        responseType = 'tension';
    } else if (instruction.toLowerCase().includes('transition')) {
        responseType = 'transition';
    }

    const options = responses[responseType as keyof typeof responses] || responses.expand;
    const selectedResponse = options[Math.floor(Math.random() * options.length)];

    return `\n\n${selectedResponse}\n\n*[AI-generated content - MCP server not available, using fallback]*\n`;
};

export default function EnhancedBookPreview({ className }: EnhancedBookPreviewProps) {
    const navigate = useNavigate();
    const { user } = useAuthContext();
    const { bookId } = useParams();
    const [searchParams] = useSearchParams();

    // State
    const [showOutline, setShowOutline] = useState(false);
    const [outlinePanelWidth, setOutlinePanelWidth] = useState(400);
    const [bookContent, setBookContent] = useState<string>(`# The Chronicles of Aethermoor
*Chapter 1: The Awakening*

The morning mist clung to the ancient towers of Aethermoor like whispered secrets refusing to be told. Lyra stood at her chamber window, watching the first rays of sunlight pierce through the ethereal veil that had shrouded the city for as long as anyone could remember.

She had always been different. Where others saw only fog and shadow, she glimpsed fleeting shapes—figures that danced just beyond the edge of perception. Today, however, something had changed. The shapes were clearer, more defined, as if a veil had been lifted from her eyes.

A soft knock at her door interrupted her thoughts. "Come in," she called, not turning from the window.

"The Council summons you, my lady." The voice belonged to Marcus, her faithful attendant. His tone carried an unusual weight of concern.

"At this early hour?" Lyra finally turned, noting the worry etched in the old man's weathered features. "What has happened?"

Marcus hesitated, his hands fidgeting with the ceremonial scroll he carried. "There have been... disturbances in the Shadowlands. The barriers weaken, and the Council believes your unique gifts may be needed."

*[Continue your story by selecting text and using AI insertion...]*`);

    const [selectedText, setSelectedText] = useState<TextSelection | null>(null);
    const [cursorPosition, setCursorPosition] = useState<number>(0);
    const [showAIDialog, setShowAIDialog] = useState(false);
    const [insertionRequests, setInsertionRequests] = useState<AIInsertionRequest[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    // AI Dialog state
    const [selectedPrompt, setSelectedPrompt] = useState('expand_scene');
    const [customInstruction, setCustomInstruction] = useState('');
    const [insertionMode, setInsertionMode] = useState<'replace' | 'insert_before' | 'insert_after'>('insert_after');

    // Editor settings
    const [fontSize, setFontSize] = useState(16);
    const [showLineNumbers, setShowLineNumbers] = useState(false);
    const [showWordCount, setShowWordCount] = useState(true);
    const [darkMode, setDarkMode] = useState(false);

    // Refs
    const editorRef = useRef<HTMLTextAreaElement>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        show: boolean;
        x: number;
        y: number;
        position: number;
    }>({ show: false, x: 0, y: 0, position: 0 });

    // Compute word count
    const wordCount = useMemo(() => {
        return bookContent.split(/\s+/).filter(word => word.length > 0).length;
    }, [bookContent]);

    // Handle text selection
    const handleTextSelection = useCallback(() => {
        const editor = editorRef.current;
        if (!editor) return;

        const selectionStart = editor.selectionStart;
        const selectionEnd = editor.selectionEnd;

        if (selectionStart !== selectionEnd) {
            const selectedText = editor.value.substring(selectionStart, selectionEnd);
            const contextBefore = editor.value.substring(Math.max(0, selectionStart - 100), selectionStart);
            const contextAfter = editor.value.substring(selectionEnd, Math.min(editor.value.length, selectionEnd + 100));

            setSelectedText({
                startOffset: selectionStart,
                endOffset: selectionEnd,
                selectedText,
                contextBefore,
                contextAfter
            });
        } else {
            setSelectedText(null);
        }

        setCursorPosition(selectionStart);
    }, []);

    // Handle right-click context menu
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();

        const editor = editorRef.current;
        if (!editor) return;

        setContextMenu({
            show: true,
            x: e.clientX,
            y: e.clientY,
            position: editor.selectionStart
        });
    }, []);

    // Close context menu
    const closeContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, show: false }));
    }, []);

    // Handle AI insertion request
    const handleAIInsertion = useCallback(async () => {
        if (!user?.id) return;

        const editor = editorRef.current;
        if (!editor) return;

        const position = selectedText ? selectedText.startOffset : cursorPosition;
        const instruction = selectedPrompt === 'custom' ? customInstruction :
            AI_INSERTION_PROMPTS.find(p => p.value === selectedPrompt)?.prompt || '';

        if (!instruction.trim()) return;

        // Get context around insertion point
        const contextBefore = editor.value.substring(Math.max(0, position - 200), position);
        const contextAfter = editor.value.substring(position, Math.min(editor.value.length, position + 200));

        const request: AIInsertionRequest = {
            id: Date.now().toString(),
            position,
            instruction,
            context: { before: contextBefore, after: contextAfter },
            status: 'processing',
            createdAt: new Date()
        };

        setInsertionRequests(prev => [...prev, request]);
        setIsProcessing(true);
        setShowAIDialog(false);

        try {
            // Try to call MCP API first
            let generatedText = '';

            try {
                const mcpResponse = await request('/api/mcp/call-tool', {
                    method: 'POST',
                    body: {
                        server: 'book-creation',
                        tool: 'generate_content',
                        arguments: {
                            instruction,
                            context_before: contextBefore,
                            context_after: contextAfter,
                            selected_text: selectedText?.selectedText
                        }
                    }
                });

                if (mcpResponse.success && mcpResponse.content) {
                    generatedText = mcpResponse.content;
                } else {
                    throw new Error('MCP request failed');
                }
            } catch (mcpError) {
                console.warn('MCP API failed, using fallback:', mcpError);
                // Use fallback generator
                generatedText = generateFallbackContent(instruction);
            }

            // Update request with result
            setInsertionRequests(prev => prev.map(req =>
                req.id === request.id
                    ? { ...req, status: 'completed', result: generatedText }
                    : req
            ));

            // Auto-apply the insertion
            setTimeout(() => applyInsertion(request.id), 100);

        } catch (error) {
            console.error('Content generation failed:', error);
            setInsertionRequests(prev => prev.map(req =>
                req.id === request.id ? { ...req, status: 'failed' } : req
            ));
        } finally {
            setIsProcessing(false);
        }
    }, [user?.id, selectedText, cursorPosition, selectedPrompt, customInstruction]);

    // Apply insertion to text
    const applyInsertion = useCallback((requestId: string) => {
        const request = insertionRequests.find(req => req.id === requestId);
        if (!request || !request.result) return;

        const editor = editorRef.current;
        if (!editor) return;

        let newContent = bookContent;
        const insertionText = request.result;

        if (insertionMode === 'replace' && selectedText) {
            // Replace selected text
            newContent =
                bookContent.substring(0, selectedText.startOffset) +
                insertionText +
                bookContent.substring(selectedText.endOffset);
        } else if (insertionMode === 'insert_before') {
            // Insert before position
            newContent =
                bookContent.substring(0, request.position) +
                insertionText +
                bookContent.substring(request.position);
        } else {
            // Insert after position (default)
            const insertPos = selectedText ? selectedText.endOffset : request.position;
            newContent =
                bookContent.substring(0, insertPos) +
                insertionText +
                bookContent.substring(insertPos);
        }

        setBookContent(newContent);
        setSelectedText(null);

        // Remove the applied request
        setInsertionRequests(prev => prev.filter(req => req.id !== requestId));
    }, [bookContent, insertionMode, selectedText, insertionRequests]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        // Handle save
                        break;
                    case 'i':
                        e.preventDefault();
                        setShowAIDialog(true);
                        break;
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Close context menu on click outside
    useEffect(() => {
        const handleClickOutside = () => {
            closeContextMenu();
        };

        if (contextMenu.show) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [contextMenu.show, closeContextMenu]);

    return (
        <div className={cn("flex h-full flex-col bg-surface-primary", className)}>
            {/* Header */}
            <div className="flex-shrink-0 border-b border-border-light p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(-1)}
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back
                        </Button>
                        <div>
                            <h1 className="text-xl font-semibold">Book Creation Studio</h1>
                            <p className="text-sm text-gray-600">Writing, planning, and AI assistance</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {showWordCount && (
                            <div className="text-sm text-gray-600 px-2">
                                {wordCount.toLocaleString()} words
                            </div>
                        )}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAIDialog(true)}
                            disabled={isProcessing}
                        >
                            {isProcessing ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Wand2 className="h-4 w-4 mr-2" />
                            )}
                            AI Assist
                        </Button>

                        <Button
                            variant={showOutline ? "default" : "outline"}
                            size="sm"
                            onClick={() => setShowOutline(!showOutline)}
                            className="relative"
                        >
                            <Map className="h-4 w-4 mr-2" />
                            {showOutline ? 'Hide Outline' : 'Show Outline'}
                            {showOutline && (
                                <div className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
                            )}
                        </Button>

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
                                        <Label className="text-xs">Line Numbers</Label>
                                        <Switch
                                            checked={showLineNumbers}
                                            onCheckedChange={setShowLineNumbers}
                                            size="sm"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs">Word Count</Label>
                                        <Switch
                                            checked={showWordCount}
                                            onCheckedChange={setShowWordCount}
                                            size="sm"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs">Dark Mode</Label>
                                        <Switch
                                            checked={darkMode}
                                            onCheckedChange={setDarkMode}
                                            size="sm"
                                        />
                                    </div>
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button size="sm">
                            <Save className="h-4 w-4 mr-2" />
                            Save
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Content Area - Split between Editor and Outline */}
            <div className="flex-1 flex overflow-hidden">
                {/* Main Editor */}
                <div className={cn(
                    "flex flex-col transition-all duration-300 ease-in-out",
                    showOutline ? "flex-1" : "w-full"
                )}>
                    <div className="flex-1 p-4 overflow-hidden">
                        <div className="h-full relative">
                            <textarea
                                ref={editorRef}
                                value={bookContent}
                                onChange={(e) => setBookContent(e.target.value)}
                                onSelect={handleTextSelection}
                                onContextMenu={handleContextMenu}
                                className={cn(
                                    "w-full h-full resize-none border rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-blue-500",
                                    "font-serif leading-relaxed transition-all duration-200",
                                    darkMode ? "bg-gray-900 text-white border-gray-700" : "bg-white text-gray-900 border-gray-300"
                                )}
                                style={{
                                    fontSize: `${fontSize}px`,
                                    lineHeight: 1.6,
                                }}
                                placeholder="Start writing your story... Select text and use AI assistance to enhance your writing."
                            />

                            {/* Selection indicators */}
                            {selectedText && (
                                <div className="absolute top-2 right-2 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                                    {selectedText.selectedText.length} chars selected
                                </div>
                            )}

                            {/* Floating Quick Actions */}
                            <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                                {selectedText && (
                                    <Button
                                        size="sm"
                                        onClick={() => setShowAIDialog(true)}
                                        className="shadow-lg hover:shadow-xl transition-shadow"
                                    >
                                        <Wand2 className="h-4 w-4 mr-2" />
                                        Enhance Text
                                    </Button>
                                )}

                                {!showOutline && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowOutline(true)}
                                        className="shadow-lg hover:shadow-xl transition-shadow bg-white"
                                    >
                                        <Map className="h-4 w-4 mr-2" />
                                        Quick Outline
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Resizable Outline Panel */}
                {showOutline && (
                    <>
                        {/* Resize Handle */}
                        <div
                            className="w-1 bg-gray-200 cursor-col-resize hover:bg-gray-300 transition-colors"
                            onMouseDown={(e) => {
                                const startX = e.clientX;
                                const startWidth = outlinePanelWidth;

                                const handleMouseMove = (e: MouseEvent) => {
                                    const deltaX = startX - e.clientX;
                                    const newWidth = Math.max(300, Math.min(800, startWidth + deltaX));
                                    setOutlinePanelWidth(newWidth);
                                };

                                const handleMouseUp = () => {
                                    document.removeEventListener('mousemove', handleMouseMove);
                                    document.removeEventListener('mouseup', handleMouseUp);
                                };

                                document.addEventListener('mousemove', handleMouseMove);
                                document.addEventListener('mouseup', handleMouseUp);
                            }}
                        />

                        {/* Outline Panel */}
                        <div
                            className="flex flex-col bg-gray-50 border-l"
                            style={{ width: `${outlinePanelWidth}px` }}
                        >
                            {/* Outline Header */}
                            <div className="flex items-center justify-between p-3 border-b bg-white">
                                <div className="flex items-center gap-2">
                                    <Map className="h-5 w-5 text-blue-600" />
                                    <h3 className="font-semibold">Story Outline</h3>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setOutlinePanelWidth(outlinePanelWidth === 400 ? 600 : 400)}
                                        className="h-7 w-7 p-0"
                                    >
                                        <Maximize2 className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowOutline(false)}
                                        className="h-7 w-7 p-0"
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>

                            {/* Outline Content */}
                            <div className="flex-1 overflow-hidden">
                                <OutlineEditor className="h-full border-none" />
                            </div>
                        </div>
                    </>
                )}

                {/* AI Insertion Requests Panel */}
                {insertionRequests.length > 0 && !showOutline && (
                    <div className="w-80 border-l bg-gray-50 flex flex-col">
                        <div className="p-4 border-b bg-white">
                            <h3 className="font-semibold">AI Insertions</h3>
                            <p className="text-sm text-gray-600">Pending and completed AI requests</p>
                        </div>

                        <div className="flex-1 overflow-auto p-4 space-y-3">
                            {insertionRequests.map((request) => (
                                <Card key={request.id} className="border">
                                    <CardContent className="p-3">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className={cn(
                                                "px-2 py-1 rounded text-xs font-medium",
                                                request.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                    request.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                                        request.status === 'failed' ? 'bg-red-100 text-red-800' :
                                                            'bg-gray-100 text-gray-800'
                                            )}>
                                                {request.status}
                                            </div>

                                            {request.status === 'completed' && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => applyInsertion(request.id)}
                                                    className="h-6 px-2 text-xs"
                                                >
                                                    <Check className="h-3 w-3 mr-1" />
                                                    Apply
                                                </Button>
                                            )}
                                        </div>

                                        <p className="text-sm text-gray-700 mb-2">{request.instruction}</p>

                                        {request.status === 'completed' && request.result && (
                                            <div className="bg-gray-100 rounded p-2 text-sm">
                                                <p className="text-gray-600 text-xs mb-1">Generated content:</p>
                                                <p className="whitespace-pre-wrap">{request.result}</p>
                                            </div>
                                        )}

                                        {request.status === 'processing' && (
                                            <div className="flex items-center text-sm text-blue-600">
                                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                Generating...
                                            </div>
                                        )}

                                        {request.status === 'failed' && (
                                            <div className="text-sm text-red-600">
                                                Failed to generate content
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Context Menu */}
            {contextMenu.show && (
                <div
                    ref={contextMenuRef}
                    className="fixed z-50 bg-white border rounded-lg shadow-lg py-2 min-w-[200px]"
                    style={{
                        left: contextMenu.x,
                        top: contextMenu.y,
                    }}
                >
                    <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                        onClick={() => {
                            setShowAIDialog(true);
                            closeContextMenu();
                        }}
                    >
                        <Wand2 className="h-4 w-4" />
                        AI Assist at cursor
                    </button>
                    <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                        onClick={() => {
                            // Handle add bookmark
                            closeContextMenu();
                        }}
                    >
                        <BookOpen className="h-4 w-4" />
                        Add bookmark
                    </button>
                    <button
                        className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                        onClick={() => {
                            // Handle copy
                            closeContextMenu();
                        }}
                    >
                        <Copy className="h-4 w-4" />
                        Copy
                    </button>
                </div>
            )}

            {/* AI Insertion Dialog */}
            <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Wand2 className="h-5 w-5" />
                            AI Writing Assistant
                        </DialogTitle>
                        <DialogDescription>
                            {selectedText
                                ? `Generate AI content based on your selected text: "${selectedText.selectedText.substring(0, 50)}${selectedText.selectedText.length > 50 ? '...' : ''}"`
                                : 'Generate AI content at the current cursor position'
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Quick prompts */}
                        <div className="space-y-2">
                            <Label>Choose a writing enhancement</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {AI_INSERTION_PROMPTS.filter(p => p.value !== 'custom').map((prompt) => (
                                    <Button
                                        key={prompt.value}
                                        variant={selectedPrompt === prompt.value ? "default" : "outline"}
                                        onClick={() => setSelectedPrompt(prompt.value)}
                                        className="justify-start h-auto p-3"
                                    >
                                        <div className="flex items-center gap-2">
                                            <prompt.icon className="h-4 w-4" />
                                            <span className="text-sm">{prompt.label}</span>
                                        </div>
                                    </Button>
                                ))}
                                <Button
                                    variant={selectedPrompt === 'custom' ? "default" : "outline"}
                                    onClick={() => setSelectedPrompt('custom')}
                                    className="justify-start h-auto p-3"
                                >
                                    <div className="flex items-center gap-2">
                                        <Wand2 className="h-4 w-4" />
                                        <span className="text-sm">Custom request</span>
                                    </div>
                                </Button>
                            </div>
                        </div>

                        {/* Custom instruction */}
                        {selectedPrompt === 'custom' && (
                            <div className="space-y-2">
                                <Label htmlFor="custom-instruction">Custom instruction</Label>
                                <Textarea
                                    id="custom-instruction"
                                    value={customInstruction}
                                    onChange={(e) => setCustomInstruction(e.target.value)}
                                    placeholder="Describe what you want the AI to add or modify..."
                                    rows={3}
                                />
                            </div>
                        )}

                        {/* Insertion mode */}
                        <div className="space-y-2">
                            <Label>How to insert</Label>
                            <Select value={insertionMode} onValueChange={(value: any) => setInsertionMode(value)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="insert_after">Insert after selection</SelectItem>
                                    <SelectItem value="insert_before">Insert before selection</SelectItem>
                                    <SelectItem value="replace">Replace selection</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <Button variant="outline" onClick={() => setShowAIDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAIInsertion}
                            disabled={isProcessing || (selectedPrompt === 'custom' && !customInstruction.trim())}
                        >
                            {isProcessing ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Wand2 className="h-4 w-4 mr-2" />
                            )}
                            Generate & Insert
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}