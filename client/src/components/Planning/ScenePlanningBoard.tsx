/**
 * Scene Planning Board - Simplified Kanban-style interface for organizing and managing scenes
 */

import React, { useState } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import SimpleBadge from '~/components/ui/SimpleBadge';
import { Progress } from '~/components/ui/progress';
import { cn } from '~/utils';

// Icons
import {
    Plus,
    MoreVertical,
    Users,
    MapPin,
    Clock,
    Target,
    CheckCircle,
    Circle,
    Calendar,
    FileText,
    Edit,
    Trash2,
    Copy,
    Eye
} from 'lucide-react';

// Mock data
const mockScenes = [
    {
        id: '1',
        title: 'Opening Scene',
        description: 'Introduce the protagonist in their normal world',
        status: 'planned',
        priority: 'high',
        characters: ['Alice', 'Bob'],
        location: 'Alice\'s Apartment',
        estimatedWords: 1500,
        progress: 0,
    },
    {
        id: '2',
        title: 'The Call to Adventure',
        description: 'Alice receives the mysterious letter',
        status: 'drafted',
        priority: 'high',
        characters: ['Alice'],
        location: 'Post Office',
        estimatedWords: 1200,
        progress: 75,
    },
    {
        id: '3',
        title: 'Meeting the Mentor',
        description: 'Alice meets the wise old librarian',
        status: 'outlined',
        priority: 'medium',
        characters: ['Alice', 'Librarian'],
        location: 'City Library',
        estimatedWords: 2000,
        progress: 25,
    },
];

const statusColumns = [
    { id: 'planned', title: 'Planned', color: 'bg-gray-100' },
    { id: 'outlined', title: 'Outlined', color: 'bg-blue-100' },
    { id: 'drafted', title: 'Drafted', color: 'bg-yellow-100' },
    { id: 'reviewed', title: 'Reviewed', color: 'bg-green-100' },
];

const priorityColors = {
    low: 'bg-gray-100 text-gray-800',
    medium: 'bg-blue-100 text-blue-800',
    high: 'bg-orange-100 text-orange-800',
    urgent: 'bg-red-100 text-red-800',
};

const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
        case 'planned': return <Circle className="h-4 w-4 text-gray-500" />;
        case 'outlined': return <FileText className="h-4 w-4 text-blue-500" />;
        case 'drafted': return <Edit className="h-4 w-4 text-yellow-500" />;
        case 'reviewed': return <CheckCircle className="h-4 w-4 text-green-500" />;
        default: return <Circle className="h-4 w-4 text-gray-500" />;
    }
};

export default function ScenePlanningBoard() {
    const [scenes] = useState(mockScenes);
    const [selectedScene, setSelectedScene] = useState<string | null>(null);

    const getScenesByStatus = (status: string) => {
        return scenes.filter(scene => scene.status === status);
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{'Scene Planning'}</h1>
                    <p className="text-muted-foreground">
                        {'Organize and manage your story scenes using a visual board'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="gap-2">
                        <Eye className="h-4 w-4" />
                        {'View Options'}
                    </Button>
                    <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        {'New Scene'}
                    </Button>
                </div>
            </div>

            {/* Planning Board */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statusColumns.map((column) => (
                    <div key={column.id} className="space-y-4">
                        {/* Column Header */}
                        <div className={cn('rounded-lg p-4', column.color)}>
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold">{column.title}</h3>
                                <SimpleBadge variant="secondary">
                                    {getScenesByStatus(column.id).length}
                                </SimpleBadge>
                            </div>
                        </div>

                        {/* Scene Cards */}
                        <div className="space-y-3">
                            {getScenesByStatus(column.id).map((scene) => (
                                <Card
                                    key={scene.id}
                                    className={cn(
                                        'cursor-pointer transition-all hover:shadow-md',
                                        selectedScene === scene.id && 'ring-2 ring-blue-500'
                                    )}
                                    onClick={() => setSelectedScene(scene.id)}
                                >
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <CardTitle className="text-sm font-medium line-clamp-1">
                                                {scene.title}
                                            </CardTitle>
                                            <div className="flex items-center gap-1">
                                                <StatusIcon status={scene.status} />
                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                    <MoreVertical className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                            {scene.description}
                                        </p>

                                        {/* Progress */}
                                        {scene.progress > 0 && (
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-xs">
                                                    <span>{'Progress'}</span>
                                                    <span>{scene.progress}%</span>
                                                </div>
                                                <Progress value={scene.progress} className="h-1" />
                                            </div>
                                        )}

                                        {/* Metadata */}
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <MapPin className="h-3 w-3" />
                                                <span className="truncate">{scene.location}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Target className="h-3 w-3" />
                                                <span>{scene.estimatedWords.toLocaleString()} words</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Users className="h-3 w-3" />
                                                <span className="truncate">{scene.characters.join(', ')}</span>
                                            </div>
                                        </div>

                                        {/* Priority Badge */}
                                        <div className="flex items-center justify-between">
                                            <SimpleBadge
                                                className={cn('text-xs', priorityColors[scene.priority as keyof typeof priorityColors])}
                                            >
                                                {scene.priority}
                                            </SimpleBadge>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                    <Edit className="h-3 w-3" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            {/* Add New Scene */}
                            <Card className="border-dashed border-2 hover:border-solid transition-all cursor-pointer">
                                <CardContent className="flex items-center justify-center p-6">
                                    <div className="text-center space-y-2">
                                        <Plus className="h-6 w-6 text-muted-foreground mx-auto" />
                                        <p className="text-sm text-muted-foreground">{'Add new scene'}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                ))}
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">{'Total Scenes'}</p>
                                <p className="text-2xl font-bold">{scenes.length}</p>
                            </div>
                            <FileText className="h-8 w-8 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">{'Completed'}</p>
                                <p className="text-2xl font-bold">
                                    {scenes.filter(s => s.status === 'reviewed').length}
                                </p>
                            </div>
                            <CheckCircle className="h-8 w-8 text-green-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">{'Est. Words'}</p>
                                <p className="text-2xl font-bold">
                                    {scenes.reduce((total, scene) => total + scene.estimatedWords, 0).toLocaleString()}
                                </p>
                            </div>
                            <Target className="h-8 w-8 text-orange-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">{'Avg Progress'}</p>
                                <p className="text-2xl font-bold">
                                    {Math.round(scenes.reduce((total, scene) => total + scene.progress, 0) / scenes.length)}%
                                </p>
                            </div>
                            <Calendar className="h-8 w-8 text-purple-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}