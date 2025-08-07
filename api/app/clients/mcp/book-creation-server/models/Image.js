import mongoose from 'mongoose';

// Image schema for book illustrations
const ImageSchema = new mongoose.Schema(
    {
        _id: {
            type: String,
            required: true,
        },
        bookId: {
            type: String,
            required: true,
            ref: 'Book',
        },
        chapterId: {
            type: String,
            required: true,
            ref: 'Chapter',
        },
        pageId: {
            type: String,
            ref: 'Page',
        },
        targetPageNumber: {
            type: Number,
            required: true,
            min: 1,
        },
        url: {
            type: String,
            required: true,
        },
        localPath: {
            type: String,
            required: true,
        },
        filename: {
            type: String,
            required: true,
        },
        placement: {
            position: {
                type: String,
                enum: ['before', 'after', 'between'],
                default: 'between',
            },
            reason: String,
            confidence: {
                type: Number,
                min: 0,
                max: 1,
                default: 0.8,
            },
        },
        prompt: {
            original: {
                type: String,
                required: true,
            },
            enhanced: {
                type: String,
                required: true,
            },
        },
        style: {
            type: String,
            default: 'book_illustration',
        },
        contextAnalysis: {
            themes: [String],
            characters: [String],
            setting: String,
            mood: String,
            actionLevel: {
                type: String,
                enum: ['low', 'medium', 'high'],
                default: 'medium',
            },
            storyBeat: String,
            suggestedPlacement: String,
        },
        generationData: {
            model: String,
            size: String,
            quality: String,
            revisedPrompt: String,
        },
        status: {
            type: String,
            enum: ['generating', 'generated', 'failed', 'approved', 'published'],
            default: 'generated',
        },
        authorId: {
            type: String,
            required: true,
        },
        metadata: {
            fileSize: Number,
            dimensions: {
                width: Number,
                height: Number,
            },
            format: String,
        },
        approved: {
            type: Boolean,
            default: false,
        },
        approvedAt: Date,
        approvedBy: String,
    },
    { timestamps: true },
);

// Indexes for better performance
ImageSchema.index({ bookId: 1, chapterId: 1 });
ImageSchema.index({ pageId: 1 });
ImageSchema.index({ targetPageNumber: 1 });
ImageSchema.index({ status: 1 });
ImageSchema.index({ authorId: 1 });
ImageSchema.index({ 'placement.position': 1 });

export const Image = mongoose.model('Image', ImageSchema);
