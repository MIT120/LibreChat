/**
 * Research Item Model - Manages research materials and references
 */

import mongoose from 'mongoose';

// File attachment sub-schema
const fileAttachmentSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String },
    localPath: { type: String },
    checksum: { type: String },
    uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

// Metadata sub-schema
const metadataSchema = new mongoose.Schema({
    source: { type: String, trim: true },
    author: { type: String, trim: true },
    publisher: { type: String, trim: true },
    publicationDate: { type: Date },
    isbn: { type: String, trim: true },
    url: { type: String, trim: true },
    accessDate: { type: Date },
    copyright: { type: String, trim: true },
    language: { type: String, default: 'en' },
    tags: [{ type: String, trim: true }],
    notes: { type: String, trim: true },
    rating: { type: Number, min: 1, max: 5 },
    reliability: { type: String, enum: ['high', 'medium', 'low', 'unverified'], default: 'medium' }
}, { _id: false });

// Linked elements sub-schema
const linkedElementsSchema = new mongoose.Schema({
    characters: [{
        characterId: { type: String, required: true },
        characterName: { type: String, required: true },
        relevance: { type: String, enum: ['inspiration', 'reference', 'model', 'contrast'], default: 'reference' },
        notes: { type: String }
    }],
    locations: [{
        locationId: { type: String, required: true },
        locationName: { type: String, required: true },
        relevance: { type: String, enum: ['inspiration', 'reference', 'model', 'contrast'], default: 'reference' },
        notes: { type: String }
    }],
    plotPoints: [{
        plotPointId: { type: String, required: true },
        plotPointName: { type: String, required: true },
        relevance: { type: String, enum: ['inspiration', 'reference', 'historical_basis', 'fact_check'], default: 'reference' },
        notes: { type: String }
    }],
    chapters: [{
        chapterId: { type: String, required: true },
        chapterTitle: { type: String, required: true },
        relevance: { type: String, enum: ['background', 'direct_reference', 'inspiration'], default: 'background' },
        notes: { type: String }
    }],
    worldElements: [{
        elementId: { type: String, required: true },
        elementName: { type: String, required: true },
        elementType: { type: String, enum: ['culture', 'technology', 'politics', 'geography', 'language'] },
        relevance: { type: String, enum: ['inspiration', 'reference', 'fact_check'], default: 'reference' },
        notes: { type: String }
    }]
}, { _id: false });

// Organization sub-schema
const organizationSchema = new mongoose.Schema({
    category: { type: String, required: true, trim: true },
    subcategory: { type: String, trim: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    status: { type: String, enum: ['to_review', 'reviewed', 'verified', 'outdated', 'archived'], default: 'to_review' },
    folders: [{ type: String, trim: true }],
    collections: [{ type: String, trim: true }]
}, { _id: false });

// Citation sub-schema
const citationSchema = new mongoose.Schema({
    style: { type: String, enum: ['apa', 'mla', 'chicago', 'harvard', 'custom'], default: 'apa' },
    formatted: { type: String },
    shortForm: { type: String },
    bibEntry: { type: String }
}, { _id: false });

// Main research item schema
const researchItemSchema = new mongoose.Schema({
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
    workspaceId: {
        type: String,
        required: true,
        ref: 'ProjectWorkspace',
        index: true
    },
    type: {
        type: String,
        enum: ['text', 'image', 'url', 'file', 'audio', 'video', 'pdf', 'quote', 'interview', 'observation'],
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    description: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    content: {
        text: { type: String },
        html: { type: String },
        markdown: { type: String },
        excerpt: { type: String, maxlength: 500 },
        transcript: { type: String }
    },
    files: [fileAttachmentSchema],
    metadata: {
        type: metadataSchema,
        default: () => ({})
    },
    linkedElements: {
        type: linkedElementsSchema,
        default: () => ({})
    },
    organization: {
        type: organizationSchema,
        required: true
    },
    citation: {
        type: citationSchema,
        default: () => ({})
    },
    usage: {
        timesReferenced: { type: Number, default: 0 },
        lastAccessed: { type: Date },
        bookmarkCount: { type: Number, default: 0 },
        exportCount: { type: Number, default: 0 }
    },
    sharing: {
        isPublic: { type: Boolean, default: false },
        sharedWith: [{
            userId: { type: String, required: true },
            permissions: { type: String, enum: ['view', 'comment', 'edit'], default: 'view' },
            sharedAt: { type: Date, default: Date.now }
        }],
        publicUrl: { type: String }
    },
    flags: {
        isFavorite: { type: Boolean, default: false },
        isArchived: { type: Boolean, default: false },
        needsReview: { type: Boolean, default: false },
        hasIssues: { type: Boolean, default: false },
        isTemplate: { type: Boolean, default: false }
    }
}, {
    _id: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
researchItemSchema.index({ bookId: 1, 'organization.category': 1 });
researchItemSchema.index({ workspaceId: 1, type: 1 });
researchItemSchema.index({ 'metadata.tags': 1 });
researchItemSchema.index({ title: 'text', description: 'text', 'content.text': 'text' });
researchItemSchema.index({ 'linkedElements.characters.characterId': 1 });
researchItemSchema.index({ 'linkedElements.locations.locationId': 1 });
researchItemSchema.index({ 'flags.isFavorite': 1, 'flags.isArchived': 1 });

// Virtuals
researchItemSchema.virtual('totalLinkedElements').get(function () {
    const linked = this.linkedElements;
    return (linked?.characters?.length || 0) +
        (linked?.locations?.length || 0) +
        (linked?.plotPoints?.length || 0) +
        (linked?.chapters?.length || 0) +
        (linked?.worldElements?.length || 0);
});

researchItemSchema.virtual('hasFiles').get(function () {
    return this.files && this.files.length > 0;
});

researchItemSchema.virtual('wordCount').get(function () {
    const text = this.content?.text || this.content?.markdown || this.description || '';
    return text.split(/\s+/).filter(word => word.length > 0).length;
});

// Methods
researchItemSchema.methods.addLinkedCharacter = function (characterId: string, characterName: string, relevance?: string, notes?: string) {
    if (!this.linkedElements.characters) {
        this.linkedElements.characters = [];
    }

    const existingIndex = this.linkedElements.characters.findIndex(c => c.characterId === characterId);
    if (existingIndex >= 0) {
        // Update existing link
        this.linkedElements.characters[existingIndex] = {
            characterId,
            characterName,
            relevance: relevance || this.linkedElements.characters[existingIndex].relevance,
            notes: notes || this.linkedElements.characters[existingIndex].notes
        };
    } else {
        // Add new link
        this.linkedElements.characters.push({
            characterId,
            characterName,
            relevance: relevance || 'reference',
            notes
        });
    }

    return this.save();
};

researchItemSchema.methods.removeLinkedCharacter = function (characterId: string) {
    if (this.linkedElements.characters) {
        this.linkedElements.characters = this.linkedElements.characters.filter(c => c.characterId !== characterId);
    }
    return this.save();
};

researchItemSchema.methods.incrementUsage = function () {
    this.usage.timesReferenced = (this.usage.timesReferenced || 0) + 1;
    this.usage.lastAccessed = new Date();
    return this.save();
};

researchItemSchema.methods.generateCitation = function (style: string = 'apa') {
    const metadata = this.metadata;
    let citation = '';

    switch (style) {
        case 'apa':
            citation = `${metadata.author || 'Unknown Author'}. ${metadata.publicationDate ? `(${new Date(metadata.publicationDate).getFullYear()})` : '(n.d.)'}. ${this.title}. ${metadata.publisher || ''}.`;
            break;
        case 'mla':
            citation = `${metadata.author || 'Unknown Author'}. "${this.title}." ${metadata.publisher || ''}, ${metadata.publicationDate ? new Date(metadata.publicationDate).getFullYear() : 'n.d.'}.`;
            break;
        default:
            citation = `${metadata.author || 'Unknown Author'}. ${this.title}. ${metadata.publisher || ''}, ${metadata.publicationDate ? new Date(metadata.publicationDate).getFullYear() : 'n.d.'}.`;
    }

    this.citation.style = style;
    this.citation.formatted = citation;
    return citation;
};

export const ResearchItem = mongoose.model('ResearchItem', researchItemSchema);
export default ResearchItem;
