/**
 * Book Editor - Simple placeholder component for book editing
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import SimpleBadge from '~/components/ui/SimpleBadge';
import { Button } from '~/components/ui/Button';

// Icons
import { BookOpen, Edit, Settings, Save, ArrowLeft } from 'lucide-react';

export default function BookEditor() {
    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{'Book Editor'}</h1>
                        <p className="text-muted-foreground">{'Edit your book content and structure'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <SimpleBadge>{'Draft'}</SimpleBadge>
                    <Button variant="outline" size="icon">
                        <Settings className="h-4 w-4" />
                    </Button>
                    <Button className="gap-2">
                        <Save className="h-4 w-4" />
                        {'Save'}
                    </Button>
                </div>
            </div>

            {/* Placeholder Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Edit className="h-5 w-5" />
                                {'Content Editor'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="min-h-[400px] flex items-center justify-center bg-muted rounded-lg">
                                <div className="text-center space-y-2">
                                    <BookOpen className="h-8 w-8 text-muted-foreground mx-auto" />
                                    <p className="text-muted-foreground">{'Rich text editor coming soon'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{'Book Structure'}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="p-2 border rounded-lg">
                                    <p className="font-medium">{'Chapter 1'}</p>
                                    <p className="text-sm text-muted-foreground">{'Introduction'}</p>
                                </div>
                                <div className="p-2 border rounded-lg bg-muted">
                                    <p className="font-medium">{'Chapter 2'}</p>
                                    <p className="text-sm text-muted-foreground">{'Currently editing'}</p>
                                </div>
                                <div className="p-2 border rounded-lg opacity-50">
                                    <p className="font-medium">{'Chapter 3'}</p>
                                    <p className="text-sm text-muted-foreground">{'Planned'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{'Writing Goals'}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div>
                                    <p className="text-sm font-medium">{'Daily Goal'}</p>
                                    <p className="text-sm text-muted-foreground">{'500 words'}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium">{'Progress'}</p>
                                    <p className="text-sm text-muted-foreground">{'250 / 500 words'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
