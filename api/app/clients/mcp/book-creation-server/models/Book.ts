/**
 * Book Model - Mongoose schema for books
 */

import mongoose from 'mongoose';
import { IBook } from '../types/book.js';

const writingStyleSchema = new mongoose.Schema({
    tone: {
        type: String,
        enum: ['formal', 'informal', 'academic', 'conversational', 'humorous', 'serious', 'inspirational'],
        required: true,
    },
    voice: {
        type: String,
        enum: ['first_person', 'second_person', 'third_person'],
        required: true,
    },
    perspective: {
        type: String,
        maxlength: 500,
    },
    vocabulary: {
        type: String,
        enum: ['simple', 'intermediate', 'advanced', 'technical'],
        required: true,
    },
    sentenceStructure: {
        type: String,
        enum: ['simple', 'complex', 'varied'],
        required: true,
    },
    specialInstructions: {
        type: String,
        maxlength: 1000,
    },
}, { _id: false });

const publishingInfoSchema = new mongoose.Schema({
    isbn: String,
    publisher: String,
    publicationDate: Date,
    copyright: String,
    edition: String,
}, { _id: false });

const metadataSchema = new mongoose.Schema({
    keywords: [String],
    language: {
        type: String,
        default: 'en',
    },
    category: String,
    tags: [String],
}, { _id: false });

// Spec schema for narrative/world/style and image consistency
const specSchema = new mongoose.Schema({
    colorPalette: {
        primary: String,
        secondary: String,
        accents: [String],
        mood: String,
    },
    characters: [
        new mongoose.Schema({
            id: { type: String, required: true },
            name: { type: String, required: true },
            role: String,
            description: String,
            visualTraits: [String],
            narrativeTraits: [String],
        }, { _id: false })
    ],
    world: {
        setting: String,
        rules: [String],
        themes: [String],
        toneGuide: String,
    },
    imageStyle: {
        style: String,
        camera: String,
        rendering: String,
        negativeCues: [String],
    },
    narrativeRules: [String],
    contextBracketFormat: { type: Boolean, default: false },
    planMarkdown: String,
}, { _id: false });

const settingsSchema = new mongoose.Schema({
    autoSave: {
        type: Boolean,
        default: true,
    },
    backupFrequency: {
        type: String,
        enum: ['hourly', 'daily', 'weekly'],
        default: 'daily',
    },
    collaborationEnabled: {
        type: Boolean,
        default: false,
    },
    exportFormats: [{
        type: String,
        enum: ['pdf', 'epub', 'docx', 'html', 'txt'],
    }],
}, { _id: false });

const bookSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 300,
    },
    subtitle: {
        type: String,
        trim: true,
        maxlength: 500,
    },
    theme: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    genre: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    targetAudience: {
        type: String,
        trim: true,
        maxlength: 500,
    },
    writingStyle: {
        type: writingStyleSchema,
        required: true,
    },
    description: {
        type: String,
        trim: true,
        maxlength: 2000,
    },
    targetWordCount: {
        type: Number,
        min: 0,
    },
    currentWordCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    estimatedPages: {
        type: Number,
        min: 0,
    },
    status: {
        type: String,
        enum: ['planning', 'outlining', 'writing', 'editing', 'review', 'completed', 'published'],
        default: 'planning',
    },
    authorId: {
        type: String,
        required: true,
        index: true,
    },
    publishingInfo: publishingInfoSchema,
    metadata: {
        type: metadataSchema,
        default: () => ({
            keywords: [],
            language: 'en',
            tags: [],
        }),
    },
    spec: { type: specSchema, default: undefined },
    settings: {
        type: settingsSchema,
        default: () => ({
            autoSave: true,
            backupFrequency: 'daily',
            collaborationEnabled: false,
            exportFormats: ['pdf', 'html'],
        }),
    },
}, {
    _id: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Indexes
bookSchema.index({ authorId: 1, status: 1 });
bookSchema.index({ genre: 1 });
bookSchema.index({ 'metadata.tags': 1 });
bookSchema.index({ createdAt: -1 });

// Virtual for completion percentage
bookSchema.virtual('completionPercentage').get(function () {
    if (!this.targetWordCount || this.targetWordCount === 0) {
        return 0;
    }
    return Math.min(100, Math.round((this.currentWordCount / this.targetWordCount) * 100));
});

export const Book = mongoose.model<IBook>('Book', bookSchema);
export default Book;
