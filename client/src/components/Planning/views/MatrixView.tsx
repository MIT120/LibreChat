/**
 * Matrix View - Table/matrix view for scenes with customizable axes
 */

import React, { useState, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Button } from '~/components/ui/Button';
import { Card, CardContent } from '~/components/ui/Card';
import { Badge } from '~/components/ui/Badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/Table';
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
    Table as TableIcon,
    Settings,
    ArrowUpDown
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

interface MatrixViewProps {
    outline: Outline;
    scenes: Scene[];
    onReorderScenes: (sceneIds: string[]) => void;
    onSceneSelect: (scene: Scene) => void;
    getStatusColor: (status: string) => string;
    getImportanceColor: (importance: string) => string;
}

type MatrixAxis = 'chapter' | 'status' | 'pov' | 'importance' | 'tension' | 'setting' | 'timeOfDay';

export default function MatrixView({
    outline,
    scenes,
    onReorderScenes,
    onSceneSelect,
    getStatusColor,
    getImportanceColor
}: MatrixViewProps) {
    // State
    const [xAxis, setXAxis] = useState<MatrixAxis>('chapter');
    const [yAxis, setYAxis] = useState<MatrixAxis>('status');
    const [cellSize, setCellSize] = useState<'sm' | 'md' | 'lg'>('md');
    const [showMatrix, setShowMatrix] = useState(true);

    // Get axis values
    const getAxisValues = useCallback((axis: MatrixAxis): string[] => {
        switch (axis) {
            case 'chapter':
                return [
                    'No Chapter',
                    ...outline.chapters.map(ch => ch.title)
                ];
            case 'status':
                return ['planned', 'writing', 'draft', 'review', 'completed'];
            case 'pov':
                const povs = [...new Set(scenes.map(s => s.pov).filter(Boolean))];
                return ['No POV', ...povs];
            case 'importance':
                return ['low', 'medium', 'high', 'critical'];
            case 'tension':
                return ['1-3', '4-6', '7-8', '9-10'];
            case 'setting':
                const settings = [...new Set(scenes.map(s => s.setting).filter(Boolean))];
                return ['No Setting', ...settings];
            case 'timeOfDay':
                const times = [...new Set(scenes.map(s => s.timeOfDay).filter(Boolean))];
                return ['No Time', ...times];
            default:
                return [];
        }
    }, [scenes, outline.chapters]);

    // Get scene value for axis
    const getSceneAxisValue = useCallback((scene: Scene, axis: MatrixAxis): string => {
        switch (axis) {
            case 'chapter':
                if (!scene.chapterId) return 'No Chapter';
                const chapter = outline.chapters.find(ch => ch.id === scene.chapterId);
                return chapter?.title || 'Unknown Chapter';
            case 'status':
                return scene.status;
            case 'pov':
                return scene.pov || 'No POV';
            case 'importance':
                return scene.importance || 'medium';
            case 'tension':
                if (!scene.tension) return '1-3';
                if (scene.tension <= 3) return '1-3';
                if (scene.tension <= 6) return '4-6';
                if (scene.tension <= 8) return '7-8';
                return '9-10';
            case 'setting':
                return scene.setting || 'No Setting';
            case 'timeOfDay':
                return scene.timeOfDay || 'No Time';
            default:
                return '';
        }
    }, [outline.chapters]);

    // Create matrix data
    const matrixData = useMemo(() => {
        const xValues = getAxisValues(xAxis);
        const yValues = getAxisValues(yAxis);

        const matrix: { [key: string]: { [key: string]: Scene[] } } = {};

        // Initialize matrix
        yValues.forEach(yVal => {
            matrix[yVal] = {};
            xValues.forEach(xVal => {
                matrix[yVal][xVal] = [];
            });
        });

        // Populate matrix with scenes
        scenes.forEach(scene => {
            const xVal = getSceneAxisValue(scene, xAxis);
            const yVal = getSceneAxisValue(scene, yAxis);

            if (!matrix[yVal]) matrix[yVal] = {};
            if (!matrix[yVal][xVal]) matrix[yVal][xVal] = [];

            matrix[yVal][xVal].push(scene);
        });

        // Sort scenes in each cell
        Object.keys(matrix).forEach(yVal => {
            Object.keys(matrix[yVal]).forEach(xVal => {
                matrix[yVal][xVal].sort((a, b) => a.order - b.order);
            });
        });

        return { matrix, xValues, yValues };
    }, [scenes, xAxis, yAxis, getAxisValues, getSceneAxisValue]);

    // Handle drag and drop
    const handleDragEnd = useCallback((result: DropResult) => {
        if (!result.destination) return;

        const { source, destination } = result;

        // Parse cell coordinates from droppableId
        const parseCell = (id: string) => {
            const parts = id.replace('cell-', '').split('-');
            return { y: parts[0], x: parts[1] };
        };

        const sourceCell = parseCell(source.droppableId);
        const destCell = parseCell(destination.droppableId);

        // Get source and destination scenes
        const sourceScenes = [...matrixData.matrix[sourceCell.y][sourceCell.x]];
        const destScenes = source.droppableId === destination.droppableId
            ? sourceScenes
            : [...matrixData.matrix[destCell.y][destCell.x]];

        if (source.droppableId === destination.droppableId) {
            // Reorder within same cell
            const [removed] = sourceScenes.splice(source.index, 1);
            sourceScenes.splice(destination.index, 0, removed);

            // Create new scene order
            const newOrder = scenes.map(scene => {
                const sceneInCell = sourceScenes.find(s => s.id === scene.id);
                return sceneInCell || scene;
            });

            onReorderScenes(newOrder.map(s => s.id));
        } else {
            // Move between cells - this would require updating scene properties
            // For now, just reorder within cells
            console.log('Cross-cell movement not implemented yet');
        }
    }, [matrixData, scenes, onReorderScenes]);

    // Get cell dimensions
    const getCellClass = useCallback(() => {
        switch (cellSize) {
            case 'sm': return 'min-h-[80px] max-h-[120px]';
            case 'md': return 'min-h-[120px] max-h-[180px]';
            case 'lg': return 'min-h-[160px] max-h-[240px]';
            default: return 'min-h-[120px] max-h-[180px]';
        }
    }, [cellSize]);

    // Scene chip component
    const SceneChip = ({ scene, index }: { scene: Scene; index: number }) => (
        <Draggable draggableId={scene.id} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={cn(
                        "group flex items-center gap-2 p-2 rounded border bg-card text-xs cursor-pointer transition-all",
                        snapshot.isDragging && "shadow-md ring-2 ring-primary scale-105",
                        "hover:shadow-sm hover:bg-accent",
                        scene.color && "border-l-2",
                        outline.settings.colorCoding === 'status' && getStatusColor(scene.status),
                        outline.settings.colorCoding === 'importance' && scene.importance && getImportanceColor(scene.importance)
                    )}
                    style={{ borderLeftColor: scene.color }}
                    onClick={() => onSceneSelect(scene)}
                >
                    <div
                        {...provided.dragHandleProps}
                        className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <GripVertical className="h-3 w-3 text-muted-foreground" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{scene.title}</div>

                        <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                            {scene.pov && (
                                <div className="flex items-center gap-1">
                                    <Users className="h-2 w-2" />
                                    <span className="truncate max-w-[60px]">{scene.pov}</span>
                                </div>
                            )}

                            {outline.settings.showWordCounts && scene.wordCount && (
                                <div className="flex items-center gap-1">
                                    <FileText className="h-2 w-2" />
                                    <span>{scene.wordCount.toLocaleString()}</span>
                                </div>
                            )}

                            {scene.tension && (
                                <div className="flex items-center gap-1">
                                    <Zap className="h-2 w-2" />
                                    <span>{scene.tension}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {outline.settings.showStatus && (
                        <Badge variant="secondary" className={cn("text-xs h-4", getStatusColor(scene.status))}>
                            {scene.status.charAt(0).toUpperCase()}
                        </Badge>
                    )}
                </div>
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
                            <TableIcon className="h-4 w-4" />
                            <span className="text-sm font-medium">Matrix View</span>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">X-Axis:</span>
                                <Select value={xAxis} onValueChange={(value: MatrixAxis) => setXAxis(value)}>
                                    <SelectTrigger className="w-32">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="chapter">Chapter</SelectItem>
                                        <SelectItem value="status">Status</SelectItem>
                                        <SelectItem value="pov">POV</SelectItem>
                                        <SelectItem value="importance">Importance</SelectItem>
                                        <SelectItem value="tension">Tension</SelectItem>
                                        <SelectItem value="setting">Setting</SelectItem>
                                        <SelectItem value="timeOfDay">Time of Day</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Y-Axis:</span>
                                <Select value={yAxis} onValueChange={(value: MatrixAxis) => setYAxis(value)}>
                                    <SelectTrigger className="w-32">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="chapter">Chapter</SelectItem>
                                        <SelectItem value="status">Status</SelectItem>
                                        <SelectItem value="pov">POV</SelectItem>
                                        <SelectItem value="importance">Importance</SelectItem>
                                        <SelectItem value="tension">Tension</SelectItem>
                                        <SelectItem value="setting">Setting</SelectItem>
                                        <SelectItem value="timeOfDay">Time of Day</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Cell Size:</span>
                            <Select value={cellSize} onValueChange={(value: any) => setCellSize(value)}>
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

                        <Button
                            variant={showMatrix ? "default" : "outline"}
                            size="sm"
                            onClick={() => setShowMatrix(!showMatrix)}
                        >
                            <TableIcon className="h-4 w-4 mr-1" />
                            {showMatrix ? 'Hide Matrix' : 'Show Matrix'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Matrix Content */}
            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex-1 overflow-auto">
                    {showMatrix ? (
                        <div className="p-4">
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-32 font-semibold">
                                                {yAxis.charAt(0).toUpperCase() + yAxis.slice(1)} \ {xAxis.charAt(0).toUpperCase() + xAxis.slice(1)}
                                            </TableHead>
                                            {matrixData.xValues.map(xVal => (
                                                <TableHead key={xVal} className="font-semibold text-center min-w-[200px]">
                                                    {xVal}
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>

                                    <TableBody>
                                        {matrixData.yValues.map(yVal => (
                                            <TableRow key={yVal}>
                                                <TableCell className="font-medium bg-muted/50">
                                                    {yVal}
                                                </TableCell>
                                                {matrixData.xValues.map(xVal => {
                                                    const cellScenes = matrixData.matrix[yVal]?.[xVal] || [];
                                                    return (
                                                        <TableCell key={`${yVal}-${xVal}`} className="p-2 align-top">
                                                            <Droppable droppableId={`cell-${yVal}-${xVal}`}>
                                                                {(provided, snapshot) => (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.droppableProps}
                                                                        className={cn(
                                                                            getCellClass(),
                                                                            "w-full space-y-1 overflow-y-auto transition-colors rounded border-2 border-dashed border-transparent p-1",
                                                                            snapshot.isDraggingOver && "border-primary bg-primary/5"
                                                                        )}
                                                                    >
                                                                        {cellScenes.map((scene, index) => (
                                                                            <SceneChip key={scene.id} scene={scene} index={index} />
                                                                        ))}
                                                                        {provided.placeholder}

                                                                        {cellScenes.length === 0 && (
                                                                            <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                                                                                Drop scenes here
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </Droppable>
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Matrix Stats */}
                            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                                <h4 className="font-medium mb-2">Matrix Statistics</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Total Scenes:</span>
                                        <span className="ml-2 font-medium">{scenes.length}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">X-Axis Values:</span>
                                        <span className="ml-2 font-medium">{matrixData.xValues.length}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Y-Axis Values:</span>
                                        <span className="ml-2 font-medium">{matrixData.yValues.length}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Matrix Cells:</span>
                                        <span className="ml-2 font-medium">{matrixData.xValues.length * matrixData.yValues.length}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <TableIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Matrix Hidden</h3>
                                <p className="text-muted-foreground mb-4">
                                    Click "Show Matrix" to display the scene matrix view.
                                </p>
                                <Button onClick={() => setShowMatrix(true)}>
                                    <TableIcon className="h-4 w-4 mr-2" />
                                    Show Matrix
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DragDropContext>
        </div>
    );
}
