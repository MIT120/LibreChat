/**
 * Character Codex - NovelCrafter-inspired centralized character management
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import SimpleBadge from '~/components/ui/SimpleBadge';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/Avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/Dialog';
import { Input } from '~/components/ui/Input';
import { Textarea } from '~/components/ui/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/Tabs';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/DropdownMenu';
import { Separator } from '~/components/ui/separator';
import { Progress } from '~/components/ui/progress';
import { cn } from '~/utils';

// Icons
import {
    Plus,
    Search,
    Filter,
    MoreVertical,
    Users,
    Heart,
    Zap,
    Crown,
    Shield,
    Sword,
    Edit,
    Trash2,
    Upload,
    Camera,
    Eye,
    EyeOff,
    Star,
    User,
    UserCheck,
    UserX,
    Palette,
    FileText,
    Target,
    Globe,
    MessageCircle,
    Image as ImageIcon
} from 'lucide-react';

// Types
export interface Character {
    _id: string;
    bookId: string;
    name: string;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'minor' | 'mentor' | 'love_interest' | 'comic_relief';

    // Basic Info
    age?: number;
    gender?: string;
    species?: string;
    occupation?: string;

    // Physical Description
    physicalDescription: {
        height?: string;
        build?: string;
        hairColor?: string;
        hairStyle?: string;
        eyeColor?: string;
        skinTone?: string;
        distinctiveFeatures: string[];
        clothing?: {
            style: string;
            colors: string[];
            accessories: string[];
        };
    };

    // Personality
    personality: {
        coreTraits: string[];
        motivations: string[];
        fears: string[];
        strengths: string[];
        weaknesses: string[];
        quirks: string[];
        speechPattern?: string;
        mannerisms: string[];
    };

    // Background
    background: {
        origin?: string;
        family?: string;
        education?: string;
        pastEvents: string[];
        secrets: string[];
        skills: string[];
    };

    // Story Elements
    goals: Array<{
        description: string;
        priority: 'low' | 'medium' | 'high';
        status: 'active' | 'achieved' | 'failed' | 'abandoned';
    }>;

    arc: {
        startingPoint: string;
        majorBeats: Array<{
            chapter?: number;
            description: string;
            transformation: string;
        }>;
        endingPoint: string;
        theme?: string;
    };

    relationships: Array<{
        characterId: string;
        characterName: string;
        relationship: string;
        description: string;
        dynamic: 'positive' | 'negative' | 'neutral' | 'complex';
    }>;

    // Appearance & Media
    avatar?: {
        url: string;
        filename: string;
        description?: string;
    };
    referenceImages: Array<{
        url: string;
        filename: string;
        description: string;
        type: 'face' | 'full_body' | 'clothing' | 'expression' | 'pose' | 'other';
    }>;

    // Meta
    notes: string;
    tags: string[];
    isTemplate: boolean;
    visibility: 'public' | 'private';
    createdAt: Date;
    updatedAt: Date;
    version: number;

    // Story Integration
    appearances: Array<{
        chapterId: string;
        pageId: string;
        sceneType: string;
        description: string;
    }>;

    // Generation Settings
    imageGenerationProfile: {
        consistencyLevel: 'low' | 'medium' | 'high' | 'strict';
        preferredStyles: string[];
        excludedElements: string[];
        customPromptAdditions: string;
    };
}

interface CharacterCodexProps {
    bookId: string;
    characters: Character[];
    onCharacterCreate: (character: Partial<Character>) => Promise<void>;
    onCharacterUpdate: (characterId: string, updates: Partial<Character>) => Promise<void>;
    onCharacterDelete: (characterId: string) => Promise<void>;
    onAvatarUpload: (characterId: string, file: File) => Promise<string>;
    onReferenceImageUpload: (characterId: string, file: File, type: string, description: string) => Promise<string>;
    className?: string;
}

const CHARACTER_ROLES = [
    { value: 'protagonist', label: 'Protagonist', icon: Crown, color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    { value: 'antagonist', label: 'Antagonist', icon: Sword, color: 'bg-red-100 text-red-800 border-red-300' },
    { value: 'supporting', label: 'Supporting', icon: Shield, color: 'bg-blue-100 text-blue-800 border-blue-300' },
    { value: 'mentor', label: 'Mentor', icon: Star, color: 'bg-purple-100 text-purple-800 border-purple-300' },
    { value: 'love_interest', label: 'Love Interest', icon: Heart, color: 'bg-pink-100 text-pink-800 border-pink-300' },
    { value: 'comic_relief', label: 'Comic Relief', icon: Zap, color: 'bg-green-100 text-green-800 border-green-300' },
    { value: 'minor', label: 'Minor', icon: User, color: 'bg-gray-100 text-gray-800 border-gray-300' }
];

const QUICK_TEMPLATES = [
    {
        name: 'Hero',
        role: 'protagonist',
        traits: ['brave', 'determined', 'loyal'],
        motivations: ['save the world', 'protect loved ones'],
        arc: 'reluctant hero to confident leader'
    },
    {
        name: 'Villain',
        role: 'antagonist',
        traits: ['cunning', 'ruthless', 'charismatic'],
        motivations: ['power', 'revenge'],
        arc: 'rising threat to ultimate defeat'
    },
    {
        name: 'Mentor',
        role: 'mentor',
        traits: ['wise', 'patient', 'experienced'],
        motivations: ['guide the hero', 'pass on knowledge'],
        arc: 'teacher to sacrifice/departure'
    }
];

export default function CharacterCodex({
    bookId,
    characters,
    onCharacterCreate,
    onCharacterUpdate,
    onCharacterDelete,
    onAvatarUpload,
    onReferenceImageUpload,
    className
}: CharacterCodexProps) {
    // State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterRole, setFilterRole] = useState<string>('all');
    const [filterTags, setFilterTags] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showCharacterDialog, setShowCharacterDialog] = useState(false);
    const [newCharacter, setNewCharacter] = useState<Partial<Character>>({
        name: '',
        role: 'supporting',
        physicalDescription: {
            distinctiveFeatures: [],
            clothing: { style: '', colors: [], accessories: [] }
        },
        personality: {
            coreTraits: [],
            motivations: [],
            fears: [],
            strengths: [],
            weaknesses: [],
            quirks: [],
            mannerisms: []
        },
        background: {
            pastEvents: [],
            secrets: [],
            skills: []
        },
        goals: [],
        arc: {
            startingPoint: '',
            majorBeats: [],
            endingPoint: ''
        },
        relationships: [],
        referenceImages: [],
        notes: '',
        tags: [],
        isTemplate: false,
        visibility: 'public',
        imageGenerationProfile: {
            consistencyLevel: 'medium',
            preferredStyles: [],
            excludedElements: [],
            customPromptAdditions: ''
        }
    });

    // Filter characters
    const filteredCharacters = useMemo(() => {
        return characters.filter(character => {
            const matchesSearch = character.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                character.personality.coreTraits.some(trait => trait.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesRole = filterRole === 'all' || character.role === filterRole;
            const matchesTags = filterTags === 'all' || character.tags.includes(filterTags);
            return matchesSearch && matchesRole && matchesTags;
        });
    }, [characters, searchQuery, filterRole, filterTags]);

    // Get unique tags
    const availableTags = useMemo(() => {
        const tags = new Set<string>();
        characters.forEach(char => char.tags.forEach(tag => tags.add(tag)));
        return Array.from(tags);
    }, [characters]);

    // Handle character creation
    const handleCreateCharacter = useCallback(async () => {
        try {
            await onCharacterCreate({
                ...newCharacter,
                bookId,
                version: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
                appearances: []
            });
            setShowCreateDialog(false);
            // Reset form
            setNewCharacter({
                name: '',
                role: 'supporting',
                physicalDescription: {
                    distinctiveFeatures: [],
                    clothing: { style: '', colors: [], accessories: [] }
                },
                personality: {
                    coreTraits: [],
                    motivations: [],
                    fears: [],
                    strengths: [],
                    weaknesses: [],
                    quirks: [],
                    mannerisms: []
                },
                background: {
                    pastEvents: [],
                    secrets: [],
                    skills: []
                },
                goals: [],
                arc: {
                    startingPoint: '',
                    majorBeats: [],
                    endingPoint: ''
                },
                relationships: [],
                referenceImages: [],
                notes: '',
                tags: [],
                isTemplate: false,
                visibility: 'public',
                imageGenerationProfile: {
                    consistencyLevel: 'medium',
                    preferredStyles: [],
                    excludedElements: [],
                    customPromptAdditions: ''
                }
            });
        } catch (error) {
            console.error('Failed to create character:', error);
        }
    }, [newCharacter, bookId, onCharacterCreate]);

    // Apply template
    const applyTemplate = useCallback((template: typeof QUICK_TEMPLATES[0]) => {
        setNewCharacter(prev => ({
            ...prev,
            role: template.role as any,
            personality: {
                ...prev.personality!,
                coreTraits: template.traits,
                motivations: template.motivations
            },
            arc: {
                ...prev.arc!,
                startingPoint: template.arc
            }
        }));
    }, []);

    // Render character card
    const renderCharacterCard = (character: Character) => {
        const roleConfig = CHARACTER_ROLES.find(r => r.value === character.role);
        const RoleIcon = roleConfig?.icon || User;

        return (
            <Card
                key={character._id}
                className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
                onClick={() => {
                    setSelectedCharacter(character);
                    setShowCharacterDialog(true);
                }}
            >
                <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                                {character.avatar ? (
                                    <AvatarImage src={character.avatar.url} alt={character.name} />
                                ) : null}
                                <AvatarFallback className="text-lg font-semibold">
                                    {character.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h3 className="font-semibold text-lg">{character.name}</h3>
                                <Badge className={cn("text-xs", roleConfig?.color)}>
                                    <RoleIcon className="h-3 w-3 mr-1" />
                                    {roleConfig?.label}
                                </Badge>
                            </div>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCharacter(character);
                                    setShowCharacterDialog(true);
                                }}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => {
                                    e.stopPropagation();
                                    // Handle duplicate
                                }}>
                                    <FileText className="h-4 w-4 mr-2" />
                                    Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCharacterDelete(character._id);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Description Preview */}
                    <div className="space-y-2 mb-3">
                        {character.age && (
                            <p className="text-sm text-gray-600">
                                Age: {character.age} {character.gender && `• ${character.gender}`}
                            </p>
                        )}
                        {character.occupation && (
                            <p className="text-sm text-gray-600">{character.occupation}</p>
                        )}
                    </div>

                    {/* Traits Preview */}
                    <div className="space-y-2 mb-3">
                        {character.personality.coreTraits.length > 0 && (
                            <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Personality</p>
                                <div className="flex flex-wrap gap-1">
                                    {character.personality.coreTraits.slice(0, 3).map((trait, i) => (
                                        <Badge key={i} variant="outline" className="text-xs">
                                            {trait}
                                        </Badge>
                                    ))}
                                    {character.personality.coreTraits.length > 3 && (
                                        <Badge variant="outline" className="text-xs">
                                            +{character.personality.coreTraits.length - 3}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="flex justify-between text-xs text-gray-500 pt-2 border-t">
                        <span>{character.appearances?.length || 0} scenes</span>
                        <span>{character.referenceImages.length} images</span>
                        <span>{character.relationships.length} relationships</span>
                    </div>

                    {/* Tags */}
                    {character.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {character.tags.slice(0, 2).map((tag, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <div className={cn("character-codex h-full flex flex-col", className)}>
            {/* Header */}
            <div className="border-b bg-white p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold">Character Codex</h2>
                        <p className="text-gray-600">Manage your story characters</p>
                    </div>
                    <Button onClick={() => setShowCreateDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Character
                    </Button>
                </div>

                {/* Filters and Search */}
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Search characters..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 w-64"
                        />
                    </div>

                    <Select value={filterRole} onValueChange={setFilterRole}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="All Roles" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            {CHARACTER_ROLES.map((role) => (
                                <SelectItem key={role.value} value={role.value}>
                                    {role.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filterTags} onValueChange={setFilterTags}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="All Tags" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Tags</SelectItem>
                            {availableTags.map((tag) => (
                                <SelectItem key={tag} value={tag}>
                                    {tag}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2 ml-auto">
                        <Button
                            variant={viewMode === 'grid' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setViewMode('grid')}
                        >
                            Grid
                        </Button>
                        <Button
                            variant={viewMode === 'list' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setViewMode('list')}
                        >
                            List
                        </Button>
                    </div>
                </div>
            </div>

            {/* Character Grid/List */}
            <div className="flex-1 overflow-auto p-6">
                {filteredCharacters.length === 0 ? (
                    <div className="text-center py-12">
                        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No characters found</h3>
                        <p className="text-gray-600 mb-4">
                            {characters.length === 0
                                ? "Create your first character to get started"
                                : "Try adjusting your search or filters"
                            }
                        </p>
                        <Button onClick={() => setShowCreateDialog(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Character
                        </Button>
                    </div>
                ) : (
                    <div className={cn(
                        viewMode === 'grid'
                            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                            : "space-y-4"
                    )}>
                        {filteredCharacters.map(renderCharacterCard)}
                    </div>
                )}
            </div>

            {/* Create Character Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create New Character</DialogTitle>
                        <DialogDescription>
                            Build a detailed character profile for your story
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                        {/* Quick Templates */}
                        <div>
                            <Label className="text-base font-medium">Quick Start Templates</Label>
                            <div className="grid grid-cols-3 gap-3 mt-2">
                                {QUICK_TEMPLATES.map((template, i) => (
                                    <Button
                                        key={i}
                                        variant="outline"
                                        onClick={() => applyTemplate(template)}
                                        className="p-4 h-auto flex flex-col items-start"
                                    >
                                        <span className="font-medium">{template.name}</span>
                                        <span className="text-xs text-gray-600">{template.arc}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <Separator />

                        <Tabs defaultValue="basic" className="w-full">
                            <TabsList className="grid w-full grid-cols-6">
                                <TabsTrigger value="basic">Basic</TabsTrigger>
                                <TabsTrigger value="appearance">Appearance</TabsTrigger>
                                <TabsTrigger value="personality">Personality</TabsTrigger>
                                <TabsTrigger value="background">Background</TabsTrigger>
                                <TabsTrigger value="story">Story Arc</TabsTrigger>
                                <TabsTrigger value="images">Images</TabsTrigger>
                            </TabsList>

                            <TabsContent value="basic" className="space-y-4 mt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">Character Name *</Label>
                                        <Input
                                            id="name"
                                            value={newCharacter.name || ''}
                                            onChange={(e) => setNewCharacter(prev => ({ ...prev, name: e.target.value }))}
                                            placeholder="Enter character name"
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="role">Role *</Label>
                                        <Select
                                            value={newCharacter.role}
                                            onValueChange={(value) => setNewCharacter(prev => ({ ...prev, role: value as any }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {CHARACTER_ROLES.map((role) => (
                                                    <SelectItem key={role.value} value={role.value}>
                                                        {role.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="age">Age</Label>
                                        <Input
                                            id="age"
                                            type="number"
                                            value={newCharacter.age || ''}
                                            onChange={(e) => setNewCharacter(prev => ({ ...prev, age: parseInt(e.target.value) || undefined }))}
                                            placeholder="Age"
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="gender">Gender</Label>
                                        <Input
                                            id="gender"
                                            value={newCharacter.gender || ''}
                                            onChange={(e) => setNewCharacter(prev => ({ ...prev, gender: e.target.value }))}
                                            placeholder="Gender"
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="occupation">Occupation</Label>
                                        <Input
                                            id="occupation"
                                            value={newCharacter.occupation || ''}
                                            onChange={(e) => setNewCharacter(prev => ({ ...prev, occupation: e.target.value }))}
                                            placeholder="Occupation"
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="notes">Character Notes</Label>
                                    <Textarea
                                        id="notes"
                                        value={newCharacter.notes || ''}
                                        onChange={(e) => setNewCharacter(prev => ({ ...prev, notes: e.target.value }))}
                                        placeholder="General notes about this character..."
                                        rows={4}
                                    />
                                </div>
                            </TabsContent>

                            {/* Other tabs would be implemented similarly */}
                            <TabsContent value="appearance">
                                <div className="text-center py-8 text-gray-500">
                                    Physical appearance editor would go here
                                </div>
                            </TabsContent>

                            <TabsContent value="personality">
                                <div className="text-center py-8 text-gray-500">
                                    Personality trait editor would go here
                                </div>
                            </TabsContent>

                            <TabsContent value="background">
                                <div className="text-center py-8 text-gray-500">
                                    Background and history editor would go here
                                </div>
                            </TabsContent>

                            <TabsContent value="story">
                                <div className="text-center py-8 text-gray-500">
                                    Character arc planning would go here
                                </div>
                            </TabsContent>

                            <TabsContent value="images">
                                <div className="text-center py-8 text-gray-500">
                                    Avatar and reference image upload would go here
                                </div>
                            </TabsContent>
                        </Tabs>

                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleCreateCharacter} disabled={!newCharacter.name}>
                                Create Character
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Character Details Dialog */}
            <Dialog open={showCharacterDialog} onOpenChange={setShowCharacterDialog}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedCharacter?.name}</DialogTitle>
                        <DialogDescription>
                            Character profile and details
                        </DialogDescription>
                    </DialogHeader>

                    {selectedCharacter && (
                        <div className="space-y-6">
                            {/* Character overview would go here */}
                            <div className="text-center py-8 text-gray-500">
                                Detailed character view would be implemented here
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
