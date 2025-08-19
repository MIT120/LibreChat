/**
 * Project Workspace Model - Manages overall project organization and user preferences
 */

import mongoose from 'mongoose';

// Writing targets sub-schema
const writingTargetsSchema = new mongoose.Schema({
    daily: { type: Number, default: 500, min: 0 },
    weekly: { type: Number, default: 3500, min: 0 },
    monthly: { type: Number, default: 15000, min: 0 },
    deadline: { type: Date },
    customGoals: [{
        name: { type: String, required: true },
        target: { type: Number, required: true },
        unit: { type: String, enum: ['words', 'pages', 'chapters'], default: 'words' },
        deadline: { type: Date }
    }]
}, { _id: false });

// Layout preferences sub-schema
const layoutSchema = new mongoose.Schema({
    sidebar: {
        width: { type: Number, default: 300, min: 200, max: 600 },
        collapsed: { type: Boolean, default: false },
        position: { type: String, enum: ['left', 'right'], default: 'left' }
    },
    panels: {
        research: { type: Boolean, default: true },
        outline: { type: Boolean, default: true },
        characters: { type: Boolean, default: true },
        timeline: { type: Boolean, default: true },
        writing: { type: Boolean, default: true }
    },
    views: {
        defaultView: {
            type: String,
            enum: ['timeline', 'outline', 'writing', 'research', 'planning'],
            default: 'writing'
        },
        lastView: { type: String },
        splitView: { type: Boolean, default: false },
        focusMode: { type: Boolean, default: false }
    }
}, { _id: false });

// Workspace settings sub-schema
const workspaceSettingsSchema = new mongoose.Schema({
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
    language: { type: String, default: 'en' },
    autoSave: { type: Boolean, default: true },
    autoSaveInterval: { type: Number, default: 30, min: 10 }, // seconds
    backupEnabled: { type: Boolean, default: true },
    backupFrequency: { type: String, enum: ['hourly', 'daily', 'weekly'], default: 'daily' },
    notifications: {
        writeReminders: { type: Boolean, default: true },
        goalReminders: { type: Boolean, default: true },
        consistencyAlerts: { type: Boolean, default: true }
    },
    privacy: {
        shareProgress: { type: Boolean, default: false },
        publicProfile: { type: Boolean, default: false }
    }
}, { _id: false });

// Main workspace schema
const projectWorkspaceSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500,
    },
    userId: {
        type: String,
        required: true,
        index: true,
    },
    books: [{
        type: String,
        ref: 'Book'
    }],
    activeBookId: {
        type: String,
        ref: 'Book'
    },
    writingTargets: {
        type: writingTargetsSchema,
        default: () => ({})
    },
    layout: {
        type: layoutSchema,
        default: () => ({})
    },
    settings: {
        type: workspaceSettingsSchema,
        default: () => ({})
    },
    statistics: {
        totalWords: { type: Number, default: 0 },
        totalPages: { type: Number, default: 0 },
        totalChapters: { type: Number, default: 0 },
        totalBooks: { type: Number, default: 0 },
        longestStreak: { type: Number, default: 0 },
        currentStreak: { type: Number, default: 0 },
        lastWritingSession: { type: Date }
    },
    collaborators: [{
        userId: { type: String, required: true },
        role: { type: String, enum: ['owner', 'editor', 'reviewer', 'reader'], required: true },
        permissions: {
            canEdit: { type: Boolean, default: false },
            canComment: { type: Boolean, default: true },
            canExport: { type: Boolean, default: false },
            canInvite: { type: Boolean, default: false }
        },
        invitedAt: { type: Date, default: Date.now },
        joinedAt: { type: Date }
    }],
    tags: [{ type: String, trim: true }],
    isArchived: { type: Boolean, default: false },
    isTemplate: { type: Boolean, default: false }
}, {
    _id: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
projectWorkspaceSchema.index({ userId: 1, isArchived: 1 });
projectWorkspaceSchema.index({ userId: 1, name: 'text', description: 'text' });
projectWorkspaceSchema.index({ 'collaborators.userId': 1 });

// Virtuals
projectWorkspaceSchema.virtual('totalCollaborators').get(function () {
    return this.collaborators?.length || 0;
});

projectWorkspaceSchema.virtual('isOwner').get(function () {
    return this.collaborators?.some(c => c.role === 'owner') || false;
});

// Methods
projectWorkspaceSchema.methods.addBook = function (bookId: string) {
    if (!this.books.includes(bookId)) {
        this.books.push(bookId);
        this.statistics.totalBooks = this.books.length;
    }
    return this.save();
};

projectWorkspaceSchema.methods.removeBook = function (bookId: string) {
    this.books = this.books.filter(id => id !== bookId);
    this.statistics.totalBooks = this.books.length;
    if (this.activeBookId === bookId) {
        this.activeBookId = this.books[0] || null;
    }
    return this.save();
};

projectWorkspaceSchema.methods.updateStatistics = function (stats: Partial<{
    totalWords: number;
    totalPages: number;
    totalChapters: number;
}>) {
    Object.assign(this.statistics, stats);
    this.statistics.lastWritingSession = new Date();
    return this.save();
};

export const ProjectWorkspace = mongoose.model('ProjectWorkspace', projectWorkspaceSchema);
export default ProjectWorkspace;
