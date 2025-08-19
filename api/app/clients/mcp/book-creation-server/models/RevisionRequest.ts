/**
 * Revision Request Model - Tracks inline editing and rewrite requests
 */

import mongoose from 'mongoose';

// Selection range sub-schema
const selectionRangeSchema = new mongoose.Schema({
    startOffset: { type: Number, required: true },
    endOffset: { type: Number, required: true },
    selectedText: { type: String, required: true },
    contextBefore: { type: String, maxlength: 200 }, // Text before selection for context
    contextAfter: { type: String, maxlength: 200 },  // Text after selection for context
}, { _id: false });

// Revision instruction sub-schema
const revisionInstructionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['rewrite', 'expand', 'condense', 'improve_tone', 'fix_grammar', 'change_style', 'add_detail', 'custom'],
        required: true
    },
    description: { type: String, required: true, maxlength: 1000 },
    specificInstructions: { type: String, maxlength: 2000 },
    targetTone: {
        type: String,
        enum: ['formal', 'casual', 'dramatic', 'humorous', 'serious', 'poetic', 'conversational'],
        required: function () { return this.type === 'change_style' || this.type === 'improve_tone'; }
    },
    targetLength: {
        type: String,
        enum: ['shorter', 'longer', 'same', 'much_shorter', 'much_longer'],
        required: function () { return this.type === 'expand' || this.type === 'condense'; }
    },
    preserveElements: [{ type: String }], // Elements to preserve (character names, plot points, etc.)
    avoidElements: [{ type: String }],    // Things to avoid in the revision
}, { _id: false });

// Revision result sub-schema
const revisionResultSchema = new mongoose.Schema({
    generatedText: { type: String, required: true },
    confidence: { type: Number, min: 0, max: 100, default: 85 },
    alternativeVersions: [{
        text: { type: String, required: true },
        variant: { type: String }, // 'formal', 'casual', 'detailed', etc.
        confidence: { type: Number, min: 0, max: 100 }
    }],
    changes: [{
        type: { type: String, enum: ['addition', 'deletion', 'modification', 'restructure'] },
        description: { type: String, required: true },
        impact: { type: String, enum: ['minor', 'moderate', 'significant'], default: 'moderate' }
    }],
    metadata: {
        model: { type: String }, // AI model used
        promptTokens: { type: Number },
        completionTokens: { type: Number },
        processingTime: { type: Number }, // milliseconds
        timestamp: { type: Date, default: Date.now }
    }
}, { _id: false });

// User feedback sub-schema
const userFeedbackSchema = new mongoose.Schema({
    rating: { type: Number, min: 1, max: 5 },
    feedback: { type: String, maxlength: 1000 },
    acceptedVersion: { type: String }, // 'original', 'generated', or specific alternative ID
    customEdits: { type: String },     // User's manual edits to the generated text
    timestamp: { type: Date, default: Date.now }
}, { _id: false });

// Main revision request schema
const revisionRequestSchema = new mongoose.Schema({
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
        ref: 'Chapter',
        index: true
    },
    pageId: {
        type: String,
        ref: 'Page',
        index: true
    },
    conversationId: {
        type: String,
        required: true,
        ref: 'Conversation',
        index: true
    },
    messageId: {
        type: String,
        ref: 'Message'
    },

    // User who made the request
    userId: {
        type: String,
        required: true,
        index: true
    },

    // What text was selected for revision
    selection: {
        type: selectionRangeSchema,
        required: true
    },

    // What kind of revision was requested
    instruction: {
        type: revisionInstructionSchema,
        required: true
    },

    // Generated result
    result: {
        type: revisionResultSchema
    },

    // User's response to the revision
    feedback: {
        type: userFeedbackSchema
    },

    // Request status
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'applied'],
        default: 'pending',
        index: true
    },

    // Priority level
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },

    // Context information
    context: {
        surroundingText: { type: String, maxlength: 2000 }, // Larger context around selection
        chapterTitle: { type: String },
        chapterSummary: { type: String },
        characterContext: [{
            characterId: { type: String },
            characterName: { type: String },
            currentState: { type: String }
        }],
        plotContext: { type: String, maxlength: 500 },
        previousRevisions: [{ type: String }] // IDs of related revisions
    },

    // Revision tracking
    version: {
        originalVersion: { type: Number, required: true }, // Version when request was made
        appliedVersion: { type: Number },                  // Version when applied (if applied)
        conflictsWithRevisions: [{ type: String }]         // Other revision IDs that conflict
    },

    // Collaboration
    assignedTo: { type: String }, // User ID if assigned to someone specific
    reviewers: [{
        userId: { type: String, required: true },
        status: { type: String, enum: ['pending', 'approved', 'rejected', 'commented'] },
        comment: { type: String },
        timestamp: { type: Date, default: Date.now }
    }],

    // System flags
    flags: {
        isAutomated: { type: Boolean, default: false },    // Generated by automated system
        requiresReview: { type: Boolean, default: false },  // Needs human review
        affectsMultiplePages: { type: Boolean, default: false },
        hasConflicts: { type: Boolean, default: false },
        isUrgent: { type: Boolean, default: false }
    },

    // Error information (if failed)
    error: {
        code: { type: String },
        message: { type: String },
        details: { type: mongoose.Schema.Types.Mixed },
        timestamp: { type: Date }
    },

    // Tags for organization
    tags: [{ type: String, trim: true }],

    // Notes from user or system
    notes: { type: String, maxlength: 2000 }
}, {
    _id: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
revisionRequestSchema.index({ bookId: 1, status: 1 });
revisionRequestSchema.index({ conversationId: 1, createdAt: -1 });
revisionRequestSchema.index({ userId: 1, status: 1, createdAt: -1 });
revisionRequestSchema.index({ chapterId: 1, pageId: 1 });
revisionRequestSchema.index({ priority: 1, status: 1 });
revisionRequestSchema.index({ 'flags.requiresReview': 1, status: 1 });

// Virtuals
revisionRequestSchema.virtual('isCompleted').get(function () {
    return ['completed', 'applied'].includes(this.status);
});

revisionRequestSchema.virtual('isPending').get(function () {
    return ['pending', 'processing'].includes(this.status);
});

revisionRequestSchema.virtual('hasResult').get(function () {
    return this.result && this.result.generatedText;
});

revisionRequestSchema.virtual('selectionLength').get(function () {
    return this.selection.endOffset - this.selection.startOffset;
});

revisionRequestSchema.virtual('processingTime').get(function () {
    if (this.result?.metadata?.processingTime) {
        return this.result.metadata.processingTime;
    }
    if (this.status === 'processing' || this.status === 'completed') {
        return new Date().getTime() - this.createdAt.getTime();
    }
    return 0;
});

// Methods
revisionRequestSchema.methods.updateStatus = function (newStatus: string, error?: any) {
    this.status = newStatus;
    if (error) {
        this.error = {
            code: error.code || 'UNKNOWN_ERROR',
            message: error.message || 'An unknown error occurred',
            details: error.details || error,
            timestamp: new Date()
        };
    }
    return this.save();
};

revisionRequestSchema.methods.addResult = function (result: any) {
    this.result = result;
    this.status = 'completed';
    return this.save();
};

revisionRequestSchema.methods.addFeedback = function (feedback: any) {
    this.feedback = feedback;
    if (feedback.acceptedVersion && feedback.acceptedVersion !== 'original') {
        this.status = 'applied';
    }
    return this.save();
};

revisionRequestSchema.methods.getConflictingRevisions = async function () {
    if (!this.version.conflictsWithRevisions || this.version.conflictsWithRevisions.length === 0) {
        return [];
    }

    return RevisionRequest.find({
        _id: { $in: this.version.conflictsWithRevisions },
        status: { $in: ['completed', 'applied'] }
    });
};

revisionRequestSchema.methods.checkForConflicts = async function () {
    // Find other revisions that might conflict with this one
    const overlappingRevisions = await RevisionRequest.find({
        bookId: this.bookId,
        pageId: this.pageId,
        _id: { $ne: this._id },
        status: { $in: ['completed', 'applied'] },
        $or: [
            {
                'selection.startOffset': {
                    $lt: this.selection.endOffset,
                    $gte: this.selection.startOffset
                }
            },
            {
                'selection.endOffset': {
                    $gt: this.selection.startOffset,
                    $lte: this.selection.endOffset
                }
            },
            {
                $and: [
                    { 'selection.startOffset': { $lte: this.selection.startOffset } },
                    { 'selection.endOffset': { $gte: this.selection.endOffset } }
                ]
            }
        ]
    });

    if (overlappingRevisions.length > 0) {
        this.version.conflictsWithRevisions = overlappingRevisions.map(r => r._id);
        this.flags.hasConflicts = true;

        // Also update the conflicting revisions to point back to this one
        await RevisionRequest.updateMany(
            { _id: { $in: overlappingRevisions.map(r => r._id) } },
            {
                $addToSet: { 'version.conflictsWithRevisions': this._id },
                $set: { 'flags.hasConflicts': true }
            }
        );
    }

    return this.save();
};

revisionRequestSchema.methods.generateSummary = function () {
    const typeDescriptions = {
        rewrite: 'Rewrite',
        expand: 'Expand',
        condense: 'Condense',
        improve_tone: 'Improve tone',
        fix_grammar: 'Fix grammar',
        change_style: 'Change style',
        add_detail: 'Add detail',
        custom: 'Custom edit'
    };

    const selectedLength = this.selection.selectedText.length;
    const typeDesc = typeDescriptions[this.instruction.type] || 'Edit';

    return `${typeDesc} ${selectedLength} characters in ${this.chapterTitle || 'chapter'}`;
};

export const RevisionRequest = mongoose.model('RevisionRequest', revisionRequestSchema);
export default RevisionRequest;
