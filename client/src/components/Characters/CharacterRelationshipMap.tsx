/**
 * Character Relationship Map - Visual network graph for character relationships
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import SimpleBadge from '~/components/ui/SimpleBadge';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/Avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/Dialog';
import { Input } from '~/components/ui/Input';
import { Textarea } from '~/components/ui/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/Select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/Tabs';
import { Label } from '~/components/ui/label';
import { Slider } from '~/components/ui/slider';
import { Switch } from '~/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/DropdownMenu';
import { cn } from '~/utils';

// Icons
import {
    Plus,
    Minus,
    MoreVertical,
    Heart,
    Sword,
    Shield,
    Users,
    Edit,
    Trash2,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Filter,
    Search,
    Settings,
    Download,
    Upload,
    Eye,
    EyeOff,
    Move,
    Link,
    Unlink
} from 'lucide-react';

// Types
interface Character {
    _id: string;
    name: string;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'minor' | 'mentor' | 'love_interest' | 'comic_relief';
    avatar?: {
        url: string;
        filename: string;
        description?: string;
    };
    tags: string[];
}

interface Relationship {
    id: string;
    characterId: string;
    targetCharacterId: string;
    relationship: string;
    description: string;
    dynamic: 'positive' | 'negative' | 'neutral' | 'complex';
    strength: number; // 1-10
    isPublic: boolean;
    tags: string[];
}

interface RelationshipNode {
    id: string;
    character: Character;
    x: number;
    y: number;
    connections: string[];
    isSelected: boolean;
    isHighlighted: boolean;
}

interface RelationshipEdge {
    id: string;
    relationship: Relationship;
    sourceId: string;
    targetId: string;
    isSelected: boolean;
    isVisible: boolean;
}

interface CharacterRelationshipMapProps {
    bookId: string;
    characters: Character[];
    relationships: Relationship[];
    onCreateRelationship: (relationship: Partial<Relationship>) => Promise<void>;
    onUpdateRelationship: (relationshipId: string, updates: Partial<Relationship>) => Promise<void>;
    onDeleteRelationship: (relationshipId: string) => Promise<void>;
    className?: string;
}

const RELATIONSHIP_COLORS = {
    positive: '#10b981', // green
    negative: '#ef4444', // red
    neutral: '#6b7280', // gray
    complex: '#8b5cf6'  // purple
};

const RELATIONSHIP_TYPES = [
    { value: 'family', label: 'Family', icon: Heart },
    { value: 'friend', label: 'Friend', icon: Shield },
    { value: 'enemy', label: 'Enemy', icon: Sword },
    { value: 'mentor', label: 'Mentor', icon: Users },
    { value: 'student', label: 'Student', icon: Users },
    { value: 'rival', label: 'Rival', icon: Sword },
    { value: 'romantic', label: 'Romantic', icon: Heart },
    { value: 'colleague', label: 'Colleague', icon: Shield },
    { value: 'ally', label: 'Ally', icon: Shield },
    { value: 'stranger', label: 'Stranger', icon: Users }
];

export default function CharacterRelationshipMap({
    bookId,
    characters,
    relationships,
    onCreateRelationship,
    onUpdateRelationship,
    onDeleteRelationship,
    className
}: CharacterRelationshipMapProps) {
    // State
    const [nodes, setNodes] = useState<RelationshipNode[]>([]);
    const [edges, setEdges] = useState<RelationshipEdge[]>([]);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 800, height: 600, scale: 1 });
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editingRelationship, setEditingRelationship] = useState<Relationship | null>(null);
    const [newRelationship, setNewRelationship] = useState<Partial<Relationship>>({
        relationship: '',
        description: '',
        dynamic: 'neutral',
        strength: 5,
        isPublic: true,
        tags: []
    });
    const [filterRelationshipType, setFilterRelationshipType] = useState<string>('all');
    const [filterDynamic, setFilterDynamic] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [autoLayout, setAutoLayout] = useState(true);
    const [showRelationshipLabels, setShowRelationshipLabels] = useState(true);
    const [showStrength, setShowStrength] = useState(true);

    // Refs
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize nodes and edges
    useEffect(() => {
        const initialNodes: RelationshipNode[] = characters.map((character, index) => ({
            id: character._id,
            character,
            x: 100 + (index % 5) * 150,
            y: 100 + Math.floor(index / 5) * 150,
            connections: [],
            isSelected: false,
            isHighlighted: false
        }));

        const initialEdges: RelationshipEdge[] = relationships.map((relationship) => ({
            id: relationship.id,
            relationship,
            sourceId: relationship.characterId,
            targetId: relationship.targetCharacterId,
            isSelected: false,
            isVisible: true
        }));

        // Update node connections
        initialNodes.forEach(node => {
            node.connections = initialEdges
                .filter(edge => edge.sourceId === node.id || edge.targetId === node.id)
                .map(edge => edge.sourceId === node.id ? edge.targetId : edge.sourceId);
        });

        setNodes(initialNodes);
        setEdges(initialEdges);

        if (autoLayout && characters.length > 0) {
            applyForceLayout(initialNodes, initialEdges);
        }
    }, [characters, relationships, autoLayout]);

    // Apply force-directed layout
    const applyForceLayout = useCallback((nodeList: RelationshipNode[], edgeList: RelationshipEdge[]) => {
        // Simple force-directed layout simulation
        const iterations = 100;
        const k = Math.sqrt((800 * 600) / nodeList.length);

        for (let i = 0; i < iterations; i++) {
            // Repulsive forces
            nodeList.forEach(node => {
                let fx = 0, fy = 0;

                nodeList.forEach(other => {
                    if (node.id !== other.id) {
                        const dx = node.x - other.x;
                        const dy = node.y - other.y;
                        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                        const force = k * k / distance;
                        fx += (dx / distance) * force;
                        fy += (dy / distance) * force;
                    }
                });

                node.x += fx * 0.01;
                node.y += fy * 0.01;
            });

            // Attractive forces (edges)
            edgeList.forEach(edge => {
                const source = nodeList.find(n => n.id === edge.sourceId);
                const target = nodeList.find(n => n.id === edge.targetId);

                if (source && target) {
                    const dx = target.x - source.x;
                    const dy = target.y - source.y;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                    const force = distance * distance / k;

                    const fx = (dx / distance) * force * 0.01;
                    const fy = (dy / distance) * force * 0.01;

                    source.x += fx;
                    source.y += fy;
                    target.x -= fx;
                    target.y -= fy;
                }
            });
        }

        setNodes([...nodeList]);
    }, []);

    // Filter edges based on current filters
    const filteredEdges = useMemo(() => {
        return edges.filter(edge => {
            const rel = edge.relationship;

            if (filterRelationshipType !== 'all' && rel.relationship !== filterRelationshipType) {
                return false;
            }

            if (filterDynamic !== 'all' && rel.dynamic !== filterDynamic) {
                return false;
            }

            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                if (!rel.relationship.toLowerCase().includes(query) &&
                    !rel.description.toLowerCase().includes(query)) {
                    return false;
                }
            }

            return true;
        });
    }, [edges, filterRelationshipType, filterDynamic, searchQuery]);

    // Handle node click
    const handleNodeClick = useCallback((nodeId: string) => {
        setSelectedNode(prev => prev === nodeId ? null : nodeId);
        setSelectedEdge(null);

        // Highlight connected nodes
        setNodes(prev => prev.map(node => ({
            ...node,
            isSelected: node.id === nodeId,
            isHighlighted: node.connections.includes(nodeId)
        })));
    }, []);

    // Handle edge click
    const handleEdgeClick = useCallback((edgeId: string) => {
        setSelectedEdge(prev => prev === edgeId ? null : edgeId);
        setSelectedNode(null);

        setEdges(prev => prev.map(edge => ({
            ...edge,
            isSelected: edge.id === edgeId
        })));
    }, []);

    // Handle node drag
    const handleNodeDrag = useCallback((nodeId: string, dx: number, dy: number) => {
        setNodes(prev => prev.map(node =>
            node.id === nodeId
                ? { ...node, x: node.x + dx, y: node.y + dy }
                : node
        ));
    }, []);

    // Create relationship
    const handleCreateRelationship = useCallback(async () => {
        if (!newRelationship.characterId || !newRelationship.targetCharacterId) {
            return;
        }

        try {
            await onCreateRelationship({
                ...newRelationship,
                id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            });

            setShowCreateDialog(false);
            setNewRelationship({
                relationship: '',
                description: '',
                dynamic: 'neutral',
                strength: 5,
                isPublic: true,
                tags: []
            });
        } catch (error) {
            console.error('Failed to create relationship:', error);
        }
    }, [newRelationship, onCreateRelationship]);

    // Edit relationship
    const handleEditRelationship = useCallback((relationship: Relationship) => {
        setEditingRelationship(relationship);
        setShowEditDialog(true);
    }, []);

    // Update relationship
    const handleUpdateRelationship = useCallback(async () => {
        if (!editingRelationship) return;

        try {
            await onUpdateRelationship(editingRelationship.id, editingRelationship);
            setShowEditDialog(false);
            setEditingRelationship(null);
        } catch (error) {
            console.error('Failed to update relationship:', error);
        }
    }, [editingRelationship, onUpdateRelationship]);

    // Delete relationship
    const handleDeleteRelationship = useCallback(async (relationshipId: string) => {
        try {
            await onDeleteRelationship(relationshipId);
        } catch (error) {
            console.error('Failed to delete relationship:', error);
        }
    }, [onDeleteRelationship]);

    // Zoom functions
    const zoomIn = useCallback(() => {
        setViewBox(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 3) }));
    }, []);

    const zoomOut = useCallback(() => {
        setViewBox(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.1) }));
    }, []);

    const resetView = useCallback(() => {
        setViewBox({ x: 0, y: 0, width: 800, height: 600, scale: 1 });
    }, []);

    // Render node
    const renderNode = (node: RelationshipNode) => {
        const character = node.character;

        return (
            <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => handleNodeClick(node.id)}
                className="cursor-pointer"
            >
                {/* Node background */}
                <circle
                    r="30"
                    fill={node.isSelected ? '#3b82f6' : node.isHighlighted ? '#f59e0b' : '#ffffff'}
                    stroke={node.isSelected ? '#1d4ed8' : '#d1d5db'}
                    strokeWidth="2"
                    className="transition-colors"
                />

                {/* Character avatar */}
                {character.avatar ? (
                    <image
                        href={character.avatar.url}
                        x="-20"
                        y="-20"
                        width="40"
                        height="40"
                        clipPath="circle(20px at center)"
                    />
                ) : (
                    <text
                        textAnchor="middle"
                        dy="0.3em"
                        fontSize="14"
                        fontWeight="bold"
                        fill={node.isSelected ? '#ffffff' : '#374151'}
                    >
                        {character.name.slice(0, 2).toUpperCase()}
                    </text>
                )}

                {/* Character name */}
                <text
                    textAnchor="middle"
                    y="45"
                    fontSize="12"
                    fontWeight="medium"
                    fill="#374151"
                >
                    {character.name}
                </text>

                {/* Role badge */}
                <text
                    textAnchor="middle"
                    y="58"
                    fontSize="10"
                    fill="#6b7280"
                >
                    {character.role}
                </text>
            </g>
        );
    };

    // Render edge
    const renderEdge = (edge: RelationshipEdge) => {
        const sourceNode = nodes.find(n => n.id === edge.sourceId);
        const targetNode = nodes.find(n => n.id === edge.targetId);

        if (!sourceNode || !targetNode) return null;

        const rel = edge.relationship;
        const color = RELATIONSHIP_COLORS[rel.dynamic];
        const strokeWidth = showStrength ? Math.max(1, rel.strength / 2) : 2;

        // Calculate edge position
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const unitX = dx / distance;
        const unitY = dy / distance;

        const startX = sourceNode.x + unitX * 30;
        const startY = sourceNode.y + unitY * 30;
        const endX = targetNode.x - unitX * 30;
        const endY = targetNode.y - unitY * 30;

        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        return (
            <g key={edge.id}>
                {/* Edge line */}
                <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeOpacity={edge.isSelected ? 1 : 0.7}
                    className="cursor-pointer transition-opacity"
                    onClick={() => handleEdgeClick(edge.id)}
                />

                {/* Arrow head */}
                <polygon
                    points={`${endX - unitX * 8 - unitY * 4},${endY - unitY * 8 + unitX * 4} ${endX},${endY} ${endX - unitX * 8 + unitY * 4},${endY - unitY * 8 - unitX * 4}`}
                    fill={color}
                    opacity={edge.isSelected ? 1 : 0.7}
                />

                {/* Relationship label */}
                {showRelationshipLabels && (
                    <text
                        x={midX}
                        y={midY - 5}
                        textAnchor="middle"
                        fontSize="10"
                        fill="#374151"
                        fontWeight="medium"
                        className="pointer-events-none"
                    >
                        {rel.relationship}
                    </text>
                )}

                {/* Strength indicator */}
                {showStrength && (
                    <text
                        x={midX}
                        y={midY + 10}
                        textAnchor="middle"
                        fontSize="8"
                        fill="#6b7280"
                        className="pointer-events-none"
                    >
                        {rel.strength}/10
                    </text>
                )}
            </g>
        );
    };

    return (
        <div className={cn("character-relationship-map h-full flex flex-col", className)}>
            {/* Header */}
            <div className="border-b bg-white p-4">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-semibold">Character Relationships</h2>
                        <p className="text-gray-600">Visual relationship network</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCreateDialog(true)}
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Relationship
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowSettings(true)}
                        >
                            <Settings className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Filters and Controls */}
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Search relationships..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 w-48"
                        />
                    </div>

                    <Select value={filterRelationshipType} onValueChange={setFilterRelationshipType}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {RELATIONSHIP_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filterDynamic} onValueChange={setFilterDynamic}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="All Dynamics" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Dynamics</SelectItem>
                            <SelectItem value="positive">Positive</SelectItem>
                            <SelectItem value="negative">Negative</SelectItem>
                            <SelectItem value="neutral">Neutral</SelectItem>
                            <SelectItem value="complex">Complex</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2 ml-auto">
                        <Button variant="outline" size="sm" onClick={zoomOut}>
                            <ZoomOut className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={zoomIn}>
                            <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={resetView}>
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Relationship Map */}
            <div className="flex-1 overflow-hidden" ref={containerRef}>
                <svg
                    ref={svgRef}
                    width="100%"
                    height="100%"
                    viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width / viewBox.scale} ${viewBox.height / viewBox.scale}`}
                    className="bg-gray-50"
                >
                    {/* Grid pattern */}
                    <defs>
                        <pattern
                            id="grid"
                            width="50"
                            height="50"
                            patternUnits="userSpaceOnUse"
                        >
                            <path
                                d="M 50 0 L 0 0 0 50"
                                fill="none"
                                stroke="#e5e7eb"
                                strokeWidth="1"
                            />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />

                    {/* Render edges first (behind nodes) */}
                    <g className="edges">
                        {filteredEdges.map(renderEdge)}
                    </g>

                    {/* Render nodes */}
                    <g className="nodes">
                        {nodes.map(renderNode)}
                    </g>
                </svg>
            </div>

            {/* Selected Relationship Details */}
            {selectedEdge && (
                <div className="border-t bg-white p-4">
                    {(() => {
                        const edge = edges.find(e => e.id === selectedEdge);
                        if (!edge) return null;

                        const sourceChar = characters.find(c => c._id === edge.sourceId);
                        const targetChar = characters.find(c => c._id === edge.targetId);

                        return (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div>
                                        <h3 className="font-medium">
                                            {sourceChar?.name} → {targetChar?.name}
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                            {edge.relationship.relationship} ({edge.relationship.dynamic})
                                        </p>
                                        {edge.relationship.description && (
                                            <p className="text-sm text-gray-500 mt-1">
                                                {edge.relationship.description}
                                            </p>
                                        )}
                                    </div>

                                    <Badge
                                        style={{ backgroundColor: RELATIONSHIP_COLORS[edge.relationship.dynamic] }}
                                        className="text-white"
                                    >
                                        Strength: {edge.relationship.strength}/10
                                    </Badge>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleEditRelationship(edge.relationship)}
                                    >
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeleteRelationship(edge.relationship.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Create Relationship Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Create Character Relationship</DialogTitle>
                        <DialogDescription>
                            Define how characters relate to each other
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>From Character</Label>
                                <Select
                                    value={newRelationship.characterId}
                                    onValueChange={(value) => setNewRelationship(prev => ({ ...prev, characterId: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select character" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {characters.map((char) => (
                                            <SelectItem key={char._id} value={char._id}>
                                                {char.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>To Character</Label>
                                <Select
                                    value={newRelationship.targetCharacterId}
                                    onValueChange={(value) => setNewRelationship(prev => ({ ...prev, targetCharacterId: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select character" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {characters
                                            .filter(char => char._id !== newRelationship.characterId)
                                            .map((char) => (
                                                <SelectItem key={char._id} value={char._id}>
                                                    {char.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Relationship Type</Label>
                                <Select
                                    value={newRelationship.relationship}
                                    onValueChange={(value) => setNewRelationship(prev => ({ ...prev, relationship: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {RELATIONSHIP_TYPES.map((type) => (
                                            <SelectItem key={type.value} value={type.value}>
                                                {type.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Dynamic</Label>
                                <Select
                                    value={newRelationship.dynamic}
                                    onValueChange={(value) => setNewRelationship(prev => ({ ...prev, dynamic: value as any }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="positive">Positive</SelectItem>
                                        <SelectItem value="negative">Negative</SelectItem>
                                        <SelectItem value="neutral">Neutral</SelectItem>
                                        <SelectItem value="complex">Complex</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label>Strength: {newRelationship.strength}/10</Label>
                            <Slider
                                value={[newRelationship.strength || 5]}
                                onValueChange={([value]) => setNewRelationship(prev => ({ ...prev, strength: value }))}
                                max={10}
                                min={1}
                                step={1}
                                className="mt-2"
                            />
                        </div>

                        <div>
                            <Label>Description</Label>
                            <Textarea
                                value={newRelationship.description}
                                onChange={(e) => setNewRelationship(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Describe the relationship..."
                                rows={3}
                            />
                        </div>

                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreateRelationship}
                                disabled={!newRelationship.characterId || !newRelationship.targetCharacterId || !newRelationship.relationship}
                            >
                                Create Relationship
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Settings Dialog */}
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Map Settings</DialogTitle>
                        <DialogDescription>
                            Customize the relationship map display
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label>Auto Layout</Label>
                            <Switch
                                checked={autoLayout}
                                onCheckedChange={setAutoLayout}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <Label>Show Relationship Labels</Label>
                            <Switch
                                checked={showRelationshipLabels}
                                onCheckedChange={setShowRelationshipLabels}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <Label>Show Strength Indicators</Label>
                            <Switch
                                checked={showStrength}
                                onCheckedChange={setShowStrength}
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={() => setShowSettings(false)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
