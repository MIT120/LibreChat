/**
 * Enhanced Writing Environment - Distraction-free writing interface with smart context panel
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/Tabs';
import SimpleBadge from '~/components/ui/SimpleBadge';
import { Progress } from '~/components/ui/progress';
import { Separator } from '~/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/Tooltip';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '~/components/ui/resizable';
import { cn } from '~/utils';

// Icons
import {
    PenTool,
    Target,
    Clock,
    Eye,
    EyeOff,
    Maximize,
    Minimize,
    Save,
    RotateCcw,
    RotateCw,
    Search,
    BookOpen,
    Users,
    MapPin,
    Calendar,
    Lightbulb,
    AlertTriangle,
    TrendingUp,
    FileText,
    Settings,
    ChevronRight,
    ChevronLeft,
    Timer,
    Volume2,
    VolumeX
} from 'lucide-react';

// Types
interface WritingSession {
    startTime: Date;
    wordCount: number;
    target: number;
    timeTarget: number; // minutes
    currentStreak: number;
}

interface ContextData {
    characters: Array<{
        id: string;
        name: string;
        description: string;
        currentState: string;
        lastAppearance?: string;
    }>;
    locations: Array<{
        id: string;
        name: string;
        description: string;
        visualDetails: string[];
    }>;
    timeline: Array<{
        id: string;
        title: string;
        description: string;
        position: number;
        importance: 'low' | 'medium' | 'high' | 'critical';
    }>;
    plotlines: Array<{
        id: string;
        name: string;
        currentStatus: string;
        nextEvents: string[];
    }>;
    consistencyAlerts: Array<{
        type: 'character' | 'location' | 'timeline' | 'plot';
        message: string;
        severity: 'warning' | 'error';
        suggestions: string[];
    }>;
}

interface WritingStats {
    wordsWritten: number;
    timeElapsed: number; // minutes
    wpm: number;
    sessionGoal: number;
    dailyGoal: number;
    dailyProgress: number;
    streak: number;
}

interface EnhancedWritingEnvironmentProps {
    bookId: string;
    chapterId?: string;
    pageId?: string;
    initialContent?: string;
    onContentChange?: (content: string) => void;
    onSave?: (content: string) => Promise<void>;
    contextData?: ContextData;
    className?: string;
}

const AUTOSAVE_DELAY = 2000; // 2 seconds

export default function EnhancedWritingEnvironment({
    bookId,
    chapterId,
    pageId,
    initialContent = '',
    onContentChange,
    onSave,
    contextData,
    className
}: EnhancedWritingEnvironmentProps) {
    // State
    const [content, setContent] = useState(initialContent);
    const [focusMode, setFocusMode] = useState(false);
    const [contextPanelVisible, setContextPanelVisible] = useState(true);
    const [contextPanelSize, setContextPanelSize] = useState(25);
    const [activeContextTab, setActiveContextTab] = useState('characters');
    const [session, setSession] = useState<WritingSession>({
        startTime: new Date(),
        wordCount: 0,
        target: 500,
        timeTarget: 60,
        currentStreak: 0
    });
    const [stats, setStats] = useState<WritingStats>({
        wordsWritten: 0,
        timeElapsed: 0,
        wpm: 0,
        sessionGoal: 500,
        dailyGoal: 1000,
        dailyProgress: 350,
        streak: 5
    });
    const [isTyping, setIsTyping] = useState(false);
    const [lastSave, setLastSave] = useState<Date | null>(null);
    const [soundEnabled, setSoundEnabled] = useState(false);
    const [showWordTarget, setShowWordTarget] = useState(true);
    const [showTimer, setShowTimer] = useState(true);

    // Refs
    const editorRef = useRef<HTMLTextAreaElement>(null);
    const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Calculate word count
    const wordCount = useMemo(() => {
        return content.trim().split(/\s+/).filter(word => word.length > 0).length;
    }, [content]);

    // Calculate session statistics
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const elapsed = Math.floor((now.getTime() - session.startTime.getTime()) / (1000 * 60));
            const wpm = elapsed > 0 ? Math.round(stats.wordsWritten / elapsed) : 0;

            setStats(prev => ({
                ...prev,
                timeElapsed: elapsed,
                wpm: wpm,
                wordsWritten: wordCount - session.wordCount
            }));
        }, 1000);

        return () => clearInterval(interval);
    }, [session.startTime, session.wordCount, wordCount, stats.wordsWritten]);

    // Handle content changes
    const handleContentChange = useCallback((newContent: string) => {
        setContent(newContent);
        setIsTyping(true);
        onContentChange?.(newContent);

        // Clear existing autosave timeout
        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
        }

        // Set new autosave timeout
        autosaveTimeoutRef.current = setTimeout(() => {
            handleAutoSave(newContent);
            setIsTyping(false);
        }, AUTOSAVE_DELAY);
    }, [onContentChange]);

    // Handle auto-save
    const handleAutoSave = useCallback(async (contentToSave: string) => {
        try {
            await onSave?.(contentToSave);
            setLastSave(new Date());
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }, [onSave]);

    // Handle manual save
    const handleManualSave = useCallback(async () => {
        try {
            await onSave?.(content);
            setLastSave(new Date());
        } catch (error) {
            console.error('Save failed:', error);
        }
    }, [content, onSave]);

    // Focus mode toggle
    const toggleFocusMode = useCallback(() => {
        setFocusMode(prev => !prev);
        if (!focusMode) {
            setContextPanelVisible(false);
        } else {
            setContextPanelVisible(true);
        }
    }, [focusMode]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl/Cmd + S - Save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleManualSave();
            }

            // Ctrl/Cmd + Shift + F - Toggle focus mode
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
                e.preventDefault();
                toggleFocusMode();
            }

            // Ctrl/Cmd + Shift + P - Toggle context panel
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
                e.preventDefault();
                setContextPanelVisible(prev => !prev);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleManualSave, toggleFocusMode]);

    // Progress calculations
    const sessionProgress = Math.min((stats.wordsWritten / session.target) * 100, 100);
    const dailyProgress = Math.min((stats.dailyProgress / stats.dailyGoal) * 100, 100);
    const timeProgress = Math.min((stats.timeElapsed / session.timeTarget) * 100, 100);

    // Context panel content
    const renderContextPanel = () => {
        if (!contextData) return null;

        return (
            <div className="h-full flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-semibold">Context</h3>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setContextPanelVisible(false)}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <Tabs value={activeContextTab} onValueChange={setActiveContextTab} className="flex-1">
                    <TabsList className="grid w-full grid-cols-4 p-1 m-2">
                        <TabsTrigger value="characters" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            Characters
                        </TabsTrigger>
                        <TabsTrigger value="locations" className="text-xs">
                            <MapPin className="h-3 w-3 mr-1" />
                            Locations
                        </TabsTrigger>
                        <TabsTrigger value="timeline" className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            Timeline
                        </TabsTrigger>
                        <TabsTrigger value="alerts" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Alerts
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex-1 overflow-auto">
                        <TabsContent value="characters" className="m-0 p-4 space-y-3">
                            {contextData.characters.map((character) => (
                                <Card key={character.id} className="p-3">
                                    <div className="space-y-2">
                                        <h4 className="font-medium text-sm">{character.name}</h4>
                                        <p className="text-xs text-gray-600">{character.description}</p>
                                        {character.currentState && (
                                            <SimpleBadge className="text-xs bg-gray-100 text-gray-800">
                                                {character.currentState}
                                            </SimpleBadge>
                                        )}
                                        {character.lastAppearance && (
                                            <p className="text-xs text-gray-500">
                                                Last seen: {character.lastAppearance}
                                            </p>
                                        )}
                                    </div>
                                </Card>
                            ))}
                        </TabsContent>

                        <TabsContent value="locations" className="m-0 p-4 space-y-3">
                            {contextData.locations.map((location) => (
                                <Card key={location.id} className="p-3">
                                    <div className="space-y-2">
                                        <h4 className="font-medium text-sm">{location.name}</h4>
                                        <p className="text-xs text-gray-600">{location.description}</p>
                                        {location.visualDetails.length > 0 && (
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium">Visual Details:</p>
                                                {location.visualDetails.map((detail, index) => (
                                                    <p key={index} className="text-xs text-gray-500">• {detail}</p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            ))}
                        </TabsContent>

                        <TabsContent value="timeline" className="m-0 p-4 space-y-3">
                            {contextData.timeline.map((event) => (
                                <Card key={event.id} className="p-3">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-medium text-sm">{event.title}</h4>
                                            <SimpleBadge
                                                className={`text-xs ${event.importance === 'critical' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}
                                            >
                                                {event.importance}
                                            </SimpleBadge>
                                        </div>
                                        <p className="text-xs text-gray-600">{event.description}</p>
                                        <div className="w-full bg-gray-200 rounded-full h-1">
                                            <div
                                                className="bg-blue-600 h-1 rounded-full"
                                                style={{ width: `${event.position}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </TabsContent>

                        <TabsContent value="alerts" className="m-0 p-4 space-y-3">
                            {contextData.consistencyAlerts.map((alert, index) => (
                                <Card key={index} className={cn("p-3", {
                                    "border-yellow-200 bg-yellow-50": alert.severity === 'warning',
                                    "border-red-200 bg-red-50": alert.severity === 'error'
                                })}>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className={cn("h-4 w-4", {
                                                "text-yellow-600": alert.severity === 'warning',
                                                "text-red-600": alert.severity === 'error'
                                            })} />
                                            <span className="text-xs font-medium capitalize">{alert.type}</span>
                                        </div>
                                        <p className="text-xs text-gray-700">{alert.message}</p>
                                        {alert.suggestions.length > 0 && (
                                            <div className="space-y-1">
                                                <p className="text-xs font-medium">Suggestions:</p>
                                                {alert.suggestions.map((suggestion, i) => (
                                                    <p key={i} className="text-xs text-gray-600">• {suggestion}</p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            ))}
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        );
    };

    // Writing stats panel
    const renderStatsPanel = () => (
        <div className="flex items-center gap-4 p-3 bg-gray-50 border-b">
            {showWordTarget && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-2">
                                <Target className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium">{stats.wordsWritten}/{session.target}</span>
                                <div className="w-16 h-2 bg-gray-200 rounded-full">
                                    <div
                                        className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                                        style={{ width: `${sessionProgress}%` }}
                                    />
                                </div>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Session Progress: {Math.round(sessionProgress)}%</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}

            {showTimer && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-2">
                                <Timer className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium">
                                    {Math.floor(stats.timeElapsed / 60)}:{(stats.timeElapsed % 60).toString().padStart(2, '0')}
                                </span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Writing Time: {stats.timeElapsed} minutes</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}

            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-purple-600" />
                            <span className="text-sm font-medium">{stats.wpm} WPM</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Words per minute</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-orange-600" />
                            <span className="text-sm font-medium">{wordCount} words</span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Total words in document</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <div className="flex-1" />

            {isTyping && (
                <SimpleBadge className="text-xs bg-gray-100 text-gray-800">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse mr-2" />
                    Typing...
                </SimpleBadge>
            )}

            {lastSave && (
                <span className="text-xs text-gray-500">
                    Saved {new Date(lastSave).toLocaleTimeString()}
                </span>
            )}

            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                >
                    {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>

                <Button variant="ghost" size="sm" onClick={handleManualSave}>
                    <Save className="h-4 w-4" />
                </Button>

                <Button variant="ghost" size="sm" onClick={toggleFocusMode}>
                    {focusMode ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
            </div>
        </div>
    );

    return (
        <div className={cn("enhanced-writing-environment h-full flex flex-col", className)}>
            {/* Stats Panel */}
            {!focusMode && renderStatsPanel()}

            {/* Main Content */}
            <div className="flex-1 overflow-hidden">
                <ResizablePanelGroup direction="horizontal">
                    {/* Editor Panel */}
                    <ResizablePanel defaultSize={contextPanelVisible ? 75 : 100}>
                        <div className="h-full flex flex-col">
                            {/* Editor */}
                            <div className="flex-1 p-6">
                                <textarea
                                    ref={editorRef}
                                    value={content}
                                    onChange={(e) => handleContentChange(e.target.value)}
                                    placeholder="Start writing your story..."
                                    className={cn(
                                        "w-full h-full resize-none border-none outline-none text-gray-900 bg-transparent",
                                        "font-serif text-lg leading-relaxed",
                                        focusMode && "text-xl leading-loose"
                                    )}
                                    style={{
                                        fontFamily: '"Georgia", "Times New Roman", serif',
                                        lineHeight: focusMode ? '2' : '1.8'
                                    }}
                                />
                            </div>
                        </div>
                    </ResizablePanel>

                    {/* Context Panel */}
                    {contextPanelVisible && !focusMode && (
                        <>
                            <ResizableHandle />
                            <ResizablePanel
                                defaultSize={25}
                                minSize={20}
                                maxSize={40}
                                onResize={setContextPanelSize}
                            >
                                <div className="h-full border-l bg-gray-50">
                                    {renderContextPanel()}
                                </div>
                            </ResizablePanel>
                        </>
                    )}
                </ResizablePanelGroup>
            </div>

            {/* Context Panel Toggle (when hidden) */}
            {!contextPanelVisible && !focusMode && (
                <Button
                    variant="outline"
                    size="sm"
                    className="fixed right-4 top-1/2 transform -translate-y-1/2 z-50"
                    onClick={() => setContextPanelVisible(true)}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
            )}

            {/* Focus Mode Overlay */}
            {focusMode && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center">
                    <div className="bg-white rounded-lg p-4 max-w-4xl w-full mx-4 h-3/4 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold">Focus Mode</h3>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">
                                    {stats.wordsWritten}/{session.target} words
                                </span>
                                <Button variant="ghost" size="sm" onClick={toggleFocusMode}>
                                    <Minimize className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <textarea
                            value={content}
                            onChange={(e) => handleContentChange(e.target.value)}
                            placeholder="Focus on your writing..."
                            className="flex-1 w-full resize-none border-none outline-none text-gray-900 font-serif text-xl leading-loose p-6 bg-gray-50 rounded-lg"
                            autoFocus
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
