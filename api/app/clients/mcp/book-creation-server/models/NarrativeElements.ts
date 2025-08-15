/**
 * Narrative Elements Model - Centralized database for story consistency
 */

import mongoose from 'mongoose';

// Character Evolution Schema - tracks character changes over time
const characterEvolutionSchema = new mongoose.Schema({
    characterId: { type: String, required: true, index: true },
    bookId: { type: String, required: true, index: true },
    conversationId: { type: String, required: true, index: true },
    version: { type: Number, required: true, default: 1 },
    
    // Core identity (should remain consistent)
    coreIdentity: {
        name: { type: String, required: true },
        role: { 
            type: String, 
            enum: ['protagonist', 'antagonist', 'supporting', 'minor', 'mentor', 'love_interest', 'comic_relief'],
            required: true 
        },
        age: { type: Number },
        gender: { type: String },
        species: { type: String, default: 'human' }
    },
    
    // Physical appearance (can evolve)
    physicalTraits: {
        height: { type: String },
        build: { type: String },
        hairColor: { type: String },
        hairStyle: { type: String },
        eyeColor: { type: String },
        skinTone: { type: String },
        distinctiveFeatures: [{ type: String }],
        clothing: {
            style: { type: String },
            colors: [{ type: String }],
            accessories: [{ type: String }]
        },
        scars: [{ 
            description: String, 
            location: String, 
            origin: String,
            acquiredIn: { chapterId: String, pageId: String }
        }]
    },
    
    // Personality traits (can develop)
    personality: {
        coreTraits: [{ type: String }], // fundamental personality
        currentMood: { type: String },
        values: [{ type: String }],
        fears: [{ type: String }],
        goals: [{ 
            description: String, 
            priority: { type: String, enum: ['primary', 'secondary', 'minor'] },
            status: { type: String, enum: ['active', 'achieved', 'abandoned', 'modified'] }
        }],
        flaws: [{ type: String }],
        strengths: [{ type: String }]
    },
    
    // Relationships (dynamic)
    relationships: [{
        targetCharacterId: { type: String, required: true },
        targetName: { type: String, required: true },
        relationshipType: { 
            type: String, 
            enum: ['family', 'romantic', 'friendship', 'rivalry', 'mentor', 'enemy', 'alliance', 'neutral']
        },
        strength: { type: Number, min: -10, max: 10 }, // -10 is hatred, +10 is deep love/loyalty
        status: { type: String, enum: ['stable', 'developing', 'deteriorating', 'complex'] },
        history: [{ 
            event: String, 
            chapterId: String, 
            pageId: String, 
            impactOnRelationship: String 
        }]
    }],
    
    // Skills and abilities (can grow)
    abilities: {
        skills: [{ 
            name: String, 
            level: { type: Number, min: 0, max: 10 },
            description: String 
        }],
        magicalAbilities: [{ 
            name: String, 
            power: { type: Number, min: 0, max: 10 },
            limitations: [String],
            description: String 
        }],
        knowledge: [{ 
            field: String, 
            expertise: { type: Number, min: 0, max: 10 },
            details: String 
        }]
    },
    
    // Character arc tracking
    arcProgression: {
        startingState: { type: String },
        currentState: { type: String },
        targetEndState: { type: String },
        milestones: [{ 
            description: String, 
            chapterId: String, 
            pageId: String, 
            achieved: { type: Boolean, default: false },
            impact: String 
        }],
        internalConflicts: [{ 
            description: String, 
            status: { type: String, enum: ['unresolved', 'developing', 'resolved'] }
        }]
    },
    
    // Tracking where character appears
    appearances: [{
        chapterId: { type: String, required: true },
        pageId: { type: String, required: true },
        sceneType: { type: String, enum: ['major', 'minor', 'mention', 'flashback'] },
        description: { type: String },
        significantEvents: [{ type: String }]
    }],
    
    // Changes made in this version
    changes: [{
        field: { type: String, required: true },
        oldValue: { type: String },
        newValue: { type: String },
        reason: { type: String },
        chapterId: { type: String },
        pageId: { type: String }
    }],
    
    lastModified: { type: Date, default: Date.now },
    modifiedBy: { type: String, enum: ['user', 'ai_generation', 'consistency_check'] }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// World Element Schema - tracks world building elements
const worldElementSchema = new mongoose.Schema({
    elementId: { type: String, required: true, unique: true, index: true },
    bookId: { type: String, required: true, index: true },
    conversationId: { type: String, required: true, index: true },
    
    // Basic information
    name: { type: String, required: true },
    type: { 
        type: String, 
        enum: ['location', 'culture', 'organization', 'rule', 'technology', 'magic_system', 'religion', 'language', 'currency', 'artifact'],
        required: true 
    },
    category: { type: String }, // subcategory like "tavern" for location type
    
    // Core description
    description: { type: String, required: true },
    
    // Visual details for consistency
    visualDetails: {
        appearance: { type: String },
        size: { type: String },
        colors: [{ type: String }],
        materials: [{ type: String }],
        atmosphere: { type: String },
        landmarks: [{ type: String }]
    },
    
    // Rules and properties
    properties: [{
        name: { type: String, required: true },
        value: { type: String, required: true },
        description: { type: String },
        exceptions: [{ type: String }]
    }],
    
    // Relationships with other elements
    connections: [{
        targetElementId: { type: String, required: true },
        targetName: { type: String, required: true },
        relationshipType: { 
            type: String, 
            enum: ['contains', 'adjacent_to', 'part_of', 'governed_by', 'conflicts_with', 'allied_with', 'depends_on']
        },
        description: { type: String }
    }],
    
    // Historical information
    history: [{
        period: { type: String },
        description: { type: String },
        significance: { type: String },
        changes: [{ type: String }]
    }],
    
    // Current state and changes
    currentState: {
        status: { type: String, enum: ['active', 'abandoned', 'destroyed', 'hidden', 'transformed'] },
        condition: { type: String },
        inhabitedBy: [{ type: String }], // character IDs
        controlledBy: { type: String }, // character or organization ID
        significance: { type: String, enum: ['major', 'moderate', 'minor'] }
    },
    
    // Tracking appearances in story
    appearances: [{
        chapterId: { type: String, required: true },
        pageId: { type: String, required: true },
        context: { type: String },
        description: { type: String },
        functionalRole: { type: String } // what purpose it served in the scene
    }],
    
    // Consistency rules
    consistencyRules: [{ 
        rule: { type: String, required: true },
        importance: { type: String, enum: ['critical', 'important', 'minor'] },
        violations: [{ 
            description: String, 
            chapterId: String, 
            pageId: String, 
            severity: { type: String, enum: ['critical', 'moderate', 'minor'] }
        }]
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Timeline Event Schema - tracks narrative chronology
const timelineEventSchema = new mongoose.Schema({
    eventId: { type: String, required: true, unique: true, index: true },
    bookId: { type: String, required: true, index: true },
    conversationId: { type: String, required: true, index: true },
    
    // Event details
    name: { type: String, required: true },
    description: { type: String, required: true },
    type: { 
        type: String, 
        enum: ['plot_point', 'character_development', 'world_change', 'relationship_change', 'conflict', 'resolution'],
        required: true 
    },
    
    // Timing information
    timing: {
        absoluteTime: { type: String }, // "Year 1203, Third Month"
        relativeTime: { type: String }, // "Three days after the festival"
        sequenceNumber: { type: Number, required: true }, // for ordering events
        duration: { type: String }, // how long the event lasted
        timeOfDay: { type: String, enum: ['dawn', 'morning', 'midday', 'afternoon', 'evening', 'night', 'midnight'] }
    },
    
    // Location and participants
    location: {
        elementId: { type: String }, // reference to world element
        locationName: { type: String },
        specificPlace: { type: String } // "the library's restricted section"
    },
    
    participants: [{
        characterId: { type: String, required: true },
        characterName: { type: String, required: true },
        role: { type: String, enum: ['protagonist', 'instigator', 'victim', 'witness', 'catalyst'] },
        presence: { type: String, enum: ['physical', 'mentioned', 'implied', 'flashback'] }
    }],
    
    // Cause and effect
    causality: {
        causes: [{ 
            eventId: String, 
            description: String,
            strength: { type: String, enum: ['direct', 'indirect', 'contributing'] }
        }],
        effects: [{ 
            eventId: String, 
            description: String,
            timeframe: String, // "immediate", "days later", etc.
            certainty: { type: String, enum: ['certain', 'likely', 'possible'] }
        }]
    },
    
    // Story impact
    impact: {
        plotSignificance: { type: String, enum: ['major', 'moderate', 'minor'] },
        characterChanges: [{ 
            characterId: String, 
            changeType: String, 
            description: String 
        }],
        worldChanges: [{ 
            elementId: String, 
            changeType: String, 
            description: String 
        }],
        relationshipChanges: [{ 
            character1: String, 
            character2: String, 
            change: String 
        }]
    },
    
    // Story placement
    storyPlacement: {
        chapterId: { type: String, required: true },
        pageId: { type: String, required: true },
        scenePosition: { type: String, enum: ['opening', 'middle', 'climax', 'resolution'] }
    },
    
    // Foreshadowing and callbacks
    narrativeConnections: {
        foreshadowedBy: [{ 
            chapterId: String, 
            pageId: String, 
            description: String 
        }],
        foreshadows: [{ 
            futureEventId: String, 
            subtlety: { type: String, enum: ['obvious', 'subtle', 'hidden'] }
        }],
        callbacks: [{ 
            pastEventId: String, 
            description: String 
        }]
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Consistency Violation Schema - tracks and manages inconsistencies
const consistencyViolationSchema = new mongoose.Schema({
    violationId: { type: String, required: true, unique: true, index: true },
    bookId: { type: String, required: true, index: true },
    conversationId: { type: String, required: true, index: true },
    
    // Violation details
    type: { 
        type: String, 
        enum: ['character_inconsistency', 'world_rule_violation', 'timeline_conflict', 'relationship_error', 'plot_hole'],
        required: true 
    },
    severity: { type: String, enum: ['critical', 'major', 'minor'], required: true },
    
    description: { type: String, required: true },
    conflictingElements: [{
        type: { type: String, enum: ['character', 'world_element', 'timeline_event'] },
        elementId: { type: String, required: true },
        elementName: { type: String, required: true },
        conflictDescription: { type: String }
    }],
    
    // Location of violations
    occurrences: [{
        chapterId: { type: String, required: true },
        pageId: { type: String, required: true },
        context: { type: String },
        specificText: { type: String }
    }],
    
    // Resolution
    status: { 
        type: String, 
        enum: ['detected', 'under_review', 'resolved', 'dismissed', 'deferred'], 
        default: 'detected' 
    },
    
    resolutionPlan: { type: String },
    resolutionActions: [{
        action: { type: String, required: true },
        targetElement: { type: String },
        description: { type: String },
        completed: { type: Boolean, default: false }
    }],
    
    detectedBy: { type: String, enum: ['ai_analysis', 'user_report', 'consistency_check'] },
    resolvedBy: { type: String },
    
    notes: [{ 
        author: String, 
        content: String, 
        timestamp: { type: Date, default: Date.now } 
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
characterEvolutionSchema.index({ bookId: 1, characterId: 1, version: -1 });
characterEvolutionSchema.index({ 'appearances.chapterId': 1 });
characterEvolutionSchema.index({ 'appearances.pageId': 1 });

worldElementSchema.index({ bookId: 1, type: 1 });
worldElementSchema.index({ 'appearances.chapterId': 1 });
worldElementSchema.index({ 'connections.targetElementId': 1 });

timelineEventSchema.index({ bookId: 1, 'timing.sequenceNumber': 1 });
timelineEventSchema.index({ 'storyPlacement.chapterId': 1 });
timelineEventSchema.index({ 'participants.characterId': 1 });

consistencyViolationSchema.index({ bookId: 1, status: 1, severity: 1 });
consistencyViolationSchema.index({ type: 1, status: 1 });

export const CharacterEvolution = mongoose.model('CharacterEvolution', characterEvolutionSchema);
export const WorldElement = mongoose.model('WorldElement', worldElementSchema);
export const TimelineEvent = mongoose.model('TimelineEvent', timelineEventSchema);
export const ConsistencyViolation = mongoose.model('ConsistencyViolation', consistencyViolationSchema);

export {
    characterEvolutionSchema,
    worldElementSchema,
    timelineEventSchema,
    consistencyViolationSchema
};
