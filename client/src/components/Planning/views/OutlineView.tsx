/**
 * Outline View - Traditional hierarchical outline view with drag-and-drop
 */

import React, { useState, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import { Badge } from '~/components/ui/Badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/Collapsible';
import { cn } from '~/utils';

// Icons
import {
    ChevronRight,
    ChevronDown,
    GripVertical,
    Eye,
    Edit,
    MoreHorizontal,
    FileText,
    Clock,
    Users,
    MapPin,
    Target,
    Zap
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

interface Act {
    id: string;
    title: string;
    description?: string;
    order: number;
    chapters: Chapter[];
    wordCount?: number;
    targetWordCount?: number;
    theme?: string;
    conflict?: string;
    color?: string;
}

interface Outline {
    id: string;
    bookId: string;
    title: string;
    description?: string;
    structure: 'three-act' | 'four-act' | 'five-act' | 'hero-journey' | 'custom';
    acts: Act[];
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

interface OutlineViewProps {
    outline: Outline;
    scenes: Scene[];
    onReorderScenes: (sceneIds: string[]) => void;
    onSceneSelect: (scene: Scene) => void;
    onChapterSelect: (chapter: Chapter) => void;
    getStatusColor: (status: string) => string;
    getImportanceColor: (importance: string) => string;
}

export default function OutlineView({
    outline,
    scenes,
    onReorderScenes,
    onSceneSelect,
    onChapterSelect,
    getStatusColor,
    getImportanceColor
}: OutlineViewProps) {
    // State for collapsed sections
    const [collapsedActs, setCollapsedActs] = useState<Set<string>>(new Set());
    const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(new Set());

    // Organize scenes by chapter and act
    const organizedData = useMemo(() => {
        const result = {
            acts: outline.acts.map(act => ({
                ...act,
                chapters: outline.chapters
                    .filter(chapter => act.chapters.some(actChapter => actChapter.id === chapter.id))
                    .map(chapter => ({
                        ...chapter,
                        scenes: scenes
                            .filter(scene => scene.chapterId === chapter.id)
                            .sort((a, b) => a.order - b.order)
                    }))
                    .sort((a, b) => a.order - b.order)
            })).sort((a, b) => a.order - b.order),
            standaloneChapters: outline.chapters
                .filter(chapter => !outline.acts.some(act =>
                    act.chapters.some(actChapter => actChapter.id === chapter.id)
                ))
                .map(chapter => ({
                    ...chapter,
                    scenes: scenes
                        .filter(scene => scene.chapterId === chapter.id)
                        .sort((a, b) => a.order - b.order)
                }))
                .sort((a, b) => a.order - b.order),
            standaloneScenes: scenes
                .filter(scene => !scene.chapterId)
                .sort((a, b) => a.order - b.order)
        };
        return result;
    }, [outline, scenes]);

    // Toggle collapsed state
    const toggleActCollapsed = useCallback((actId: string) => {
        setCollapsedActs(prev => {
            const newSet = new Set(prev);
            if (newSet.has(actId)) {
                newSet.delete(actId);
            } else {
                newSet.add(actId);
            }
            return newSet;
        });
    }, []);

    const toggleChapterCollapsed = useCallback((chapterId: string) => {
        setCollapsedChapters(prev => {
            const newSet = new Set(prev);
            if (newSet.has(chapterId)) {
                newSet.delete(chapterId);
            } else {
                newSet.add(chapterId);
            }
            return newSet;
        });
    }, []);

    // Handle drag and drop
    const handleDragEnd = useCallback((result: DropResult) => {
        if (!result.destination) return;

        const { source, destination } = result;

        // Only handle scene reordering for now
        if (source.droppableId.startsWith('scenes-') && destination.droppableId.startsWith('scenes-')) {
            const sourceScenes = scenes.filter(scene =>
                source.droppableId === 'scenes-standalone'
                    ? !scene.chapterId
                    : scene.chapterId === source.droppableId.replace('scenes-', '')
            );

            const destinationScenes = scenes.filter(scene =>
                destination.droppableId === 'scenes-standalone'
                    ? !scene.chapterId
                    : scene.chapterId === destination.droppableId.replace('scenes-', '')
            );

            // If moving within the same container
            if (source.droppableId === destination.droppableId) {
                const reorderedScenes = Array.from(sourceScenes);
                const [removed] = reorderedScenes.splice(source.index, 1);
                reorderedScenes.splice(destination.index, 0, removed);

                // Update order and call reorder
                const newSceneIds = [
                    ...scenes.filter(scene =>
                        source.droppableId === 'scenes-standalone'
                            ? scene.chapterId
                            : scene.chapterId !== source.droppableId.replace('scenes-', '')
                    ).map(scene => scene.id),
                    ...reorderedScenes.map(scene => scene.id)
                ];

                onReorderScenes(newSceneIds);
            }
        }
    }, [scenes, onReorderScenes]);

    // Scene component
    const SceneItem = ({ scene, index }: { scene: Scene; index: number }) => (
        <Draggable draggableId={scene.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={cn(
                        "group rounded-lg border bg-card p-4 shadow-sm transition-all",
                        snapshot.isDragging && "shadow-md ring-2 ring-primary",
                        "hover:shadow-md"
                    )}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                                <div
                                    {...provided.dragHandleProps}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                                >
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                </div>

                                <h4
                                    className="font-medium text-sm cursor-pointer hover:text-primary"
                                    onClick={() => onSceneSelect(scene)}
                                >
                                    {scene.title}
                                </h4>

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

                            {scene.description && (
                                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                    {scene.description}
                                </p>
                            )}

                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                {scene.pov && (
                                    <div className="flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        {scene.pov}
                                    </div>
                                )}

                                {scene.setting && (
                                    <div className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {scene.setting}
                                    </div>
                                )}

                                {outline.settings.showWordCounts && scene.wordCount && (
                                    <div className="flex items-center gap-1">
                                        <FileText className="h-3 w-3" />
                                        {scene.wordCount.toLocaleString()} words
                                    </div>
                                )}

                                {scene.tension && (
                                    <div className="flex items-center gap-1">
                                        <Zap className="h-3 w-3" />
                                        {scene.tension}/10
                                    </div>
                                )}
                            </div>

                            {outline.settings.showTags && scene.tags && scene.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {scene.tags.map(tag => (
                                        <Badge key={tag} variant="outline" className="text-xs">
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>

                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </Draggable>
    );

    // Chapter component
    const ChapterSection = ({ chapter, actId }: { chapter: Chapter; actId?: string }) => {
        const isCollapsed = collapsedChapters.has(chapter.id);
        const chapterScenes = chapter.scenes;

        return (
            <div className="ml-4 mb-4">
                <Collapsible open={!isCollapsed} onOpenChange={() => toggleChapterCollapsed(chapter.id)}>
                    <CollapsibleTrigger asChild>
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer group">
                            {isCollapsed ? (
                                <ChevronRight className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}

                            <FileText className="h-4 w-4" />

                            <h3
                                className="font-medium flex-1"
                                onClick={() => onChapterSelect(chapter)}
                            >
                                {chapter.title}
                            </h3>

                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{chapterScenes.length} scenes</span>
                                {outline.settings.showWordCounts && chapter.wordCount && (
                                    <span>{chapter.wordCount.toLocaleString()} words</span>
                                )}
                            </div>
                        </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                        <div className="mt-2 ml-4">
                            <Droppable droppableId={`scenes-${chapter.id}`}>
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={cn(
                                            "space-y-2 min-h-[2rem] p-2 rounded-lg transition-colors",
                                            snapshot.isDraggingOver && "bg-primary/5"
                                        )}
                                    >
                                        {chapterScenes.map((scene, index) => (
                                            <SceneItem key={scene.id} scene={scene} index={index} />
                                        ))}
                                        {provided.placeholder}

                                        {chapterScenes.length === 0 && (
                                            <div className="text-center py-4 text-muted-foreground text-sm">
                                                No scenes in this chapter. Drag scenes here or create new ones.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </div>
        );
    };

    // Act component
    const ActSection = ({ act }: { act: Act }) => {
        const isCollapsed = collapsedActs.has(act.id);

        return (
            <div className="mb-6">
                <Collapsible open={!isCollapsed} onOpenChange={() => toggleActCollapsed(act.id)}>
                    <CollapsibleTrigger asChild>
                        <div className="flex items-center gap-2 p-4 rounded-lg bg-primary/5 hover:bg-primary/10 cursor-pointer group">
                            {isCollapsed ? (
                                <ChevronRight className="h-5 w-5" />
                            ) : (
                                <ChevronDown className="h-5 w-5" />
                            )}

                            <h2 className="text-lg font-semibold flex-1">{act.title}</h2>

                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>{act.chapters.length} chapters</span>
                                <span>
                                    {act.chapters.reduce((total, ch) => total + ch.scenes.length, 0)} scenes
                                </span>
                                {outline.settings.showWordCounts && act.wordCount && (
                                    <span>{act.wordCount.toLocaleString()} words</span>
                                )}
                            </div>
                        </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                        <div className="mt-2">
                            {act.description && (
                                <p className="text-muted-foreground mb-4 ml-4">{act.description}</p>
                            )}

                            {act.chapters.map(chapter => (
                                <ChapterSection key={chapter.id} chapter={chapter} actId={act.id} />
                            ))}
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </div>
        );
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div className="h-full overflow-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Acts */}
                    {organizedData.acts.map(act => (
                        <ActSection key={act.id} act={act} />
                    ))}

                    {/* Standalone Chapters */}
                    {organizedData.standaloneChapters.map(chapter => (
                        <ChapterSection key={chapter.id} chapter={chapter} />
                    ))}

                    {/* Standalone Scenes */}
                    {organizedData.standaloneScenes.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Standalone Scenes
                            </h2>

                            <Droppable droppableId="scenes-standalone">
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={cn(
                                            "space-y-2 min-h-[2rem] p-4 rounded-lg border-2 border-dashed transition-colors",
                                            snapshot.isDraggingOver ? "border-primary bg-primary/5" : "border-muted"
                                        )}
                                    >
                                        {organizedData.standaloneScenes.map((scene, index) => (
                                            <SceneItem key={scene.id} scene={scene} index={index} />
                                        ))}
                                        {provided.placeholder}

                                        {organizedData.standaloneScenes.length === 0 && (
                                            <div className="text-center py-8 text-muted-foreground">
                                                No standalone scenes. Drag scenes here or create new ones.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </Droppable>
                        </div>
                    )}

                    {/* Empty state */}
                    {organizedData.acts.length === 0 &&
                        organizedData.standaloneChapters.length === 0 &&
                        organizedData.standaloneScenes.length === 0 && (
                            <div className="text-center py-12">
                                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <h3 className="text-lg font-semibold mb-2">No content yet</h3>
                                <p className="text-muted-foreground">
                                    Start by adding chapters and scenes to build your story structure.
                                </p>
                            </div>
                        )}
                </div>
            </div>
        </DragDropContext>
    );
}
