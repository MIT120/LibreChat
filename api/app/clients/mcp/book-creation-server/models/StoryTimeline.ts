/**
 * Story Timeline Model - Visual timeline system for story events and character arcs
 */

import mongoose from 'mongoose';

// Timeline marker sub-schema
const timelineMarkerSchema = new mongoose.Schema({
    id: { type: String, required: true },
    type: {
        type: String,
        enum: ['plot_point', 'character_event', 'world_event', 'conflict', 'resolution', 'milestone'],
        required: true
    },
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, maxlength: 500 },
    chapterId: { type: String, ref: 'Chapter' },
    pageId: { type: String, ref: 'Page' },
    position: { type: Number, required: true, min: 0 }, // Timeline position (0-100)
    color: { type: String, default: '#4b7bec' },
    icon: { type: String, default: 'circle' },
    participants: [{
        characterId: { type: String, required: true },
        role: { type: String, enum: ['protagonist', 'antagonist', 'witness', 'catalyst', 'victim', 'instigator'] }
    }],
    consequences: [{ type: String }],
    importance: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    tags: [{ type: String }],
    visibility: {
        showInOutline: { type: Boolean, default: true },
        showInWriting: { type: Boolean, default: false },
        showInExport: { type: Boolean, default: true }
    }
}, { _id: false });

// Plot arc sub-schema
const plotArcSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true, maxlength: 100 },
    description: { type: String, maxlength: 500 },
    type: {
        type: String,
        enum: ['main', 'subplot', 'character_arc', 'relationship_arc', 'mystery', 'romance'],
        default: 'subplot'
    },
    startPosition: { type: Number, required: true, min: 0, max: 100 },
    endPosition: { type: Number, required: true, min: 0, max: 100 },
    color: { type: String, default: '#20bf6b' },
    tension: {
        start: { type: Number, min: 0, max: 10, default: 1 },
        peak: { type: Number, min: 0, max: 10, default: 8 },
        end: { type: Number, min: 0, max: 10, default: 2 }
    },
    milestones: [{
        position: { type: Number, required: true },
        title: { type: String, required: true },
        description: { type: String },
        achieved: { type: Boolean, default: false }
    }],
    characters: [{
        characterId: { type: String, required: true },
        importance: { type: String, enum: ['primary', 'secondary', 'minor'], default: 'secondary' }
    }]
}, { _id: false });

// Character arc marker sub-schema
const characterArcMarkerSchema = new mongoose.Schema({
    id: { type: String, required: true },
    characterId: { type: String, required: true },
    characterName: { type: String, required: true },
    position: { type: Number, required: true, min: 0, max: 100 },
    eventType: {
        type: String,
        enum: ['introduction', 'development', 'conflict', 'growth', 'setback', 'revelation', 'transformation'],
        required: true
    },
    title: { type: String, required: true },
    description: { type: String },
    emotionalState: {
        before: { type: String },
        after: { type: String }
    },
    relationships: [{
        withCharacter: { type: String, required: true },
        changeType: { type: String, enum: ['strengthened', 'weakened', 'changed', 'formed', 'broken'] },
        description: { type: String }
    }],
    skills: [{
        name: { type: String, required: true },
        changeType: { type: String, enum: ['gained', 'improved', 'lost', 'discovered'] },
        level: { type: Number, min: 0, max: 10 }
    }],
    color: { type: String, default: '#8854d0' }
}, { _id: false });

// Timeline settings sub-schema
const timelineSettingsSchema = new mongoose.Schema({
    scale: { type: String, enum: ['chapter', 'scene', 'page', 'custom'], default: 'chapter' },
    showCharacters: { type: Boolean, default: true },
    showPlotArcs: { type: Boolean, default: true },
    showRelationships: { type: Boolean, default: false },
    showTension: { type: Boolean, default: true },
    groupBy: { type: String, enum: ['chronological', 'character', 'plotline', 'location'], default: 'chronological' },
    filters: {
        eventTypes: [{ type: String }],
        characters: [{ type: String }],
        plotArcs: [{ type: String }],
        importanceLevel: [{ type: String }]
    },
    view: {
        zoom: { type: Number, min: 0.1, max: 5, default: 1 },
        centerPosition: { type: Number, min: 0, max: 100, default: 0 },
        showMinimap: { type: Boolean, default: true },
        showGrid: { type: Boolean, default: true }
    }
}, { _id: false });

// Main timeline schema
const storyTimelineSchema = new mongoose.Schema({
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
    name: {
        type: String,
        default: 'Main Timeline',
        maxlength: 100
    },
    description: {
        type: String,
        maxlength: 500
    },
    events: [timelineMarkerSchema],
    plotArcs: [plotArcSchema],
    characterArcs: [characterArcMarkerSchema],
    settings: {
        type: timelineSettingsSchema,
        default: () => ({})
    },
    metadata: {
        totalEvents: { type: Number, default: 0 },
        totalPlotArcs: { type: Number, default: 0 },
        totalCharacterArcs: { type: Number, default: 0 },
        timelineSpan: {
            start: { type: String }, // "Chapter 1" or custom format
            end: { type: String }    // "Chapter 20" or custom format
        },
        lastCalculated: { type: Date, default: Date.now }
    },
    isTemplate: { type: Boolean, default: false },
    templateCategory: { type: String }, // 'hero_journey', 'three_act', 'save_the_cat', etc.
}, {
    _id: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
storyTimelineSchema.index({ bookId: 1 });
storyTimelineSchema.index({ 'events.chapterId': 1 });
storyTimelineSchema.index({ 'events.pageId': 1 });
storyTimelineSchema.index({ 'events.participants.characterId': 1 });

// Virtuals
storyTimelineSchema.virtual('totalElements').get(function () {
    return (this.events?.length || 0) + (this.plotArcs?.length || 0) + (this.characterArcs?.length || 0);
});

storyTimelineSchema.virtual('timelineProgress').get(function () {
    if (!this.events || this.events.length === 0) return 0;
    const maxPosition = Math.max(...this.events.map(e => e.position));
    return Math.min(maxPosition, 100);
});

// Methods
storyTimelineSchema.methods.addEvent = function (eventData: any) {
    const newEvent = {
        id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...eventData
    };
    this.events.push(newEvent);
    this.metadata.totalEvents = this.events.length;
    this.metadata.lastCalculated = new Date();
    return this.save();
};

storyTimelineSchema.methods.addPlotArc = function (arcData: any) {
    const newArc = {
        id: `arc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...arcData
    };
    this.plotArcs.push(newArc);
    this.metadata.totalPlotArcs = this.plotArcs.length;
    this.metadata.lastCalculated = new Date();
    return this.save();
};

storyTimelineSchema.methods.addCharacterArc = function (characterArcData: any) {
    const newCharacterArc = {
        id: `char_arc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...characterArcData
    };
    this.characterArcs.push(newCharacterArc);
    this.metadata.totalCharacterArcs = this.characterArcs.length;
    this.metadata.lastCalculated = new Date();
    return this.save();
};

storyTimelineSchema.methods.getEventsByChapter = function (chapterId: string) {
    return this.events.filter(event => event.chapterId === chapterId);
};

storyTimelineSchema.methods.getEventsByCharacter = function (characterId: string) {
    return this.events.filter(event =>
        event.participants.some(p => p.characterId === characterId)
    );
};

storyTimelineSchema.methods.updateEventPosition = function (eventId: string, newPosition: number) {
    const event = this.events.find(e => e.id === eventId);
    if (event) {
        event.position = newPosition;
        this.metadata.lastCalculated = new Date();
        return this.save();
    }
    return Promise.reject(new Error('Event not found'));
};

export const StoryTimeline = mongoose.model('StoryTimeline', storyTimelineSchema);
export default StoryTimeline;
