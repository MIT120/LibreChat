/**
 * Book Conversation Model - Links conversations to books and tracks context
 */

import mongoose from 'mongoose';

// Conversation context sub-schema
const conversationContextSchema = new mongoose.Schema({
    activeChapterId: { type: String, ref: 'Chapter' },
    activePageId: { type: String, ref: 'Page' },
    focusArea: {
        type: String,
        enum: ['writing', 'planning', 'editing', 'research', 'character_development', 'world_building'],
        default: 'writing'
    },
    workflowStage: {
        type: String,
        enum: ['brainstorming', 'outlining', 'first_draft', 'revision', 'editing', 'proofreading', 'publishing'],
        default: 'first_draft'
    },
    lastContext: {
        characters: [{
            characterId: { type: String },
            characterName: { type: String },
            lastMentioned: { type: Date }
        }],
        locations: [{
            locationId: { type: String },
            locationName: { type: String },
            lastMentioned: { type: Date }
        }],
        plotlines: [{
            plotlineId: { type: String },
            plotlineName: { type: String },
            lastMentioned: { type: Date }
        }]
    }
}, { _id: false });

// Conversation statistics sub-schema
const conversationStatsSchema = new mongoose.Schema({
    messageCount: { type: Number, default: 0 },
    wordsGenerated: { type: Number, default: 0 },
    revisionsRequested: { type: Number, default: 0 },
    revisionsApplied: { type: Number, default: 0 },
    chaptersWorkedOn: { type: Number, default: 0 },
    pagesCreated: { type: Number, default: 0 },
    charactersCreated: { type: Number, default: 0 },
    locationsCreated: { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now },
    totalSessionTime: { type: Number, default: 0 }, // minutes
    averageResponseTime: { type: Number, default: 0 }, // seconds
}, { _id: false });

// Conversation goals sub-schema
const conversationGoalsSchema = new mongoose.Schema({
    primary: {
        type: String,
        enum: ['complete_chapter', 'develop_character', 'write_scene', 'plan_plot', 'research_topic', 'edit_content', 'general_writing'],
        default: 'general_writing'
    },
    secondary: [{ type: String }],
    specificTargets: [{
        target: { type: String, required: true },
        targetType: { type: String, enum: ['word_count', 'chapter_completion', 'character_development', 'plot_progression'] },
        currentProgress: { type: Number, default: 0 },
        targetProgress: { type: Number, required: true },
        deadline: { type: Date },
        achieved: { type: Boolean, default: false },
        achievedAt: { type: Date }
    }],
    sessionGoal: { type: String }, // What user wants to accomplish in this session
}, { _id: false });

// Main book conversation schema
const bookConversationSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
    },
    conversationId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    bookId: {
        type: String,
        required: true,
        ref: 'Book',
        index: true
    },
    workspaceId: {
        type: String,
        required: true,
        ref: 'ProjectWorkspace',
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },

    // Conversation metadata
    title: {
        type: String,
        required: true,
        maxlength: 200,
        trim: true
    },
    description: {
        type: String,
        maxlength: 500,
        trim: true
    },

    // Conversation type and purpose
    type: {
        type: String,
        enum: ['writing_session', 'planning', 'editing', 'research', 'brainstorming', 'review', 'collaboration'],
        default: 'writing_session'
    },

    // Current context
    context: {
        type: conversationContextSchema,
        default: () => ({})
    },

    // Goals for this conversation
    goals: {
        type: conversationGoalsSchema,
        default: () => ({})
    },

    // Statistics
    stats: {
        type: conversationStatsSchema,
        default: () => ({})
    },

    // Conversation state
    status: {
        type: String,
        enum: ['active', 'paused', 'completed', 'archived'],
        default: 'active',
        index: true
    },

    // Organization
    tags: [{ type: String, trim: true }],
    category: {
        type: String,
        enum: ['draft', 'revision', 'planning', 'research', 'brainstorm', 'review'],
        default: 'draft'
    },

    // Collaboration
    sharedWith: [{
        userId: { type: String, required: true },
        role: { type: String, enum: ['viewer', 'commenter', 'editor'], default: 'viewer' },
        sharedAt: { type: Date, default: Date.now },
        lastAccessed: { type: Date }
    }],

    // Settings
    settings: {
        autoSave: { type: Boolean, default: true },
        enableRevisionTracking: { type: Boolean, default: true },
        enableContextAwareness: { type: Boolean, default: true },
        enableSuggestions: { type: Boolean, default: true },
        reminderInterval: { type: Number, default: 30 }, // minutes
    },

    // Session tracking
    sessions: [{
        startTime: { type: Date, required: true },
        endTime: { type: Date },
        duration: { type: Number }, // minutes
        messageCount: { type: Number, default: 0 },
        wordsGenerated: { type: Number, default: 0 },
        goals: [{ type: String }],
        accomplished: [{ type: String }],
        notes: { type: String }
    }],

    // Related content
    relatedContent: {
        revisionRequests: [{ type: String, ref: 'RevisionRequest' }],
        generatedPages: [{ type: String, ref: 'Page' }],
        modifiedChapters: [{ type: String, ref: 'Chapter' }],
        createdCharacters: [{ type: String }],
        createdLocations: [{ type: String }],
        researchItems: [{ type: String, ref: 'ResearchItem' }]
    },

    // System flags
    flags: {
        isPinned: { type: Boolean, default: false },
        isTemplate: { type: Boolean, default: false },
        requiresReview: { type: Boolean, default: false },
        hasUnresolvedIssues: { type: Boolean, default: false },
        isHighPriority: { type: Boolean, default: false }
    },

    // Archive information
    archivedAt: { type: Date },
    archivedBy: { type: String },
    archiveReason: { type: String },

    // Last activity tracking
    lastMessage: {
        messageId: { type: String },
        content: { type: String, maxlength: 200 }, // Preview of last message
        timestamp: { type: Date },
        sender: { type: String, enum: ['user', 'assistant'] }
    }
}, {
    _id: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
bookConversationSchema.index({ bookId: 1, status: 1, updatedAt: -1 });
bookConversationSchema.index({ workspaceId: 1, status: 1 });
bookConversationSchema.index({ userId: 1, status: 1, updatedAt: -1 });
bookConversationSchema.index({ type: 1, status: 1 });
bookConversationSchema.index({ 'context.activeChapterId': 1 });
bookConversationSchema.index({ 'flags.isPinned': 1, updatedAt: -1 });
bookConversationSchema.index({ tags: 1 });

// Virtuals
bookConversationSchema.virtual('isActive').get(function () {
    return this.status === 'active';
});

bookConversationSchema.virtual('totalDuration').get(function () {
    return this.sessions.reduce((total, session) => total + (session.duration || 0), 0);
});

bookConversationSchema.virtual('averageSessionDuration').get(function () {
    const completedSessions = this.sessions.filter(s => s.duration);
    if (completedSessions.length === 0) return 0;
    return completedSessions.reduce((total, session) => total + session.duration, 0) / completedSessions.length;
});

bookConversationSchema.virtual('productivity').get(function () {
    // Calculate total duration from sessions
    const totalTime = this.sessions.reduce((total, session) => total + (session.duration || 0), 0);
    const totalWords = this.stats.wordsGenerated;
    return totalTime > 0 ? Math.round(totalWords / totalTime) : 0; // words per minute
});

bookConversationSchema.virtual('completionPercentage').get(function () {
    const achievedGoals = this.goals.specificTargets?.filter(g => g.achieved).length || 0;
    const totalGoals = this.goals.specificTargets?.length || 0;
    return totalGoals > 0 ? Math.round((achievedGoals / totalGoals) * 100) : 0;
});

// Methods
bookConversationSchema.methods.startSession = function (goals?: string[]) {
    const session = {
        startTime: new Date(),
        messageCount: 0,
        wordsGenerated: 0,
        goals: goals || [],
        accomplished: [],
        notes: ''
    };

    this.sessions.push(session);
    this.status = 'active';
    return this.save();
};

bookConversationSchema.methods.endSession = function (accomplished?: string[], notes?: string) {
    const currentSession = this.sessions[this.sessions.length - 1];
    if (currentSession && !currentSession.endTime) {
        currentSession.endTime = new Date();
        currentSession.duration = Math.round((currentSession.endTime.getTime() - currentSession.startTime.getTime()) / (1000 * 60));
        currentSession.accomplished = accomplished || [];
        currentSession.notes = notes || '';

        // Update total session time
        this.stats.totalSessionTime = (this.stats.totalSessionTime || 0) + currentSession.duration;
    }

    return this.save();
};

bookConversationSchema.methods.updateStats = function (updates: any) {
    Object.assign(this.stats, updates);
    this.stats.lastActivity = new Date();
    return this.save();
};

bookConversationSchema.methods.addRevisionRequest = function (revisionRequestId: string) {
    if (!this.relatedContent.revisionRequests.includes(revisionRequestId)) {
        this.relatedContent.revisionRequests.push(revisionRequestId);
        this.stats.revisionsRequested = (this.stats.revisionsRequested || 0) + 1;
    }
    return this.save();
};

bookConversationSchema.methods.updateContext = function (context: any) {
    Object.assign(this.context, context);
    return this.save();
};

bookConversationSchema.methods.addGoal = function (goal: any) {
    if (!this.goals.specificTargets) {
        this.goals.specificTargets = [];
    }
    this.goals.specificTargets.push(goal);
    return this.save();
};

bookConversationSchema.methods.achieveGoal = function (goalIndex: number) {
    if (this.goals.specificTargets && this.goals.specificTargets[goalIndex]) {
        this.goals.specificTargets[goalIndex].achieved = true;
        this.goals.specificTargets[goalIndex].achievedAt = new Date();
    }
    return this.save();
};

bookConversationSchema.methods.updateLastMessage = function (messageId: string, content: string, sender: 'user' | 'assistant') {
    this.lastMessage = {
        messageId,
        content: content.substring(0, 200),
        timestamp: new Date(),
        sender
    };
    this.stats.messageCount = (this.stats.messageCount || 0) + 1;
    this.stats.lastActivity = new Date();
    return this.save();
};

bookConversationSchema.methods.archive = function (reason?: string, userId?: string) {
    this.status = 'archived';
    this.archivedAt = new Date();
    this.archivedBy = userId;
    this.archiveReason = reason;
    return this.save();
};

bookConversationSchema.methods.getSummary = function () {
    return {
        id: this._id,
        title: this.title,
        type: this.type,
        messageCount: this.stats.messageCount,
        wordsGenerated: this.stats.wordsGenerated,
        duration: this.totalDuration,
        productivity: this.productivity,
        lastActivity: this.stats.lastActivity,
        status: this.status,
        goals: this.goals.specificTargets?.length || 0,
        goalsAchieved: this.goals.specificTargets?.filter(g => g.achieved).length || 0
    };
};

// Static methods
bookConversationSchema.statics.findByBook = function (bookId: string, options: any = {}) {
    const query = { bookId, status: { $ne: 'archived' } };

    if (options.status) {
        query.status = options.status;
    }

    let dbQuery = this.find(query);

    if (options.sortBy) {
        const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
        dbQuery = dbQuery.sort({ [options.sortBy]: sortOrder });
    } else {
        dbQuery = dbQuery.sort({ updatedAt: -1 });
    }

    if (options.limit) {
        dbQuery = dbQuery.limit(options.limit);
    }

    return dbQuery;
};

bookConversationSchema.statics.findActiveByUser = function (userId: string) {
    return this.find({
        userId,
        status: 'active'
    }).sort({ updatedAt: -1 });
};

bookConversationSchema.statics.getBookConversationStats = function (bookId: string) {
    return this.aggregate([
        { $match: { bookId } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalMessages: { $sum: '$stats.messageCount' },
                totalWords: { $sum: '$stats.wordsGenerated' },
                totalTime: { $sum: '$stats.totalSessionTime' }
            }
        }
    ]);
};

export const BookConversation = mongoose.model('BookConversation', bookConversationSchema);
export default BookConversation;
