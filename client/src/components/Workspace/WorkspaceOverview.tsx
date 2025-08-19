/**
 * Workspace Overview - Main dashboard for book creation workspace
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import SimpleBadge from '~/components/ui/SimpleBadge';
import { Progress } from '~/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/Tabs';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/Avatar';
import { Separator } from '~/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/DropdownMenu';
import { cn } from '~/utils';

// Icons
import {
    BookOpen,
    PenTool,
    Clock,
    Target,
    TrendingUp,
    Users,
    Calendar,
    FileText,
    Plus,
    MoreVertical,
    Edit,
    Trash2,
    Star,
    Play,
    Pause,
    CheckCircle,
    AlertCircle,
    ArrowRight,
    Zap,
    Coffee,
    Trophy,
    Bookmark,
    MessageSquare,
} from 'lucide-react';

// Mock data - in real app this would come from hooks
const mockWorkspaceData = {
    name: "My Writing Workspace",
    totalBooks: 3,
    totalWords: 42500,
    todayWords: 1250,
    dailyGoal: 1000,
    currentStreak: 7,
    longestStreak: 21,
    activeProjects: [
        {
            id: '1',
            title: 'The Shadow Chronicles',
            genre: 'Fantasy',
            progress: 65,
            wordCount: 28000,
            targetWords: 80000,
            lastUpdated: new Date(),
            status: 'active',
            chapters: 12,
            targetChapters: 20,
        },
        {
            id: '2',
            title: 'Modern Romance',
            genre: 'Romance',
            progress: 30,
            wordCount: 12000,
            targetWords: 60000,
            lastUpdated: new Date(Date.now() - 86400000), // yesterday
            status: 'paused',
            chapters: 5,
            targetChapters: 15,
        },
        {
            id: '3',
            title: 'Sci-Fi Adventure',
            genre: 'Science Fiction',
            progress: 85,
            wordCount: 68000,
            targetWords: 75000,
            lastUpdated: new Date(Date.now() - 3600000), // 1 hour ago
            status: 'active',
            chapters: 18,
            targetChapters: 20,
        },
    ],
    recentActivity: [
        {
            type: 'writing',
            description: 'Added 1,250 words to Chapter 13',
            bookTitle: 'The Shadow Chronicles',
            timestamp: new Date(),
        },
        {
            type: 'milestone',
            description: 'Reached 65% completion',
            bookTitle: 'The Shadow Chronicles',
            timestamp: new Date(Date.now() - 3600000),
        },
        {
            type: 'conversation',
            description: 'Created revision request for dialogue',
            bookTitle: 'Modern Romance',
            timestamp: new Date(Date.now() - 7200000),
        },
    ],
    weeklyStats: {
        monday: 800,
        tuesday: 1200,
        wednesday: 950,
        thursday: 1100,
        friday: 1250,
        saturday: 600,
        sunday: 0,
    },
};

const statusIcons = {
    active: Play,
    paused: Pause,
    completed: CheckCircle,
    archived: AlertCircle,
};

const statusColors = {
    active: 'bg-green-100 text-green-800',
    paused: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-blue-100 text-blue-800',
    archived: 'bg-gray-100 text-gray-800',
};

export default function WorkspaceOverview() {
    const navigate = useNavigate();
    const [selectedTab, setSelectedTab] = useState('overview');

    const data = mockWorkspaceData;

    const totalProgress = useMemo(() => {
        const totalWords = data.activeProjects.reduce((sum, project) => sum + project.wordCount, 0);
        const totalTarget = data.activeProjects.reduce((sum, project) => sum + project.targetWords, 0);
        return totalTarget > 0 ? (totalWords / totalTarget) * 100 : 0;
    }, [data.activeProjects]);

    const dailyProgress = (data.todayWords / data.dailyGoal) * 100;

    const weeklyTotal = Object.values(data.weeklyStats).reduce((sum, words) => sum + words, 0);

    const handleCreateBook = () => {
        navigate('/d/books/new');
    };

    const handleOpenBook = (bookId: string) => {
        navigate(`/d/books/${bookId}/preview`);
    };

    const handleStartWriting = (bookId: string) => {
        navigate(`/d/writing/${bookId}`);
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{data.name}</h1>
                    <p className="text-muted-foreground">
                        Welcome back! Ready to continue your writing journey?
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={handleCreateBook} className="gap-2">
                        <Plus className="h-4 w-4" />
                        New Book
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/d/writing')} className="gap-2">
                        <PenTool className="h-4 w-4" />
                        Start Writing
                    </Button>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-100 rounded-lg">
                                <BookOpen className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Active Books</p>
                                <p className="text-2xl font-bold">{data.totalBooks}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-green-100 rounded-lg">
                                <Target className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Today's Progress</p>
                                <p className="text-2xl font-bold">{data.todayWords.toLocaleString()}</p>
                                <Progress value={dailyProgress} className="mt-2 h-2" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-orange-100 rounded-lg">
                                <TrendingUp className="h-6 w-6 text-orange-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Total Words</p>
                                <p className="text-2xl font-bold">{data.totalWords.toLocaleString()}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-purple-100 rounded-lg">
                                <Trophy className="h-6 w-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Current Streak</p>
                                <p className="text-2xl font-bold">{data.currentStreak} days</p>
                                <p className="text-xs text-muted-foreground">Best: {data.longestStreak} days</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Tabs */}
            <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview">Projects</TabsTrigger>
                    <TabsTrigger value="activity">Recent Activity</TabsTrigger>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    {/* Active Projects */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BookOpen className="h-5 w-5" />
                                Active Projects
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {data.activeProjects.map((project) => {
                                const StatusIcon = statusIcons[project.status];
                                return (
                                    <div key={project.id} className="border rounded-lg p-4 space-y-3">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-lg">{project.title}</h3>
                                                    <Badge
                                                        variant="secondary"
                                                        className={cn('text-xs', statusColors[project.status])}
                                                    >
                                                        <StatusIcon className="h-3 w-3 mr-1" />
                                                        {project.status}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{project.genre}</p>
                                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                    <span>{project.wordCount.toLocaleString()} / {project.targetWords.toLocaleString()} words</span>
                                                    <span>{project.chapters} / {project.targetChapters} chapters</span>
                                                    <span>Updated {project.lastUpdated.toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleOpenBook(project.id)}>
                                                        <BookOpen className="h-4 w-4 mr-2" />
                                                        Preview
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleStartWriting(project.id)}>
                                                        <PenTool className="h-4 w-4 mr-2" />
                                                        Continue Writing
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => navigate(`/d/planning/scenes/${project.id}`)}>
                                                        <FileText className="h-4 w-4 mr-2" />
                                                        Plan Scenes
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => navigate(`/d/planning/timeline/${project.id}`)}>
                                                        <Calendar className="h-4 w-4 mr-2" />
                                                        Timeline
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span>Progress</span>
                                                <span>{project.progress}%</span>
                                            </div>
                                            <Progress value={project.progress} className="h-2" />
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                onClick={() => handleStartWriting(project.id)}
                                                className="gap-2"
                                            >
                                                <PenTool className="h-3 w-3" />
                                                Continue Writing
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleOpenBook(project.id)}
                                                className="gap-2"
                                            >
                                                <BookOpen className="h-3 w-3" />
                                                Preview
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="activity" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                Recent Activity
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {data.recentActivity.map((activity, index) => (
                                <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        {activity.type === 'writing' && <PenTool className="h-4 w-4 text-blue-600" />}
                                        {activity.type === 'milestone' && <Trophy className="h-4 w-4 text-blue-600" />}
                                        {activity.type === 'conversation' && <MessageSquare className="h-4 w-4 text-blue-600" />}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium">{activity.description}</p>
                                        <p className="text-sm text-muted-foreground">{activity.bookTitle}</p>
                                        <p className="text-xs text-muted-foreground">{activity.timestamp.toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="analytics" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Weekly Progress</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {Object.entries(data.weeklyStats).map(([day, words]) => (
                                        <div key={day} className="flex items-center justify-between">
                                            <span className="text-sm capitalize">{day}</span>
                                            <div className="flex items-center gap-2">
                                                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-blue-500 rounded-full"
                                                        style={{ width: `${Math.min((words / data.dailyGoal) * 100, 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm w-16 text-right">{words.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <Separator className="my-4" />
                                <div className="flex justify-between font-medium">
                                    <span>Weekly Total</span>
                                    <span>{weeklyTotal.toLocaleString()} words</span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Writing Goals</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Daily Goal</span>
                                        <span>{data.todayWords} / {data.dailyGoal} words</span>
                                    </div>
                                    <Progress value={dailyProgress} className="h-2" />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Overall Progress</span>
                                        <span>{totalProgress.toFixed(1)}%</span>
                                    </div>
                                    <Progress value={totalProgress} className="h-2" />
                                </div>
                                <div className="pt-2 space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm">Current Streak</span>
                                        <span className="font-medium">{data.currentStreak} days</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm">Longest Streak</span>
                                        <span className="font-medium">{data.longestStreak} days</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
