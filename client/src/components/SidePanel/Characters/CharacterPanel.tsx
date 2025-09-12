/**
 * Character Panel for Sidebar - Shows characters for the currently active book
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '~/components/ui/Button';
import { Card, CardContent } from '~/components/ui/Card';
import SimpleBadge from '~/components/ui/SimpleBadge';
// Avatar components (inline for simplicity)
const Avatar = ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <div className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}>
        {children}
    </div>
);

const AvatarImage = ({ src, alt, className }: { src?: string; alt?: string; className?: string }) => (
    <img className={cn("aspect-square h-full w-full object-cover", className)} src={src} alt={alt} />
);

const AvatarFallback = ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <div className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted text-muted-foreground", className)}>
        {children}
    </div>
);
import { Input } from '~/components/ui/Input';
import { Textarea } from '~/components/ui/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/Select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/Dialog';
import { Label } from '~/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/DropdownMenu';
import { Separator } from '~/components/ui/separator';
// import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/Tooltip';
import { cn } from '~/utils';
import useCharacters from '~/hooks/useCharacters';
import { useChatContext } from '~/Providers';

// Icons
import {
    Plus,
    Search,
    Users,
    Heart,
    Zap,
    Crown,
    Shield,
    Sword,
    Edit,
    Trash2,
    User,
    Star,
    MoreVertical,
    Camera,
    Image as ImageIcon,
    Loader2,
    FolderOpen,
    Eye,
    RefreshCw,
    BookOpen
} from 'lucide-react';

// Character interface (simplified for panel use)
interface Character {
    _id: string;
    bookId: string;
    name: string;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'minor' | 'mentor' | 'love_interest' | 'comic_relief';
    age?: number;
    gender?: string;
    occupation?: string;
    physicalDescription: {
        distinctiveFeatures: string[];
    };
    personality: {
        coreTraits: string[];
        motivations: string[];
    };
    avatar?: {
        url: string;
        filename: string;
        description?: string;
    };
    notes: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}

interface CharacterPanelProps {
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

// Character templates are now fetched from the backend

export default function CharacterPanel({ className }: CharacterPanelProps) {
    const params = useParams();
    const { conversation } = useChatContext();

    // Extract bookId from conversation context or URL
    const bookId = useMemo(() => {
        // Try to extract from URL params if we're in a book context
        if (params.bookId) {
            return params.bookId;
        }

        // For now, return a placeholder - this would need to be derived from conversation
        // In a real implementation, you might have a way to get bookId from conversation metadata
        return null;
    }, [params]);

    const {
        characters = [],
        loading,
        createCharacter,
        updateCharacter,
        deleteCharacter,
        refresh
    } = useCharacters({ bookId: bookId || '', autoLoad: !!bookId });

    // State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showCharacterDialog, setShowCharacterDialog] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [templates, setTemplates] = useState<any[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [newCharacter, setNewCharacter] = useState({
        name: '',
        role: 'supporting' as const,
        age: undefined as number | undefined,
        gender: '',
        occupation: '',
        physicalDescription: {
            distinctiveFeatures: [] as string[]
        },
        personality: {
            coreTraits: [] as string[],
            motivations: [] as string[]
        },
        notes: '',
        tags: [] as string[]
    });

    // Filter characters based on search
    const filteredCharacters = useMemo(() => {
        if (!searchQuery) return characters;
        return characters.filter(character =>
            character.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            character.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
            character.personality.coreTraits.some(trait =>
                trait.toLowerCase().includes(searchQuery.toLowerCase())
            )
        );
    }, [characters, searchQuery]);

    // Handle character creation with image generation
    const handleCreateCharacter = useCallback(async () => {
        if (!bookId || !newCharacter.name) return;

        setIsCreating(true);
        try {
            const characterData = {
                ...newCharacter,
                bookId,
                physicalDescription: {
                    ...newCharacter.physicalDescription,
                    distinctiveFeatures: newCharacter.physicalDescription.distinctiveFeatures.filter(f => f.trim())
                },
                personality: {
                    ...newCharacter.personality,
                    coreTraits: newCharacter.personality.coreTraits.filter(t => t.trim()),
                    motivations: newCharacter.personality.motivations.filter(m => m.trim()),
                    fears: [],
                    strengths: [],
                    weaknesses: [],
                    quirks: [],
                    mannerisms: []
                },
                referenceImages: [],
                tags: newCharacter.tags.filter(t => t.trim())
            };

            await createCharacter(characterData);

            // Reset form
            setNewCharacter({
                name: '',
                role: 'supporting',
                age: undefined,
                gender: '',
                occupation: '',
                physicalDescription: { distinctiveFeatures: [] },
                personality: { coreTraits: [], motivations: [] },
                notes: '',
                tags: []
            });

            setShowCreateDialog(false);
        } catch (error) {
            console.error('Failed to create character:', error);
        } finally {
            setIsCreating(false);
        }
    }, [bookId, newCharacter, createCharacter]);

    // Fetch character templates
    const fetchTemplates = useCallback(async () => {
        if (templatesLoading || templates.length > 0) return; // Don't fetch if already loaded

        setTemplatesLoading(true);
        try {
            const response = await fetch('/api/characters/templates', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setTemplates(data.templates || []);
            } else {
                console.error('Failed to fetch templates:', response.statusText);
                // Fallback to basic templates
                setTemplates([
                    {
                        name: 'Hero',
                        role: 'protagonist',
                        traits: ['brave', 'determined', 'loyal'],
                        motivations: ['save the world', 'protect loved ones'],
                        description: 'A classic heroic protagonist'
                    },
                    {
                        name: 'Villain',
                        role: 'antagonist',
                        traits: ['cunning', 'ruthless', 'charismatic'],
                        motivations: ['power', 'revenge'],
                        description: 'A compelling antagonist'
                    },
                    {
                        name: 'Mentor',
                        role: 'mentor',
                        traits: ['wise', 'patient', 'experienced'],
                        motivations: ['guide the hero', 'pass on knowledge'],
                        description: 'A wise guide and teacher'
                    }
                ]);
            }
        } catch (error) {
            console.error('Error fetching templates:', error);
            // Fallback to basic templates
            setTemplates([
                {
                    name: 'Hero',
                    role: 'protagonist',
                    traits: ['brave', 'determined', 'loyal'],
                    motivations: ['save the world', 'protect loved ones'],
                    description: 'A classic heroic protagonist'
                },
                {
                    name: 'Villain',
                    role: 'antagonist',
                    traits: ['cunning', 'ruthless', 'charismatic'],
                    motivations: ['power', 'revenge'],
                    description: 'A compelling antagonist'
                },
                {
                    name: 'Mentor',
                    role: 'mentor',
                    traits: ['wise', 'patient', 'experienced'],
                    motivations: ['guide the hero', 'pass on knowledge'],
                    description: 'A wise guide and teacher'
                }
            ]);
        } finally {
            setTemplatesLoading(false);
        }
    }, [templatesLoading, templates.length]);

    // Apply character template
    const applyTemplate = useCallback((template: any) => {
        setNewCharacter(prev => ({
            ...prev,
            role: template.role as any,
            personality: {
                ...prev.personality,
                coreTraits: template.traits || [],
                motivations: template.motivations || []
            },
            notes: template.description || ''
        }));
    }, []);

    // Fetch templates when dialog opens
    useEffect(() => {
        if (showCreateDialog) {
            fetchTemplates();
        }
    }, [showCreateDialog, fetchTemplates]);

    // Add trait/motivation helpers
    const addTrait = useCallback((trait: string) => {
        if (trait.trim()) {
            setNewCharacter(prev => ({
                ...prev,
                personality: {
                    ...prev.personality,
                    coreTraits: [...prev.personality.coreTraits, trait.trim()]
                }
            }));
        }
    }, []);

    const removeTrait = useCallback((index: number) => {
        setNewCharacter(prev => ({
            ...prev,
            personality: {
                ...prev.personality,
                coreTraits: prev.personality.coreTraits.filter((_, i) => i !== index)
            }
        }));
    }, []);

    // Render character card for panel
    const renderCharacterCard = (character: Character) => {
        const roleConfig = CHARACTER_ROLES.find(r => r.value === character.role);
        const RoleIcon = roleConfig?.icon || User;

        return (
            <Card
                key={character._id}
                className="cursor-pointer transition-all hover:shadow-sm hover:bg-surface-hover"
                onClick={() => {
                    setSelectedCharacter(character);
                    setShowCharacterDialog(true);
                }}
            >
                <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10 flex-shrink-0">
                            {character.avatar ? (
                                <AvatarImage src={character.avatar.url} alt={character.name} />
                            ) : null}
                            <AvatarFallback className="text-sm font-medium">
                                {character.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h4 className="font-medium text-sm text-text-primary truncate">
                                        {character.name}
                                    </h4>
                                    <SimpleBadge className={cn("text-xs mt-1", roleConfig?.color)}>
                                        <RoleIcon className="h-2.5 w-2.5 mr-1" />
                                        {roleConfig?.label}
                                    </SimpleBadge>
                                </div>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                            <MoreVertical className="h-3 w-3" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedCharacter(character);
                                            setShowCharacterDialog(true);
                                        }}>
                                            <Eye className="h-3 w-3 mr-2" />
                                            View Details
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedCharacter(character);
                                            setShowCharacterDialog(true);
                                        }}>
                                            <Edit className="h-3 w-3 mr-2" />
                                            Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="text-red-600"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteCharacter(character._id);
                                            }}
                                        >
                                            <Trash2 className="h-3 w-3 mr-2" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* Character info */}
                            {(character.age || character.occupation) && (
                                <p className="text-xs text-text-secondary mt-1">
                                    {[character.age && `Age ${character.age}`, character.occupation]
                                        .filter(Boolean).join(' • ')}
                                </p>
                            )}

                            {/* Images indicator */}
                            {character.avatar && (
                                <div className="flex items-center gap-1 mt-1">
                                    <ImageIcon className="h-3 w-3 text-text-tertiary" />
                                    <span className="text-xs text-text-tertiary">
                                        Has avatar
                                    </span>
                                </div>
                            )}

                            {/* Traits preview */}
                            {character.personality.coreTraits.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {character.personality.coreTraits.slice(0, 2).map((trait, i) => (
                                        <SimpleBadge key={i} variant="outline" className="text-xs">
                                            {trait}
                                        </SimpleBadge>
                                    ))}
                                    {character.personality.coreTraits.length > 2 && (
                                        <SimpleBadge variant="outline" className="text-xs">
                                            +{character.personality.coreTraits.length - 2}
                                        </SimpleBadge>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    };

    // Don't show panel if no book context
    if (!bookId) {
        return (
            <div className={cn('flex h-full flex-col bg-surface-primary', className)}>
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-center">
                        <BookOpen className="h-8 w-8 mx-auto mb-3 text-text-tertiary" />
                        <p className="text-sm text-text-secondary">
                            Select a book to view its characters
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn('flex h-full flex-col bg-surface-primary', className)}>
            {/* Header */}
            <div className="flex-shrink-0 border-b border-border-light p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-text-primary" />
                        <h2 className="text-lg font-semibold text-text-primary">Characters</h2>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={refresh}
                            disabled={loading}
                            className="h-6 w-6 p-0"
                        >
                            {loading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <RefreshCw className="h-3 w-3" />
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowCreateDialog(true)}
                            className="h-6 w-6 p-0"
                        >
                            <Plus className="h-3 w-3" />
                        </Button>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 text-text-tertiary" />
                    <Input
                        placeholder="Search characters..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-8 text-sm"
                    />
                </div>
            </div>

            {/* Character List */}
            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
                        <span className="ml-2 text-sm text-text-secondary">Loading characters...</span>
                    </div>
                ) : filteredCharacters.length === 0 ? (
                    <div className="text-center py-8">
                        {characters.length === 0 ? (
                            <>
                                <Users className="h-8 w-8 mx-auto mb-3 text-text-tertiary" />
                                <p className="text-sm text-text-secondary mb-2">No characters created yet</p>
                                <p className="text-xs text-text-tertiary mb-4">
                                    Add characters to bring your story to life
                                </p>
                                <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                                    <Plus className="h-3 w-3 mr-1" />
                                    Create First Character
                                </Button>
                            </>
                        ) : (
                            <>
                                <FolderOpen className="h-8 w-8 mx-auto mb-3 text-text-tertiary" />
                                <p className="text-sm text-text-secondary">No characters found</p>
                                <p className="text-xs text-text-tertiary">
                                    Try adjusting your search
                                </p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredCharacters.map(renderCharacterCard)}
                    </div>
                )}

                {/* Character count */}
                {characters.length > 0 && (
                    <>
                        <Separator className="my-4" />
                        <div className="text-center">
                            <p className="text-xs text-text-tertiary">
                                {filteredCharacters.length} of {characters.length} character{characters.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </>
                )}
            </div>

            {/* Create Character Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create New Character</DialogTitle>
                        <DialogDescription>
                            Create a character for your story. An image will be generated automatically.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Quick Templates */}
                        <div>
                            <Label className="text-sm font-medium mb-2 block">Quick Start Templates</Label>
                            {templatesLoading ? (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="ml-2 text-sm text-text-secondary">Loading templates...</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                                    {templates.map((template, i) => (
                                        <Button
                                            key={template._id || i}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => applyTemplate(template)}
                                            className="h-auto p-2 flex flex-col items-center text-xs"
                                            title={template.description}
                                        >
                                            <span className="font-medium">{template.name}</span>
                                            <span className="text-xs text-text-secondary">{template.role}</span>
                                            {template.difficulty && (
                                                <span className="text-xs text-text-tertiary">
                                                    {template.difficulty}
                                                </span>
                                            )}
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <Separator />

                        {/* Basic Info */}
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor="name">Name *</Label>
                                    <Input
                                        id="name"
                                        value={newCharacter.name}
                                        onChange={(e) => setNewCharacter(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Character name"
                                    />
                                </div>
                                <div>
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

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <Label htmlFor="age">Age</Label>
                                    <Input
                                        id="age"
                                        type="number"
                                        value={newCharacter.age || ''}
                                        onChange={(e) => setNewCharacter(prev => ({
                                            ...prev,
                                            age: e.target.value ? parseInt(e.target.value) : undefined
                                        }))}
                                        placeholder="Age"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="gender">Gender</Label>
                                    <Input
                                        id="gender"
                                        value={newCharacter.gender}
                                        onChange={(e) => setNewCharacter(prev => ({ ...prev, gender: e.target.value }))}
                                        placeholder="Gender"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="occupation">Occupation</Label>
                                    <Input
                                        id="occupation"
                                        value={newCharacter.occupation}
                                        onChange={(e) => setNewCharacter(prev => ({ ...prev, occupation: e.target.value }))}
                                        placeholder="Job/Role"
                                    />
                                </div>
                            </div>

                            {/* Personality Traits */}
                            <div>
                                <Label>Personality Traits</Label>
                                <div className="space-y-2">
                                    <div className="flex flex-wrap gap-1">
                                        {newCharacter.personality.coreTraits.map((trait, i) => (
                                            <SimpleBadge
                                                key={i}
                                                variant="secondary"
                                                className="cursor-pointer"
                                                onClick={() => removeTrait(i)}
                                            >
                                                {trait} ×
                                            </SimpleBadge>
                                        ))}
                                    </div>
                                    <Input
                                        placeholder="Add trait and press Enter"
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const input = e.target as HTMLInputElement;
                                                addTrait(input.value);
                                                input.value = '';
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <Label htmlFor="notes">Description</Label>
                                <Textarea
                                    id="notes"
                                    value={newCharacter.notes}
                                    onChange={(e) => setNewCharacter(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Brief description of the character..."
                                    rows={3}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreateCharacter}
                                disabled={!newCharacter.name || isCreating}
                            >
                                {isCreating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <Camera className="h-4 w-4 mr-2" />
                                        Create with Image
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Character Details Dialog */}
            <Dialog open={showCharacterDialog} onOpenChange={setShowCharacterDialog}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedCharacter?.name}</DialogTitle>
                        <DialogDescription>
                            Character details and profile
                        </DialogDescription>
                    </DialogHeader>

                    {selectedCharacter && (
                        <div className="space-y-6">
                            <div className="flex items-start gap-4">
                                <Avatar className="h-16 w-16">
                                    {selectedCharacter.avatar ? (
                                        <AvatarImage src={selectedCharacter.avatar.url} alt={selectedCharacter.name} />
                                    ) : null}
                                    <AvatarFallback className="text-lg font-semibold">
                                        {selectedCharacter.name.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="flex-1">
                                    <h3 className="text-xl font-semibold">{selectedCharacter.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        {(() => {
                                            const roleConfig = CHARACTER_ROLES.find(r => r.value === selectedCharacter.role);
                                            const RoleIcon = roleConfig?.icon || User;
                                            return (
                                                <SimpleBadge className={roleConfig?.color}>
                                                    <RoleIcon className="h-3 w-3 mr-1" />
                                                    {roleConfig?.label}
                                                </SimpleBadge>
                                            );
                                        })()}
                                    </div>

                                    {(selectedCharacter.age || selectedCharacter.gender || selectedCharacter.occupation) && (
                                        <div className="mt-2 text-sm text-text-secondary">
                                            {[
                                                selectedCharacter.age && `Age ${selectedCharacter.age}`,
                                                selectedCharacter.gender,
                                                selectedCharacter.occupation
                                            ].filter(Boolean).join(' • ')}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Character Avatar */}
                            {selectedCharacter.avatar && (
                                <div>
                                    <h4 className="font-medium mb-3">Character Avatar</h4>
                                    <div className="flex justify-center">
                                        <div className="space-y-2">
                                            <div className="w-32 h-32 rounded-lg overflow-hidden bg-gray-100">
                                                <img
                                                    src={selectedCharacter.avatar.url}
                                                    alt={`${selectedCharacter.name} avatar`}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-medium text-text-primary">Character Avatar</p>
                                                <p className="text-xs text-text-secondary">AI-generated portrait</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Personality Traits */}
                            {selectedCharacter.personality.coreTraits.length > 0 && (
                                <div>
                                    <h4 className="font-medium mb-2">Personality Traits</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedCharacter.personality.coreTraits.map((trait, i) => (
                                            <SimpleBadge key={i} variant="secondary">
                                                {trait}
                                            </SimpleBadge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Motivations */}
                            {selectedCharacter.personality.motivations.length > 0 && (
                                <div>
                                    <h4 className="font-medium mb-2">Motivations</h4>
                                    <ul className="text-sm text-text-secondary space-y-1">
                                        {selectedCharacter.personality.motivations.map((motivation, i) => (
                                            <li key={i}>• {motivation}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Notes */}
                            {selectedCharacter.notes && (
                                <div>
                                    <h4 className="font-medium mb-2">Description</h4>
                                    <p className="text-sm text-text-secondary whitespace-pre-wrap">
                                        {selectedCharacter.notes}
                                    </p>
                                </div>
                            )}

                            {/* Tags */}
                            {selectedCharacter.tags.length > 0 && (
                                <div>
                                    <h4 className="font-medium mb-2">Tags</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedCharacter.tags.map((tag, i) => (
                                            <SimpleBadge key={i} variant="outline">
                                                {tag}
                                            </SimpleBadge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
