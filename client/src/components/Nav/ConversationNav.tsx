/**
 * Conversation Navigation - Shows conversation list with book connection chips
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import SimpleBadge from '~/components/ui/SimpleBadge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '~/components/ui/Select';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '~/components/ui/DropdownMenu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/Tooltip';
import { ScrollArea } from '~/components/ui/scroll-area';
import { cn } from '~/utils';
import {
    useConversationSummaries,
    usePinConversation,
    useArchiveConversation,
} from '~/hooks/useConversations';

// Icons
import {
    Search,
    Plus,
    BookOpen,
    MessageSquare,
    Pin,
    PinOff,
    Archive,
    MoreVertical,
    Clock,
    Edit,
    TrendingUp,
    Users,
    Filter,
    SortAsc,
    SortDesc,
} from 'lucide-react';

const CONVERSATION_TYPE_COLORS = {
    writing_session: 'bg-green-100 text-green-800',
    planning: 'bg-blue-100 text-blue-800',
    editing: 'bg-yellow-100 text-yellow-800',
    research: 'bg-purple-100 text-purple-800',
    brainstorming: 'bg-pink-100 text-pink-800',
    review: 'bg-orange-100 text-orange-800',
    collaboration: 'bg-indigo-100 text-indigo-800',
};

const STATUS_COLORS = {
    active: 'bg-green-500',
    paused: 'bg-yellow-500',
    completed: 'bg-blue-500',
    archived: 'bg-gray-500',
};

interface ConversationNavProps {
    className?: string;
    workspaceId?: string;
    onNewConversation?: () => void;
}

export default function ConversationNav({
    className,
    workspaceId,
    onNewConversation,
}: ConversationNavProps) {
    const navigate = useNavigate();
    const { conversationId } = useParams();

    // State for filters and search
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterBook, setFilterBook] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'lastActivity' | 'title' | 'productivity'>('lastActivity');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Fetch conversation summaries
    const { data: conversationsData, isLoading } = useConversationSummaries({
        workspaceId,
        includeArchived: false,
        limit: 100,
        sortBy,
    });

    const pinConversation = usePinConversation();
    const archiveConversation = useArchiveConversation();

    const conversations = conversationsData?.summaries || [];

    // Get unique books for filter
    const availableBooks = useMemo(() => {
        const books = new Map();
        conversations.forEach((conv) => {
            if (!books.has(conv.bookId)) {
                books.set(conv.bookId, { id: conv.bookId, title: conv.bookTitle });
            }
        });
        return Array.from(books.values());
    }, [conversations]);

    // Filter and sort conversations
    const filteredConversations = useMemo(() => {
        const filtered = conversations.filter((conv) => {
            const matchesSearch =
                conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                conv.bookTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                conv.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

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

            let result = 0;
            switch (sortBy) {
                case 'title':
                    result = a.title.localeCompare(b.title);
                    break;
                case 'productivity':
                    result = a.productivity - b.productivity;
                    break;
                case 'lastActivity':
                default:
                    result = new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime();
                    break;
            }

            return sortOrder === 'desc' ? -result : result;
        });

        return filtered;
    }, [conversations, searchQuery, filterType, filterStatus, filterBook, sortBy, sortOrder]);

    // Format time ago
    const formatTimeAgo = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Now';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        return date.toLocaleDateString();
    };

    // Format duration
    const formatDuration = (minutes: number) => {
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h`;
    };

    // Handle conversation click
    const handleConversationClick = (conv: any) => {
        navigate(`/c/${conv.conversationId}`);
    };

    // Handle pin conversation
    const handlePinConversation = (e: React.MouseEvent, conv: any) => {
        e.stopPropagation();
        pinConversation.mutate({ id: conv.id, pinned: !conv.isPinned });
    };

    // Handle archive conversation
    const handleArchiveConversation = (e: React.MouseEvent, conv: any) => {
        e.stopPropagation();
        archiveConversation.mutate({ id: conv.id });
    };

    return (
        <div className={cn('flex h-full flex-col bg-surface-primary', className)}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-light p-3">
                <h2 className="text-sm font-semibold text-text-primary">Conversations</h2>
                <Button size="sm" onClick={onNewConversation} className="h-7 px-2">
                    <Plus className="mr-1 h-3 w-3" />
                    New
                </Button>
            </div>

            {/* Filters */}
            <div className="space-y-2 border-b border-border-light p-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 transform text-gray-400" />
                    <Input
                        placeholder="Search conversations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 pl-9 text-xs"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="writing_session">Writing</SelectItem>
                            <SelectItem value="planning">Planning</SelectItem>
                            <SelectItem value="editing">Editing</SelectItem>
                            <SelectItem value="research">Research</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        className="h-7 px-2"
                    >
                        {sortOrder === 'asc' ? (
                            <SortAsc className="h-3 w-3" />
                        ) : (
                            <SortDesc className="h-3 w-3" />
                        )}
                    </Button>
                </div>

                {availableBooks.length > 1 && (
                    <Select value={filterBook} onValueChange={setFilterBook}>
                        <SelectTrigger className="h-7 text-xs">
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
            </div>

            {/* Conversation List */}
            <ScrollArea className="flex-1">
                <div className="space-y-1 p-2">
                    {isLoading ? (
                        <div className="py-8 text-center text-sm text-gray-500">Loading conversations...</div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="py-8 text-center text-sm text-gray-500">
                            {searchQuery || filterType !== 'all' || filterBook !== 'all'
                                ? 'No conversations match your filters'
                                : 'No conversations yet'}
                        </div>
                    ) : (
                        filteredConversations.map((conv) => (
                            <div
                                key={conv.id}
                                className={cn(
                                    'group relative cursor-pointer rounded-lg p-3 transition-colors hover:bg-surface-hover',
                                    conv.conversationId === conversationId &&
                                    'bg-surface-secondary ring-1 ring-border-medium',
                                    conv.isPinned && 'border border-yellow-200 bg-yellow-50',
                                )}
                                onClick={() => handleConversationClick(conv)}
                            >
                                {/* Header */}
                                <div className="mb-2 flex items-start justify-between">
                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                        {/* Status indicator */}
                                        <div
                                            className={cn(
                                                'h-2 w-2 flex-shrink-0 rounded-full',
                                                STATUS_COLORS[conv.status as keyof typeof STATUS_COLORS] || 'bg-gray-400',
                                            )}
                                        />

                                        {/* Title */}
                                        <h3 className="flex-1 truncate text-sm font-medium text-text-primary">
                                            {conv.title}
                                        </h3>

                                        {/* Pin indicator */}
                                        {conv.isPinned && <Pin className="h-3 w-3 flex-shrink-0 text-yellow-600" />}
                                    </div>

                                    {/* Actions */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                                            >
                                                <MoreVertical className="h-3 w-3" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={(e) => handlePinConversation(e, conv)}>
                                                {conv.isPinned ? (
                                                    <>
                                                        <PinOff className="mr-2 h-4 w-4" />
                                                        Unpin
                                                    </>
                                                ) : (
                                                    <>
                                                        <Pin className="mr-2 h-4 w-4" />
                                                        Pin
                                                    </>
                                                )}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={(e) => handleArchiveConversation(e, conv)}>
                                                <Archive className="mr-2 h-4 w-4" />
                                                Archive
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                {/* Book chip */}
                                <div className="mb-2">
                                    <Badge
                                        variant="outline"
                                        className="border-blue-200 bg-blue-50 text-xs text-blue-700"
                                    >
                                        <BookOpen className="mr-1 h-3 w-3" />
                                        {conv.bookTitle}
                                    </Badge>
                                </div>

                                {/* Type and stats */}
                                <div className="flex items-center justify-between">
                                    <Badge
                                        className={cn(
                                            'text-xs',
                                            CONVERSATION_TYPE_COLORS[
                                            conv.type as keyof typeof CONVERSATION_TYPE_COLORS
                                            ] || 'bg-gray-100 text-gray-800',
                                        )}
                                    >
                                        {conv.type.replace('_', ' ')}
                                    </Badge>

                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex items-center gap-1">
                                                        <MessageSquare className="h-3 w-3" />
                                                        {conv.messageCount}
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{conv.messageCount} messages</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        {conv.wordsGenerated > 0 && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="flex items-center gap-1">
                                                            <Edit className="h-3 w-3" />
                                                            {conv.wordsGenerated > 1000
                                                                ? `${Math.round(conv.wordsGenerated / 1000)}k`
                                                                : conv.wordsGenerated}
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>{conv.wordsGenerated.toLocaleString()} words</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}

                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {formatTimeAgo(conv.lastActivity)}
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Last activity: {new Date(conv.lastActivity).toLocaleString()}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </div>

                                {/* Last message preview */}
                                {conv.lastMessage && (
                                    <div className="mt-2 border-t border-border-light pt-2">
                                        <p className="line-clamp-2 text-xs text-gray-600">
                                            <span className="font-medium">
                                                {conv.lastMessage.sender === 'user' ? 'You' : 'Assistant'}:
                                            </span>{' '}
                                            {conv.lastMessage.content}
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
