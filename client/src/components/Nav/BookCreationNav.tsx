/**
 * Book Creation Navigation - NovelCrafter-style navigation for book creation features
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '~/components/ui/Button';
import SimpleBadge from '~/components/ui/SimpleBadge';
import { Separator } from '~/components/ui/separator';
import { cn } from '~/utils';

// Icons
import {
    BookOpen,
    PenTool,
    Map,
    FileText,
    Users,
    Calendar,
    TrendingUp,
    Zap,
    Target,
    Folder,
    Home,
    Plus,
    Search,
    MoreHorizontal,
} from 'lucide-react';

interface NavItem {
    id: string;
    label: string;
    icon: React.ComponentType<any>;
    path: string;
    description: string;
    badge?: string;
    disabled?: boolean;
    children?: NavItem[];
}

const navigationItems: NavItem[] = [
    {
        id: 'workspace',
        label: 'Workspace',
        icon: Home,
        path: '/d/workspace',
        description: 'Your writing workspace and project overview',
        badge: 'Pro',
    },
    {
        id: 'writing',
        label: 'Writing Studio',
        icon: PenTool,
        path: '/d/writing',
        description: 'Enhanced writing environment with AI assistance',
        children: [
            {
                id: 'writing-new',
                label: 'New Session',
                icon: Plus,
                path: '/d/writing/new',
                description: 'Start a new writing session',
            },
            {
                id: 'writing-continue',
                label: 'Continue Writing',
                icon: FileText,
                path: '/d/writing/continue',
                description: 'Resume your last writing session',
            },
        ],
    },
    {
        id: 'books',
        label: 'Book Library',
        icon: BookOpen,
        path: '/d/books',
        description: 'Manage your book projects and preview content',
        children: [
            {
                id: 'books-all',
                label: 'All Books',
                icon: Folder,
                path: '/d/books',
                description: 'View all your book projects',
            },
            {
                id: 'books-drafts',
                label: 'Drafts',
                icon: FileText,
                path: '/d/books?status=draft',
                description: 'Books in draft status',
            },
            {
                id: 'books-published',
                label: 'Published',
                icon: Target,
                path: '/d/books?status=published',
                description: 'Published books',
            },
        ],
    },
    {
        id: 'planning',
        label: 'Story Planning',
        icon: Map,
        path: '/d/planning',
        description: 'Plan scenes, timelines, and story structure',
        children: [
            {
                id: 'planning-scenes',
                label: 'Scene Planning',
                icon: FileText,
                path: '/d/planning',
                description: 'Plan individual scenes and chapters',
            },
            {
                id: 'planning-timeline',
                label: 'Story Timeline',
                icon: Calendar,
                path: '/d/planning/timeline',
                description: 'Visual timeline of story events',
            },
            {
                id: 'planning-characters',
                label: 'Characters',
                icon: Users,
                path: '/d/planning/characters',
                description: 'Character development and management',
            },
        ],
    },
    {
        id: 'analytics',
        label: 'Analytics',
        icon: TrendingUp,
        path: '/d/analytics',
        description: 'Writing analytics and progress tracking',
        badge: 'New',
        disabled: true,
    },
    {
        id: 'prompts',
        label: 'Prompts',
        icon: Zap,
        path: '/d/prompts',
        description: 'Manage AI prompts and templates',
    },
];

interface BookCreationNavProps {
    className?: string;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
}

export default function BookCreationNav({
    className,
    collapsed = false,
    onToggleCollapse,
}: BookCreationNavProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const [expandedItems, setExpandedItems] = useState<string[]>(['writing', 'books', 'planning']);

    const isActive = (path: string) => {
        return location.pathname === path || location.pathname.startsWith(path + '/');
    };

    const toggleExpanded = (itemId: string) => {
        setExpandedItems((prev) =>
            prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
        );
    };

    const handleNavigation = (path: string) => {
        navigate(path);
    };

    const NavButton = ({ item, level = 0 }: { item: NavItem; level?: number }) => {
        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = expandedItems.includes(item.id);
        const active = isActive(item.path);

        return (
            <div key={item.id}>
                <Button
                    variant={active ? 'secondary' : 'ghost'}
                    size="sm"
                    disabled={item.disabled}
                    className={cn(
                        'h-10 w-full justify-start gap-3 font-normal',
                        level > 0 && 'ml-6 text-sm',
                        active && 'bg-secondary text-secondary-foreground',
                        collapsed && 'justify-center px-2',
                    )}
                    onClick={() => {
                        if (hasChildren && !collapsed) {
                            toggleExpanded(item.id);
                        } else if (!item.disabled) {
                            handleNavigation(item.path);
                        }
                    }}
                >
                    <item.icon className={cn('h-4 w-4 flex-shrink-0')} />
                    {!collapsed && (
                        <>
                            <span className="flex-1 text-left">{item.label}</span>
                            {item.badge && <SimpleBadge className="text-xs">{item.badge}</SimpleBadge>}
                            {hasChildren && <MoreHorizontal className="h-3 w-3" />}
                        </>
                    )}
                </Button>

                {/* Render children if expanded and not collapsed */}
                {hasChildren && isExpanded && !collapsed && (
                    <div className="mt-1 space-y-1">
                        {item.children!.map((child) => (
                            <NavButton key={child.id} item={child} level={level + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={cn('flex flex-col space-y-2', className)}>
            {/* Header */}
            {!collapsed && (
                <div className="px-3 py-2">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold tracking-tight">{'Book Creation'}</h2>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleCollapse}>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{'Professional writing toolkit'}</p>
                </div>
            )}

            {/* Navigation Items */}
            <div className="space-y-1 px-2">
                {navigationItems.map((item) => (
                    <NavButton key={item.id} item={item} />
                ))}
            </div>

            {!collapsed && (
                <>
                    <Separator className="my-4" />

                    {/* Quick Actions */}
                    <div className="space-y-1 px-2">
                        <h3 className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {'Quick Actions'}
                        </h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-full justify-start gap-3"
                            onClick={() => navigate('/c/new')}
                        >
                            <Plus className="h-4 w-4" />
                            {'New Chat'}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-full justify-start gap-3"
                            onClick={() => navigate('/search')}
                        >
                            <Search className="h-4 w-4" />
                            {'Search Books'}
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}
