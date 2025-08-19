/**
 * Scene Plan Model - Planning and organization system for individual scenes
 */

import mongoose from 'mongoose';

// Participant sub-schema
const participantSchema = new mongoose.Schema({
    characterId: { type: String, required: true },
    characterName: { type: String, required: true },
    role: {
        type: String,
        enum: ['protagonist', 'antagonist', 'supporting', 'witness', 'catalyst', 'victim', 'mentor'],
        default: 'supporting'
    },
    presence: {
        type: String,
        enum: ['physically_present', 'mentioned', 'implied', 'flashback', 'dream', 'vision'],
        default: 'physically_present'
    },
    goals: [{
        description: { type: String, required: true },
        priority: { type: String, enum: ['primary', 'secondary', 'hidden'], default: 'primary' },
        achieved: { type: Boolean, default: false }
    }],
    conflicts: [{
        type: { type: String, enum: ['internal', 'interpersonal', 'external', 'moral'], required: true },
        description: { type: String, required: true },
        intensity: { type: Number, min: 1, max: 10, default: 5 },
        resolved: { type: Boolean, default: false }
    }],
    emotions: [{
        emotion: { type: String, required: true },
        intensity: { type: Number, min: 1, max: 10, default: 5 },
        trigger: { type: String }
    }],
    development: {
        characterGrowth: { type: String },
        relationshipChanges: [{
            withCharacter: { type: String, required: true },
            changeType: { type: String, enum: ['strengthened', 'weakened', 'complicated', 'new', 'ended'] },
            description: { type: String }
        }],
        skillsLearned: [{ type: String }],
        revelations: [{ type: String }]
    }
}, { _id: false });

// Setting sub-schema
const settingSchema = new mongoose.Schema({
    locationId: { type: String, ref: 'WorldElement' },
    locationName: { type: String, required: true },
    specificPlace: { type: String }, // "the library's restricted section"
    timeOfDay: {
        type: String,
        enum: ['dawn', 'morning', 'midday', 'afternoon', 'evening', 'dusk', 'night', 'midnight', 'unknown'],
        default: 'unknown'
    },
    weather: {
        type: String,
        enum: ['clear', 'cloudy', 'rainy', 'stormy', 'snowy', 'foggy', 'windy', 'hot', 'cold', 'unknown'],
        default: 'unknown'
    },
    season: {
        type: String,
        enum: ['spring', 'summer', 'autumn', 'winter', 'unknown'],
        default: 'unknown'
    },
    atmosphere: { type: String },
    mood: {
        type: String,
        enum: ['tense', 'peaceful', 'mysterious', 'romantic', 'threatening', 'cheerful', 'melancholy', 'dramatic'],
        default: 'peaceful'
    },
    lighting: { type: String },
    sounds: [{ type: String }],
    smells: [{ type: String }],
    visualDetails: [{ type: String }]
}, { _id: false });

// Plot elements sub-schema
const plotElementsSchema = new mongoose.Schema({
    arcIds: [{ type: String }], // Reference to plot arcs
    arcNames: [{ type: String }],
    purpose: {
        type: String,
        enum: ['setup', 'development', 'climax', 'resolution', 'transition', 'reveal', 'foreshadowing'],
        required: true
    },
    tension: { type: Number, min: 0, max: 10, default: 5 },
    pacing: {
        type: String,
        enum: ['very_slow', 'slow', 'medium', 'fast', 'very_fast'],
        default: 'medium'
    },
    stakes: { type: String, required: true },
    obstacles: [{
        description: { type: String, required: true },
        type: { type: String, enum: ['physical', 'emotional', 'social', 'moral', 'intellectual'] },
        difficulty: { type: Number, min: 1, max: 10, default: 5 }
    }],
    revelations: [{
        description: { type: String, required: true },
        impact: { type: String, enum: ['minor', 'moderate', 'major', 'game_changing'], default: 'moderate' },
        foreshadowed: { type: Boolean, default: false }
    }],
    consequences: [{ type: String }]
}, { _id: false });

// Scene structure sub-schema
const sceneStructureSchema = new mongoose.Schema({
    hook: {
        description: { type: String, required: true },
        type: { type: String, enum: ['action', 'dialogue', 'mystery', 'conflict', 'revelation'] }
    },
    development: {
        description: { type: String, required: true },
        keyBeats: [{
            description: { type: String, required: true },
            emotionalBeat: { type: String },
            plotFunction: { type: String }
        }]
    },
    climax: {
        description: { type: String, required: true },
        type: { type: String, enum: ['action', 'emotional', 'revelation', 'decision', 'confrontation'] },
        intensity: { type: Number, min: 1, max: 10, default: 7 }
    },
    resolution: {
        description: { type: String, required: true },
        consequences: [{ type: String }],
        transitions: [{
            to: { type: String }, // next scene/chapter
            method: { type: String, enum: ['direct', 'time_jump', 'location_change', 'pov_shift'] }
        }]
    },
    subtext: { type: String },
    symbolism: [{
        symbol: { type: String, required: true },
        meaning: { type: String, required: true }
    }]
}, { _id: false });

// Writing notes sub-schema
const writingNotesSchema = new mongoose.Schema({
    premise: { type: String },
    conflict: { type: String },
    outcome: { type: String },
    theme: { type: String },
    tone: { type: String },
    pov: {
        type: String,
        enum: ['first_person', 'second_person', 'third_limited', 'third_omniscient', 'multiple'],
        default: 'third_limited'
    },
    narrativeStyle: { type: String },
    specialInstructions: [{ type: String }],
    researchNeeded: [{
        topic: { type: String, required: true },
        priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
        status: { type: String, enum: ['needed', 'in_progress', 'completed'], default: 'needed' }
    }],
    continuityNotes: [{ type: String }],
    revisionNotes: [{
        note: { type: String, required: true },
        priority: { type: String, enum: ['minor', 'major', 'critical'], default: 'minor' },
        status: { type: String, enum: ['open', 'addressed', 'resolved'], default: 'open' },
        createdAt: { type: Date, default: Date.now }
    }]
}, { _id: false });

// Main scene plan schema
const scenePlanSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
    },
    bookId: {
        type: String,
        required: true,
        ref: 'Book',
        index: true
    },
    chapterId: {
        type: String,
        required: true,
        ref: 'Chapter',
        index: true
    },
    pageId: {
        type: String,
        ref: 'Page' // Set when scene is actually written
    },
    sceneNumber: {
        type: Number,
        required: true,
        min: 1
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    purpose: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    participants: [participantSchema],
    setting: {
        type: settingSchema,
        required: true
    },
    plotElements: {
        type: plotElementsSchema,
        required: true
    },
    structure: {
        type: sceneStructureSchema,
        required: true
    },
    writingNotes: {
        type: writingNotesSchema,
        default: () => ({})
    },
    status: {
        type: String,
        enum: ['planned', 'outlined', 'drafted', 'revised', 'reviewed', 'approved', 'published'],
        default: 'planned',
        index: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    estimatedWordCount: {
        type: Number,
        min: 0,
        default: 1000
    },
    actualWordCount: {
        type: Number,
        min: 0,
        default: 0
    },
    tags: [{ type: String, trim: true }],
    dependencies: [{
        sceneId: { type: String, required: true },
        relationship: { type: String, enum: ['must_come_before', 'must_come_after', 'parallel', 'alternative'] },
        description: { type: String }
    }],
    timeline: {
        plannedDate: { type: Date },
        startedDate: { type: Date },
        completedDate: { type: Date },
        deadline: { type: Date }
    },
    collaborators: [{
        userId: { type: String, required: true },
        role: { type: String, enum: ['writer', 'reviewer', 'editor'], required: true },
        assignedAt: { type: Date, default: Date.now }
    }]
}, {
    _id: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
scenePlanSchema.index({ bookId: 1, chapterId: 1, sceneNumber: 1 });
scenePlanSchema.index({ status: 1, priority: 1 });
scenePlanSchema.index({ 'participants.characterId': 1 });
scenePlanSchema.index({ 'plotElements.arcIds': 1 });
scenePlanSchema.index({ tags: 1 });
scenePlanSchema.index({ 'timeline.deadline': 1 });

// Virtuals
scenePlanSchema.virtual('isComplete').get(function () {
    return this.status === 'approved' || this.status === 'published';
});

scenePlanSchema.virtual('isOverdue').get(function () {
    // Check if overdue based on status - note: 'completed' is not in the enum, using 'published' as complete
    const isComplete = this.status === 'published';
    return this.timeline?.deadline && new Date() > this.timeline.deadline && !isComplete;
});

scenePlanSchema.virtual('progressPercentage').get(function () {
    if (!this.estimatedWordCount || this.estimatedWordCount === 0) return 0;
    return Math.min((this.actualWordCount / this.estimatedWordCount) * 100, 100);
});

scenePlanSchema.virtual('participantCount').get(function () {
    return this.participants?.length || 0;
});

scenePlanSchema.virtual('conflictCount').get(function () {
    return this.participants?.reduce((total, p) => total + (p.conflicts?.length || 0), 0) || 0;
});

// Methods
scenePlanSchema.methods.addParticipant = function (participantData: any) {
    if (!this.participants.some(p => p.characterId === participantData.characterId)) {
        this.participants.push(participantData);
        return this.save();
    }
    return Promise.resolve(this);
};

scenePlanSchema.methods.removeParticipant = function (characterId: string) {
    this.participants = this.participants.filter(p => p.characterId !== characterId);
    return this.save();
};

scenePlanSchema.methods.updateStatus = function (newStatus: string, userId?: string) {
    const oldStatus = this.status;
    this.status = newStatus;

    // Update timeline
    if (newStatus === 'drafted' && !this.timeline.startedDate) {
        this.timeline.startedDate = new Date();
    } else if (['approved', 'published'].includes(newStatus) && !this.timeline.completedDate) {
        this.timeline.completedDate = new Date();
    }

    return this.save();
};

scenePlanSchema.methods.calculateTensionCurve = function () {
    const beats = this.structure?.development?.keyBeats || [];
    const climaxTension = this.structure?.climax?.intensity || 7;
    const baseTension = this.plotElements?.tension || 5;

    // Simple tension curve calculation
    const curve = [baseTension];
    beats.forEach((_, index) => {
        const progress = (index + 1) / (beats.length + 1);
        const tension = baseTension + (climaxTension - baseTension) * progress;
        curve.push(tension);
    });
    curve.push(climaxTension);
    curve.push(Math.max(1, baseTension - 2)); // Resolution lower than start

    return curve;
};

export const ScenePlan = mongoose.model('ScenePlan', scenePlanSchema);
export default ScenePlan;
