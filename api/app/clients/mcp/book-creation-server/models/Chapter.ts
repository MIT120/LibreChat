/**
 * Chapter Model - Mongoose schema for chapters
 */

import mongoose from 'mongoose';
import { IChapter } from '../types/book.js';

const chapterSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
    },
    bookId: {
        type: String,
        required: true,
        index: true,
    },
    chapterNumber: {
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
    description: {
        type: String,
        trim: true,
        maxlength: 1000,
    },
    outline: {
        type: String,
        trim: true,
    },
    targetWordCount: {
        type: Number,
        min: 0,
    },
    wordCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    status: {
        type: String,
        enum: ['planned', 'in_progress', 'draft', 'review', 'approved', 'published'],
        default: 'planned',
    },
    notes: {
        type: String,
        trim: true,
    },
}, {
    _id: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Indexes
chapterSchema.index({ bookId: 1, chapterNumber: 1 }, { unique: true });
chapterSchema.index({ status: 1 });
chapterSchema.index({ createdAt: -1 });

// Virtual for completion percentage
chapterSchema.virtual('completionPercentage').get(function () {
    if (!this.targetWordCount || this.targetWordCount === 0) {
        return 0;
    }
    return Math.min(100, Math.round((this.wordCount / this.targetWordCount) * 100));
});

export const Chapter = mongoose.model<IChapter>('Chapter', chapterSchema);
export default Chapter;
