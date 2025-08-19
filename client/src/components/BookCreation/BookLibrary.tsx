/**
 * Book Library - Simple placeholder component for book management
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import SimpleBadge from '~/components/ui/SimpleBadge';
import BookCreationLaunchButton from './LaunchButton';

// Icons
import {
    BookOpen,
    Plus,
    Search,
    Filter,
    Grid,
    List,
} from 'lucide-react';

export default function BookLibrary() {
    const navigate = useNavigate();

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{'Book Library'}</h1>
                    <p className="text-muted-foreground">
                        {'Manage your book projects and writing sessions'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon">
                        <Search className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon">
                        <Filter className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon">
                        <Grid className="h-4 w-4" />
                    </Button>
                    <Button onClick={() => navigate('/d/books/new')} className="gap-2">
                        <Plus className="h-4 w-4" />
                        {'New Book'}
                    </Button>
                </div>
            </div>

            {/* Empty State */}
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center space-y-6">
                    <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold">{'No books yet'}</h3>
                        <p className="text-muted-foreground max-w-md">
                            {'Start your writing journey by creating your first book project. Use our AI-powered tools to plan, write, and organize your story.'}
                        </p>
                    </div>
                    <div className="space-y-4">
                        <Button onClick={() => navigate('/d/books/new')} size="lg" className="gap-2">
                            <Plus className="h-5 w-5" />
                            {'Create Your First Book'}
                        </Button>
                        <div className="text-sm text-muted-foreground">
                            {'or'}
                        </div>
                        <Button variant="outline" onClick={() => navigate('/d/writing')} className="gap-2">
                            <BookOpen className="h-4 w-4" />
                            {'Start Writing Session'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
