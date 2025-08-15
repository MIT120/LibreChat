/**
 * Page Model - Mongoose schema for pages
 */

import mongoose from 'mongoose';
import { IPage } from '../types/book.js';

const pageSchema = new mongoose.Schema({
    pageId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    chapterId: {
        type: String,
        required: true,
        index: true,
    },
    conversationId: {
        type: String,
        required: true,
        index: true,
    },
    pageNumber: {
        type: Number,
        required: true,
        min: 1,
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    content: {
        type: String,
        required: true,
    },
    wordCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    notes: {
        type: String,
        trim: true,
    },
    status: {
        type: String,
        enum: ['draft', 'review', 'approved', 'published'],
        default: 'draft',
    },
    images: [{
        id: String,
        url: String,
        localPath: String,
        placement: {
            position: {
                type: String,
                enum: ['before', 'after', 'between'],
                default: 'after',
            },
        },
        prompt: String,
        status: {
            type: String,
            enum: ['pending', 'generated', 'approved', 'rejected'],
            default: 'pending',
        },
    }],
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Indexes
pageSchema.index({ chapterId: 1, pageNumber: 1 }, { unique: true });
pageSchema.index({ conversationId: 1 });
pageSchema.index({ chapterId: 1, conversationId: 1 });
pageSchema.index({ status: 1 });
pageSchema.index({ createdAt: -1 });

// Auto-calculate word count before saving
pageSchema.pre('save', function () {
    if (this.isModified('content')) {
        this.wordCount = this.content
            .split(/\s+/)
            .filter(word => word.length > 0)
            .length;
    }
});

export const Page = mongoose.model<IPage>('Page', pageSchema);
export default Page;
