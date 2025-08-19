/**
 * useCharacters - Hook for character management with MCP integration
 */

import { useState, useCallback, useEffect } from 'react';
import { Character } from '~/components/Characters/CharacterCodex';

interface UseCharactersOptions {
    bookId: string;
    autoLoad?: boolean;
}

interface CharacterFilters {
    role?: string;
    tags?: string[];
    search?: string;
}

interface UseCharactersReturn {
    characters: Character[];
    loading: boolean;
    error: string | null;

    // CRUD operations
    createCharacter: (character: Partial<Character>) => Promise<Character>;
    updateCharacter: (characterId: string, updates: Partial<Character>) => Promise<Character>;
    deleteCharacter: (characterId: string) => Promise<void>;
    getCharacter: (characterId: string) => Promise<Character>;

    // Filtering and search
    filteredCharacters: Character[];
    setFilters: (filters: CharacterFilters) => void;
    filters: CharacterFilters;

    // Avatar and image management
    uploadAvatar: (characterId: string, file: File) => Promise<string>;
    uploadReferenceImage: (characterId: string, file: File, type: string, description: string) => Promise<string>;
    generateCharacterImage: (characterId: string, prompt?: string, type?: string) => Promise<string>;

    // AI enhancement
    generateWithAI: (basicInfo: { name: string; role: string; genre: string; context?: string }) => Promise<Character>;

    // Relationships
    createRelationship: (characterId: string, targetCharacterId: string, relationship: any) => Promise<void>;
    getRelationships: (characterId: string) => Promise<any[]>;

    // Utility functions
    refresh: () => Promise<void>;
    clearError: () => void;
}

// Mock MCP client - replace with actual implementation
const mcpClient = {
    async callTool(toolName: string, args: any) {
        // This would integrate with your actual MCP client
        console.log(`Calling MCP tool: ${toolName}`, args);

        // Mock implementations for demonstration
        switch (toolName) {
            case 'get_characters':
                return {
                    characters: []
                };
            case 'create_character':
                return {
                    _id: `char_${Date.now()}`,
                    ...args,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: 1
                };
            case 'update_character':
                return {
                    ...args.updates,
                    updatedAt: new Date()
                };
            case 'delete_character':
                return { success: true };
            case 'upload_character_avatar':
                return {
                    success: true,
                    avatar: {
                        url: '/uploads/characters/avatar.jpg',
                        filename: 'avatar.jpg'
                    }
                };
            case 'upload_character_reference_image':
                return {
                    success: true,
                    referenceImage: {
                        url: '/uploads/characters/ref.jpg',
                        filename: 'ref.jpg',
                        type: args.type,
                        description: args.description
                    }
                };
            case 'generate_character_with_ai':
                return {
                    _id: `char_${Date.now()}`,
                    name: args.name,
                    role: args.role,
                    // AI-enhanced fields would be populated here
                    physicalDescription: {
                        distinctiveFeatures: ['AI-generated feature'],
                        clothing: { style: '', colors: [], accessories: [] }
                    },
                    personality: {
                        coreTraits: ['AI-generated trait'],
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
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    version: 1,
                    appearances: [],
                    imageGenerationProfile: {
                        consistencyLevel: 'medium',
                        preferredStyles: [],
                        excludedElements: [],
                        customPromptAdditions: ''
                    }
                };
            case 'generate_character_image':
                return {
                    imageUrl: '/api/generated-images/character.jpg',
                    generatedAt: new Date()
                };
            case 'create_character_relationship':
                return { success: true };
            case 'get_character_relationships':
                return [];
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }
};

export default function useCharacters({ bookId, autoLoad = true }: UseCharactersOptions): UseCharactersReturn {
    const [characters, setCharacters] = useState<Character[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<CharacterFilters>({});

    // Filtered characters based on current filters
    const filteredCharacters = characters.filter(character => {
        if (filters.role && character.role !== filters.role) return false;
        if (filters.tags && filters.tags.length > 0) {
            if (!filters.tags.some(tag => character.tags.includes(tag))) return false;
        }
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            if (!character.name.toLowerCase().includes(searchLower) &&
                !character.personality.coreTraits.some(trait => trait.toLowerCase().includes(searchLower))) {
                return false;
            }
        }
        return true;
    });

    // Load characters
    const loadCharacters = useCallback(async () => {
        if (!bookId) return;

        setLoading(true);
        setError(null);

        try {
            const response = await mcpClient.callTool('get_characters', { bookId });
            setCharacters(response.characters || response);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load characters';
            setError(errorMessage);
            console.error('Error loading characters:', err);
        } finally {
            setLoading(false);
        }
    }, [bookId]);

    // Auto-load on mount
    useEffect(() => {
        if (autoLoad) {
            loadCharacters();
        }
    }, [autoLoad, loadCharacters]);

    // Create character
    const createCharacter = useCallback(async (characterData: Partial<Character>): Promise<Character> => {
        setLoading(true);
        setError(null);

        try {
            const newCharacter = await mcpClient.callTool('create_character', {
                bookId,
                ...characterData
            });

            setCharacters(prev => [...prev, newCharacter]);
            return newCharacter;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to create character';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [bookId]);

    // Update character
    const updateCharacter = useCallback(async (characterId: string, updates: Partial<Character>): Promise<Character> => {
        setLoading(true);
        setError(null);

        try {
            const updatedCharacter = await mcpClient.callTool('update_character', {
                characterId,
                updates
            });

            setCharacters(prev => prev.map(char =>
                char._id === characterId ? { ...char, ...updatedCharacter } : char
            ));

            return updatedCharacter;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to update character';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, []);

    // Delete character
    const deleteCharacter = useCallback(async (characterId: string): Promise<void> => {
        setLoading(true);
        setError(null);

        try {
            await mcpClient.callTool('delete_character', { characterId });
            setCharacters(prev => prev.filter(char => char._id !== characterId));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete character';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, []);

    // Get single character
    const getCharacter = useCallback(async (characterId: string): Promise<Character> => {
        try {
            return await mcpClient.callTool('get_character', { characterId });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to get character';
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    }, []);

    // Upload avatar
    const uploadAvatar = useCallback(async (characterId: string, file: File): Promise<string> => {
        setLoading(true);
        setError(null);

        try {
            // Convert file to base64
            const base64 = await fileToBase64(file);

            const response = await mcpClient.callTool('upload_character_avatar', {
                characterId,
                imageData: base64,
                filename: file.name,
                description: 'Character avatar'
            });

            // Update character in state
            setCharacters(prev => prev.map(char =>
                char._id === characterId
                    ? { ...char, avatar: response.avatar }
                    : char
            ));

            return response.avatar.url;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to upload avatar';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, []);

    // Upload reference image
    const uploadReferenceImage = useCallback(async (
        characterId: string,
        file: File,
        type: string,
        description: string
    ): Promise<string> => {
        setLoading(true);
        setError(null);

        try {
            const base64 = await fileToBase64(file);

            const response = await mcpClient.callTool('upload_character_reference_image', {
                characterId,
                imageData: base64,
                filename: file.name,
                description,
                type
            });

            // Update character in state
            setCharacters(prev => prev.map(char =>
                char._id === characterId
                    ? {
                        ...char,
                        referenceImages: [...char.referenceImages, response.referenceImage]
                    }
                    : char
            ));

            return response.referenceImage.url;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to upload reference image';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, []);

    // Generate character image
    const generateCharacterImage = useCallback(async (
        characterId: string,
        prompt?: string,
        type: string = 'portrait'
    ): Promise<string> => {
        setLoading(true);
        setError(null);

        try {
            const response = await mcpClient.callTool('generate_character_image', {
                characterId,
                prompt,
                type,
                useReferenceImages: true
            });

            return response.imageUrl;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to generate character image';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, []);

    // Generate with AI
    const generateWithAI = useCallback(async (basicInfo: {
        name: string;
        role: string;
        genre: string;
        context?: string;
    }): Promise<Character> => {
        setLoading(true);
        setError(null);

        try {
            const newCharacter = await mcpClient.callTool('generate_character_with_ai', {
                bookId,
                name: basicInfo.name,
                role: basicInfo.role,
                genre: basicInfo.genre,
                storyContext: basicInfo.context
            });

            setCharacters(prev => [...prev, newCharacter]);
            return newCharacter;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to generate character with AI';
            setError(errorMessage);
            throw new Error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [bookId]);

    // Create relationship
    const createRelationship = useCallback(async (
        characterId: string,
        targetCharacterId: string,
        relationship: any
    ): Promise<void> => {
        try {
            await mcpClient.callTool('create_character_relationship', {
                characterId,
                targetCharacterId,
                ...relationship
            });

            // Refresh characters to get updated relationships
            await loadCharacters();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to create relationship';
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    }, [loadCharacters]);

    // Get relationships
    const getRelationships = useCallback(async (characterId: string): Promise<any[]> => {
        try {
            return await mcpClient.callTool('get_character_relationships', { characterId });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to get relationships';
            setError(errorMessage);
            throw new Error(errorMessage);
        }
    }, []);

    // Utility functions
    const refresh = useCallback(async () => {
        await loadCharacters();
    }, [loadCharacters]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        characters,
        loading,
        error,
        createCharacter,
        updateCharacter,
        deleteCharacter,
        getCharacter,
        filteredCharacters,
        setFilters,
        filters,
        uploadAvatar,
        uploadReferenceImage,
        generateCharacterImage,
        generateWithAI,
        createRelationship,
        getRelationships,
        refresh,
        clearError
    };
}

// Helper function to convert File to base64
function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // Remove data URL prefix to get just the base64 data
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}
