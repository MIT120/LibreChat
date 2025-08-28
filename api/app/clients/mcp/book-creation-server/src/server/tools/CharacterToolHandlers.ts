/**
 * Character Tool Handlers - MCP tools for character management with avatar support
 */

import { ILogger } from '../../interfaces/ILogger';
import { BaseToolHandler } from '../../core/BaseToolHandler.js';
import { IToolHandler } from '../../interfaces/index.js';
import { ValidationError, NotFoundError, DatabaseError } from '../../../types/errors.js';
import { ContentEnhancementService } from '../../services/ContentEnhancementService';
import { NarrativeConsistencyService } from '../../services/NarrativeConsistencyService';
import { ImageService } from '../../services/ImageService';
import { CharacterVoiceService } from '../../services/CharacterVoiceService';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

interface Character {
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
        uploadedAt: Date;
    };
    referenceImages: Array<{
        url: string;
        filename: string;
        description: string;
        type: 'face' | 'full_body' | 'clothing' | 'expression' | 'pose' | 'other';
        uploadedAt: Date;
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

export class CharacterToolHandlers extends BaseToolHandler {
    private contentEnhancementService?: ContentEnhancementService;
    private narrativeService?: NarrativeConsistencyService;
    private imageService?: ImageService;
    private voiceService?: CharacterVoiceService;

    // In-memory character storage (replace with database in production)
    private characters = new Map<string, Character>();

    // File upload configuration
    private upload = multer({
        storage: multer.diskStorage({
            destination: async (req, file, cb) => {
                const uploadDir = path.join(process.cwd(), 'uploads', 'characters');
                await fs.mkdir(uploadDir, { recursive: true });
                cb(null, uploadDir);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                cb(null, `${uniqueSuffix}-${file.originalname}`);
            }
        }),
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB limit
        },
        fileFilter: (req, file, cb) => {
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(null, false); // Only image files are allowed
            }
        }
    });

    constructor(
        logger: ILogger,
        contentEnhancementService?: ContentEnhancementService,
        narrativeService?: NarrativeConsistencyService,
        imageService?: ImageService,
        voiceService?: CharacterVoiceService
    ) {
        super(logger);
        this.contentEnhancementService = contentEnhancementService;
        this.narrativeService = narrativeService;
        this.imageService = imageService;
        this.voiceService = voiceService;
    }

    protected defineTools(): void {
        // Character tools are defined inline in getTools method
    }

    override getTools(): IToolHandler[] {
        return [
            {
                name: 'create_character',
                description: 'Create a new character for the book with comprehensive profile',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Book ID' },
                        name: { type: 'string', description: 'Character name' },
                        role: {
                            type: 'string',
                            enum: ['protagonist', 'antagonist', 'supporting', 'minor', 'mentor', 'love_interest', 'comic_relief'],
                            description: 'Character role in the story'
                        },
                        age: { type: 'number', description: 'Character age' },
                        gender: { type: 'string', description: 'Character gender' },
                        occupation: { type: 'string', description: 'Character occupation' },
                        physicalDescription: {
                            type: 'object',
                            properties: {
                                height: { type: 'string' },
                                build: { type: 'string' },
                                hairColor: { type: 'string' },
                                hairStyle: { type: 'string' },
                                eyeColor: { type: 'string' },
                                skinTone: { type: 'string' },
                                distinctiveFeatures: { type: 'array', items: { type: 'string' } },
                                clothing: {
                                    type: 'object',
                                    properties: {
                                        style: { type: 'string' },
                                        colors: { type: 'array', items: { type: 'string' } },
                                        accessories: { type: 'array', items: { type: 'string' } }
                                    }
                                }
                            }
                        },
                        personality: {
                            type: 'object',
                            properties: {
                                coreTraits: { type: 'array', items: { type: 'string' } },
                                motivations: { type: 'array', items: { type: 'string' } },
                                fears: { type: 'array', items: { type: 'string' } },
                                strengths: { type: 'array', items: { type: 'string' } },
                                weaknesses: { type: 'array', items: { type: 'string' } },
                                quirks: { type: 'array', items: { type: 'string' } },
                                speechPattern: { type: 'string' },
                                mannerisms: { type: 'array', items: { type: 'string' } }
                            }
                        },
                        background: {
                            type: 'object',
                            properties: {
                                origin: { type: 'string' },
                                family: { type: 'string' },
                                education: { type: 'string' },
                                pastEvents: { type: 'array', items: { type: 'string' } },
                                secrets: { type: 'array', items: { type: 'string' } },
                                skills: { type: 'array', items: { type: 'string' } }
                            }
                        },
                        notes: { type: 'string', description: 'Additional character notes' },
                        tags: { type: 'array', items: { type: 'string' }, description: 'Character tags' },
                        generateAIProfile: { type: 'boolean', description: 'Whether to use AI to enhance the character profile' }
                    },
                    required: ['bookId', 'name', 'role']
                },
                handler: this.handleCreateCharacter.bind(this)
            },
            {
                name: 'get_characters',
                description: 'Get all characters for a book',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Book ID' },
                        role: { type: 'string', description: 'Filter by character role' },
                        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' }
                    },
                    required: ['bookId']
                },
                handler: this.handleGetCharacters.bind(this)
            },
            {
                name: 'get_character',
                description: 'Get a specific character by ID',
                inputSchema: {
                    type: 'object',
                    properties: {
                        characterId: { type: 'string', description: 'Character ID' }
                    },
                    required: ['characterId']
                },
                handler: this.handleGetCharacter.bind(this)
            },
            {
                name: 'update_character',
                description: 'Update an existing character',
                inputSchema: {
                    type: 'object',
                    properties: {
                        characterId: { type: 'string', description: 'Character ID' },
                        updates: {
                            type: 'object',
                            description: 'Character updates (any field from create_character)',
                            additionalProperties: true
                        }
                    },
                    required: ['characterId', 'updates']
                },
                handler: this.handleUpdateCharacter.bind(this)
            },
            {
                name: 'delete_character',
                description: 'Delete a character',
                inputSchema: {
                    type: 'object',
                    properties: {
                        characterId: { type: 'string', description: 'Character ID' }
                    },
                    required: ['characterId']
                },
                handler: this.handleDeleteCharacter.bind(this)
            },
            {
                name: 'upload_character_avatar',
                description: 'Upload an avatar image for a character',
                inputSchema: {
                    type: 'object',
                    properties: {
                        characterId: { type: 'string', description: 'Character ID' },
                        imageData: { type: 'string', description: 'Base64 encoded image data' },
                        filename: { type: 'string', description: 'Original filename' },
                        description: { type: 'string', description: 'Image description' }
                    },
                    required: ['characterId', 'imageData', 'filename']
                },
                handler: this.handleUploadAvatar.bind(this)
            },
            {
                name: 'upload_character_reference_image',
                description: 'Upload a reference image for a character',
                inputSchema: {
                    type: 'object',
                    properties: {
                        characterId: { type: 'string', description: 'Character ID' },
                        imageData: { type: 'string', description: 'Base64 encoded image data' },
                        filename: { type: 'string', description: 'Original filename' },
                        description: { type: 'string', description: 'Image description' },
                        type: {
                            type: 'string',
                            enum: ['face', 'full_body', 'clothing', 'expression', 'pose', 'other'],
                            description: 'Type of reference image'
                        }
                    },
                    required: ['characterId', 'imageData', 'filename', 'type']
                },
                handler: this.handleUploadReferenceImage.bind(this)
            },
            {
                name: 'generate_character_with_ai',
                description: 'Generate a comprehensive character profile using AI',
                inputSchema: {
                    type: 'object',
                    properties: {
                        bookId: { type: 'string', description: 'Book ID' },
                        name: { type: 'string', description: 'Character name' },
                        role: {
                            type: 'string',
                            enum: ['protagonist', 'antagonist', 'supporting', 'minor', 'mentor', 'love_interest', 'comic_relief'],
                            description: 'Character role in the story'
                        },
                        genre: { type: 'string', description: 'Book genre' },
                        existingTraits: { type: 'array', items: { type: 'string' }, description: 'Any existing character traits' },
                        storyContext: { type: 'string', description: 'Story context for character development' }
                    },
                    required: ['bookId', 'name', 'role', 'genre']
                },
                handler: this.handleGenerateCharacterWithAI.bind(this)
            },
            {
                name: 'generate_character_image',
                description: 'Generate an image for a character using their profile',
                inputSchema: {
                    type: 'object',
                    properties: {
                        characterId: { type: 'string', description: 'Character ID' },
                        prompt: { type: 'string', description: 'Additional prompt for image generation' },
                        style: { type: 'string', description: 'Specific style for the image' },
                        type: {
                            type: 'string',
                            enum: ['portrait', 'full_body', 'action', 'expression', 'scene'],
                            description: 'Type of image to generate',
                            default: 'portrait'
                        },
                        useReferenceImages: { type: 'boolean', description: 'Whether to use reference images for consistency', default: true }
                    },
                    required: ['characterId']
                },
                handler: this.handleGenerateCharacterImage.bind(this)
            },
            {
                name: 'get_character_relationships',
                description: 'Get relationships for a character or between characters',
                inputSchema: {
                    type: 'object',
                    properties: {
                        characterId: { type: 'string', description: 'Character ID' },
                        targetCharacterId: { type: 'string', description: 'Target character ID for specific relationship' }
                    },
                    required: ['characterId']
                },
                handler: this.handleGetCharacterRelationships.bind(this)
            },
            {
                name: 'create_character_relationship',
                description: 'Create or update a relationship between characters',
                inputSchema: {
                    type: 'object',
                    properties: {
                        characterId: { type: 'string', description: 'Character ID' },
                        targetCharacterId: { type: 'string', description: 'Target character ID' },
                        relationship: { type: 'string', description: 'Type of relationship (friend, enemy, family, etc.)' },
                        description: { type: 'string', description: 'Description of the relationship' },
                        dynamic: {
                            type: 'string',
                            enum: ['positive', 'negative', 'neutral', 'complex'],
                            description: 'Overall dynamic of the relationship'
                        }
                    },
                    required: ['characterId', 'targetCharacterId', 'relationship', 'dynamic']
                },
                handler: this.handleCreateCharacterRelationship.bind(this)
            },
            {
                name: 'generate_character_voice_profile',
                description: 'Generate AI voice profile for character dialogue consistency',
                inputSchema: {
                    type: 'object',
                    properties: {
                        characterId: { type: 'string', description: 'Character ID' }
                    },
                    required: ['characterId']
                },
                handler: async () => { throw new Error('Voice profile generation not implemented'); }
            },
            {
                name: 'generate_character_dialogue',
                description: 'Generate voice-consistent dialogue for a character',
                inputSchema: {
                    type: 'object',
                    properties: {
                        characterId: { type: 'string', description: 'Character ID' },
                        situation: { type: 'string', description: 'Dialogue situation or context' },
                        emotion: { type: 'string', description: 'Character emotion' },
                        targetCharacter: { type: 'string', description: 'Character being spoken to' },
                        context: { type: 'string', description: 'Additional context' },
                        tone: { type: 'string', description: 'Specific tone override' },
                        length: {
                            type: 'string',
                            enum: ['short', 'medium', 'long'],
                            description: 'Desired dialogue length'
                        },
                        includeAction: { type: 'boolean', description: 'Include action descriptions' }
                    },
                    required: ['characterId', 'situation']
                },
                handler: async () => { throw new Error('Dialogue generation not implemented'); }
            },
            {
                name: 'get_character_voice_profile',
                description: 'Get voice profile for a character',
                inputSchema: {
                    type: 'object',
                    properties: {
                        characterId: { type: 'string', description: 'Character ID' }
                    },
                    required: ['characterId']
                },
                handler: async () => { throw new Error('Get voice profile not implemented'); }
            },
            {
                name: 'update_character_voice_profile',
                description: 'Update character voice profile with new dialogue example',
                inputSchema: {
                    type: 'object',
                    properties: {
                        characterId: { type: 'string', description: 'Character ID' },
                        dialogue: { type: 'string', description: 'New dialogue example' },
                        context: { type: 'string', description: 'Context for the dialogue' }
                    },
                    required: ['characterId', 'dialogue', 'context']
                },
                handler: async () => { throw new Error('Update voice profile not implemented'); }
            },
            {
                name: 'generate_character_contextual_image',
                description: 'Generate a contextual image of a character in a specific scene, situation, or pose',
                inputSchema: {
                    type: 'object',
                    properties: {
                        characterId: { type: 'string', description: 'Character ID' },
                        context: { type: 'string', description: 'Scene context or situation description' },
                        imageType: {
                            type: 'string',
                            enum: ['scene', 'action', 'emotion', 'interaction', 'environment'],
                            description: 'Type of contextual image',
                            default: 'scene'
                        },
                        specificPrompt: { type: 'string', description: 'Specific prompt for the image generation' },
                        style: { type: 'string', description: 'Art style override (optional)' },
                        includeOtherCharacters: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Other character IDs to include in the scene'
                        },
                        mood: {
                            type: 'string',
                            enum: ['happy', 'sad', 'angry', 'fearful', 'surprised', 'neutral', 'dramatic', 'peaceful'],
                            description: 'Mood/atmosphere for the image'
                        },
                        setting: { type: 'string', description: 'Location or setting description' }
                    },
                    required: ['characterId', 'context']
                },
                handler: this.handleGenerateCharacterContextualImage.bind(this)
            }
        ];
    }

    async handleCreateCharacter(args: any): Promise<any> {
        try {
            this.logger.info('Creating character', { bookId: args.bookId, name: args.name });

            // Validate inputs
            if (!args.bookId || !args.name || !args.role) {
                throw new ValidationError('Missing required fields for character creation', [
                    { field: 'bookId', message: 'Book ID is required', code: 'REQUIRED' },
                    { field: 'name', message: 'Character name is required', code: 'REQUIRED' },
                    { field: 'role', message: 'Character role is required', code: 'REQUIRED' }
                ]);
            }

            // Generate character ID
            const characterId = `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Create character object
            const character: Character = {
                _id: characterId,
                bookId: args.bookId,
                name: args.name,
                role: args.role,
                age: args.age,
                gender: args.gender,
                species: args.species || 'human',
                occupation: args.occupation,
                physicalDescription: {
                    height: args.physicalDescription?.height,
                    build: args.physicalDescription?.build,
                    hairColor: args.physicalDescription?.hairColor,
                    hairStyle: args.physicalDescription?.hairStyle,
                    eyeColor: args.physicalDescription?.eyeColor,
                    skinTone: args.physicalDescription?.skinTone,
                    distinctiveFeatures: args.physicalDescription?.distinctiveFeatures || [],
                    clothing: args.physicalDescription?.clothing || { style: '', colors: [], accessories: [] }
                },
                personality: {
                    coreTraits: args.personality?.coreTraits || [],
                    motivations: args.personality?.motivations || [],
                    fears: args.personality?.fears || [],
                    strengths: args.personality?.strengths || [],
                    weaknesses: args.personality?.weaknesses || [],
                    quirks: args.personality?.quirks || [],
                    speechPattern: args.personality?.speechPattern,
                    mannerisms: args.personality?.mannerisms || []
                },
                background: {
                    origin: args.background?.origin,
                    family: args.background?.family,
                    education: args.background?.education,
                    pastEvents: args.background?.pastEvents || [],
                    secrets: args.background?.secrets || [],
                    skills: args.background?.skills || []
                },
                goals: [],
                arc: {
                    startingPoint: '',
                    majorBeats: [],
                    endingPoint: '',
                    theme: ''
                },
                relationships: [],
                referenceImages: [],
                notes: args.notes || '',
                tags: args.tags || [],
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

            // Enhance with AI if requested
            if (args.generateAIProfile && this.contentEnhancementService) {
                try {
                    const aiProfile = await this.contentEnhancementService.generateCharacterDevelopment({
                        bookId: args.bookId,
                        characterId,
                        characterName: args.name,
                        role: args.role,
                        genre: args.genre || 'fiction',
                        existingTraits: args.personality?.coreTraits || [],
                        storyContext: args.storyContext || ''
                    });

                    // Merge AI-generated profile
                    character.physicalDescription = { ...character.physicalDescription, ...aiProfile.physicalDescription };
                    character.personality = { ...character.personality, ...aiProfile.personality };
                    character.background = { ...character.background, ...aiProfile.background };
                    // Fix goals type mismatch
                    if (Array.isArray(aiProfile.goals)) {
                        character.goals = aiProfile.goals;
                    } else {
                        character.goals = [];
                    }
                    // Fix arc type mismatch
                    if (aiProfile.arc && typeof aiProfile.arc === 'object' && 'majorBeats' in aiProfile.arc) {
                        character.arc = aiProfile.arc as any;
                    }
                } catch (error) {
                    this.logger.warn('Failed to enhance character with AI, continuing with basic profile', error as Error);
                }
            }

            // Store character
            this.characters.set(characterId, character);

            // Generate voice profile if voice service is available
            if (this.voiceService) {
                try {
                    await this.voiceService.generateVoiceProfile(character);
                    this.logger.info('Voice profile generated for character', { characterId });
                } catch (error) {
                    this.logger.warn('Failed to generate voice profile', error as Error);
                }
            }

            // Register in narrative consistency system if available
            if (this.narrativeService) {
                try {
                    await this.narrativeService.upsertCharacter(
                        args.bookId,
                        args.bookId, // using bookId as conversationId
                        {
                            characterId,
                            name: character.name,
                            role: character.role,
                            physicalTraits: character.physicalDescription,
                            personality: character.personality
                        }
                    );
                } catch (error) {
                    this.logger.warn('Failed to register character in narrative system', error as Error);
                }
            }

            // Auto-generate character images if image service is available
            if (this.imageService && !args.skipImageGeneration) {
                try {
                    this.logger.info('Auto-generating character images (portfolio + full body)', { characterId });

                    // Build base character description for image generation
                    const physicalDesc = this.buildPhysicalDescription(character);
                    const personalityDesc = character.personality.coreTraits.slice(0, 3).join(', ');

                    // Add age and gender context if available
                    const ageGenderDesc = [];
                    if (character.age) ageGenderDesc.push(`${character.age} years old`);
                    if (character.gender) ageGenderDesc.push(character.gender);
                    const ageGenderContext = ageGenderDesc.length > 0 ? `. ${ageGenderDesc.join(', ')}` : '';

                    // Generate multiple images concurrently
                    const imageGenerationPromises = [];

                    // 1. Portfolio Portrait (Professional headshot style)
                    let portfolioPrompt = `Professional portfolio portrait of ${character.name}`;
                    if (physicalDesc) {
                        portfolioPrompt += `, ${physicalDesc}`;
                    }
                    if (personalityDesc) {
                        portfolioPrompt += `. Character traits: ${personalityDesc}`;
                    }
                    portfolioPrompt += ageGenderContext;
                    portfolioPrompt += '. Professional headshot, studio lighting, clear facial features, confident expression, high quality portrait photography style';

                    const portfolioPromise = this.generateCharacterAvatarInternal(
                        character,
                        portfolioPrompt,
                        'portrait'
                    ).then(result => ({ type: 'portfolio', result }));

                    // 2. Full Body Image (Character design style)
                    let fullBodyPrompt = `Full body character design of ${character.name}`;
                    if (physicalDesc) {
                        fullBodyPrompt += `, ${physicalDesc}`;
                    }
                    if (personalityDesc) {
                        fullBodyPrompt += `. Character traits: ${personalityDesc}`;
                    }
                    fullBodyPrompt += ageGenderContext;

                    // Add occupation/role context for full body
                    if (character.occupation) {
                        fullBodyPrompt += `. Occupation: ${character.occupation}`;
                    }
                    fullBodyPrompt += `. Full body standing pose, character sheet style, clean background, detailed clothing and accessories, professional character design`;

                    const fullBodyPromise = this.generateCharacterAvatarInternal(
                        character,
                        fullBodyPrompt,
                        'full_body'
                    ).then(result => ({ type: 'full_body', result }));

                    // Add to promises array
                    imageGenerationPromises.push(portfolioPromise, fullBodyPromise);

                    // Wait for all images to complete
                    const imageResults = await Promise.allSettled(imageGenerationPromises);

                    // Process results
                    const timestamp = Date.now();
                    let avatarSet = false;
                    let generatedImages = 0;

                    for (const imageResult of imageResults) {
                        if (imageResult.status === 'fulfilled') {
                            const { type, result } = imageResult.value;

                            if (result && result.imageUrl) {
                                if (type === 'portfolio' && !avatarSet) {
                                    // Set the portfolio image as the main avatar
                                    character.avatar = {
                                        url: result.imageUrl,
                                        filename: `avatar_${characterId}_${timestamp}.jpg`,
                                        description: `Professional portfolio portrait of ${character.name}`,
                                        uploadedAt: new Date()
                                    };
                                    avatarSet = true;
                                    generatedImages++;
                                } else {
                                    // Add as reference image
                                    const referenceImage = {
                                        url: result.imageUrl,
                                        filename: `${type}_${characterId}_${timestamp}.jpg`,
                                        description: type === 'portfolio'
                                            ? `Professional portfolio portrait of ${character.name}`
                                            : `Full body character design of ${character.name}`,
                                        type: type === 'portfolio' ? 'face' : 'full_body',
                                        uploadedAt: new Date()
                                    };

                                    character.referenceImages.push(referenceImage);
                                    generatedImages++;
                                }

                                this.logger.info(`Character ${type} image generated successfully`, {
                                    characterId,
                                    type,
                                    imageUrl: result.imageUrl
                                });
                            }
                        } else {
                            this.logger.warn(`Failed to generate character image`, {
                                characterId,
                                error: imageResult.reason
                            });
                        }
                    }

                    // Update the stored character with new images
                    if (generatedImages > 0) {
                        this.characters.set(characterId, character);
                        this.logger.info(`Character image generation completed`, {
                            characterId,
                            generatedImages,
                            hasAvatar: !!character.avatar,
                            referenceImages: character.referenceImages.length
                        });
                    }

                } catch (error) {
                    this.logger.warn('Failed to auto-generate character images', {
                        characterId,
                        error: (error as Error).message
                    });
                    // Don't fail character creation if image generation fails
                }
            }

            this.logger.info('Character created successfully', { characterId });
            return character;

        } catch (error) {
            this.logger.error('Error creating character', error as Error);
            throw error;
        }
    }

    async handleGetCharacters(args: any): Promise<any> {
        try {
            this.logger.info('Getting characters', { bookId: args.bookId });

            // Get all characters for the book
            const bookCharacters = Array.from(this.characters.values()).filter(char => char.bookId === args.bookId);

            // Apply filters
            let filteredCharacters = bookCharacters;

            if (args.role) {
                filteredCharacters = filteredCharacters.filter(char => char.role === args.role);
            }

            if (args.tags && args.tags.length > 0) {
                filteredCharacters = filteredCharacters.filter(char =>
                    args.tags.some((tag: string) => char.tags.includes(tag))
                );
            }

            this.logger.info('Characters retrieved', { count: filteredCharacters.length });
            return filteredCharacters;

        } catch (error) {
            this.logger.error('Error getting characters', error as Error);
            throw error;
        }
    }

    async handleGetCharacter(args: any): Promise<any> {
        try {
            this.logger.info('Getting character', { characterId: args.characterId });

            const character = this.characters.get(args.characterId);
            if (!character) {
                throw new NotFoundError('Character', args.characterId);
            }

            return character;

        } catch (error) {
            this.logger.error('Error getting character', error as Error);
            throw error;
        }
    }

    async handleUpdateCharacter(args: any): Promise<any> {
        try {
            this.logger.info('Updating character', { characterId: args.characterId });

            const character = this.characters.get(args.characterId);
            if (!character) {
                throw new NotFoundError('Character', args.characterId);
            }

            // Apply updates
            const updatedCharacter = {
                ...character,
                ...args.updates,
                updatedAt: new Date(),
                version: character.version + 1
            };

            // Store updated character
            this.characters.set(args.characterId, updatedCharacter);

            // Update in narrative consistency system if available
            if (this.narrativeService && (args.updates.name || args.updates.physicalDescription || args.updates.personality)) {
                try {
                    await this.narrativeService.upsertCharacter(
                        character.bookId,
                        character.bookId,
                        {
                            characterId: args.characterId,
                            name: updatedCharacter.name,
                            role: updatedCharacter.role,
                            physicalTraits: updatedCharacter.physicalDescription,
                            personality: updatedCharacter.personality
                        }
                    );
                } catch (error) {
                    this.logger.warn('Failed to update character in narrative system', error as Error);
                }
            }

            this.logger.info('Character updated successfully', { characterId: args.characterId });
            return updatedCharacter;

        } catch (error) {
            this.logger.error('Error updating character', error as Error);
            throw error;
        }
    }

    async handleDeleteCharacter(args: any): Promise<any> {
        try {
            this.logger.info('Deleting character', { characterId: args.characterId });

            const character = this.characters.get(args.characterId);
            if (!character) {
                throw new NotFoundError('Character', args.characterId);
            }

            // Remove character
            this.characters.delete(args.characterId);

            // Clean up avatar and reference images
            if (character.avatar) {
                try {
                    await fs.unlink(path.join(process.cwd(), 'uploads', 'characters', character.avatar.filename));
                } catch (error) {
                    this.logger.warn('Failed to delete avatar file', error as Error);
                }
            }

            for (const image of character.referenceImages) {
                try {
                    await fs.unlink(path.join(process.cwd(), 'uploads', 'characters', image.filename));
                } catch (error) {
                    this.logger.warn('Failed to delete reference image file', error as Error);
                }
            }

            this.logger.info('Character deleted successfully', { characterId: args.characterId });
            return { success: true, characterId: args.characterId };

        } catch (error) {
            this.logger.error('Error deleting character', error as Error);
            throw error;
        }
    }

    async handleUploadAvatar(args: any): Promise<any> {
        try {
            this.logger.info('Uploading character avatar', { characterId: args.characterId });

            const character = this.characters.get(args.characterId);
            if (!character) {
                throw new NotFoundError('Character', args.characterId);
            }

            // Decode base64 image data
            const imageBuffer = Buffer.from(args.imageData, 'base64');

            // Generate filename
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const filename = `avatar-${uniqueSuffix}-${args.filename}`;
            const filepath = path.join(process.cwd(), 'uploads', 'characters', filename);

            // Ensure directory exists
            await fs.mkdir(path.dirname(filepath), { recursive: true });

            // Save file
            await fs.writeFile(filepath, imageBuffer);

            // Generate URL (replace with your actual URL generation logic)
            const url = `/uploads/characters/${filename}`;

            // Update character
            const updatedCharacter = {
                ...character,
                avatar: {
                    url,
                    filename,
                    description: args.description,
                    uploadedAt: new Date()
                },
                updatedAt: new Date()
            };

            this.characters.set(args.characterId, updatedCharacter);

            this.logger.info('Avatar uploaded successfully', { characterId: args.characterId, filename });
            return {
                success: true,
                avatar: updatedCharacter.avatar,
                character: updatedCharacter
            };

        } catch (error) {
            this.logger.error('Error uploading avatar', error as Error);
            throw error;
        }
    }

    async handleUploadReferenceImage(args: any): Promise<any> {
        try {
            this.logger.info('Uploading character reference image', { characterId: args.characterId, type: args.type });

            const character = this.characters.get(args.characterId);
            if (!character) {
                throw new NotFoundError('Character', args.characterId);
            }

            // Decode base64 image data
            const imageBuffer = Buffer.from(args.imageData, 'base64');

            // Generate filename
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const filename = `ref-${args.type}-${uniqueSuffix}-${args.filename}`;
            const filepath = path.join(process.cwd(), 'uploads', 'characters', filename);

            // Ensure directory exists
            await fs.mkdir(path.dirname(filepath), { recursive: true });

            // Save file
            await fs.writeFile(filepath, imageBuffer);

            // Generate URL
            const url = `/uploads/characters/${filename}`;

            // Create reference image object
            const referenceImage = {
                url,
                filename,
                description: args.description || '',
                type: args.type,
                uploadedAt: new Date()
            };

            // Update character
            const updatedCharacter = {
                ...character,
                referenceImages: [...character.referenceImages, referenceImage],
                updatedAt: new Date()
            };

            this.characters.set(args.characterId, updatedCharacter);

            this.logger.info('Reference image uploaded successfully', { characterId: args.characterId, filename });
            return {
                success: true,
                referenceImage,
                character: updatedCharacter
            };

        } catch (error) {
            this.logger.error('Error uploading reference image', error as Error);
            throw error;
        }
    }

    async handleGenerateCharacterWithAI(args: any): Promise<any> {
        try {
            this.logger.info('Generating character with AI', { bookId: args.bookId, name: args.name });

            if (!this.contentEnhancementService) {
                throw new Error('Content enhancement service not available');
            }

            // Generate character profile using AI
            const aiProfile = await this.contentEnhancementService.generateCharacterDevelopment({
                bookId: args.bookId,
                characterName: args.name,
                role: args.role,
                genre: args.genre,
                existingTraits: args.existingTraits || [],
                storyContext: args.storyContext || ''
            });

            // Create character from AI profile
            const characterData = {
                bookId: args.bookId,
                name: args.name,
                role: args.role,
                physicalDescription: aiProfile.physicalDescription,
                personality: aiProfile.personality,
                background: aiProfile.background,
                generateAIProfile: false // Already generated
            };

            // Use the create character handler
            return await this.handleCreateCharacter(characterData);

        } catch (error) {
            this.logger.error('Error generating character with AI', error as Error);
            throw error;
        }
    }

    async handleGenerateCharacterImage(args: any): Promise<any> {
        try {
            this.logger.info('Generating character image', { characterId: args.characterId, type: args.type });

            const character = this.characters.get(args.characterId);
            if (!character) {
                throw new NotFoundError('Character', args.characterId);
            }

            if (!this.imageService) {
                throw new Error('Image service not available');
            }

            // Build character-specific prompt
            let prompt = args.prompt || '';

            // Add character description to prompt
            const physicalDesc = this.buildPhysicalDescription(character);
            prompt = `${physicalDesc} ${prompt}`.trim();

            // Add reference images for consistency if available and requested
            let referenceImageUrls: string[] = [];
            if (args.useReferenceImages && character.referenceImages.length > 0) {
                // Use relevant reference images based on the type
                const relevantImages = character.referenceImages.filter(img => {
                    if (args.type === 'portrait' && (img.type === 'face' || img.type === 'expression')) return true;
                    if (args.type === 'full_body' && img.type === 'full_body') return true;
                    if (args.type === 'action' && (img.type === 'pose' || img.type === 'full_body')) return true;
                    return img.type === 'other';
                });

                referenceImageUrls = relevantImages.slice(0, 3).map(img => img.url); // Limit to 3 images
            }

            // Generate the actual image
            const imageResult = await this.generateCharacterAvatarInternal(
                character,
                prompt,
                args.type || 'portrait',
                args.style
            );

            this.logger.info('Character image generated', { characterId: args.characterId });
            return imageResult;

        } catch (error) {
            this.logger.error('Error generating character image', error as Error);
            throw error;
        }
    }

    /**
     * Internal method to generate character avatar using the image service
     */
    private async generateCharacterAvatarInternal(
        character: Character,
        prompt: string,
        type: string = 'portrait',
        style?: string
    ): Promise<any> {
        try {
            if (!this.imageService) {
                throw new Error('Image service not available');
            }

            // Build character context for image generation
            const characterContext = {
                name: character.name,
                role: character.role,
                age: character.age,
                gender: character.gender,
                physicalDescription: character.physicalDescription,
                personality: character.personality.coreTraits.slice(0, 3)
            };

            // Use context-aware image generation if available
            if (this.narrativeService) {
                try {
                    // Try to get book context for style consistency
                    const bookContext = await this.narrativeService.getNarrativeContext(
                        character.bookId,
                        character.bookId, // using bookId as conversationId
                        undefined // no specific page
                    );

                    // Generate image with full context
                    const result = await this.imageService.generateImage({
                        prompt,
                        style: style || 'realistic_artistic',
                        bookId: character.bookId,
                        characterContext,
                        bookContext,
                        imageType: type,
                        consistency: character.imageGenerationProfile.consistencyLevel
                    });

                    return {
                        imageUrl: result.imageUrl || result.url,
                        prompt: prompt,
                        style: result.style || style || 'realistic_artistic',
                        characterId: character._id,
                        type: type,
                        generatedAt: new Date(),
                        contextUsed: true
                    };
                } catch (contextError) {
                    this.logger.warn('Context-aware generation failed, falling back to basic generation', {
                        error: (contextError as Error).message
                    });
                }
            }

            // Fallback to basic image generation
            const result = await this.imageService.generateImage({
                prompt,
                style: style || 'realistic_artistic',
                imageType: type
            });

            return {
                imageUrl: result.imageUrl || result.url,
                prompt: prompt,
                style: result.style || style || 'realistic_artistic',
                characterId: character._id,
                type: type,
                generatedAt: new Date(),
                contextUsed: false
            };

        } catch (error) {
            this.logger.error('Error in generateCharacterAvatarInternal', error as Error);
            throw error;
        }
    }

    /**
     * Generate contextual images of characters in specific scenes or situations
     */
    async handleGenerateCharacterContextualImage(args: any): Promise<any> {
        try {
            this.logger.info('Generating character contextual image', {
                characterId: args.characterId,
                imageType: args.imageType,
                context: args.context
            });

            const character = this.characters.get(args.characterId);
            if (!character) {
                throw new NotFoundError('Character', args.characterId);
            }

            if (!this.imageService) {
                throw new Error('Image service not available');
            }

            // Build contextual prompt
            let contextualPrompt = '';

            // Start with character description
            const physicalDesc = this.buildPhysicalDescription(character);
            const personalityDesc = character.personality.coreTraits.slice(0, 3).join(', ');

            // Build base character reference
            let characterReference = `${character.name}`;
            if (physicalDesc) {
                characterReference += `, ${physicalDesc}`;
            }

            // Add age and gender if available
            const ageGenderDesc = [];
            if (character.age) ageGenderDesc.push(`${character.age} years old`);
            if (character.gender) ageGenderDesc.push(character.gender);
            if (ageGenderDesc.length > 0) {
                characterReference += `, ${ageGenderDesc.join(', ')}`;
            }

            // Build contextual scene prompt based on image type and context
            switch (args.imageType) {
                case 'scene':
                    contextualPrompt = `${characterReference} in a scene: ${args.context}`;
                    break;
                case 'action':
                    contextualPrompt = `${characterReference} performing action: ${args.context}`;
                    break;
                case 'emotion':
                    contextualPrompt = `${characterReference} expressing emotion: ${args.context}`;
                    break;
                case 'interaction':
                    contextualPrompt = `${characterReference} interacting: ${args.context}`;
                    break;
                case 'environment':
                    contextualPrompt = `${characterReference} in environment: ${args.context}`;
                    break;
                default:
                    contextualPrompt = `${characterReference}: ${args.context}`;
            }

            // Add specific prompt if provided
            if (args.specificPrompt) {
                contextualPrompt += `. ${args.specificPrompt}`;
            }

            // Add mood/atmosphere
            if (args.mood) {
                const moodDescriptions = {
                    happy: 'cheerful and bright atmosphere',
                    sad: 'melancholic and somber mood',
                    angry: 'intense and dramatic lighting',
                    fearful: 'tense and shadowy atmosphere',
                    surprised: 'dynamic and energetic composition',
                    neutral: 'balanced and natural lighting',
                    dramatic: 'dramatic lighting and composition',
                    peaceful: 'calm and serene atmosphere'
                };
                contextualPrompt += `. ${moodDescriptions[args.mood] || 'natural atmosphere'}`;
            }

            // Add setting if provided
            if (args.setting) {
                contextualPrompt += `. Setting: ${args.setting}`;
            }

            // Add personality context for better character portrayal
            if (personalityDesc) {
                contextualPrompt += `. Character personality: ${personalityDesc}`;
            }

            // Add style guidance based on image type
            const styleGuidance = {
                scene: 'cinematic composition, storytelling focus, environmental details',
                action: 'dynamic pose, motion blur if appropriate, action-focused composition',
                emotion: 'focus on facial expression, emotional lighting, intimate framing',
                interaction: 'multiple subjects, social dynamics, relationship focus',
                environment: 'wide shot, environmental storytelling, atmospheric details'
            };

            contextualPrompt += `. ${styleGuidance[args.imageType] || 'professional illustration style'}`;

            // Handle multiple characters if specified
            if (args.includeOtherCharacters && args.includeOtherCharacters.length > 0) {
                const otherCharacters = [];
                for (const otherId of args.includeOtherCharacters) {
                    const otherChar = this.characters.get(otherId);
                    if (otherChar) {
                        const otherDesc = this.buildPhysicalDescription(otherChar);
                        otherCharacters.push(`${otherChar.name}${otherDesc ? `, ${otherDesc}` : ''}`);
                    }
                }

                if (otherCharacters.length > 0) {
                    contextualPrompt += `. Also featuring: ${otherCharacters.join(', ')}`;
                }
            }

            // Generate the contextual image
            const imageResult = await this.generateCharacterAvatarInternal(
                character,
                contextualPrompt,
                args.imageType,
                args.style
            );

            if (imageResult && imageResult.imageUrl) {
                // Store as reference image
                const referenceImage = {
                    url: imageResult.imageUrl,
                    filename: `contextual_${args.imageType}_${character._id}_${Date.now()}.jpg`,
                    description: `${args.context} - ${args.imageType} image`,
                    type: 'other',
                    uploadedAt: new Date()
                };

                character.referenceImages.push(referenceImage);
                this.characters.set(character._id, character);

                this.logger.info('Character contextual image generated successfully', {
                    characterId: args.characterId,
                    imageType: args.imageType,
                    imageUrl: imageResult.imageUrl
                });

                return {
                    success: true,
                    imageUrl: imageResult.imageUrl,
                    prompt: contextualPrompt,
                    imageType: args.imageType,
                    context: args.context,
                    characterId: args.characterId,
                    generatedAt: new Date(),
                    referenceImage
                };
            }

            throw new Error('Failed to generate contextual image');

        } catch (error) {
            this.logger.error('Error generating character contextual image', error as Error);
            throw error;
        }
    }

    async handleGetCharacterRelationships(args: any): Promise<any> {
        try {
            this.logger.info('Getting character relationships', { characterId: args.characterId });

            const character = this.characters.get(args.characterId);
            if (!character) {
                throw new NotFoundError('Character', args.characterId);
            }

            if (args.targetCharacterId) {
                // Get specific relationship
                const relationship = character.relationships.find(r => r.characterId === args.targetCharacterId);
                return relationship || null;
            } else {
                // Get all relationships
                return character.relationships;
            }

        } catch (error) {
            this.logger.error('Error getting character relationships', error as Error);
            throw error;
        }
    }

    async handleCreateCharacterRelationship(args: any): Promise<any> {
        try {
            this.logger.info('Creating character relationship', {
                characterId: args.characterId,
                targetCharacterId: args.targetCharacterId
            });

            const character = this.characters.get(args.characterId);
            const targetCharacter = this.characters.get(args.targetCharacterId);

            if (!character) {
                throw new NotFoundError('Character', args.characterId);
            }
            if (!targetCharacter) {
                throw new NotFoundError('Character', args.targetCharacterId);
            }

            // Create relationship object
            const relationship = {
                characterId: args.targetCharacterId,
                characterName: targetCharacter.name,
                relationship: args.relationship,
                description: args.description || '',
                dynamic: args.dynamic
            };

            // Update character's relationships
            const existingIndex = character.relationships.findIndex(r => r.characterId === args.targetCharacterId);
            if (existingIndex >= 0) {
                character.relationships[existingIndex] = relationship;
            } else {
                character.relationships.push(relationship);
            }

            // Update the character
            const updatedCharacter = {
                ...character,
                updatedAt: new Date()
            };

            this.characters.set(args.characterId, updatedCharacter);

            this.logger.info('Character relationship created', { characterId: args.characterId, targetCharacterId: args.targetCharacterId });
            return relationship;

        } catch (error) {
            this.logger.error('Error creating character relationship', error as Error);
            throw error;
        }
    }

    private buildPhysicalDescription(character: Character): string {
        const desc = character.physicalDescription;
        const parts: string[] = [];

        if (desc.height) parts.push(`height: ${desc.height}`);
        if (desc.build) parts.push(`build: ${desc.build}`);
        if (desc.hairColor && desc.hairStyle) parts.push(`${desc.hairColor} ${desc.hairStyle} hair`);
        else if (desc.hairColor) parts.push(`${desc.hairColor} hair`);
        if (desc.eyeColor) parts.push(`${desc.eyeColor} eyes`);
        if (desc.skinTone) parts.push(`${desc.skinTone} skin`);
        if (desc.distinctiveFeatures.length > 0) parts.push(`distinctive features: ${desc.distinctiveFeatures.join(', ')}`);

        if (desc.clothing?.style) parts.push(`clothing style: ${desc.clothing.style}`);
        if (desc.clothing?.colors && desc.clothing.colors.length > 0) {
            parts.push(`wearing ${desc.clothing.colors.join(' and ')} colors`);
        }

        const result = parts.join(', ');
        return result ? `Character appearance: ${result}` : '';
    }
}
