/**
 * Book Creation Launch Button - Entry point to book creation features
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import SimpleBadge from '~/components/ui/SimpleBadge';
import { Separator } from '~/components/ui/separator';
import { cn } from '~/utils';

// Icons
import {
    BookOpen,
    PenTool,
    Sparkles,
    ArrowRight,
    Zap,
    Target,
    Users,
    Clock,
} from 'lucide-react';

interface BookCreationLaunchButtonProps {
    className?: string;
    variant?: 'default' | 'minimal' | 'card';
}

const features = [
    {
        icon: BookOpen,
        title: 'Complete Book Management',
        description: 'Create, organize, and manage your entire book project from concept to publication.',
    },
    {
        icon: PenTool,
        title: 'AI-Powered Writing Studio',
        description: 'Enhanced writing environment with intelligent suggestions and content generation.',
    },
    {
        icon: Target,
        title: 'Story Planning Tools',
        description: 'Visual timeline, scene planning, and character development tools.',
    },
    {
        icon: Users,
        title: 'Collaboration Features',
        description: 'Work with editors, reviewers, and other writers seamlessly.',
    },
];

export default function BookCreationLaunchButton({
    className,
    variant = 'default'
}: BookCreationLaunchButtonProps) {
    const navigate = useNavigate();

    const handleLaunch = () => {
        navigate('/d/workspace');
    };

    if (variant === 'minimal') {
        return (
            <Button
                onClick={handleLaunch}
                className={cn('gap-2', className)}
                variant="outline"
            >
                <BookOpen className="h-4 w-4" />
                Book Creation Studio
                <SimpleBadge variant="secondary" className="text-xs">
                    Pro
                </SimpleBadge>
            </Button>
        );
    }

    if (variant === 'card') {
        return (
            <Card className={cn('cursor-pointer transition-all hover:shadow-lg', className)} onClick={handleLaunch}>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                                <BookOpen className="h-5 w-5 text-white" />
                            </div>
                            Book Creation Studio
                        </CardTitle>
                        <SimpleBadge variant="secondary" className="bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Pro
                        </SimpleBadge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-muted-foreground">
                        Professional writing toolkit with AI assistance, story planning, and collaboration features.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                        {features.map((feature, index) => (
                            <div key={index} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                                <feature.icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-medium">{feature.title}</p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Button
                        className="w-full gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleLaunch();
                        }}
                    >
                        <Zap className="h-4 w-4" />
                        Launch Studio
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </CardContent>
            </Card>
        );
    }

    // Default variant
    return (
        <div className={cn('space-y-4', className)}>
            <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-800">New Feature</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Book Creation Studio</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                    A complete writing environment designed for authors, with AI assistance, story planning, and collaboration tools.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                {features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3 p-4 border rounded-lg">
                        <div className="p-2 bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg">
                            <feature.icon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-medium">{feature.title}</h3>
                            <p className="text-sm text-muted-foreground">{feature.description}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="text-center">
                <Button
                    size="lg"
                    onClick={handleLaunch}
                    className="gap-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 px-8"
                >
                    <BookOpen className="h-5 w-5" />
                    Launch Book Creation Studio
                    <ArrowRight className="h-5 w-5" />
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                    Available with Pro subscription
                </p>
            </div>
        </div>
    );
}
