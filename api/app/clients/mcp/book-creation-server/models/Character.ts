/**
 * Character Model - MongoDB schema for character storage
 */

import mongoose, { Document, Schema } from 'mongoose';

// Character role enum
export enum CharacterRole {
    PROTAGONIST = 'protagonist',
    ANTAGONIST = 'antagonist',
    SUPPORTING = 'supporting',
    MINOR = 'minor',
    MENTOR = 'mentor',
    LOVE_INTEREST = 'love_interest',
    COMIC_RELIEF = 'comic_relief'
}

// Character visibility enum
export enum CharacterVisibility {
    PUBLIC = 'public',
    PRIVATE = 'private'
}

// Physical description schema
const physicalDescriptionSchema = new Schema({
    height: { type: String },
    build: { type: String },
    hairColor: { type: String },
    hairStyle: { type: String },
    eyeColor: { type: String },
    skinTone: { type: String },
    distinctiveFeatures: [{ type: String }],
    clothing: {
        style: { type: String },
        colors: [{ type: String }],
        accessories: [{ type: String }]
    }
}, { _id: false });

// Personality schema
const personalitySchema = new Schema({
    coreTraits: [{ type: String }],
    motivations: [{ type: String }],
    fears: [{ type: String }],
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    quirks: [{ type: String }],
    speechPattern: { type: String },
    mannerisms: [{ type: String }]
}, { _id: false });

// Background schema
const backgroundSchema = new Schema({
    origin: { type: String },
    family: { type: String },
    education: { type: String },
    pastEvents: [{ type: String }],
    secrets: [{ type: String }],
    skills: [{ type: String }]
}, { _id: false });

// Goal schema
const goalSchema = new Schema({
    description: { type: String, required: true },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['active', 'achieved', 'failed', 'abandoned'],
        default: 'active'
    }
}, { _id: false });

// Arc schema
const arcSchema = new Schema({
    startingPoint: { type: String },
    majorBeats: [{
        chapter: { type: Number },
        description: { type: String, required: true },
        transformation: { type: String, required: true },
        _id: false
    }],
    endingPoint: { type: String },
    theme: { type: String }
}, { _id: false });

// Relationship schema
const relationshipSchema = new Schema({
    characterId: { type: String, required: true },
    characterName: { type: String, required: true },
    relationship: { type: String, required: true },
    description: { type: String },
    dynamic: {
        type: String,
        enum: ['positive', 'negative', 'neutral', 'complex'],
        required: true
    }
}, { _id: false });

// Avatar schema
const avatarSchema = new Schema({
    url: { type: String, required: true },
    filename: { type: String, required: true },
    description: { type: String },
    uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

// Reference image schema
const referenceImageSchema = new Schema({
    url: { type: String, required: true },
    filename: { type: String, required: true },
    description: { type: String },
    type: {
        type: String,
        enum: ['face', 'full_body', 'clothing', 'expression', 'pose', 'other'],
        required: true
    },
    uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

// Appearance schema
const appearanceSchema = new Schema({
    chapterId: { type: String, required: true },
    pageId: { type: String, required: true },
    sceneType: { type: String, required: true },
    description: { type: String, required: true }
}, { _id: false });

// Image generation profile schema
const imageGenerationProfileSchema = new Schema({
    consistencyLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'strict'],
        default: 'medium'
    },
    preferredStyles: [{ type: String }],
    excludedElements: [{ type: String }],
    customPromptAdditions: { type: String }
}, { _id: false });

// Main character schema
const characterSchema = new Schema({
    _id: {
        type: String,
        required: true
    },
    bookId: {
        type: String,
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    role: {
        type: String,
        enum: Object.values(CharacterRole),
        required: true,
        index: true
    },

    // Basic info
    age: {
        type: Number,
        min: 0,
        max: 1000
    },
    gender: {
        type: String,
        trim: true,
        maxlength: 50
    },
    species: {
        type: String,
        default: 'human',
        trim: true,
        maxlength: 50
    },
    occupation: {
        type: String,
        trim: true,
        maxlength: 100
    },

    // Detailed descriptions
    physicalDescription: {
        type: physicalDescriptionSchema,
        default: () => ({
            distinctiveFeatures: [],
            clothing: { style: '', colors: [], accessories: [] }
        })
    },
    personality: {
        type: personalitySchema,
        default: () => ({
            coreTraits: [],
            motivations: [],
            fears: [],
            strengths: [],
            weaknesses: [],
            quirks: [],
            mannerisms: []
        })
    },
    background: {
        type: backgroundSchema,
        default: () => ({
            pastEvents: [],
            secrets: [],
            skills: []
        })
    },

    // Story elements
    goals: [goalSchema],
    arc: {
        type: arcSchema,
        default: () => ({
            startingPoint: '',
            majorBeats: [],
            endingPoint: '',
            theme: ''
        })
    },
    relationships: [relationshipSchema],

    // Media
    avatar: avatarSchema,
    referenceImages: [referenceImageSchema],

    // Meta
    notes: {
        type: String,
        maxlength: 5000
    },
    tags: [{
        type: String,
        trim: true,
        maxlength: 50
    }],
    isTemplate: {
        type: Boolean,
        default: false,
        index: true
    },
    visibility: {
        type: String,
        enum: Object.values(CharacterVisibility),
        default: CharacterVisibility.PUBLIC
    },
    version: {
        type: Number,
        default: 1
    },

    // Story integration
    appearances: [appearanceSchema],

    // Generation settings
    imageGenerationProfile: {
        type: imageGenerationProfileSchema,
        default: () => ({
            consistencyLevel: 'medium',
            preferredStyles: [],
            excludedElements: [],
            customPromptAdditions: ''
        })
    }
}, {
    _id: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
characterSchema.index({ bookId: 1, role: 1 });
characterSchema.index({ bookId: 1, isTemplate: 1 });
characterSchema.index({ bookId: 1, name: 1 });
characterSchema.index({ tags: 1 });
characterSchema.index({ visibility: 1, isTemplate: 1 });

// Virtual for character type
characterSchema.virtual('type').get(function () {
    return this.isTemplate ? 'template' : 'character';
});

// Export interface
export interface ICharacter {
    _id: string;
    bookId: string;
    name: string;
    role: CharacterRole;
    age?: number;
    gender?: string;
    species?: string;
    occupation?: string;
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
    background: {
        origin?: string;
        family?: string;
        education?: string;
        pastEvents: string[];
        secrets: string[];
        skills: string[];
    };
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
    notes: string;
    tags: string[];
    isTemplate: boolean;
    visibility: CharacterVisibility;
    version: number;
    appearances: Array<{
        chapterId: string;
        pageId: string;
        sceneType: string;
        description: string;
    }>;
    imageGenerationProfile: {
        consistencyLevel: 'low' | 'medium' | 'high' | 'strict';
        preferredStyles: string[];
        excludedElements: string[];
        customPromptAdditions: string;
    };
    createdAt: Date;
    updatedAt: Date;
}

export interface CharacterDocument extends ICharacter, Document { }

// Create and export the model
export const Character = mongoose.model<CharacterDocument>('Character', characterSchema);
export default Character;
