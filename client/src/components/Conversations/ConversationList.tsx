/**
 * Conversation List - Shows conversations with book connection chips
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import SimpleBadge from '~/components/ui/SimpleBadge';
import { Input } from '~/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/Select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/DropdownMenu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/Tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/Avatar';
import { Separator } from '~/components/ui/separator';
import { cn } from '~/utils';

// Icons
import {
    MessageSquare,
    BookOpen,
    Search,
    Filter,
    MoreVertical,
    Pin,
    PinOff,
    Archive,
    Trash2,
    Clock,
    Target,
    TrendingUp,
    Users,
    Edit,
    Copy,
    Share,
    Star,
    StarOff,
    Calendar,
    CheckCircle,
    Circle,
    Pause,
    Play
} from 'lucide-react';

// Types
interface ConversationSummary {
    id: string;
    conversationId: string;
    title: string;
    bookTitle: string;
    bookId: string;
    bookGenre?: string;
    type: 'writing_session' | 'planning' | 'editing' | 'research' | 'brainstorming' | 'review' | 'collaboration';
    status: 'active' | 'paused' | 'completed' | 'archived';
    messageCount: number;
    wordsGenerated: number;
    lastActivity: Date;
    duration: number; // minutes
    productivity: number; // words per minute
    tags: string[];
    isActive: boolean;
    isPinned: boolean;
    isFavorited?: boolean;
    lastMessage?: {
        content: string;
        sender: 'user' | 'assistant';
        timestamp: Date;
    };
    goals?: {
        completed: number;
        total: number;
    };
    participants?: Array<{
        userId: string;
        name: string;
        role: string;
    }>;
}

interface ConversationListProps {
    conversations: ConversationSummary[];
    onConversationSelect: (conversationId: string) => void;
    onConversationPin: (id: string, pinned: boolean) => Promise<void>;
    onConversationArchive: (id: string) => Promise<void>;
    onConversationDelete: (id: string) => Promise<void>;
    onConversationDuplicate?: (id: string) => Promise<void>;
    onNewConversation: (bookId?: string) => void;
    showBookChips?: boolean;
    groupByBook?: boolean;
    className?: string;
}

const CONVERSATION_TYPE_COLORS = {
    writing_session: 'bg-green-100 text-green-800',
    planning: 'bg-blue-100 text-blue-800',
    editing: 'bg-yellow-100 text-yellow-800',
    research: 'bg-purple-100 text-purple-800',
    brainstorming: 'bg-pink-100 text-pink-800',
    review: 'bg-orange-100 text-orange-800',
    collaboration: 'bg-indigo-100 text-indigo-800'
};

const STATUS_COLORS = {
    active: 'bg-green-500',
    paused: 'bg-yellow-500',
    completed: 'bg-blue-500',
    archived: 'bg-gray-500'
};

const TYPE_ICONS = {
    writing_session: Edit,
    planning: Target,
    editing: CheckCircle,
    research: Search,
    brainstorming: Star,
    review: Circle,
    collaboration: Users
};

export default function ConversationList({
    conversations,
    onConversationSelect,
    onConversationPin,
    onConversationArchive,
    onConversationDelete,
    onConversationDuplicate,
    onNewConversation,
    showBookChips = true,
    groupByBook = false,
    className
}: ConversationListProps) {
    // State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterBook, setFilterBook] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'lastActivity' | 'title' | 'productivity' | 'messageCount'>('lastActivity');

    const navigate = useNavigate();

    // Get unique books for filter
    const availableBooks = useMemo(() => {
        const books = new Map();
        conversations.forEach(conv => {
            if (!books.has(conv.bookId)) {
                books.set(conv.bookId, { id: conv.bookId, title: conv.bookTitle, genre: conv.bookGenre });
            }
        });
        return Array.from(books.values());
    }, [conversations]);

    // Filter and sort conversations
    const filteredConversations = useMemo(() => {
        let filtered = conversations.filter(conv => {
            const matchesSearch = conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                conv.bookTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                conv.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesType = filterType === 'all' || conv.type === filterType;
            const matchesStatus = filterStatus === 'all' || conv.status === filterStatus;
            const matchesBook = filterBook === 'all' || conv.bookId === filterBook;

            return matchesSearch && matchesType && matchesStatus && matchesBook;
        });

        // Sort conversations
        filtered.sort((a, b) => {
            // Pinned conversations always come first
            if (a.isPinned !== b.isPinned) {
                return a.isPinned ? -1 : 1;
            }

            switch (sortBy) {
                case 'title':
                    return a.title.localeCompare(b.title);
                case 'productivity':
                    return b.productivity - a.productivity;
                case 'messageCount':
                    return b.messageCount - a.messageCount;
                case 'lastActivity':
                default:
                    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
            }
        });

        return filtered;
    }, [conversations, searchQuery, filterType, filterStatus, filterBook, sortBy]);

    // Group conversations by book if requested
    const groupedConversations = useMemo(() => {
        if (!groupByBook) {
            return { 'All Conversations': filteredConversations };
        }

        const groups: Record<string, ConversationSummary[]> = {};
        filteredConversations.forEach(conv => {
            const bookKey = conv.bookTitle;
            if (!groups[bookKey]) {
                groups[bookKey] = [];
            }
            groups[bookKey].push(conv);
        });

        return groups;
    }, [filteredConversations, groupByBook]);

    // Format time ago
    const formatTimeAgo = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    // Format duration
    const formatDuration = (minutes: number) => {
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        const remainingMins = minutes % 60;
        return `${hours}h ${remainingMins}m`;
    };

    // Render conversation card
    const renderConversationCard = (conversation: ConversationSummary) => {
        const TypeIcon = TYPE_ICONS[conversation.type];

        return (
            <Card
                key={conversation.id}
                className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    conversation.isActive && "ring-2 ring-blue-500",
                    conversation.isPinned && "border-yellow-400"
                )}
                onClick={() => onConversationSelect(conversation.conversationId)}
            >
                <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3 flex-1">
                            {/* Status indicator */}
                            <div className="flex items-center gap-2 mt-1">
                                <div
                                    className={cn(
                                        "w-2 h-2 rounded-full",
                                        STATUS_COLORS[conversation.status]
                                    )}
                                />
                                {conversation.isPinned && (
                                    <Pin className="h-3 w-3 text-yellow-600" />
                                )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <TypeIcon className="h-4 w-4 text-gray-500" />
                                    <h3 className="font-medium text-gray-900 truncate">{conversation.title}</h3>
                                </div>

                                {/* Book chip */}
                                {showBookChips && (
                                    <div className="flex items-center gap-2 mb-2">
                                        <Badge
                                            variant="outline"
                                            className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                                        >
                                            <BookOpen className="h-3 w-3 mr-1" />
                                            {conversation.bookTitle}
                                        </Badge>
                                        {conversation.bookGenre && (
                                            <Badge variant="secondary" className="text-xs">
                                                {conversation.bookGenre}
                                            </Badge>
                                        )}
                                    </div>
                                )}

                                {/* Type and status badges */}
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge
                                        className={cn("text-xs", CONVERSATION_TYPE_COLORS[conversation.type])}
                                    >
                                        {conversation.type.replace('_', ' ')}
                                    </Badge>

                                    <Badge variant="outline" className="text-xs">
                                        {conversation.status}
                                    </Badge>

                                    {conversation.goals && (
                                        <Badge variant="outline" className="text-xs">
                                            {conversation.goals.completed}/{conversation.goals.total} goals
                                        </Badge>
                                    )}
                                </div>

                                {/* Last message preview */}
                                {conversation.lastMessage && (
                                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                                        <span className="font-medium">
                                            {conversation.lastMessage.sender === 'user' ? 'You' : 'Assistant'}:
                                        </span>{' '}
                                        {conversation.lastMessage.content}
                                    </p>
                                )}

                                {/* Stats */}
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex items-center gap-1">
                                                    <MessageSquare className="h-3 w-3" />
                                                    {conversation.messageCount}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{conversation.messageCount} messages</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>

                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex items-center gap-1">
                                                    <Edit className="h-3 w-3" />
                                                    {conversation.wordsGenerated.toLocaleString()}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{conversation.wordsGenerated} words generated</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>

                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {formatDuration(conversation.duration)}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{formatDuration(conversation.duration)} total time</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>

                                    {conversation.productivity > 0 && (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex items-center gap-1">
                                                        <TrendingUp className="h-3 w-3" />
                                                        {conversation.productivity} WPM
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{conversation.productivity} words per minute</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )}
                                </div>

                                {/* Tags */}
                                {conversation.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {conversation.tags.slice(0, 3).map((tag, index) => (
                                            <Badge key={index} variant="outline" className="text-xs px-1 py-0">
                                                {tag}
                                            </Badge>
                                        ))}
                                        {conversation.tags.length > 3 && (
                                            <Badge variant="outline" className="text-xs px-1 py-0">
                                                +{conversation.tags.length - 3}
                                            </Badge>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">
                                {formatTimeAgo(conversation.lastActivity)}
                            </span>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                        <MoreVertical className="h-3 w-3" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={(e) => {
                                        e.stopPropagation();
                                        onConversationPin(conversation.id, !conversation.isPinned);
                                    }}>
                                        {conversation.isPinned ? (
                                            <>
                                                <PinOff className="h-4 w-4 mr-2" />
                                                Unpin
                                            </>
                                        ) : (
                                            <>
                                                <Pin className="h-4 w-4 mr-2" />
                                                Pin
                                            </>
                                        )}
                                    </DropdownMenuItem>

                                    {onConversationDuplicate && (
                                        <DropdownMenuItem onClick={(e) => {
                                            e.stopPropagation();
                                            onConversationDuplicate(conversation.id);
                                        }}>
                                            <Copy className="h-4 w-4 mr-2" />
                                            Duplicate
                                        </DropdownMenuItem>
                                    )}

                                    <DropdownMenuItem onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/book/${conversation.bookId}`);
                                    }}>
                                        <BookOpen className="h-4 w-4 mr-2" />
                                        View Book
                                    </DropdownMenuItem>

                                    <Separator />

                                    <DropdownMenuItem onClick={(e) => {
                                        e.stopPropagation();
                                        onConversationArchive(conversation.id);
                                    }}>
                                        <Archive className="h-4 w-4 mr-2" />
                                        Archive
                                    </DropdownMenuItem>

                                    <DropdownMenuItem
                                        className="text-red-600"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onConversationDelete(conversation.id);
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    {/* Participants (for collaboration) */}
                    {conversation.type === 'collaboration' && conversation.participants && conversation.participants.length > 0 && (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                            <Users className="h-3 w-3 text-gray-500" />
                            <div className="flex -space-x-1">
                                {conversation.participants.slice(0, 3).map((participant, index) => (
                                    <Avatar key={index} className="h-5 w-5 border-2 border-white">
                                        <AvatarFallback className="text-xs">
                                            {participant.name.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>
                                ))}
                                {conversation.participants.length > 3 && (
                                    <div className="h-5 w-5 bg-gray-200 rounded-full border-2 border-white flex items-center justify-center">
                                        <span className="text-xs text-gray-600">+{conversation.participants.length - 3}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <div className={cn("conversation-list", className)}>
            {/* Header */}
            <div className="border-b bg-white p-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Conversations</h2>
                    <Button onClick={() => onNewConversation()}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        New Conversation
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="relative flex-1 min-w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>

                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="writing_session">Writing</SelectItem>
                            <SelectItem value="planning">Planning</SelectItem>
                            <SelectItem value="editing">Editing</SelectItem>
                            <SelectItem value="research">Research</SelectItem>
                            <SelectItem value="brainstorming">Brainstorming</SelectItem>
                            <SelectItem value="review">Review</SelectItem>
                            <SelectItem value="collaboration">Collaboration</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="paused">Paused</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                    </Select>

                    {availableBooks.length > 1 && (
                        <Select value={filterBook} onValueChange={setFilterBook}>
                            <SelectTrigger className="w-48">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Books</SelectItem>
                                {availableBooks.map((book) => (
                                    <SelectItem key={book.id} value={book.id}>
                                        {book.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                        <SelectTrigger className="w-36">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="lastActivity">Recent</SelectItem>
                            <SelectItem value="title">Name</SelectItem>
                            <SelectItem value="productivity">Productivity</SelectItem>
                            <SelectItem value="messageCount">Messages</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
                {filteredConversations.length === 0 ? (
                    <div className="text-center py-12">
                        <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No conversations found</h3>
                        <p className="text-gray-600 mb-4">
                            {searchQuery || filterType !== 'all' || filterStatus !== 'all' || filterBook !== 'all'
                                ? 'Try adjusting your filters or search terms'
                                : 'Start a new conversation to begin writing'
                            }
                        </p>
                        <Button onClick={() => onNewConversation()}>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Start Writing
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Object.entries(groupedConversations).map(([groupName, groupConversations]) => (
                            <div key={groupName}>
                                {groupByBook && (
                                    <div className="flex items-center gap-2 mb-4">
                                        <BookOpen className="h-5 w-5 text-gray-600" />
                                        <h3 className="text-lg font-semibold text-gray-900">{groupName}</h3>
                                        <Badge variant="secondary">{groupConversations.length}</Badge>
                                    </div>
                                )}

                                <div className="grid gap-4">
                                    {groupConversations.map(renderConversationCard)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
