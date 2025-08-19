/**
 * Workspace Dashboard - Main interface for managing writing projects and books
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/Tabs';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import SimpleBadge from '~/components/ui/SimpleBadge';
import { Progress } from '~/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/Avatar';
import { Separator } from '~/components/ui/separator';
import { Calendar } from '~/components/ui/calendar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/DropdownMenu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/Dialog';
import { Input } from '~/components/ui/Input';
import { Textarea } from '~/components/ui/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/Select';
import { cn } from '~/utils';
import TimelineView from '../StoryPlanning/TimelineView';

// Icons
import {
    BookOpen,
    Target,
    TrendingUp,
    Calendar as CalendarIcon,
    Settings,
    Plus,
    MoreVertical,
    Clock,
    Users,
    FileText,
    BarChart3,
    PenTool,
    Map,
    Search,
    Filter,
    Star,
    Archive
} from 'lucide-react';

// Types
interface Workspace {
    _id: string;
    name: string;
    description?: string;
    books: string[];
    activeBookId?: string;
    writingTargets: {
        daily: number;
        weekly: number;
        monthly: number;
    };
    statistics: {
        totalWords: number;
        totalPages: number;
        totalChapters: number;
        totalBooks: number;
        currentStreak: number;
        longestStreak: number;
        lastWritingSession?: Date;
    };
    layout: {
        sidebar: { width: number; collapsed: boolean; position: 'left' | 'right' };
        panels: Record<string, boolean>;
        views: {
            defaultView: string;
            lastView?: string;
            splitView: boolean;
            focusMode: boolean;
        };
    };
    settings: {
        theme: 'light' | 'dark' | 'auto';
        autoSave: boolean;
        notifications: Record<string, boolean>;
    };
    createdAt: Date;
    updatedAt: Date;
}

interface WorkspaceStats {
    totalWords: number;
    totalPages: number;
    totalChapters: number;
    totalBooks: number;
    longestStreak: number;
    currentStreak: number;
    lastWritingSession?: Date;
    dailyProgress: {
        today: number;
        thisWeek: number;
        thisMonth: number;
    };
    goalProgress: {
        daily: { target: number; achieved: number; percentage: number };
        weekly: { target: number; achieved: number; percentage: number };
        monthly: { target: number; achieved: number; percentage: number };
    };
}

interface Book {
    _id: string;
    title: string;
    genre: string;
    status: string;
    currentWordCount: number;
    targetWordCount?: number;
    estimatedPages?: number;
    updatedAt: Date;
}

interface RecentActivity {
    type: 'book_created' | 'chapter_written' | 'goal_achieved' | 'milestone_reached';
    description: string;
    timestamp: Date;
    bookId?: string;
    chapterId?: string;
}

interface WorkspaceDashboardProps {
    className?: string;
}

export default function WorkspaceDashboard({ className }: WorkspaceDashboardProps) {
    const { workspaceId } = useParams();
    const navigate = useNavigate();

    // State
    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [stats, setStats] = useState<WorkspaceStats | null>(null);
    const [books, setBooks] = useState<Book[]>([]);
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState<string>('overview');
    const [showCreateBook, setShowCreateBook] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    // Load workspace data
    useEffect(() => {
        if (workspaceId) {
            loadWorkspaceData();
        }
    }, [workspaceId]);

    const loadWorkspaceData = async () => {
        try {
            setLoading(true);
            // This would call your MCP tools
            // const workspaceData = await mcpClient.getWorkspace(workspaceId, userId, true);
            // const booksData = await mcpClient.getBooksByWorkspace(workspaceId);

            // Mock data for now
            const mockWorkspace: Workspace = {
                _id: workspaceId || '',
                name: 'My Writing Project',
                description: 'A collection of fantasy novels',
                books: ['book1', 'book2', 'book3'],
                activeBookId: 'book1',
                writingTargets: {
                    daily: 500,
                    weekly: 3500,
                    monthly: 15000
                },
                statistics: {
                    totalWords: 45678,
                    totalPages: 183,
                    totalChapters: 15,
                    totalBooks: 3,
                    currentStreak: 5,
                    longestStreak: 12,
                    lastWritingSession: new Date()
                },
                layout: {
                    sidebar: { width: 300, collapsed: false, position: 'left' },
                    panels: {
                        research: true,
                        outline: true,
                        characters: true,
                        timeline: true,
                        writing: true
                    },
                    views: {
                        defaultView: 'overview',
                        splitView: false,
                        focusMode: false
                    }
                },
                settings: {
                    theme: 'auto',
                    autoSave: true,
                    notifications: {
                        writeReminders: true,
                        goalReminders: true,
                        consistencyAlerts: true
                    }
                },
                createdAt: new Date('2024-01-15'),
                updatedAt: new Date()
            };

            const mockStats: WorkspaceStats = {
                totalWords: 45678,
                totalPages: 183,
                totalChapters: 15,
                totalBooks: 3,
                longestStreak: 12,
                currentStreak: 5,
                lastWritingSession: new Date(),
                dailyProgress: {
                    today: 320,
                    thisWeek: 2100,
                    thisMonth: 8950
                },
                goalProgress: {
                    daily: { target: 500, achieved: 320, percentage: 64 },
                    weekly: { target: 3500, achieved: 2100, percentage: 60 },
                    monthly: { target: 15000, achieved: 8950, percentage: 60 }
                }
            };

            const mockBooks: Book[] = [
                {
                    _id: 'book1',
                    title: 'The Crystal Chronicles',
                    genre: 'Fantasy',
                    status: 'writing',
                    currentWordCount: 25000,
                    targetWordCount: 80000,
                    estimatedPages: 320,
                    updatedAt: new Date()
                },
                {
                    _id: 'book2',
                    title: 'Shadows of Tomorrow',
                    genre: 'Sci-Fi',
                    status: 'planning',
                    currentWordCount: 5000,
                    targetWordCount: 100000,
                    estimatedPages: 400,
                    updatedAt: new Date('2024-01-10')
                },
                {
                    _id: 'book3',
                    title: 'Love in the Digital Age',
                    genre: 'Romance',
                    status: 'review',
                    currentWordCount: 15678,
                    targetWordCount: 60000,
                    estimatedPages: 240,
                    updatedAt: new Date('2024-01-05')
                }
            ];

            const mockActivity: RecentActivity[] = [
                {
                    type: 'chapter_written',
                    description: 'Completed Chapter 8 of The Crystal Chronicles',
                    timestamp: new Date(),
                    bookId: 'book1',
                    chapterId: 'ch8'
                },
                {
                    type: 'goal_achieved',
                    description: 'Reached daily writing goal of 500 words',
                    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
                },
                {
                    type: 'milestone_reached',
                    description: '25,000 words written in The Crystal Chronicles',
                    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    bookId: 'book1'
                }
            ];

            setWorkspace(mockWorkspace);
            setStats(mockStats);
            setBooks(mockBooks);
            setRecentActivity(mockActivity);
            setActiveView(mockWorkspace.layout.views.lastView || mockWorkspace.layout.views.defaultView);
        } catch (error) {
            console.error('Failed to load workspace:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter books based on search and status
    const filteredBooks = useMemo(() => {
        return books.filter(book => {
            const matchesSearch = book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                book.genre.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = filterStatus === 'all' || book.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [books, searchQuery, filterStatus]);

    // Calculate progress for books
    const getBookProgress = (book: Book) => {
        if (!book.targetWordCount) return 0;
        return Math.round((book.currentWordCount / book.targetWordCount) * 100);
    };

    // Get status color
    const getStatusColor = (status: string) => {
        const colors = {
            planning: 'bg-blue-100 text-blue-800',
            writing: 'bg-green-100 text-green-800',
            editing: 'bg-yellow-100 text-yellow-800',
            review: 'bg-purple-100 text-purple-800',
            completed: 'bg-gray-100 text-gray-800',
            published: 'bg-emerald-100 text-emerald-800'
        };
        return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
    };

    if (loading || !workspace) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className={cn("workspace-dashboard", className)}>
            {/* Header */}
            <div className="workspace-header border-b bg-white p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{workspace.name}</h1>
                        {workspace.description && (
                            <p className="text-gray-600 mt-1">{workspace.description}</p>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
                            <Settings className="h-4 w-4 mr-2" />
                            Settings
                        </Button>
                        <Button size="sm" onClick={() => setShowCreateBook(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            New Book
                        </Button>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center">
                                <BookOpen className="h-8 w-8 text-blue-600" />
                                <div className="ml-3">
                                    <p className="text-sm font-medium text-gray-600">Total Books</p>
                                    <p className="text-2xl font-bold text-gray-900">{stats?.totalBooks || 0}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center">
                                <PenTool className="h-8 w-8 text-green-600" />
                                <div className="ml-3">
                                    <p className="text-sm font-medium text-gray-600">Total Words</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {stats?.totalWords?.toLocaleString() || 0}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center">
                                <Target className="h-8 w-8 text-purple-600" />
                                <div className="ml-3">
                                    <p className="text-sm font-medium text-gray-600">Daily Goal</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {stats?.goalProgress.daily.percentage || 0}%
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center">
                                <TrendingUp className="h-8 w-8 text-orange-600" />
                                <div className="ml-3">
                                    <p className="text-sm font-medium text-gray-600">Streak</p>
                                    <p className="text-2xl font-bold text-gray-900">{stats?.currentStreak || 0} days</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Main Content */}
            <div className="workspace-content flex-1 p-6">
                <Tabs value={activeView} onValueChange={setActiveView} className="h-full">
                    <TabsList className="grid w-full grid-cols-6">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="books">Books</TabsTrigger>
                        <TabsTrigger value="timeline">Timeline</TabsTrigger>
                        <TabsTrigger value="writing">Writing</TabsTrigger>
                        <TabsTrigger value="research">Research</TabsTrigger>
                        <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    </TabsList>

                    {/* Overview Tab */}
                    <TabsContent value="overview" className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Progress Section */}
                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle>Writing Progress</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span>Daily Goal ({stats?.goalProgress.daily.target} words)</span>
                                            <span>{stats?.goalProgress.daily.achieved}/{stats?.goalProgress.daily.target}</span>
                                        </div>
                                        <Progress value={stats?.goalProgress.daily.percentage} />
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span>Weekly Goal ({stats?.goalProgress.weekly.target} words)</span>
                                            <span>{stats?.goalProgress.weekly.achieved}/{stats?.goalProgress.weekly.target}</span>
                                        </div>
                                        <Progress value={stats?.goalProgress.weekly.percentage} />
                                    </div>

                                    <div>
                                        <div className="flex justify-between text-sm mb-2">
                                            <span>Monthly Goal ({stats?.goalProgress.monthly.target} words)</span>
                                            <span>{stats?.goalProgress.monthly.achieved}/{stats?.goalProgress.monthly.target}</span>
                                        </div>
                                        <Progress value={stats?.goalProgress.monthly.percentage} />
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Recent Activity */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Recent Activity</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {recentActivity.map((activity, index) => (
                                        <div key={index} className="flex items-start gap-3 pb-3 border-b last:border-b-0">
                                            <div className="w-2 h-2 rounded-full bg-blue-600 mt-2"></div>
                                            <div className="flex-1">
                                                <p className="text-sm text-gray-900">{activity.description}</p>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(activity.timestamp).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Active Books Preview */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Active Books</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {books.slice(0, 3).map((book) => (
                                        <Card key={book._id} className="cursor-pointer hover:shadow-md transition-shadow">
                                            <CardContent className="p-4">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h3 className="font-semibold text-gray-900 truncate">{book.title}</h3>
                                                    <SimpleBadge className={getStatusColor(book.status)}>
                                                        {book.status}
                                                    </SimpleBadge>
                                                </div>
                                                <p className="text-sm text-gray-600 mb-3">{book.genre}</p>

                                                {book.targetWordCount && (
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-sm">
                                                            <span>Progress</span>
                                                            <span>{book.currentWordCount.toLocaleString()} / {book.targetWordCount.toLocaleString()}</span>
                                                        </div>
                                                        <Progress value={getBookProgress(book)} />
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Books Tab */}
                    <TabsContent value="books" className="space-y-6">
                        {/* Books Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        placeholder="Search books..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-10 w-64"
                                    />
                                </div>

                                <Select value={filterStatus} onValueChange={setFilterStatus}>
                                    <SelectTrigger className="w-40">
                                        <Filter className="h-4 w-4 mr-2" />
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="planning">Planning</SelectItem>
                                        <SelectItem value="writing">Writing</SelectItem>
                                        <SelectItem value="editing">Editing</SelectItem>
                                        <SelectItem value="review">Review</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button onClick={() => setShowCreateBook(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                New Book
                            </Button>
                        </div>

                        {/* Books Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredBooks.map((book) => (
                                <Card key={book._id} className="cursor-pointer hover:shadow-lg transition-shadow">
                                    <CardContent className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex-1">
                                                <h3 className="text-lg font-semibold text-gray-900 mb-1">{book.title}</h3>
                                                <p className="text-sm text-gray-600">{book.genre}</p>
                                            </div>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem>Open</DropdownMenuItem>
                                                    <DropdownMenuItem>Edit</DropdownMenuItem>
                                                    <DropdownMenuItem>Duplicate</DropdownMenuItem>
                                                    <DropdownMenuItem>Export</DropdownMenuItem>
                                                    <Separator />
                                                    <DropdownMenuItem className="text-red-600">Archive</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <SimpleBadge className={getStatusColor(book.status)}>
                                                    {book.status}
                                                </SimpleBadge>
                                                <span className="text-sm text-gray-500">
                                                    {new Date(book.updatedAt).toLocaleDateString()}
                                                </span>
                                            </div>

                                            {book.targetWordCount && (
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span>Progress</span>
                                                        <span>{getBookProgress(book)}%</span>
                                                    </div>
                                                    <Progress value={getBookProgress(book)} />
                                                    <div className="flex justify-between text-xs text-gray-500">
                                                        <span>{book.currentWordCount.toLocaleString()} words</span>
                                                        <span>{book.targetWordCount.toLocaleString()} target</span>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-4 text-sm text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <FileText className="h-4 w-4" />
                                                    {book.estimatedPages || 0} pages
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>

                    {/* Timeline Tab */}
                    <TabsContent value="timeline" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Story Timeline</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {/* TimelineView component would be rendered here with real data */}
                                <div className="h-96 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                                    <div className="text-center">
                                        <Map className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Timeline View</h3>
                                        <p className="text-gray-600 mb-4">Visual timeline component would be rendered here</p>
                                        <Button>Create Timeline</Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Writing Tab */}
                    <TabsContent value="writing" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Writing Environment</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-96 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                                    <div className="text-center">
                                        <PenTool className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Enhanced Writing Environment</h3>
                                        <p className="text-gray-600 mb-4">Distraction-free writing interface with context panel</p>
                                        <Button>Start Writing</Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Research Tab */}
                    <TabsContent value="research" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Research Hub</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-96 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                                    <div className="text-center">
                                        <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Research Management</h3>
                                        <p className="text-gray-600 mb-4">Organize research materials and references</p>
                                        <Button>Add Research</Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Analytics Tab */}
                    <TabsContent value="analytics" className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Writing Analytics</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-96 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                                    <div className="text-center">
                                        <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Advanced Analytics</h3>
                                        <p className="text-gray-600 mb-4">Track writing progress and productivity metrics</p>
                                        <Button>View Analytics</Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Create Book Dialog */}
            <Dialog open={showCreateBook} onOpenChange={setShowCreateBook}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Create New Book</DialogTitle>
                        <DialogDescription>
                            Start a new writing project in your workspace
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <label htmlFor="title" className="text-sm font-medium">Title</label>
                            <Input id="title" placeholder="Enter book title" />
                        </div>

                        <div className="grid gap-2">
                            <label htmlFor="genre" className="text-sm font-medium">Genre</label>
                            <Select>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select genre" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="fantasy">Fantasy</SelectItem>
                                    <SelectItem value="sci-fi">Science Fiction</SelectItem>
                                    <SelectItem value="romance">Romance</SelectItem>
                                    <SelectItem value="mystery">Mystery</SelectItem>
                                    <SelectItem value="thriller">Thriller</SelectItem>
                                    <SelectItem value="literary">Literary Fiction</SelectItem>
                                    <SelectItem value="non-fiction">Non-Fiction</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <label htmlFor="description" className="text-sm font-medium">Description</label>
                            <Textarea id="description" placeholder="Brief description of your book" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <label htmlFor="target-words" className="text-sm font-medium">Target Word Count</label>
                                <Input id="target-words" type="number" placeholder="80000" />
                            </div>
                            <div className="grid gap-2">
                                <label htmlFor="target-pages" className="text-sm font-medium">Estimated Pages</label>
                                <Input id="target-pages" type="number" placeholder="320" />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setShowCreateBook(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => setShowCreateBook(false)}>
                            Create Book
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
