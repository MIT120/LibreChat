/**
 * Character Template Manager - Export/Import character templates for reuse
 */

import React, { useState, useCallback } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import SimpleBadge from '~/components/ui/SimpleBadge';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/Avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/Dialog';
import { Input } from '~/components/ui/Input';
import { Textarea } from '~/components/ui/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/Select';
import { Label } from '~/components/ui/label';
import { Switch } from '~/components/ui/switch';
import { Progress } from '~/components/ui/progress';
import { cn } from '~/utils';

// Icons
import {
    Download,
    Upload,
    FileDown,
    FileUp,
    Copy,
    Package,
    Star,
    Users,
    Globe,
    Lock,
    Check,
    X,
    AlertTriangle,
    Info,
    Search,
    Filter,
    Plus,
    Edit,
    Trash2,
    Eye,
    Share
} from 'lucide-react';

// Types
interface Character {
    _id: string;
    name: string;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'minor' | 'mentor' | 'love_interest' | 'comic_relief';
    age?: number;
    gender?: string;
    occupation?: string;
    physicalDescription: any;
    personality: any;
    background: any;
    goals: any[];
    arc: any;
    tags: string[];
    notes: string;
    isTemplate: boolean;
    visibility: 'public' | 'private';
}

interface CharacterTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    genre: string[];
    author: string;
    downloads: number;
    rating: number;
    isOfficial: boolean;
    visibility: 'public' | 'private';
    character: Omit<Character, '_id' | 'isTemplate'>;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}

interface CharacterTemplateManagerProps {
    bookId: string;
    characters: Character[];
    onImportCharacter: (character: Partial<Character>) => Promise<void>;
    onExportCharacters: (characterIds: string[], format: string) => Promise<void>;
    className?: string;
}

const TEMPLATE_CATEGORIES = [
    'Heroes',
    'Villains',
    'Supporting Characters',
    'Mentors',
    'Love Interests',
    'Comic Relief',
    'Archetypes',
    'Fantasy',
    'Sci-Fi',
    'Romance',
    'Mystery',
    'Horror',
    'Historical',
    'Custom'
];

const EXPORT_FORMATS = [
    { value: 'json', label: 'JSON', description: 'Full character data for backup/sharing' },
    { value: 'csv', label: 'CSV', description: 'Spreadsheet format for external tools' },
    { value: 'yaml', label: 'YAML', description: 'Human-readable format' },
    { value: 'template', label: 'Template', description: 'Reusable character template' }
];

// Mock templates - in production, these would come from API
const SAMPLE_TEMPLATES: CharacterTemplate[] = [
    {
        id: 'template_1',
        name: 'The Reluctant Hero',
        description: 'Classic hero archetype who is thrust into adventure against their will',
        category: 'Heroes',
        genre: ['fantasy', 'adventure'],
        author: 'NovelCrafter Official',
        downloads: 1240,
        rating: 4.8,
        isOfficial: true,
        visibility: 'public',
        character: {
            name: 'Hero Template',
            role: 'protagonist',
            physicalDescription: {
                distinctiveFeatures: ['brave eyes', 'determined jaw'],
                clothing: { style: 'practical', colors: ['earth tones'], accessories: [] }
            },
            personality: {
                coreTraits: ['brave', 'reluctant', 'growing', 'compassionate'],
                motivations: ['protect loved ones', 'do what\'s right'],
                fears: ['failure', 'losing people they care about'],
                strengths: ['courage under pressure', 'quick thinking'],
                weaknesses: ['self-doubt', 'impulsiveness'],
                quirks: ['fidgets when nervous'],
                mannerisms: ['looks down when uncertain']
            },
            background: {
                pastEvents: ['ordinary life disrupted'],
                secrets: ['hidden potential'],
                skills: ['basic combat', 'problem solving']
            },
            goals: [],
            arc: {
                startingPoint: 'Ordinary person in ordinary world',
                majorBeats: [],
                endingPoint: 'Transformed hero who has grown'
            },
            tags: ['hero', 'growth', 'reluctant'],
            notes: 'Template for classic hero\'s journey protagonist',
            visibility: 'public'
        },
        tags: ['hero', 'protagonist', 'journey'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
    },
    {
        id: 'template_2',
        name: 'The Cunning Villain',
        description: 'Intelligent antagonist who relies on wit rather than brute force',
        category: 'Villains',
        genre: ['mystery', 'thriller'],
        author: 'NovelCrafter Official',
        downloads: 890,
        rating: 4.6,
        isOfficial: true,
        visibility: 'public',
        character: {
            name: 'Villain Template',
            role: 'antagonist',
            physicalDescription: {
                distinctiveFeatures: ['piercing gaze', 'calculating smile'],
                clothing: { style: 'elegant', colors: ['dark'], accessories: ['signature item'] }
            },
            personality: {
                coreTraits: ['intelligent', 'manipulative', 'charming', 'ruthless'],
                motivations: ['power', 'control', 'revenge'],
                fears: ['being outsmarted', 'losing control'],
                strengths: ['strategic thinking', 'persuasion'],
                weaknesses: ['arrogance', 'underestimating others'],
                quirks: ['cold smile when pleased'],
                mannerisms: ['steeples fingers when thinking']
            },
            background: {
                pastEvents: ['betrayal or loss that shaped them'],
                secrets: ['hidden vulnerability'],
                skills: ['manipulation', 'planning', 'reading people']
            },
            goals: [],
            arc: {
                startingPoint: 'Established power position',
                majorBeats: [],
                endingPoint: 'Defeated but memorable'
            },
            tags: ['villain', 'intelligent', 'manipulative'],
            notes: 'Template for cerebral antagonist',
            visibility: 'public'
        },
        tags: ['villain', 'antagonist', 'cunning'],
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01')
    }
];

export default function CharacterTemplateManager({
    bookId,
    characters,
    onImportCharacter,
    onExportCharacters,
    className
}: CharacterTemplateManagerProps) {
    // State
    const [activeTab, setActiveTab] = useState<'import' | 'export' | 'templates'>('templates');
    const [templates, setTemplates] = useState<CharacterTemplate[]>(SAMPLE_TEMPLATES);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [filterGenre, setFilterGenre] = useState<string>('all');
    const [selectedTemplate, setSelectedTemplate] = useState<CharacterTemplate | null>(null);
    const [showTemplateDialog, setShowTemplateDialog] = useState(false);
    const [showExportDialog, setShowExportDialog] = useState(false);
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
    const [exportFormat, setExportFormat] = useState('json');
    const [exportOptions, setExportOptions] = useState({
        includeImages: false,
        includePrivateNotes: false,
        createTemplate: false
    });
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importPreview, setImportPreview] = useState<any[]>([]);
    const [isImporting, setIsImporting] = useState(false);

    // Filter templates
    const filteredTemplates = templates.filter(template => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (!template.name.toLowerCase().includes(query) &&
                !template.description.toLowerCase().includes(query) &&
                !template.tags.some(tag => tag.toLowerCase().includes(query))) {
                return false;
            }
        }

        if (filterCategory !== 'all' && template.category !== filterCategory) {
            return false;
        }

        if (filterGenre !== 'all' && !template.genre.includes(filterGenre)) {
            return false;
        }

        return true;
    });

    // Handle template import
    const handleImportTemplate = useCallback(async (template: CharacterTemplate) => {
        try {
            await onImportCharacter({
                ...template.character,
                name: `${template.character.name} (from template)`,
                isTemplate: false
            });

            // Update download count
            setTemplates(prev => prev.map(t =>
                t.id === template.id
                    ? { ...t, downloads: t.downloads + 1 }
                    : t
            ));

        } catch (error) {
            console.error('Failed to import template:', error);
        }
    }, [onImportCharacter]);

    // Handle file import
    const handleFileImport = useCallback(async () => {
        if (!importFile) return;

        setIsImporting(true);

        try {
            const text = await importFile.text();
            let data;

            if (importFile.name.endsWith('.json')) {
                data = JSON.parse(text);
            } else if (importFile.name.endsWith('.csv')) {
                // Basic CSV parsing - in production, use a proper CSV library
                const lines = text.split('\n');
                const headers = lines[0].split(',');
                data = lines.slice(1).map(line => {
                    const values = line.split(',');
                    const obj: any = {};
                    headers.forEach((header, index) => {
                        obj[header.trim()] = values[index]?.trim();
                    });
                    return obj;
                });
            } else {
                throw new Error('Unsupported file format');
            }

            setImportPreview(Array.isArray(data) ? data : [data]);

        } catch (error) {
            console.error('Failed to parse import file:', error);
        } finally {
            setIsImporting(false);
        }
    }, [importFile]);

    // Handle export
    const handleExport = useCallback(async () => {
        if (selectedCharacters.length === 0) return;

        try {
            await onExportCharacters(selectedCharacters, exportFormat);
        } catch (error) {
            console.error('Failed to export characters:', error);
        }
    }, [selectedCharacters, exportFormat, onExportCharacters]);

    // Toggle character selection
    const toggleCharacterSelection = useCallback((characterId: string) => {
        setSelectedCharacters(prev =>
            prev.includes(characterId)
                ? prev.filter(id => id !== characterId)
                : [...prev, characterId]
        );
    }, []);

    // Render template card
    const renderTemplateCard = (template: CharacterTemplate) => (
        <Card
            key={template.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => {
                setSelectedTemplate(template);
                setShowTemplateDialog(true);
            }}
        >
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="font-semibold flex items-center gap-2">
                            {template.name}
                            {template.isOfficial && (
                                <Badge variant="secondary" className="text-xs">
                                    <Check className="h-3 w-3 mr-1" />
                                    Official
                                </Badge>
                            )}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Star className="h-3 w-3 text-yellow-500" />
                        {template.rating}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-0">
                <div className="space-y-3">
                    {/* Character preview */}
                    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                        <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                                {template.character.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-medium text-sm">{template.character.name}</p>
                            <p className="text-xs text-gray-600 capitalize">{template.character.role}</p>
                        </div>
                    </div>

                    {/* Traits preview */}
                    <div>
                        <p className="text-xs font-medium text-gray-700 mb-1">Key Traits</p>
                        <div className="flex flex-wrap gap-1">
                            {template.character.personality.coreTraits.slice(0, 3).map((trait, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                    {trait}
                                </Badge>
                            ))}
                            {template.character.personality.coreTraits.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                    +{template.character.personality.coreTraits.length - 3}
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex justify-between text-xs text-gray-500 pt-2 border-t">
                        <span>{template.category}</span>
                        <span>{template.downloads} downloads</span>
                    </div>

                    {/* Genre tags */}
                    <div className="flex flex-wrap gap-1">
                        {template.genre.map((genre, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                                {genre}
                            </Badge>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className={cn("character-template-manager h-full flex flex-col", className)}>
            {/* Header */}
            <div className="border-b bg-white p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold">Character Templates</h2>
                        <p className="text-gray-600">Import, export, and manage character templates</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowImportDialog(true)}
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            Import
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setShowExportDialog(true)}
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Export
                        </Button>
                    </div>
                </div>

                {/* Tab navigation */}
                <div className="flex gap-4 mb-4">
                    <Button
                        variant={activeTab === 'templates' ? 'default' : 'outline'}
                        onClick={() => setActiveTab('templates')}
                    >
                        <Package className="h-4 w-4 mr-2" />
                        Browse Templates
                    </Button>
                    <Button
                        variant={activeTab === 'export' ? 'default' : 'outline'}
                        onClick={() => setActiveTab('export')}
                    >
                        <FileDown className="h-4 w-4 mr-2" />
                        Export Characters
                    </Button>
                    <Button
                        variant={activeTab === 'import' ? 'default' : 'outline'}
                        onClick={() => setActiveTab('import')}
                    >
                        <FileUp className="h-4 w-4 mr-2" />
                        Import Characters
                    </Button>
                </div>

                {/* Filters (for templates tab) */}
                {activeTab === 'templates' && (
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search templates..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 w-64"
                            />
                        </div>

                        <Select value={filterCategory} onValueChange={setFilterCategory}>
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                {TEMPLATE_CATEGORIES.map((category) => (
                                    <SelectItem key={category} value={category}>
                                        {category}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={filterGenre} onValueChange={setFilterGenre}>
                            <SelectTrigger className="w-40">
                                <SelectValue placeholder="All Genres" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Genres</SelectItem>
                                <SelectItem value="fantasy">Fantasy</SelectItem>
                                <SelectItem value="sci-fi">Sci-Fi</SelectItem>
                                <SelectItem value="romance">Romance</SelectItem>
                                <SelectItem value="mystery">Mystery</SelectItem>
                                <SelectItem value="horror">Horror</SelectItem>
                                <SelectItem value="historical">Historical</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {activeTab === 'templates' && (
                    <div>
                        {filteredTemplates.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredTemplates.map(renderTemplateCard)}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
                                <p className="text-gray-600">
                                    Try adjusting your search or filters
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'export' && (
                    <div className="max-w-2xl">
                        <Card>
                            <CardHeader>
                                <CardTitle>Export Characters</CardTitle>
                                <p className="text-sm text-gray-600">
                                    Select characters and format for export
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Character selection */}
                                <div>
                                    <Label className="text-base font-medium">Select Characters</Label>
                                    <div className="grid grid-cols-1 gap-2 mt-2">
                                        {characters.map(character => (
                                            <div
                                                key={character._id}
                                                className={cn(
                                                    "flex items-center gap-3 p-3 border rounded-lg cursor-pointer",
                                                    selectedCharacters.includes(character._id)
                                                        ? "border-blue-500 bg-blue-50"
                                                        : "border-gray-200 hover:border-gray-300"
                                                )}
                                                onClick={() => toggleCharacterSelection(character._id)}
                                            >
                                                <Avatar className="h-8 w-8">
                                                    {character.avatar ? (
                                                        <AvatarImage src={character.avatar.url} alt={character.name} />
                                                    ) : null}
                                                    <AvatarFallback className="text-xs">
                                                        {character.name.slice(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1">
                                                    <p className="font-medium">{character.name}</p>
                                                    <p className="text-sm text-gray-600 capitalize">{character.role}</p>
                                                </div>
                                                {selectedCharacters.includes(character._id) && (
                                                    <Check className="h-4 w-4 text-blue-600" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Export format */}
                                <div>
                                    <Label className="text-base font-medium">Export Format</Label>
                                    <div className="grid grid-cols-1 gap-2 mt-2">
                                        {EXPORT_FORMATS.map(format => (
                                            <div
                                                key={format.value}
                                                className={cn(
                                                    "flex items-start gap-3 p-3 border rounded-lg cursor-pointer",
                                                    exportFormat === format.value
                                                        ? "border-blue-500 bg-blue-50"
                                                        : "border-gray-200 hover:border-gray-300"
                                                )}
                                                onClick={() => setExportFormat(format.value)}
                                            >
                                                <div className="flex-1">
                                                    <p className="font-medium">{format.label}</p>
                                                    <p className="text-sm text-gray-600">{format.description}</p>
                                                </div>
                                                {exportFormat === format.value && (
                                                    <Check className="h-4 w-4 text-blue-600" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Export options */}
                                <div>
                                    <Label className="text-base font-medium">Export Options</Label>
                                    <div className="space-y-3 mt-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="includeImages">Include images</Label>
                                            <Switch
                                                id="includeImages"
                                                checked={exportOptions.includeImages}
                                                onCheckedChange={(checked) =>
                                                    setExportOptions(prev => ({ ...prev, includeImages: checked }))
                                                }
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="includePrivateNotes">Include private notes</Label>
                                            <Switch
                                                id="includePrivateNotes"
                                                checked={exportOptions.includePrivateNotes}
                                                onCheckedChange={(checked) =>
                                                    setExportOptions(prev => ({ ...prev, includePrivateNotes: checked }))
                                                }
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="createTemplate">Create reusable template</Label>
                                            <Switch
                                                id="createTemplate"
                                                checked={exportOptions.createTemplate}
                                                onCheckedChange={(checked) =>
                                                    setExportOptions(prev => ({ ...prev, createTemplate: checked }))
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleExport}
                                    disabled={selectedCharacters.length === 0}
                                    className="w-full"
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Export {selectedCharacters.length} Character{selectedCharacters.length !== 1 ? 's' : ''}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === 'import' && (
                    <div className="max-w-2xl">
                        <Card>
                            <CardHeader>
                                <CardTitle>Import Characters</CardTitle>
                                <p className="text-sm text-gray-600">
                                    Upload a character file to import
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* File upload */}
                                <div>
                                    <Label className="text-base font-medium">Select File</Label>
                                    <div className="mt-2">
                                        <Input
                                            type="file"
                                            accept=".json,.csv,.yaml,.yml"
                                            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Supported formats: JSON, CSV, YAML
                                        </p>
                                    </div>
                                </div>

                                {importFile && (
                                    <Button onClick={handleFileImport} disabled={isImporting}>
                                        {isImporting ? (
                                            <>
                                                <div className="animate-spin h-4 w-4 mr-2 border-2 border-gray-300 border-t-blue-600 rounded-full" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <Eye className="h-4 w-4 mr-2" />
                                                Preview Import
                                            </>
                                        )}
                                    </Button>
                                )}

                                {/* Import preview */}
                                {importPreview.length > 0 && (
                                    <div>
                                        <Label className="text-base font-medium">Import Preview</Label>
                                        <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                                            {importPreview.map((character, index) => (
                                                <div key={index} className="p-3 border rounded-lg">
                                                    <p className="font-medium">{character.name || 'Unnamed Character'}</p>
                                                    <p className="text-sm text-gray-600">
                                                        {character.role || 'No role specified'}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        <Button
                                            onClick={() => {
                                                importPreview.forEach(char => onImportCharacter(char));
                                                setImportPreview([]);
                                                setImportFile(null);
                                            }}
                                            className="w-full mt-3"
                                        >
                                            <Upload className="h-4 w-4 mr-2" />
                                            Import {importPreview.length} Character{importPreview.length !== 1 ? 's' : ''}
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* Template Details Dialog */}
            <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedTemplate?.name}</DialogTitle>
                        <DialogDescription>
                            Template details and preview
                        </DialogDescription>
                    </DialogHeader>

                    {selectedTemplate && (
                        <div className="space-y-6">
                            {/* Template info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="font-medium">Category</Label>
                                    <p className="text-sm text-gray-600">{selectedTemplate.category}</p>
                                </div>
                                <div>
                                    <Label className="font-medium">Author</Label>
                                    <p className="text-sm text-gray-600">{selectedTemplate.author}</p>
                                </div>
                                <div>
                                    <Label className="font-medium">Downloads</Label>
                                    <p className="text-sm text-gray-600">{selectedTemplate.downloads}</p>
                                </div>
                                <div>
                                    <Label className="font-medium">Rating</Label>
                                    <p className="text-sm text-gray-600 flex items-center gap-1">
                                        <Star className="h-3 w-3 text-yellow-500" />
                                        {selectedTemplate.rating}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <Label className="font-medium">Description</Label>
                                <p className="text-sm text-gray-600 mt-1">{selectedTemplate.description}</p>
                            </div>

                            {/* Character preview */}
                            <div>
                                <Label className="font-medium">Character Preview</Label>
                                <div className="mt-2 p-4 border rounded-lg space-y-3">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-12 w-12">
                                            <AvatarFallback>
                                                {selectedTemplate.character.name.slice(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h3 className="font-medium">{selectedTemplate.character.name}</h3>
                                            <p className="text-sm text-gray-600 capitalize">{selectedTemplate.character.role}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-sm font-medium text-gray-700">Personality Traits</p>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {selectedTemplate.character.personality.coreTraits.map((trait, i) => (
                                                <Badge key={i} variant="outline" className="text-xs">
                                                    {trait}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-sm font-medium text-gray-700">Character Arc</p>
                                        <p className="text-xs text-gray-600 mt-1">
                                            {selectedTemplate.character.arc.startingPoint} → {selectedTemplate.character.arc.endingPoint}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3">
                                <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
                                    Close
                                </Button>
                                <Button onClick={() => {
                                    handleImportTemplate(selectedTemplate);
                                    setShowTemplateDialog(false);
                                }}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Import Template
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
