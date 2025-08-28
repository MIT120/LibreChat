/**
 * Grid View - Card-based grid view for scenes with drag-and-drop
 */

import React, { useState, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import { Badge } from '~/components/ui/Badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/Select';
import { Slider } from '~/components/ui/Slider';
import { cn } from '~/utils';

// Icons
import {
    GripVertical,
    Eye,
    Edit,
    MoreHorizontal,
    FileText,
    Clock,
    Users,
    MapPin,
    Target,
    Zap,
    Grid as GridIcon,
    Filter,
    Settings
} from 'lucide-react';

// Types (shared with OutlineEditor)
interface Scene {
    id: string;
    title: string;
    description?: string;
    summary?: string;
    chapterId?: string;
    order: number;
    status: 'planned' | 'writing' | 'draft' | 'review' | 'completed';
    wordCount?: number;
    targetWordCount?: number;
    tags?: string[];
    notes?: string;
    pov?: string;
    setting?: string;
    timeOfDay?: string;
    conflict?: string;
    goal?: string;
    outcome?: string;
    tension?: number;
    importance?: 'low' | 'medium' | 'high' | 'critical';
    position?: { x: number; y: number };
    color?: string;
}

interface Chapter {
    id: string;
    title: string;
    description?: string;
    order: number;
    scenes: Scene[];
    wordCount?: number;
    targetWordCount?: number;
    status: 'planned' | 'writing' | 'draft' | 'review' | 'completed';
    tags?: string[];
    notes?: string;
    color?: string;
    position?: { x: number; y: number };
}

interface Outline {
    id: string;
    bookId: string;
    title: string;
    description?: string;
    structure: 'three-act' | 'four-act' | 'five-act' | 'hero-journey' | 'custom';
    acts: any[];
    chapters: Chapter[];
    scenes: Scene[];
    settings: {
        defaultView: 'outline' | 'grid' | 'matrix';
        gridColumns?: number;
        matrixRows?: number;
        showWordCounts: boolean;
        showStatus: boolean;
        showTags: boolean;
        colorCoding: 'none' | 'status' | 'pov' | 'importance' | 'custom';
        autoSave: boolean;
    };
    metadata: {
        totalScenes: number;
        totalChapters: number;
        totalWordCount: number;
        targetWordCount: number;
        completionPercentage: number;
        lastModified: string;
        version: number;
    };
}

interface GridViewProps {
    outline: Outline;
    scenes: Scene[];
    onReorderScenes: (sceneIds: string[]) => void;
    onSceneSelect: (scene: Scene) => void;
    getStatusColor: (status: string) => string;
    getImportanceColor: (importance: string) => string;
}

export default function GridView({
    outline,
    scenes,
    onReorderScenes,
    onSceneSelect,
    getStatusColor,
    getImportanceColor
}: GridViewProps) {
    // State
    const [gridColumns, setGridColumns] = useState(outline.settings.gridColumns || 4);
    const [groupBy, setGroupBy] = useState<'none' | 'chapter' | 'status' | 'pov'>('none');
    const [cardSize, setCardSize] = useState<'sm' | 'md' | 'lg'>('md');

    // Group scenes
    const groupedScenes = useMemo(() => {
        const groups: { [key: string]: Scene[] } = {};

        if (groupBy === 'none') {
            groups['all'] = [...scenes].sort((a, b) => a.order - b.order);
        } else if (groupBy === 'chapter') {
            // Group by chapter
            const chapterMap = new Map(outline.chapters.map(ch => [ch.id, ch.title]));

            scenes.forEach(scene => {
                const key = scene.chapterId
                    ? chapterMap.get(scene.chapterId) || 'Unknown Chapter'
                    : 'No Chapter';

                if (!groups[key]) groups[key] = [];
                groups[key].push(scene);
            });
        } else if (groupBy === 'status') {
            // Group by status
            scenes.forEach(scene => {
                const key = scene.status.charAt(0).toUpperCase() + scene.status.slice(1);
                if (!groups[key]) groups[key] = [];
                groups[key].push(scene);
            });
        } else if (groupBy === 'pov') {
            // Group by POV
            scenes.forEach(scene => {
                const key = scene.pov || 'No POV';
                if (!groups[key]) groups[key] = [];
                groups[key].push(scene);
            });
        }

        // Sort scenes within each group
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => a.order - b.order);
        });

        return groups;
    }, [scenes, groupBy, outline.chapters]);

    // Handle drag and drop
    const handleDragEnd = useCallback((result: DropResult) => {
        if (!result.destination) return;

        const { source, destination } = result;

        // Handle reordering within the same group
        if (source.droppableId === destination.droppableId) {
            const groupKey = source.droppableId.replace('grid-', '');
            const groupScenes = [...groupedScenes[groupKey]];

            const [removed] = groupScenes.splice(source.index, 1);
            groupScenes.splice(destination.index, 0, removed);

            // Create new scene order maintaining other groups
            const newSceneIds: string[] = [];

            Object.entries(groupedScenes).forEach(([key, scenes]) => {
                if (key === groupKey) {
                    newSceneIds.push(...groupScenes.map(s => s.id));
                } else {
                    newSceneIds.push(...scenes.map(s => s.id));
                }
            });

            onReorderScenes(newSceneIds);
        }
    }, [groupedScenes, onReorderScenes]);

    // Get card dimensions based on size
    const getCardClass = useCallback(() => {
        const base = "w-full";
        switch (cardSize) {
            case 'sm': return `${base} min-h-[120px]`;
            case 'md': return `${base} min-h-[160px]`;
            case 'lg': return `${base} min-h-[200px]`;
            default: return `${base} min-h-[160px]`;
        }
    }, [cardSize]);

    // Scene card component
    const SceneCard = ({ scene, index }: { scene: Scene; index: number }) => (
        <Draggable draggableId={scene.id} index={index}>
            {(provided, snapshot) => (
                <Card
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={cn(
                        getCardClass(),
                        "group transition-all hover:shadow-md cursor-pointer",
                        snapshot.isDragging && "shadow-lg ring-2 ring-primary rotate-2",
                        scene.color && "border-l-4",
                        outline.settings.colorCoding === 'status' && getStatusColor(scene.status),
                        outline.settings.colorCoding === 'importance' && scene.importance && getImportanceColor(scene.importance)
                    )}
                    style={{
                        borderLeftColor: scene.color,
                        ...provided.draggableProps.style
                    }}
                    onClick={() => onSceneSelect(scene)}
                >
                    <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <CardTitle className="text-sm font-medium line-clamp-2">
                                    {scene.title}
                                </CardTitle>

                                <div className="flex items-center gap-1 mt-1">
                                    {outline.settings.showStatus && (
                                        <Badge variant="secondary" className={cn("text-xs", getStatusColor(scene.status))}>
                                            {scene.status}
                                        </Badge>
                                    )}

                                    {scene.importance && scene.importance !== 'medium' && (
                                        <Badge variant="outline" className={cn("text-xs", getImportanceColor(scene.importance))}>
                                            {scene.importance}
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                <div
                                    {...provided.dragHandleProps}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                                </div>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <MoreHorizontal className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                        {scene.description && (
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                {scene.description}
                            </p>
                        )}

                        <div className="space-y-1">
                            {scene.pov && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Users className="h-3 w-3" />
                                    <span className="truncate">{scene.pov}</span>
                                </div>
                            )}

                            {scene.setting && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    <span className="truncate">{scene.setting}</span>
                                </div>
                            )}

                            {outline.settings.showWordCounts && scene.wordCount && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <FileText className="h-3 w-3" />
                                    <span>{scene.wordCount.toLocaleString()}</span>
                                </div>
                            )}

                            {scene.tension && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Zap className="h-3 w-3" />
                                    <span>{scene.tension}/10</span>
                                </div>
                            )}
                        </div>

                        {outline.settings.showTags && scene.tags && scene.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {scene.tags.slice(0, 3).map(tag => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                        {tag}
                                    </Badge>
                                ))}
                                {scene.tags.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                        +{scene.tags.length - 3}
                                    </Badge>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </Draggable>
    );

    return (
        <div className="h-full flex flex-col">
            {/* Controls */}
            <div className="border-b bg-background px-6 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <GridIcon className="h-4 w-4" />
                            <span className="text-sm font-medium">Grid View</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Columns:</span>
                            <div className="w-24">
                                <Slider
                                    value={[gridColumns]}
                                    onValueChange={([value]) => setGridColumns(value)}
                                    min={2}
                                    max={8}
                                    step={1}
                                    className="w-full"
                                />
                            </div>
                            <span className="text-sm text-muted-foreground min-w-[2ch]">{gridColumns}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Group by:</span>
                            <Select value={groupBy} onValueChange={(value: any) => setGroupBy(value)}>
                                <SelectTrigger className="w-32">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="chapter">Chapter</SelectItem>
                                    <SelectItem value="status">Status</SelectItem>
                                    <SelectItem value="pov">POV</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Size:</span>
                            <Select value={cardSize} onValueChange={(value: any) => setCardSize(value)}>
                                <SelectTrigger className="w-20">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sm">Small</SelectItem>
                                    <SelectItem value="md">Medium</SelectItem>
                                    <SelectItem value="lg">Large</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid Content */}
            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex-1 overflow-auto p-6">
                    {Object.entries(groupedScenes).map(([groupKey, groupScenes]) => (
                        <div key={groupKey} className="mb-8">
                            {groupBy !== 'none' && (
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <div className="h-1 w-8 bg-primary rounded" />
                                    {groupKey}
                                    <Badge variant="secondary" className="ml-2">
                                        {groupScenes.length}
                                    </Badge>
                                </h3>
                            )}

                            <Droppable droppableId={`grid-${groupKey}`}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={cn(
                                            "grid gap-4 transition-colors rounded-lg p-2",
                                            `grid-cols-${gridColumns}`,
                                            snapshot.isDraggingOver && "bg-primary/5"
                                        )}
                                        style={{
                                            gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`
                                        }}
                                    >
                                        {groupScenes.map((scene, index) => (
                                            <SceneCard key={scene.id} scene={scene} index={index} />
                                        ))}
                                        {provided.placeholder}

                                        {groupScenes.length === 0 && (
                                            <div
                                                className="col-span-full text-center py-12 text-muted-foreground"
                                                style={{ gridColumn: `1 / ${gridColumns + 1}` }}
                                            >
                                                <FileText className="h-8 w-8 mx-auto mb-2" />
                                                <p>No scenes in this group</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    ))}

                    {Object.keys(groupedScenes).length === 0 && (
                        <div className="text-center py-12">
                            <GridIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No scenes to display</h3>
                            <p className="text-muted-foreground">
                                Create some scenes to see them in the grid view.
                            </p>
                        </div>
                    )}
                </div>
            </DragDropContext>
        </div>
    );
}
