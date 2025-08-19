/**
 * Timeline View - Visual timeline for story events and character arcs
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';
import SimpleBadge from '~/components/ui/SimpleBadge';
import { Progress } from '~/components/ui/progress';
import { cn } from '~/utils';

// Icons
import {
    Calendar,
    Users,
    MapPin,
    Zap,
    Heart,
    Sword,
    Plus,
    Edit,
    Eye,
    Filter,
    MoreVertical,
} from 'lucide-react';

// Mock timeline data
const mockTimelineEvents = [
    {
        id: '1',
        title: 'Story Begins',
        description: 'Alice discovers the mysterious letter',
        type: 'plot_point',
        position: 10,
        chapterNumber: 1,
        characters: ['Alice'],
        location: 'Alice\'s Apartment',
        importance: 'high',
        color: '#3b82f6',
    },
    {
        id: '2',
        title: 'First Obstacle',
        description: 'Alice faces the guardian at the threshold',
        type: 'conflict',
        position: 25,
        chapterNumber: 3,
        characters: ['Alice', 'Guardian'],
        location: 'The Portal',
        importance: 'medium',
        color: '#ef4444',
    },
    {
        id: '3',
        title: 'Character Growth',
        description: 'Alice learns to trust her instincts',
        type: 'character_event',
        position: 45,
        chapterNumber: 7,
        characters: ['Alice'],
        location: 'The Forest of Reflection',
        importance: 'high',
        color: '#8b5cf6',
    },
    {
        id: '4',
        title: 'Climactic Battle',
        description: 'Final confrontation with the Shadow Lord',
        type: 'resolution',
        position: 85,
        chapterNumber: 15,
        characters: ['Alice', 'Shadow Lord', 'Mentor'],
        location: 'The Dark Castle',
        importance: 'critical',
        color: '#f59e0b',
    },
];

const eventTypeIcons = {
    plot_point: Zap,
    character_event: Users,
    world_event: MapPin,
    conflict: Sword,
    resolution: Heart,
    milestone: Calendar,
};

const importanceColors = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-blue-100 text-blue-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
};

export default function TimelineView() {
    const [events] = useState(mockTimelineEvents);
    const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');

    const handleEventClick = (eventId: string) => {
        setSelectedEvent(selectedEvent === eventId ? null : eventId);
    };

    const renderTimelineView = () => (
        <div className="relative">
            {/* Timeline Progress Bar */}
            <div className="absolute left-8 top-0 bottom-0 w-1 bg-gray-200 rounded-full">
                <div
                    className="w-full bg-blue-500 rounded-full transition-all duration-1000"
                    style={{ height: '60%' }}
                />
            </div>

            {/* Timeline Events */}
            <div className="space-y-8">
                {events.map((event, index) => {
                    const IconComponent = eventTypeIcons[event.type as keyof typeof eventTypeIcons] || Zap;

                    return (
                        <div key={event.id} className="relative flex items-start gap-6">
                            {/* Timeline Marker */}
                            <div className="relative z-10 flex items-center justify-center">
                                <div
                                    className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-white shadow-lg"
                                    style={{ backgroundColor: event.color }}
                                >
                                    <IconComponent className="h-5 w-5 text-white" />
                                </div>
                            </div>

                            {/* Event Card */}
                            <Card
                                className={cn(
                                    'flex-1 cursor-pointer transition-all hover:shadow-md',
                                    selectedEvent === event.id && 'ring-2 ring-blue-500',
                                    index % 2 === 0 ? 'mr-8' : 'ml-8'
                                )}
                                onClick={() => handleEventClick(event.id)}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <CardTitle className="text-lg font-semibold">
                                                {event.title}
                                            </CardTitle>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Calendar className="h-4 w-4" />
                                                <span>Chapter {event.chapterNumber}</span>
                                                <span>•</span>
                                                <span>{event.position}% through story</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <SimpleBadge
                                                className={cn('text-xs', importanceColors[event.importance as keyof typeof importanceColors])}
                                            >
                                                {event.importance}
                                            </SimpleBadge>
                                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                                <MoreVertical className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <p className="text-sm text-muted-foreground">
                                        {event.description}
                                    </p>

                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <MapPin className="h-4 w-4" />
                                            <span>{event.location}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Users className="h-4 w-4" />
                                            <span>{event.characters.join(', ')}</span>
                                        </div>
                                    </div>

                                    {selectedEvent === event.id && (
                                        <div className="pt-3 border-t space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="sm" className="gap-2">
                                                    <Edit className="h-3 w-3" />
                                                    {'Edit Event'}
                                                </Button>
                                                <Button variant="outline" size="sm" className="gap-2">
                                                    <Eye className="h-3 w-3" />
                                                    {'View Details'}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderListView = () => (
        <div className="space-y-4">
            {events.map((event) => {
                const IconComponent = eventTypeIcons[event.type as keyof typeof eventTypeIcons] || Zap;

                return (
                    <Card key={event.id} className="cursor-pointer hover:shadow-md transition-all">
                        <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                                <div
                                    className="flex items-center justify-center w-10 h-10 rounded-full"
                                    style={{ backgroundColor: event.color }}
                                >
                                    <IconComponent className="h-4 w-4 text-white" />
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-start justify-between">
                                        <h3 className="font-semibold">{event.title}</h3>
                                        <SimpleBadge
                                            className={cn('text-xs', importanceColors[event.importance as keyof typeof importanceColors])}
                                        >
                                            {event.importance}
                                        </SimpleBadge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{event.description}</p>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <span>Chapter {event.chapterNumber}</span>
                                        <span>{event.position}%</span>
                                        <span>{event.location}</span>
                                        <span>{event.characters.join(', ')}</span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{'Story Timeline'}</h1>
                    <p className="text-muted-foreground">
                        {'Visualize your story structure and character arcs'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                        <Button
                            variant={viewMode === 'timeline' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('timeline')}
                        >
                            {'Timeline'}
                        </Button>
                        <Button
                            variant={viewMode === 'list' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('list')}
                        >
                            {'List'}
                        </Button>
                    </div>
                    <Button variant="outline" className="gap-2">
                        <Filter className="h-4 w-4" />
                        {'Filter'}
                    </Button>
                    <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        {'Add Event'}
                    </Button>
                </div>
            </div>

            {/* Story Progress */}
            <Card>
                <CardContent className="p-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold">{'Story Progress'}</h3>
                            <span className="text-sm text-muted-foreground">{'60% Complete'}</span>
                        </div>
                        <Progress value={60} className="h-2" />
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                            <div className="text-center">
                                <p className="font-medium">{'Setup'}</p>
                                <p className="text-muted-foreground">{'Chapters 1-3'}</p>
                            </div>
                            <div className="text-center">
                                <p className="font-medium">{'Rising Action'}</p>
                                <p className="text-muted-foreground">{'Chapters 4-12'}</p>
                            </div>
                            <div className="text-center">
                                <p className="font-medium">{'Climax'}</p>
                                <p className="text-muted-foreground">{'Chapters 13-15'}</p>
                            </div>
                            <div className="text-center">
                                <p className="font-medium">{'Resolution'}</p>
                                <p className="text-muted-foreground">{'Chapters 16-18'}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Timeline Content */}
            <Card>
                <CardContent className="p-6">
                    {viewMode === 'timeline' ? renderTimelineView() : renderListView()}
                </CardContent>
            </Card>
        </div>
    );
}