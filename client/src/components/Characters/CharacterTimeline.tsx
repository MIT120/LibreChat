/**
 * Character Timeline - Track character appearances and development across the story
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import SimpleBadge from '~/components/ui/SimpleBadge';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/Avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/Dialog';
import { Input } from '~/components/ui/Input';
import { Textarea } from '~/components/ui/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/Tabs';
import { Label } from '~/components/ui/label';
import { Slider } from '~/components/ui/slider';
import { Progress } from '~/components/ui/progress';
import { cn } from '~/utils';

// Icons
import {
    Plus,
    Calendar,
    Clock,
    User,
    Users,
    MapPin,
    Eye,
    EyeOff,
    Filter,
    Search,
    BarChart3,
    TrendingUp,
    BookOpen,
    FileText,
    Image as ImageIcon,
    MessageCircle,
    Heart,
    Zap,
    Target,
    Star,
    ChevronLeft,
    ChevronRight,
    MoreVertical,
    Edit,
    Trash2
} from 'lucide-react';

// Types
interface Character {
    _id: string;
    name: string;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'minor' | 'mentor' | 'love_interest' | 'comic_relief';
    avatar?: {
        url: string;
        filename: string;
        description?: string;
    };
    appearances: Array<{
        chapterId: string;
        pageId: string;
        sceneType: string;
        description: string;
        timestamp?: Date;
    }>;
    arc: {
        startingPoint: string;
        majorBeats: Array<{
            chapter?: number;
            description: string;
            transformation: string;
        }>;
        endingPoint: string;
        theme?: string;
    };
}

interface Chapter {
    _id: string;
    title: string;
    number: number;
    status: string;
    wordCount: number;
    estimatedWordCount: number;
}

interface TimelineEvent {
    id: string;
    characterId: string;
    character: Character;
    chapterId: string;
    chapter: Chapter;
    pageId?: string;
    eventType: 'appearance' | 'development' | 'relationship' | 'conflict' | 'resolution' | 'milestone';
    title: string;
    description: string;
    significance: 'low' | 'medium' | 'high' | 'critical';
    timestamp: Date;
    emotionalState?: string;
    physicalChanges?: string[];
    relationshipChanges?: Array<{
        targetCharacterId: string;
        change: string;
    }>;
    developmentNotes?: string;
}

interface CharacterTimelineProps {
    bookId: string;
    characters: Character[];
    chapters: Chapter[];
    onAddEvent: (event: Partial<TimelineEvent>) => Promise<void>;
    onUpdateEvent: (eventId: string, updates: Partial<TimelineEvent>) => Promise<void>;
    onDeleteEvent: (eventId: string) => Promise<void>;
    className?: string;
}

const EVENT_TYPES = [
    { value: 'appearance', label: 'Appearance', icon: Eye, color: 'bg-blue-100 text-blue-800' },
    { value: 'development', label: 'Character Development', icon: TrendingUp, color: 'bg-green-100 text-green-800' },
    { value: 'relationship', label: 'Relationship Change', icon: Heart, color: 'bg-pink-100 text-pink-800' },
    { value: 'conflict', label: 'Conflict', icon: Zap, color: 'bg-red-100 text-red-800' },
    { value: 'resolution', label: 'Resolution', icon: Target, color: 'bg-purple-100 text-purple-800' },
    { value: 'milestone', label: 'Major Milestone', icon: Star, color: 'bg-yellow-100 text-yellow-800' }
];

const SIGNIFICANCE_COLORS = {
    low: 'bg-gray-100 text-gray-800 border-gray-300',
    medium: 'bg-blue-100 text-blue-800 border-blue-300',
    high: 'bg-orange-100 text-orange-800 border-orange-300',
    critical: 'bg-red-100 text-red-800 border-red-300'
};

export default function CharacterTimeline({
    bookId,
    characters,
    chapters,
    onAddEvent,
    onUpdateEvent,
    onDeleteEvent,
    className
}: CharacterTimelineProps) {
    // State
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [selectedCharacter, setSelectedCharacter] = useState<string>('all');
    const [selectedChapter, setSelectedChapter] = useState<string>('all');
    const [selectedEventType, setSelectedEventType] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'timeline' | 'character' | 'analytics'>('timeline');
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
    const [newEvent, setNewEvent] = useState<Partial<TimelineEvent>>({
        eventType: 'appearance',
        title: '',
        description: '',
        significance: 'medium',
        emotionalState: '',
        physicalChanges: [],
        relationshipChanges: [],
        developmentNotes: ''
    });
    const [timelineRange, setTimelineRange] = useState({ start: 1, end: 10 });

    // Generate mock events from character appearances
    useMemo(() => {
        const generatedEvents: TimelineEvent[] = [];

        characters.forEach(character => {
            // Add appearances as events
            character.appearances.forEach((appearance, index) => {
                const chapter = chapters.find(c => c._id === appearance.chapterId);
                if (chapter) {
                    generatedEvents.push({
                        id: `appearance_${character._id}_${index}`,
                        characterId: character._id,
                        character,
                        chapterId: appearance.chapterId,
                        chapter,
                        pageId: appearance.pageId,
                        eventType: 'appearance',
                        title: `${character.name} appears in ${chapter.title}`,
                        description: appearance.description,
                        significance: 'medium',
                        timestamp: appearance.timestamp || new Date()
                    });
                }
            });

            // Add character arc beats as development events
            character.arc.majorBeats.forEach((beat, index) => {
                const chapter = chapters.find(c => c.number === beat.chapter);
                if (chapter) {
                    generatedEvents.push({
                        id: `development_${character._id}_${index}`,
                        characterId: character._id,
                        character,
                        chapterId: chapter._id,
                        chapter,
                        eventType: 'development',
                        title: `${character.name}: ${beat.description}`,
                        description: beat.transformation,
                        significance: 'high',
                        timestamp: new Date(),
                        developmentNotes: beat.transformation
                    });
                }
            });
        });

        setEvents(generatedEvents);
    }, [characters, chapters]);

    // Filter events
    const filteredEvents = useMemo(() => {
        return events.filter(event => {
            if (selectedCharacter !== 'all' && event.characterId !== selectedCharacter) return false;
            if (selectedChapter !== 'all' && event.chapterId !== selectedChapter) return false;
            if (selectedEventType !== 'all' && event.eventType !== selectedEventType) return false;

            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                if (!event.title.toLowerCase().includes(query) &&
                    !event.description.toLowerCase().includes(query) &&
                    !event.character.name.toLowerCase().includes(query)) {
                    return false;
                }
            }

            return true;
        }).sort((a, b) => {
            // Sort by chapter number, then by timestamp
            const chapterDiff = a.chapter.number - b.chapter.number;
            if (chapterDiff !== 0) return chapterDiff;
            return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        });
    }, [events, selectedCharacter, selectedChapter, selectedEventType, searchQuery]);

    // Character analytics
    const characterAnalytics = useMemo(() => {
        const analytics = new Map<string, {
            character: Character;
            totalEvents: number;
            eventsByType: Record<string, number>;
            significance: Record<string, number>;
            chaptersAppeared: Set<string>;
            developmentProgress: number;
        }>();

        characters.forEach(character => {
            const characterEvents = events.filter(e => e.characterId === character._id);
            const eventsByType: Record<string, number> = {};
            const significance: Record<string, number> = {};
            const chaptersAppeared = new Set<string>();

            characterEvents.forEach(event => {
                eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
                significance[event.significance] = (significance[event.significance] || 0) + 1;
                chaptersAppeared.add(event.chapterId);
            });

            // Calculate development progress based on arc completion
            const totalBeats = character.arc.majorBeats.length;
            const completedBeats = characterEvents.filter(e => e.eventType === 'development').length;
            const developmentProgress = totalBeats > 0 ? (completedBeats / totalBeats) * 100 : 0;

            analytics.set(character._id, {
                character,
                totalEvents: characterEvents.length,
                eventsByType,
                significance,
                chaptersAppeared,
                developmentProgress
            });
        });

        return analytics;
    }, [characters, events]);

    // Handle add event
    const handleAddEvent = useCallback(async () => {
        if (!newEvent.characterId || !newEvent.chapterId || !newEvent.title) {
            return;
        }

        const character = characters.find(c => c._id === newEvent.characterId);
        const chapter = chapters.find(c => c._id === newEvent.chapterId);

        if (!character || !chapter) return;

        try {
            await onAddEvent({
                ...newEvent,
                id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                character,
                chapter,
                timestamp: new Date()
            });

            setShowAddDialog(false);
            setNewEvent({
                eventType: 'appearance',
                title: '',
                description: '',
                significance: 'medium',
                emotionalState: '',
                physicalChanges: [],
                relationshipChanges: [],
                developmentNotes: ''
            });
        } catch (error) {
            console.error('Failed to add event:', error);
        }
    }, [newEvent, characters, chapters, onAddEvent]);

    // Handle edit event
    const handleEditEvent = useCallback((event: TimelineEvent) => {
        setEditingEvent(event);
        setShowEditDialog(true);
    }, []);

    // Handle update event
    const handleUpdateEvent = useCallback(async () => {
        if (!editingEvent) return;

        try {
            await onUpdateEvent(editingEvent.id, editingEvent);
            setShowEditDialog(false);
            setEditingEvent(null);
        } catch (error) {
            console.error('Failed to update event:', error);
        }
    }, [editingEvent, onUpdateEvent]);

    // Render timeline view
    const renderTimelineView = () => (
        <div className="space-y-4">
            {/* Timeline scale */}
            <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                    <Label>Chapter Range</Label>
                    <span className="text-sm text-gray-600">
                        Chapters {timelineRange.start} - {timelineRange.end}
                    </span>
                </div>
                <Slider
                    value={[timelineRange.start, timelineRange.end]}
                    onValueChange={([start, end]) => setTimelineRange({ start, end })}
                    max={Math.max(...chapters.map(c => c.number))}
                    min={1}
                    step={1}
                    className="mt-2"
                />
            </div>

            {/* Timeline events */}
            <div className="space-y-3">
                {filteredEvents.map((event, index) => {
                    const eventTypeConfig = EVENT_TYPES.find(t => t.value === event.eventType);
                    const EventIcon = eventTypeConfig?.icon || Eye;

                    return (
                        <div key={event.id} className="relative">
                            {/* Timeline line */}
                            {index < filteredEvents.length - 1 && (
                                <div className="absolute left-6 top-12 w-0.5 h-12 bg-gray-200" />
                            )}

                            <Card className="ml-12 hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                        {/* Event icon */}
                                        <div className={cn(
                                            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center -ml-16 mt-1 border-2 border-white",
                                            eventTypeConfig?.color || 'bg-gray-100 text-gray-800'
                                        )}>
                                            <EventIcon className="h-4 w-4" />
                                        </div>

                                        {/* Event content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h3 className="font-medium text-gray-900 mb-1">
                                                        {event.title}
                                                    </h3>
                                                    <p className="text-sm text-gray-600 mb-2">
                                                        {event.description}
                                                    </p>

                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <span>{event.chapter.title}</span>
                                                        <span>•</span>
                                                        <span>{event.character.name}</span>
                                                        {event.pageId && (
                                                            <>
                                                                <span>•</span>
                                                                <span>Page {event.pageId}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <Badge className={SIGNIFICANCE_COLORS[event.significance]}>
                                                        {event.significance}
                                                    </Badge>

                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEditEvent(event)}
                                                    >
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Additional details */}
                                            {(event.emotionalState || event.physicalChanges?.length || event.relationshipChanges?.length) && (
                                                <div className="mt-3 pt-3 border-t space-y-2">
                                                    {event.emotionalState && (
                                                        <div className="text-xs">
                                                            <span className="font-medium text-gray-700">Emotional State:</span>
                                                            <span className="ml-1 text-gray-600">{event.emotionalState}</span>
                                                        </div>
                                                    )}

                                                    {event.physicalChanges && event.physicalChanges.length > 0 && (
                                                        <div className="text-xs">
                                                            <span className="font-medium text-gray-700">Physical Changes:</span>
                                                            <span className="ml-1 text-gray-600">
                                                                {event.physicalChanges.join(', ')}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {event.relationshipChanges && event.relationshipChanges.length > 0 && (
                                                        <div className="text-xs">
                                                            <span className="font-medium text-gray-700">Relationships:</span>
                                                            <span className="ml-1 text-gray-600">
                                                                {event.relationshipChanges.map(rc => rc.change).join(', ')}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    );
                })}

                {filteredEvents.length === 0 && (
                    <div className="text-center py-12">
                        <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No events found</h3>
                        <p className="text-gray-600 mb-4">
                            {events.length === 0
                                ? "No timeline events have been created yet"
                                : "Try adjusting your filters to see more events"
                            }
                        </p>
                        <Button onClick={() => setShowAddDialog(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Timeline Event
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );

    // Render character view
    const renderCharacterView = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from(characterAnalytics.values()).map(({ character, totalEvents, eventsByType, significance, chaptersAppeared, developmentProgress }) => (
                <Card key={character._id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                                {character.avatar ? (
                                    <AvatarImage src={character.avatar.url} alt={character.name} />
                                ) : null}
                                <AvatarFallback className="text-lg font-semibold">
                                    {character.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h3 className="font-semibold">{character.name}</h3>
                                <p className="text-sm text-gray-600 capitalize">{character.role}</p>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {/* Statistics */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-600">Total Events</span>
                                <p className="font-semibold">{totalEvents}</p>
                            </div>
                            <div>
                                <span className="text-gray-600">Chapters</span>
                                <p className="font-semibold">{chaptersAppeared.size}</p>
                            </div>
                        </div>

                        {/* Development Progress */}
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">Development Progress</span>
                                <span className="font-medium">{Math.round(developmentProgress)}%</span>
                            </div>
                            <Progress value={developmentProgress} className="h-2" />
                        </div>

                        {/* Event breakdown */}
                        <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">Event Types</p>
                            <div className="space-y-1">
                                {Object.entries(eventsByType).map(([type, count]) => {
                                    const typeConfig = EVENT_TYPES.find(t => t.value === type);
                                    return (
                                        <div key={type} className="flex justify-between text-xs">
                                            <span className="text-gray-600">{typeConfig?.label || type}</span>
                                            <span className="font-medium">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Significance breakdown */}
                        <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">Event Significance</p>
                            <div className="flex gap-1">
                                {Object.entries(significance).map(([sig, count]) => (
                                    <Badge
                                        key={sig}
                                        className={cn("text-xs", SIGNIFICANCE_COLORS[sig as keyof typeof SIGNIFICANCE_COLORS])}
                                    >
                                        {sig}: {count}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );

    // Render analytics view
    const renderAnalyticsView = () => (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Event distribution by chapter */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Events by Chapter</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {chapters.slice(0, 10).map(chapter => {
                            const chapterEvents = filteredEvents.filter(e => e.chapterId === chapter._id);
                            const percentage = events.length > 0 ? (chapterEvents.length / events.length) * 100 : 0;

                            return (
                                <div key={chapter._id}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium">{chapter.title}</span>
                                        <span className="text-gray-600">{chapterEvents.length} events</span>
                                    </div>
                                    <Progress value={percentage} className="h-2" />
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Event types distribution */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Event Types Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {EVENT_TYPES.map(eventType => {
                            const typeEvents = filteredEvents.filter(e => e.eventType === eventType.value);
                            const percentage = filteredEvents.length > 0 ? (typeEvents.length / filteredEvents.length) * 100 : 0;

                            return (
                                <div key={eventType.value}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-medium">{eventType.label}</span>
                                        <span className="text-gray-600">{typeEvents.length} events</span>
                                    </div>
                                    <Progress value={percentage} className="h-2" />
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );

    return (
        <div className={cn("character-timeline h-full flex flex-col", className)}>
            {/* Header */}
            <div className="border-b bg-white p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold">Character Timeline</h2>
                        <p className="text-gray-600">Track character appearances and development</p>
                    </div>
                    <Button onClick={() => setShowAddDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Event
                    </Button>
                </div>

                {/* View mode tabs */}
                <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as any)} className="mb-4">
                    <TabsList>
                        <TabsTrigger value="timeline">Timeline</TabsTrigger>
                        <TabsTrigger value="character">Characters</TabsTrigger>
                        <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* Filters */}
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Search events..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 w-64"
                        />
                    </div>

                    <Select value={selectedCharacter} onValueChange={setSelectedCharacter}>
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="All Characters" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Characters</SelectItem>
                            {characters.map((character) => (
                                <SelectItem key={character._id} value={character._id}>
                                    {character.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="All Chapters" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Chapters</SelectItem>
                            {chapters.map((chapter) => (
                                <SelectItem key={chapter._id} value={chapter._id}>
                                    {chapter.title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={selectedEventType} onValueChange={setSelectedEventType}>
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="All Event Types" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Event Types</SelectItem>
                            {EVENT_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {viewMode === 'timeline' && renderTimelineView()}
                {viewMode === 'character' && renderCharacterView()}
                {viewMode === 'analytics' && renderAnalyticsView()}
            </div>

            {/* Add Event Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Add Timeline Event</DialogTitle>
                        <DialogDescription>
                            Record a significant character moment or development
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Character</Label>
                                <Select
                                    value={newEvent.characterId}
                                    onValueChange={(value) => setNewEvent(prev => ({ ...prev, characterId: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select character" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {characters.map((char) => (
                                            <SelectItem key={char._id} value={char._id}>
                                                {char.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Chapter</Label>
                                <Select
                                    value={newEvent.chapterId}
                                    onValueChange={(value) => setNewEvent(prev => ({ ...prev, chapterId: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select chapter" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {chapters.map((chapter) => (
                                            <SelectItem key={chapter._id} value={chapter._id}>
                                                {chapter.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Event Type</Label>
                                <Select
                                    value={newEvent.eventType}
                                    onValueChange={(value) => setNewEvent(prev => ({ ...prev, eventType: value as any }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {EVENT_TYPES.map((type) => (
                                            <SelectItem key={type.value} value={type.value}>
                                                {type.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Significance</Label>
                                <Select
                                    value={newEvent.significance}
                                    onValueChange={(value) => setNewEvent(prev => ({ ...prev, significance: value as any }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="critical">Critical</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label>Event Title</Label>
                            <Input
                                value={newEvent.title}
                                onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Brief title for this event"
                            />
                        </div>

                        <div>
                            <Label>Description</Label>
                            <Textarea
                                value={newEvent.description}
                                onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Detailed description of what happens..."
                                rows={3}
                            />
                        </div>

                        <div>
                            <Label>Emotional State</Label>
                            <Input
                                value={newEvent.emotionalState}
                                onChange={(e) => setNewEvent(prev => ({ ...prev, emotionalState: e.target.value }))}
                                placeholder="Character's emotional state during this event"
                            />
                        </div>

                        <div>
                            <Label>Development Notes</Label>
                            <Textarea
                                value={newEvent.developmentNotes}
                                onChange={(e) => setNewEvent(prev => ({ ...prev, developmentNotes: e.target.value }))}
                                placeholder="How this event contributes to character development..."
                                rows={2}
                            />
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAddEvent}
                                disabled={!newEvent.characterId || !newEvent.chapterId || !newEvent.title}
                            >
                                Add Event
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
