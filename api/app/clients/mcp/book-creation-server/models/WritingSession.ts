/**
 * Writing Session Model - Tracks writing sessions and productivity analytics
 */

import mongoose from 'mongoose';

// Writing goals sub-schema
const writingGoalsSchema = new mongoose.Schema({
    wordTarget: { type: Number, min: 0, default: 500 },
    timeTarget: { type: Number, min: 0, default: 60 }, // minutes
    pageTarget: { type: Number, min: 0 },
    sceneTarget: { type: Number, min: 0 },
    customGoals: [{
        name: { type: String, required: true },
        target: { type: Number, required: true },
        unit: { type: String, enum: ['words', 'pages', 'scenes', 'characters', 'minutes'], required: true },
        achieved: { type: Boolean, default: false }
    }],
    achieved: { type: Boolean, default: false },
    achievedAt: { type: Date }
}, { _id: false });

// Environment sub-schema
const environmentSchema = new mongoose.Schema({
    location: { type: String, default: 'home' },
    device: { type: String, enum: ['desktop', 'laptop', 'tablet', 'phone', 'other'], default: 'laptop' },
    writingTool: { type: String, default: 'web_app' },
    distractionLevel: { type: Number, min: 1, max: 10, default: 5 },
    noiseLevel: { type: String, enum: ['silent', 'quiet', 'moderate', 'noisy'], default: 'quiet' },
    mood: {
        type: String,
        enum: ['motivated', 'neutral', 'struggling', 'inspired', 'tired', 'focused', 'distracted'],
        default: 'neutral'
    },
    energyLevel: { type: Number, min: 1, max: 10, default: 5 },
    notes: { type: String }
}, { _id: false });

// Productivity metrics sub-schema
const productivitySchema = new mongoose.Schema({
    wpm: { type: Number, min: 0, default: 0 }, // words per minute
    cpm: { type: Number, min: 0, default: 0 }, // characters per minute
    totalBreaks: { type: Number, min: 0, default: 0 },
    longestWritingStreak: { type: Number, min: 0, default: 0 }, // minutes without break
    revisions: { type: Number, min: 0, default: 0 },
    deletions: { type: Number, min: 0, default: 0 },
    flowState: {
        achieved: { type: Boolean, default: false },
        duration: { type: Number, min: 0, default: 0 }, // minutes in flow
        triggers: [{ type: String }]
    },
    efficiency: { type: Number, min: 0, max: 100, default: 0 }, // percentage
    focus: { type: Number, min: 1, max: 10, default: 5 },
    satisfaction: { type: Number, min: 1, max: 10, default: 5 }
}, { _id: false });

// Content created sub-schema
const contentCreatedSchema = new mongoose.Schema({
    pagesCreated: [{
        pageId: { type: String, required: true },
        pageTitle: { type: String, required: true },
        wordsWritten: { type: Number, min: 0, default: 0 },
        startTime: { type: Date },
        endTime: { type: Date }
    }],
    pagesEdited: [{
        pageId: { type: String, required: true },
        pageTitle: { type: String, required: true },
        wordsAdded: { type: Number, default: 0 },
        wordsDeleted: { type: Number, default: 0 },
        wordsNetChange: { type: Number, default: 0 },
        editTime: { type: Number, min: 0, default: 0 } // minutes spent editing
    }],
    chaptersWorkedOn: [{
        chapterId: { type: String, required: true },
        chapterTitle: { type: String, required: true },
        timeSpent: { type: Number, min: 0, default: 0 } // minutes
    }],
    scenesPlanned: [{
        sceneId: { type: String, required: true },
        sceneTitle: { type: String, required: true },
        timeSpent: { type: Number, min: 0, default: 0 }
    }],
    researchItems: [{
        itemId: { type: String, required: true },
        itemTitle: { type: String, required: true },
        timeSpent: { type: Number, min: 0, default: 0 }
    }]
}, { _id: false });

// Session interruptions sub-schema
const interruptionsSchema = new mongoose.Schema({
    breaks: [{
        startTime: { type: Date, required: true },
        endTime: { type: Date },
        duration: { type: Number, min: 0 }, // minutes
        reason: { type: String, enum: ['planned', 'fatigue', 'distraction', 'external', 'research', 'other'] },
        notes: { type: String }
    }],
    distractions: [{
        time: { type: Date, required: true },
        type: { type: String, enum: ['notification', 'person', 'noise', 'thought', 'internet', 'other'] },
        severity: { type: Number, min: 1, max: 5 },
        duration: { type: Number, min: 0 }, // minutes lost
        notes: { type: String }
    }],
    technicalIssues: [{
        time: { type: Date, required: true },
        type: { type: String, enum: ['app_crash', 'connection', 'sync_issue', 'performance', 'other'] },
        severity: { type: Number, min: 1, max: 5 },
        resolution: { type: String },
        timeToResolve: { type: Number, min: 0 } // minutes
    }]
}, { _id: false });

// Main writing session schema
const writingSessionSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    workspaceId: {
        type: String,
        required: true,
        ref: 'ProjectWorkspace',
        index: true
    },
    bookId: {
        type: String,
        required: true,
        ref: 'Book',
        index: true
    },
    sessionType: {
        type: String,
        enum: ['writing', 'editing', 'planning', 'research', 'review', 'mixed'],
        default: 'writing'
    },
    startTime: {
        type: Date,
        required: true,
        index: true
    },
    endTime: {
        type: Date,
        index: true
    },
    actualDuration: { type: Number, min: 0 }, // minutes, calculated
    activeDuration: { type: Number, min: 0 }, // minutes actually writing (excluding breaks)

    // Core metrics
    wordsWritten: { type: Number, min: 0, default: 0 },
    wordsEdited: { type: Number, min: 0, default: 0 },
    wordsDeleted: { type: Number, min: 0, default: 0 },
    netWordChange: { type: Number, default: 0 },
    charactersTyped: { type: Number, min: 0, default: 0 },

    goals: {
        type: writingGoalsSchema,
        required: true
    },
    environment: {
        type: environmentSchema,
        default: () => ({})
    },
    productivity: {
        type: productivitySchema,
        default: () => ({})
    },
    contentCreated: {
        type: contentCreatedSchema,
        default: () => ({})
    },
    interruptions: {
        type: interruptionsSchema,
        default: () => ({})
    },

    // Session quality
    qualityRating: { type: Number, min: 1, max: 10 },
    difficultyRating: { type: Number, min: 1, max: 10 },
    enjoymentRating: { type: Number, min: 1, max: 10 },

    // Notes and reflections
    notes: { type: String },
    challenges: [{ type: String }],
    breakthroughs: [{ type: String }],
    learnings: [{ type: String }],
    tomorrowPlan: { type: String },

    // Session context
    timeOfDay: {
        type: String,
        enum: ['early_morning', 'morning', 'midday', 'afternoon', 'evening', 'night', 'late_night'],
        required: true
    },
    dayOfWeek: {
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        required: true
    },
    isWeekend: { type: Boolean, default: false },
    isPlanned: { type: Boolean, default: false },

    // Streaks and patterns
    streakData: {
        isDailyGoalMet: { type: Boolean, default: false },
        isPartOfStreak: { type: Boolean, default: false },
        currentStreakLength: { type: Number, min: 0, default: 0 },
        streakType: { type: String, enum: ['daily_words', 'daily_time', 'weekly_goal', 'custom'] }
    },

    // Analysis
    automated: {
        isAnalyzed: { type: Boolean, default: false },
        analyzedAt: { type: Date },
        insights: [{
            type: { type: String, enum: ['pattern', 'improvement', 'concern', 'achievement'] },
            description: { type: String },
            confidence: { type: Number, min: 0, max: 100 }
        }],
        recommendations: [{ type: String }]
    }
}, {
    _id: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
writingSessionSchema.index({ userId: 1, startTime: -1 });
writingSessionSchema.index({ bookId: 1, startTime: -1 });
writingSessionSchema.index({ sessionType: 1, startTime: -1 });
writingSessionSchema.index({ 'goals.achieved': 1 });
writingSessionSchema.index({ timeOfDay: 1, dayOfWeek: 1 });
writingSessionSchema.index({ 'streakData.isPartOfStreak': 1 });

// Virtuals
writingSessionSchema.virtual('isActive').get(function () {
    return !this.endTime;
});

writingSessionSchema.virtual('duration').get(function () {
    if (!this.endTime) return null;
    return Math.round((this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60)); // minutes
});

writingSessionSchema.virtual('averageWPM').get(function () {
    if (!this.activeDuration || this.activeDuration === 0) return 0;
    return Math.round(this.wordsWritten / this.activeDuration);
});

writingSessionSchema.virtual('efficiency').get(function () {
    if (!this.actualDuration || this.actualDuration === 0) return 0;
    return Math.round((this.activeDuration / this.actualDuration) * 100);
});

writingSessionSchema.virtual('goalAchievement').get(function () {
    const goals = this.goals;
    let achieved = 0;
    let total = 0;

    if (goals.wordTarget > 0) {
        total++;
        if (this.wordsWritten >= goals.wordTarget) achieved++;
    }

    if (goals.timeTarget > 0) {
        total++;
        if (this.activeDuration >= goals.timeTarget) achieved++;
    }

    if (goals.pageTarget > 0) {
        total++;
        if (this.contentCreated.pagesCreated.length >= goals.pageTarget) achieved++;
    }

    return total > 0 ? Math.round((achieved / total) * 100) : 0;
});

// Methods
writingSessionSchema.methods.endSession = function () {
    if (!this.endTime) {
        this.endTime = new Date();
        this.actualDuration = Math.round((this.endTime.getTime() - this.startTime.getTime()) / (1000 * 60));

        // Calculate if goals were achieved
        this.goals.achieved = this.goalAchievement >= 100;
        if (this.goals.achieved) {
            this.goals.achievedAt = this.endTime;
        }

        // Update productivity metrics
        this.productivity.wpm = this.averageWPM;
        this.productivity.efficiency = this.efficiency;

        // Calculate net word change
        this.netWordChange = this.wordsWritten - this.wordsDeleted;
    }
    return this.save();
};

writingSessionSchema.methods.addBreak = function (startTime: Date, reason?: string, notes?: string) {
    this.interruptions.breaks.push({
        startTime,
        reason: reason || 'planned',
        notes
    });
    return this.save();
};

writingSessionSchema.methods.endBreak = function () {
    const breaks = this.interruptions.breaks;
    const lastBreak = breaks[breaks.length - 1];

    if (lastBreak && !lastBreak.endTime) {
        lastBreak.endTime = new Date();
        lastBreak.duration = Math.round((lastBreak.endTime.getTime() - lastBreak.startTime.getTime()) / (1000 * 60));

        // Update active duration
        const totalBreakTime = breaks.reduce((total, b) => total + (b.duration || 0), 0);
        this.activeDuration = Math.max(0, (this.actualDuration || 0) - totalBreakTime);
    }

    return this.save();
};

writingSessionSchema.methods.addPageCreated = function (pageId: string, pageTitle: string, wordsWritten: number) {
    this.contentCreated.pagesCreated.push({
        pageId,
        pageTitle,
        wordsWritten,
        startTime: new Date(),
        endTime: new Date()
    });

    this.wordsWritten += wordsWritten;
    return this.save();
};

writingSessionSchema.methods.calculateInsights = function () {
    const insights = [];

    // Performance insights
    if (this.averageWPM > 50) {
        insights.push({
            type: 'achievement',
            description: 'High writing speed achieved',
            confidence: 85
        });
    }

    if (this.efficiency > 80) {
        insights.push({
            type: 'achievement',
            description: 'High focus efficiency maintained',
            confidence: 90
        });
    }

    if (this.interruptions.breaks.length > 5) {
        insights.push({
            type: 'concern',
            description: 'Frequent breaks may indicate fatigue or distractions',
            confidence: 70
        });
    }

    // Goal achievement
    if (this.goalAchievement >= 100) {
        insights.push({
            type: 'achievement',
            description: 'All session goals achieved',
            confidence: 100
        });
    }

    this.automated.insights = insights;
    this.automated.isAnalyzed = true;
    this.automated.analyzedAt = new Date();

    return this.save();
};

export const WritingSession = mongoose.model('WritingSession', writingSessionSchema);
export default WritingSession;
