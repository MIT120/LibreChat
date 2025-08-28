/**
 * Outline Model - Database schema for story outlines
 */

import mongoose, { Schema, Document } from 'mongoose';

// Scene interface for outline structure
export interface IScene {
    _id: string;
    title: string;
    description?: string;
    summary?: string;
    chapterId?: string;
    pageId?: string;
    order: number;
    status: 'planned' | 'writing' | 'draft' | 'review' | 'completed';
    wordCount?: number;
    targetWordCount?: number;
    tags?: string[];
    notes?: string;
    pov?: string; // Point of view character
    setting?: string;
    timeOfDay?: string;
    conflict?: string;
    goal?: string;
    outcome?: string;
    tension?: number; // 1-10 scale
    importance?: 'low' | 'medium' | 'high' | 'critical';
    position?: { x: number; y: number }; // For grid/matrix views
    color?: string;
    metadata?: {
        createdAt: Date;
        updatedAt: Date;
        lastModifiedBy?: string;
    };
}

// Chapter structure for nested organization
export interface IChapterOutline {
    _id: string;
    title: string;
    description?: string;
    order: number;
    scenes: IScene[];
    wordCount?: number;
    targetWordCount?: number;
    status: 'planned' | 'writing' | 'draft' | 'review' | 'completed';
    tags?: string[];
    notes?: string;
    color?: string;
    position?: { x: number; y: number };
}

// Act/Part structure for higher-level organization
export interface IActOutline {
    _id: string;
    title: string;
    description?: string;
    order: number;
    chapters: IChapterOutline[];
    wordCount?: number;
    targetWordCount?: number;
    theme?: string;
    conflict?: string;
    color?: string;
}

// Main outline interface
export interface IOutline extends Document {
    _id: string;
    bookId: string;
    title: string;
    description?: string;
    structure: 'three-act' | 'four-act' | 'five-act' | 'hero-journey' | 'custom';
    acts: IActOutline[];
    scenes: IScene[]; // Flat scene list for easy querying
    chapters: IChapterOutline[]; // Flat chapter list
    settings: {
        defaultView: 'outline' | 'grid' | 'matrix';
        gridColumns?: number;
        matrixRows?: number;
        showWordCounts: boolean;
        showStatus: boolean;
        showTags: boolean;
        colorCoding: 'none' | 'status' | 'pov' | 'importance' | 'custom';
        autoSave: boolean;
    };
    metadata: {
        totalScenes: number;
        totalChapters: number;
        totalWordCount: number;
        targetWordCount: number;
        completionPercentage: number;
        lastModified: Date;
        version: number;
    };
    createdAt: Date;
    updatedAt: Date;
    authorId: string;
    conversationId: string;
}

// Mongoose schemas
const sceneSchema = new Schema<IScene>({
    _id: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    summary: { type: String, maxlength: 500 },
    chapterId: { type: String },
    pageId: { type: String },
    order: { type: Number, required: true, min: 0 },
    status: {
        type: String,
        enum: ['planned', 'writing', 'draft', 'review', 'completed'],
        default: 'planned'
    },
    wordCount: { type: Number, min: 0, default: 0 },
    targetWordCount: { type: Number, min: 0 },
    tags: [{ type: String, maxlength: 50 }],
    notes: { type: String, maxlength: 2000 },
    pov: { type: String, maxlength: 100 },
    setting: { type: String, maxlength: 200 },
    timeOfDay: { type: String, maxlength: 50 },
    conflict: { type: String, maxlength: 500 },
    goal: { type: String, maxlength: 300 },
    outcome: { type: String, maxlength: 300 },
    tension: { type: Number, min: 1, max: 10 },
    importance: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    position: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 }
    },
    color: { type: String, maxlength: 7 }, // Hex color code
    metadata: {
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
        lastModifiedBy: { type: String }
    }
}, { _id: false });

const chapterOutlineSchema = new Schema<IChapterOutline>({
    _id: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    order: { type: Number, required: true, min: 0 },
    scenes: [sceneSchema],
    wordCount: { type: Number, min: 0, default: 0 },
    targetWordCount: { type: Number, min: 0 },
    status: {
        type: String,
        enum: ['planned', 'writing', 'draft', 'review', 'completed'],
        default: 'planned'
    },
    tags: [{ type: String, maxlength: 50 }],
    notes: { type: String, maxlength: 2000 },
    color: { type: String, maxlength: 7 },
    position: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 }
    }
}, { _id: false });

const actOutlineSchema = new Schema<IActOutline>({
    _id: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    order: { type: Number, required: true, min: 0 },
    chapters: [chapterOutlineSchema],
    wordCount: { type: Number, min: 0, default: 0 },
    targetWordCount: { type: Number, min: 0 },
    theme: { type: String, maxlength: 300 },
    conflict: { type: String, maxlength: 500 },
    color: { type: String, maxlength: 7 }
}, { _id: false });

const outlineSchema = new Schema<IOutline>({
    _id: { type: String, required: true },
    bookId: { type: String, required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, maxlength: 1000 },
    structure: {
        type: String,
        enum: ['three-act', 'four-act', 'five-act', 'hero-journey', 'custom'],
        default: 'three-act'
    },
    acts: [actOutlineSchema],
    scenes: [sceneSchema],
    chapters: [chapterOutlineSchema],
    settings: {
        defaultView: {
            type: String,
            enum: ['outline', 'grid', 'matrix'],
            default: 'outline'
        },
        gridColumns: { type: Number, min: 1, max: 10, default: 4 },
        matrixRows: { type: Number, min: 1, max: 10, default: 3 },
        showWordCounts: { type: Boolean, default: true },
        showStatus: { type: Boolean, default: true },
        showTags: { type: Boolean, default: false },
        colorCoding: {
            type: String,
            enum: ['none', 'status', 'pov', 'importance', 'custom'],
            default: 'status'
        },
        autoSave: { type: Boolean, default: true }
    },
    metadata: {
        totalScenes: { type: Number, default: 0 },
        totalChapters: { type: Number, default: 0 },
        totalWordCount: { type: Number, default: 0 },
        targetWordCount: { type: Number, default: 0 },
        completionPercentage: { type: Number, min: 0, max: 100, default: 0 },
        lastModified: { type: Date, default: Date.now },
        version: { type: Number, default: 1 }
    },
    authorId: { type: String, required: true, index: true },
    conversationId: { type: String, required: true, index: true }
}, {
    timestamps: true,
    _id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
outlineSchema.index({ bookId: 1, authorId: 1 });
outlineSchema.index({ 'scenes.order': 1 });
outlineSchema.index({ 'chapters.order': 1 });
outlineSchema.index({ 'acts.order': 1 });

// Virtual methods
outlineSchema.virtual('totalDuration').get(function () {
    return this.scenes.reduce((total: number, scene: IScene) => {
        return total + (scene.wordCount || 0);
    }, 0);
});

outlineSchema.virtual('averageSceneLength').get(function () {
    const totalScenes = this.metadata.totalScenes;
    return totalScenes > 0 ? this.metadata.totalWordCount / totalScenes : 0;
});

// Methods
outlineSchema.methods.updateMetadata = function () {
    this.metadata.totalScenes = this.scenes.length;
    this.metadata.totalChapters = this.chapters.length;
    this.metadata.totalWordCount = this.scenes.reduce((total: number, scene: IScene) => {
        return total + (scene.wordCount || 0);
    }, 0);

    const completedScenes = this.scenes.filter((scene: IScene) => scene.status === 'completed').length;
    this.metadata.completionPercentage = this.metadata.totalScenes > 0
        ? Math.round((completedScenes / this.metadata.totalScenes) * 100)
        : 0;

    this.metadata.lastModified = new Date();
    this.metadata.version += 1;
};

outlineSchema.methods.reorderScenes = function (sceneIds: string[]) {
    const sceneMap = new Map(this.scenes.map((scene: IScene) => [scene._id, scene]));

    this.scenes = sceneIds.map((id, index) => {
        const scene = sceneMap.get(id);
        if (scene) {
            scene.order = index;
            return scene;
        }
        return null;
    }).filter(Boolean);

    this.updateMetadata();
};

outlineSchema.methods.addScene = function (sceneData: Partial<IScene>, chapterId?: string) {
    const newScene: IScene = {
        _id: sceneData._id || require('uuid').v4(),
        title: sceneData.title || 'New Scene',
        description: sceneData.description,
        summary: sceneData.summary,
        chapterId,
        order: this.scenes.length,
        status: sceneData.status || 'planned',
        wordCount: sceneData.wordCount || 0,
        targetWordCount: sceneData.targetWordCount,
        tags: sceneData.tags || [],
        notes: sceneData.notes,
        pov: sceneData.pov,
        setting: sceneData.setting,
        timeOfDay: sceneData.timeOfDay,
        conflict: sceneData.conflict,
        goal: sceneData.goal,
        outcome: sceneData.outcome,
        tension: sceneData.tension,
        importance: sceneData.importance || 'medium',
        position: sceneData.position || { x: 0, y: 0 },
        color: sceneData.color,
        metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            lastModifiedBy: sceneData.metadata?.lastModifiedBy
        }
    };

    this.scenes.push(newScene);
    this.updateMetadata();
    return newScene;
};

// Pre-save middleware
outlineSchema.pre('save', function (next) {
    this.updateMetadata();
    next();
});

export const Outline = mongoose.model<IOutline>('Outline', outlineSchema);
export default Outline;
