/**
 * Outline Editor - Main component for managing story outlines with multiple views
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import { Input } from '~/components/ui/Input';
import { Textarea } from '~/components/ui/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/Select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/Dialog';
import { Badge } from '~/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/Tabs';
import { Separator } from '~/components/ui/separator';
import { Label } from '~/components/ui/label';
import { cn } from '~/utils';

// View components
import OutlineView from './views/OutlineView';
import GridView from './views/GridView';
import MatrixView from './views/MatrixView';

// Icons
import {
    BookOpen,
    Plus,
    Settings,
    Save,
    Eye,
    Grid,
    List,
    Layout,
    BarChart3,
    Download,
    Upload,
    RefreshCw,
    Edit,
    Trash2,
    Copy,
    Filter,
    Search,
    MoreHorizontal
} from 'lucide-react';

// Types
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
    createdAt: string;
    updatedAt: string;
}

interface OutlineEditorProps {
    className?: string;
}

export default function OutlineEditor({ className }: OutlineEditorProps) {
    const { bookId } = useParams<{ bookId: string }>();
    const queryClient = useQueryClient();

    // State
    const [currentView, setCurrentView] = useState<'outline' | 'grid' | 'matrix'>('outline');
    const [showCreateScene, setShowCreateScene] = useState(false);
    const [showCreateChapter, setShowCreateChapter] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
    const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [povFilter, setPovFilter] = useState<string>('all');

    // Form states
    const [newSceneForm, setNewSceneForm] = useState({
        title: '',
        description: '',
        summary: '',
        chapterId: '',
        status: 'planned' as const,
        pov: '',
        setting: '',
        conflict: '',
        goal: '',
        notes: '',
        importance: 'medium' as const
    });

    const [newChapterForm, setNewChapterForm] = useState({
        title: '',
        description: '',
        notes: ''
    });

    // Fetch outline data
    const {
        data: outline,
        isLoading,
        error,
        refetch
    } = useQuery({
        queryKey: ['outline', bookId],
        queryFn: async () => {
            if (!bookId) throw new Error('No book ID provided');

            const response = await fetch('/api/mcp/call-tool', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    server: 'book-creation',
                    tool: 'get_outline',
                    arguments: { bookId }
                })
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch outline');
            }

            return result.outline as Outline;
        },
        enabled: !!bookId
    });

    // Create outline mutation
    const createOutlineMutation = useMutation({
        mutationFn: async (data: {
            title: string;
            description?: string;
            structure: string;
        }) => {
            const response = await fetch('/api/mcp/call-tool', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    server: 'book-creation',
                    tool: 'create_outline',
                    arguments: {
                        bookId,
                        title: data.title,
                        description: data.description,
                        structure: data.structure,
                        authorId: 'current-user', // TODO: Get from auth context
                        conversationId: 'current-conversation' // TODO: Get from conversation context
                    }
                })
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to create outline');
            }

            return result.outline;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['outline', bookId] });
        }
    });

    // Add scene mutation
    const addSceneMutation = useMutation({
        mutationFn: async (sceneData: typeof newSceneForm) => {
            const response = await fetch('/api/mcp/call-tool', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    server: 'book-creation',
                    tool: 'add_scene',
                    arguments: {
                        outlineId: outline?.id,
                        ...sceneData,
                        authorId: 'current-user'
                    }
                })
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to add scene');
            }

            return result.scene;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['outline', bookId] });
            setShowCreateScene(false);
            setNewSceneForm({
                title: '',
                description: '',
                summary: '',
                chapterId: '',
                status: 'planned',
                pov: '',
                setting: '',
                conflict: '',
                goal: '',
                notes: '',
                importance: 'medium'
            });
        }
    });

    // Add chapter mutation
    const addChapterMutation = useMutation({
        mutationFn: async (chapterData: typeof newChapterForm) => {
            const response = await fetch('/api/mcp/call-tool', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    server: 'book-creation',
                    tool: 'add_chapter',
                    arguments: {
                        outlineId: outline?.id,
                        ...chapterData
                    }
                })
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to add chapter');
            }

            return result.chapter;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['outline', bookId] });
            setShowCreateChapter(false);
            setNewChapterForm({
                title: '',
                description: '',
                notes: ''
            });
        }
    });

    // Reorder scenes mutation
    const reorderScenesMutation = useMutation({
        mutationFn: async (sceneIds: string[]) => {
            const response = await fetch('/api/mcp/call-tool', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    server: 'book-creation',
                    tool: 'reorder_scenes',
                    arguments: {
                        outlineId: outline?.id,
                        sceneIds
                    }
                })
            });

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Failed to reorder scenes');
            }

            return result;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['outline', bookId] });
        }
    });

    // Update view when outline settings change
    useEffect(() => {
        if (outline?.settings?.defaultView) {
            setCurrentView(outline.settings.defaultView);
        }
    }, [outline?.settings?.defaultView]);

    // Filter scenes based on search and filters
    const filteredScenes = useMemo(() => {
        if (!outline?.scenes) return [];

        return outline.scenes.filter(scene => {
            // Search filter
            const matchesSearch = !searchQuery ||
                scene.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                scene.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                scene.summary?.toLowerCase().includes(searchQuery.toLowerCase());

            // Status filter
            const matchesStatus = statusFilter === 'all' || scene.status === statusFilter;

            // POV filter
            const matchesPov = povFilter === 'all' || scene.pov === povFilter;

            return matchesSearch && matchesStatus && matchesPov;
        });
    }, [outline?.scenes, searchQuery, statusFilter, povFilter]);

    // Get unique POVs for filter
    const uniquePovs = useMemo(() => {
        if (!outline?.scenes) return [];
        const povs = outline.scenes
            .map(scene => scene.pov)
            .filter(Boolean)
            .filter((pov, index, array) => array.indexOf(pov) === index);
        return povs;
    }, [outline?.scenes]);

    // Event handlers
    const handleCreateOutline = useCallback(async () => {
        if (!bookId) return;

        await createOutlineMutation.mutateAsync({
            title: `${bookId} Outline`,
            description: 'Story outline for this book',
            structure: 'three-act'
        });
    }, [bookId, createOutlineMutation]);

    const handleAddScene = useCallback(async () => {
        await addSceneMutation.mutateAsync(newSceneForm);
    }, [addSceneMutation, newSceneForm]);

    const handleAddChapter = useCallback(async () => {
        await addChapterMutation.mutateAsync(newChapterForm);
    }, [addChapterMutation, newChapterForm]);

    const handleReorderScenes = useCallback(async (sceneIds: string[]) => {
        await reorderScenesMutation.mutateAsync(sceneIds);
    }, [reorderScenesMutation]);

    const handleViewChange = useCallback((view: 'outline' | 'grid' | 'matrix') => {
        setCurrentView(view);
    }, []);

    // Status color mapping
    const getStatusColor = useCallback((status: string) => {
        const colors = {
            planned: 'bg-gray-100 text-gray-800',
            writing: 'bg-blue-100 text-blue-800',
            draft: 'bg-yellow-100 text-yellow-800',
            review: 'bg-orange-100 text-orange-800',
            completed: 'bg-green-100 text-green-800'
        };
        return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
    }, []);

    // Importance color mapping
    const getImportanceColor = useCallback((importance: string) => {
        const colors = {
            low: 'bg-blue-100 text-blue-800',
            medium: 'bg-yellow-100 text-yellow-800',
            high: 'bg-orange-100 text-orange-800',
            critical: 'bg-red-100 text-red-800'
        };
        return colors[importance as keyof typeof colors] || 'bg-gray-100 text-gray-800';
    }, []);

    if (isLoading) {
        return (
            <div className={cn("flex h-full items-center justify-center", className)}>
                <RefreshCw className="h-6 w-6 animate-spin" />
                <span className="ml-2">Loading outline...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className={cn("flex h-full flex-col items-center justify-center", className)}>
                <p className="text-destructive mb-4">Failed to load outline</p>
                <Button onClick={() => refetch()}>Try Again</Button>
            </div>
        );
    }

    if (!outline) {
        return (
            <div className={cn("flex h-full flex-col items-center justify-center space-y-4", className)}>
                <BookOpen className="h-12 w-12 text-muted-foreground" />
                <div className="text-center">
                    <h3 className="text-lg font-semibold">No Outline Found</h3>
                    <p className="text-muted-foreground mb-4">
                        Create an outline to start planning your story structure
                    </p>
                    <Button
                        onClick={handleCreateOutline}
                        disabled={createOutlineMutation.isPending}
                    >
                        {createOutlineMutation.isPending ? (
                            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Plus className="h-4 w-4 mr-2" />
                        )}
                        Create Outline
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("flex h-full flex-col", className)}>
            {/* Header */}
            <div className="border-b bg-background px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <BookOpen className="h-6 w-6" />
                        <div>
                            <h1 className="text-xl font-semibold">{outline.title}</h1>
                            <p className="text-sm text-muted-foreground">
                                {outline.structure} • {outline.metadata.totalScenes} scenes • {outline.metadata.totalChapters} chapters
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        {/* View Toggle */}
                        <div className="flex rounded-lg border">
                            <Button
                                variant={currentView === 'outline' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => handleViewChange('outline')}
                                className="rounded-r-none"
                            >
                                <List className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={currentView === 'grid' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => handleViewChange('grid')}
                                className="rounded-none"
                            >
                                <Grid className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={currentView === 'matrix' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => handleViewChange('matrix')}
                                className="rounded-l-none"
                            >
                                <Layout className="h-4 w-4" />
                            </Button>
                        </div>

                        <Separator orientation="vertical" className="h-6" />

                        <Button variant="outline" size="sm" onClick={() => setShowCreateChapter(true)}>
                            <Plus className="h-4 w-4 mr-1" />
                            Chapter
                        </Button>

                        <Button variant="outline" size="sm" onClick={() => setShowCreateScene(true)}>
                            <Plus className="h-4 w-4 mr-1" />
                            Scene
                        </Button>

                        <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
                            <Settings className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center space-x-4 mt-4">
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search scenes..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="planned">Planned</SelectItem>
                            <SelectItem value="writing">Writing</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="review">Review</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={povFilter} onValueChange={setPovFilter}>
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="POV" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All POV</SelectItem>
                            {uniquePovs.map(pov => (
                                <SelectItem key={pov} value={pov!}>{pov}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {currentView === 'outline' && (
                    <OutlineView
                        outline={outline}
                        scenes={filteredScenes}
                        onReorderScenes={handleReorderScenes}
                        onSceneSelect={setSelectedScene}
                        onChapterSelect={setSelectedChapter}
                        getStatusColor={getStatusColor}
                        getImportanceColor={getImportanceColor}
                    />
                )}

                {currentView === 'grid' && (
                    <GridView
                        outline={outline}
                        scenes={filteredScenes}
                        onReorderScenes={handleReorderScenes}
                        onSceneSelect={setSelectedScene}
                        getStatusColor={getStatusColor}
                        getImportanceColor={getImportanceColor}
                    />
                )}

                {currentView === 'matrix' && (
                    <MatrixView
                        outline={outline}
                        scenes={filteredScenes}
                        onReorderScenes={handleReorderScenes}
                        onSceneSelect={setSelectedScene}
                        getStatusColor={getStatusColor}
                        getImportanceColor={getImportanceColor}
                    />
                )}
            </div>

            {/* Create Scene Dialog */}
            <Dialog open={showCreateScene} onOpenChange={setShowCreateScene}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Add New Scene</DialogTitle>
                        <DialogDescription>
                            Create a new scene for your story outline
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="scene-title">Title *</Label>
                            <Input
                                id="scene-title"
                                value={newSceneForm.title}
                                onChange={(e) => setNewSceneForm(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Scene title"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="scene-description">Description</Label>
                            <Textarea
                                id="scene-description"
                                value={newSceneForm.description}
                                onChange={(e) => setNewSceneForm(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Brief description of what happens in this scene"
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="scene-chapter">Chapter</Label>
                                <Select
                                    value={newSceneForm.chapterId}
                                    onValueChange={(value) => setNewSceneForm(prev => ({ ...prev, chapterId: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select chapter" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">No chapter</SelectItem>
                                        {outline.chapters.map(chapter => (
                                            <SelectItem key={chapter.id} value={chapter.id}>
                                                {chapter.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="scene-status">Status</Label>
                                <Select
                                    value={newSceneForm.status}
                                    onValueChange={(value) => setNewSceneForm(prev => ({ ...prev, status: value as any }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="planned">Planned</SelectItem>
                                        <SelectItem value="writing">Writing</SelectItem>
                                        <SelectItem value="draft">Draft</SelectItem>
                                        <SelectItem value="review">Review</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="scene-pov">POV Character</Label>
                                <Input
                                    id="scene-pov"
                                    value={newSceneForm.pov}
                                    onChange={(e) => setNewSceneForm(prev => ({ ...prev, pov: e.target.value }))}
                                    placeholder="Point of view character"
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="scene-setting">Setting</Label>
                                <Input
                                    id="scene-setting"
                                    value={newSceneForm.setting}
                                    onChange={(e) => setNewSceneForm(prev => ({ ...prev, setting: e.target.value }))}
                                    placeholder="Scene location"
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="scene-conflict">Conflict</Label>
                            <Textarea
                                id="scene-conflict"
                                value={newSceneForm.conflict}
                                onChange={(e) => setNewSceneForm(prev => ({ ...prev, conflict: e.target.value }))}
                                placeholder="Main conflict or tension in this scene"
                                rows={2}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="scene-goal">Goal</Label>
                            <Textarea
                                id="scene-goal"
                                value={newSceneForm.goal}
                                onChange={(e) => setNewSceneForm(prev => ({ ...prev, goal: e.target.value }))}
                                placeholder="What the protagonist wants to achieve"
                                rows={2}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="scene-notes">Notes</Label>
                            <Textarea
                                id="scene-notes"
                                value={newSceneForm.notes}
                                onChange={(e) => setNewSceneForm(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Additional notes or ideas"
                                rows={2}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowCreateScene(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddScene}
                            disabled={!newSceneForm.title || addSceneMutation.isPending}
                        >
                            {addSceneMutation.isPending ? (
                                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Plus className="h-4 w-4 mr-2" />
                            )}
                            Add Scene
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Create Chapter Dialog */}
            <Dialog open={showCreateChapter} onOpenChange={setShowCreateChapter}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Chapter</DialogTitle>
                        <DialogDescription>
                            Create a new chapter to organize your scenes
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="chapter-title">Title *</Label>
                            <Input
                                id="chapter-title"
                                value={newChapterForm.title}
                                onChange={(e) => setNewChapterForm(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Chapter title"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="chapter-description">Description</Label>
                            <Textarea
                                id="chapter-description"
                                value={newChapterForm.description}
                                onChange={(e) => setNewChapterForm(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="What happens in this chapter"
                                rows={3}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="chapter-notes">Notes</Label>
                            <Textarea
                                id="chapter-notes"
                                value={newChapterForm.notes}
                                onChange={(e) => setNewChapterForm(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Additional notes"
                                rows={2}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowCreateChapter(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddChapter}
                            disabled={!newChapterForm.title || addChapterMutation.isPending}
                        >
                            {addChapterMutation.isPending ? (
                                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Plus className="h-4 w-4 mr-2" />
                            )}
                            Add Chapter
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
