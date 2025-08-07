import mongoose from 'mongoose';

// Sub-schema for relationship evolution over time
const RelationshipEvolutionSchema = new mongoose.Schema(
    {
        chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
        pageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page' },
        evolutionType: {
            type: String,
            enum: ['strengthened', 'weakened', 'changed_type', 'conflict', 'resolution', 'new_dynamic'],
        },
        previousStrength: { type: Number, min: 1, max: 10 },
        newStrength: { type: Number, min: 1, max: 10 },
        description: String,
        significance: String,
        timestamp: { type: Date, default: Date.now },
    },
    { _id: false },
);

// Sub-schema for relationship conflicts
const ConflictSchema = new mongoose.Schema(
    {
        conflictType: {
            type: String,
            enum: [
                'ideological',
                'personal',
                'professional',
                'romantic',
                'family',
                'resource',
                'loyalty',
                'misunderstanding',
            ],
        },
        severity: { type: Number, min: 1, max: 10, default: 5 },
        description: String,
        startChapter: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
        startPage: { type: mongoose.Schema.Types.ObjectId, ref: 'Page' },
        resolutionChapter: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
        resolutionPage: { type: mongoose.Schema.Types.ObjectId, ref: 'Page' },
        isResolved: { type: Boolean, default: false },
        resolutionType: {
            type: String,
            enum: ['reconciliation', 'separation', 'compromise', 'victory', 'defeat', 'ongoing'],
        },
    },
    { _id: false },
);

// Sub-schema for shared experiences
const SharedExperienceSchema = new mongoose.Schema(
    {
        experienceType: {
            type: String,
            enum: [
                'adventure',
                'trauma',
                'celebration',
                'learning',
                'conflict',
                'collaboration',
                'discovery',
            ],
        },
        description: String,
        location: String,
        chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
        pageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page' },
        impact: String,
        significance: { type: Number, min: 1, max: 10, default: 5 },
    },
    { _id: false },
);

// Main CharacterRelationship Schema
const CharacterRelationshipSchema = new mongoose.Schema(
    {
        // Core Relationship Data
        bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
        character1Id: { type: mongoose.Schema.Types.ObjectId, ref: 'Character', required: true },
        character2Id: { type: mongoose.Schema.Types.ObjectId, ref: 'Character', required: true },
        character1Name: { type: String, required: true },
        character2Name: { type: String, required: true },

        // Relationship Classification
        relationshipType: {
            type: String,
            enum: [
                'family',
                'romantic',
                'friendship',
                'mentorship',
                'rivalry',
                'enemity',
                'professional',
                'acquaintance',
                'authority',
                'dependency',
                'alliance',
                'betrayal',
                'unknown',
                'complex',
            ],
            required: true,
        },
        subtype: String, // e.g., "father-son", "business partners", "childhood friends"

        // Relationship Dynamics
        dynamics: {
            powerBalance: {
                type: String,
                enum: ['balanced', 'character1_dominant', 'character2_dominant', 'shifting', 'complex'],
            },
            communicationStyle: {
                type: String,
                enum: ['open', 'guarded', 'hostile', 'formal', 'intimate', 'passive-aggressive', 'minimal'],
            },
            trustLevel: { type: Number, min: 1, max: 10, default: 5 },
            intimacyLevel: { type: Number, min: 1, max: 10, default: 5 },
            conflictLevel: { type: Number, min: 1, max: 10, default: 1 },
            dependencyLevel: { type: Number, min: 1, max: 10, default: 1 },
        },

        // Relationship Strength and Status
        strength: { type: Number, min: 1, max: 10, default: 5 },
        status: {
            type: String,
            enum: ['active', 'inactive', 'estranged', 'complicated', 'ended', 'reconciling'],
            default: 'active',
        },

        // Bidirectional Perspectives
        character1Perspective: {
            feelings: [String], // emotions character1 feels towards character2
            motivations: [String], // what character1 wants from this relationship
            secrets: [String], // what character1 hides from character2
            trust: { type: Number, min: 1, max: 10, default: 5 },
            dependency: { type: Number, min: 1, max: 10, default: 1 },
        },
        character2Perspective: {
            feelings: [String],
            motivations: [String],
            secrets: [String],
            trust: { type: Number, min: 1, max: 10, default: 5 },
            dependency: { type: Number, min: 1, max: 10, default: 1 },
        },

        // Relationship History
        origin: {
            description: String,
            location: String,
            chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
            pageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page' },
            circumstances: String,
        },

        // Key Moments and Evolution
        keyMoments: [SharedExperienceSchema],
        evolution: [RelationshipEvolutionSchema],
        conflicts: [ConflictSchema],

        // Relationship Patterns
        patterns: {
            communicationPatterns: [String],
            conflictPatterns: [String],
            supportPatterns: [String],
            interactionFrequency: {
                type: String,
                enum: ['daily', 'weekly', 'monthly', 'rarely', 'sporadic', 'seasonal'],
            },
        },

        // Story Impact
        storySignificance: {
            plotRelevance: { type: Number, min: 1, max: 10, default: 5 },
            thematicImportance: { type: Number, min: 1, max: 10, default: 5 },
            characterDevelopmentImpact: { type: Number, min: 1, max: 10, default: 5 },
            description: String,
        },

        // Relationship Arcs
        arc: {
            startingPoint: String,
            currentState: String,
            projectedEndpoint: String,
            majorTurningPoints: [String],
            growthAreas: [String],
            challenges: [String],
        },

        // External Factors
        externalInfluences: [
            {
                influence: String,
                impact: String,
                strength: { type: Number, min: 1, max: 10, default: 5 },
            },
        ],

        // Dialogue and Interactions
        interactionStyle: {
            typicalTopics: [String],
            avoidedTopics: [String],
            communicationBarriers: [String],
            sharedLanguage: String, // special terms, inside jokes, etc.
        },

        // Metadata
        tags: [String],
        notes: String,
        isSymmetric: { type: Boolean, default: true }, // whether both characters view the relationship similarly

        // Analytics
        analytics: {
            totalInteractions: { type: Number, default: 0 },
            chaptersInvolved: { type: Number, default: 0 },
            evolutionCount: { type: Number, default: 0 },
            conflictCount: { type: Number, default: 0 },
            conflictResolutionRate: { type: Number, default: 0 },
            averageStrength: { type: Number, default: 5 },
            stabilityScore: { type: Number, default: 5 }, // how stable/consistent the relationship is
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    },
);

// Compound Indexes
CharacterRelationshipSchema.index(
    { bookId: 1, character1Id: 1, character2Id: 1 },
    { unique: true },
);
CharacterRelationshipSchema.index({ character1Id: 1 });
CharacterRelationshipSchema.index({ character2Id: 1 });
CharacterRelationshipSchema.index({ relationshipType: 1 });
CharacterRelationshipSchema.index({ status: 1 });
CharacterRelationshipSchema.index({ 'storySignificance.plotRelevance': -1 });

// Virtual Properties
CharacterRelationshipSchema.virtual('isActive').get(function () {
    return this.status === 'active';
});

CharacterRelationshipSchema.virtual('hasConflicts').get(function () {
    return this.conflicts && this.conflicts.length > 0;
});

CharacterRelationshipSchema.virtual('unresolvedConflicts').get(function () {
    return this.conflicts ? this.conflicts.filter((c) => !c.isResolved) : [];
});

CharacterRelationshipSchema.virtual('relationshipAge').get(function () {
    if (this.origin && this.createdAt) {
        return Date.now() - this.createdAt.getTime();
    }
    return 0;
});

CharacterRelationshipSchema.virtual('complexityScore').get(function () {
    let score = 0;
    score += this.keyMoments.length * 5;
    score += this.evolution.length * 10;
    score += this.conflicts.length * 15;
    score += this.character1Perspective.secrets.length * 3;
    score += this.character2Perspective.secrets.length * 3;
    return Math.min(score, 100);
});

// Instance Methods
CharacterRelationshipSchema.methods.addKeyMoment = function (
    experienceType,
    description,
    chapterId,
    pageId,
    significance = 5,
) {
    this.keyMoments.push({
        experienceType,
        description,
        chapterId,
        pageId,
        significance,
    });
    this.analytics.totalInteractions += 1;
    return this.save();
};

CharacterRelationshipSchema.methods.evolveRelationship = function (
    evolutionType,
    newStrength,
    description,
    chapterId,
    pageId,
) {
    const previousStrength = this.strength;

    this.evolution.push({
        evolutionType,
        previousStrength,
        newStrength,
        description,
        chapterId,
        pageId,
    });

    this.strength = newStrength;
    this.analytics.evolutionCount += 1;
    this.calculateStabilityScore();

    return this.save();
};

CharacterRelationshipSchema.methods.addConflict = function (
    conflictType,
    severity,
    description,
    chapterId,
    pageId,
) {
    this.conflicts.push({
        conflictType,
        severity,
        description,
        startChapter: chapterId,
        startPage: pageId,
    });

    this.dynamics.conflictLevel = Math.min(this.dynamics.conflictLevel + 1, 10);
    this.analytics.conflictCount += 1;
    this.calculateConflictResolutionRate();

    return this.save();
};

CharacterRelationshipSchema.methods.resolveConflict = function (
    conflictIndex,
    resolutionType,
    chapterId,
    pageId,
) {
    if (this.conflicts[conflictIndex]) {
        this.conflicts[conflictIndex].isResolved = true;
        this.conflicts[conflictIndex].resolutionType = resolutionType;
        this.conflicts[conflictIndex].resolutionChapter = chapterId;
        this.conflicts[conflictIndex].resolutionPage = pageId;

        this.calculateConflictResolutionRate();
    }

    return this.save();
};

CharacterRelationshipSchema.methods.updateDynamics = function (dynamicUpdates) {
    Object.assign(this.dynamics, dynamicUpdates);
    return this.save();
};

CharacterRelationshipSchema.methods.addCharacterPerspective = function (
    characterNum,
    perspectiveUpdates,
) {
    const perspectiveField = characterNum === 1 ? 'character1Perspective' : 'character2Perspective';

    if (perspectiveUpdates.feelings) {
        this[perspectiveField].feelings = [
            ...new Set([...this[perspectiveField].feelings, ...perspectiveUpdates.feelings]),
        ];
    }
    if (perspectiveUpdates.motivations) {
        this[perspectiveField].motivations = [
            ...new Set([...this[perspectiveField].motivations, ...perspectiveUpdates.motivations]),
        ];
    }
    if (perspectiveUpdates.secrets) {
        this[perspectiveField].secrets = [
            ...new Set([...this[perspectiveField].secrets, ...perspectiveUpdates.secrets]),
        ];
    }
    if (perspectiveUpdates.trust !== undefined) {
        this[perspectiveField].trust = perspectiveUpdates.trust;
    }
    if (perspectiveUpdates.dependency !== undefined) {
        this[perspectiveField].dependency = perspectiveUpdates.dependency;
    }

    return this.save();
};

CharacterRelationshipSchema.methods.calculateStabilityScore = function () {
    let stabilityFactors = [];

    // Strength consistency
    if (this.evolution.length > 0) {
        const strengthVariance =
            this.evolution.reduce((sum, evo) => {
                return sum + Math.abs(evo.newStrength - evo.previousStrength);
            }, 0) / this.evolution.length;
        stabilityFactors.push(Math.max(0, 10 - strengthVariance));
    } else {
        stabilityFactors.push(8); // Default for new relationships
    }

    // Conflict resolution
    stabilityFactors.push(this.analytics.conflictResolutionRate);

    // Trust levels alignment
    const trustDifference = Math.abs(
        this.character1Perspective.trust - this.character2Perspective.trust,
    );
    stabilityFactors.push(Math.max(0, 10 - trustDifference));

    this.analytics.stabilityScore =
        stabilityFactors.reduce((sum, factor) => sum + factor, 0) / stabilityFactors.length;
    return this.analytics.stabilityScore;
};

CharacterRelationshipSchema.methods.calculateConflictResolutionRate = function () {
    if (this.conflicts.length === 0) {
        this.analytics.conflictResolutionRate = 10;
    } else {
        const resolvedCount = this.conflicts.filter((c) => c.isResolved).length;
        this.analytics.conflictResolutionRate = (resolvedCount / this.conflicts.length) * 10;
    }
    return this.analytics.conflictResolutionRate;
};

CharacterRelationshipSchema.methods.getRelationshipSummary = function () {
    return {
        characters: `${this.character1Name} & ${this.character2Name}`,
        type: this.relationshipType,
        strength: this.strength,
        status: this.status,
        conflicts: this.conflicts.length,
        unresolvedConflicts: this.unresolvedConflicts.length,
        keyMoments: this.keyMoments.length,
        stabilityScore: this.analytics.stabilityScore,
        complexityScore: this.complexityScore,
    };
};

// Static Methods
CharacterRelationshipSchema.statics.findByCharacter = function (characterId) {
    return this.find({
        $or: [{ character1Id: characterId }, { character2Id: characterId }],
    }).sort({ 'storySignificance.plotRelevance': -1, strength: -1 });
};

CharacterRelationshipSchema.statics.findByBook = function (bookId) {
    return this.find({ bookId }).sort({ 'storySignificance.plotRelevance': -1, strength: -1 });
};

CharacterRelationshipSchema.statics.findByType = function (bookId, relationshipType) {
    return this.find({ bookId, relationshipType }).sort({ strength: -1 });
};

CharacterRelationshipSchema.statics.findConflictedRelationships = function (bookId) {
    return this.find({
        bookId,
        'conflicts.isResolved': false,
    }).sort({ 'dynamics.conflictLevel': -1 });
};

CharacterRelationshipSchema.statics.getRelationshipNetwork = function (bookId) {
    return this.aggregate([
        { $match: { bookId: mongoose.Types.ObjectId(bookId) } },
        {
            $group: {
                _id: '$relationshipType',
                count: { $sum: 1 },
                averageStrength: { $avg: '$strength' },
                relationships: {
                    $push: {
                        character1: '$character1Name',
                        character2: '$character2Name',
                        strength: '$strength',
                        status: '$status',
                    },
                },
            },
        },
        { $sort: { count: -1 } },
    ]);
};

CharacterRelationshipSchema.statics.getRelationshipStats = function (bookId) {
    return this.aggregate([
        { $match: { bookId: mongoose.Types.ObjectId(bookId) } },
        {
            $group: {
                _id: null,
                totalRelationships: { $sum: 1 },
                averageStrength: { $avg: '$strength' },
                averageStability: { $avg: '$analytics.stabilityScore' },
                totalConflicts: { $sum: '$analytics.conflictCount' },
                averageComplexity: { $avg: { $ifNull: ['$complexityScore', 0] } },
                relationshipTypes: { $addToSet: '$relationshipType' },
                activeRelationships: {
                    $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
                },
            },
        },
    ]);
};

// Pre-save Middleware
CharacterRelationshipSchema.pre('save', function (next) {
    // Ensure character1Id is always the smaller ObjectId for consistency
    if (this.character1Id.toString() > this.character2Id.toString()) {
        [this.character1Id, this.character2Id] = [this.character2Id, this.character1Id];
        [this.character1Name, this.character2Name] = [this.character2Name, this.character1Name];
        [this.character1Perspective, this.character2Perspective] = [
            this.character2Perspective,
            this.character1Perspective,
        ];
    }

    // Calculate analytics
    this.calculateStabilityScore();
    this.calculateConflictResolutionRate();

    // Update chapters involved
    const chapters = new Set();
    this.keyMoments.forEach((moment) => {
        if (moment.chapterId) chapters.add(moment.chapterId.toString());
    });
    this.evolution.forEach((evo) => {
        if (evo.chapterId) chapters.add(evo.chapterId.toString());
    });
    this.analytics.chaptersInvolved = chapters.size;

    next();
});

const CharacterRelationship = mongoose.model('CharacterRelationship', CharacterRelationshipSchema);
export { CharacterRelationship };
export default CharacterRelationship;
