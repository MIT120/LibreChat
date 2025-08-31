/**
 * CharacterTemplate Model - MongoDB schema for character template storage
 */

import mongoose, { Document, Schema } from 'mongoose';
import { CharacterRole, CharacterVisibility } from './Character';

// Template category enum
export enum TemplateCategory {
    ARCHETYPE = 'archetype',           // Classical archetypes (hero, villain, mentor)
    GENRE = 'genre',                   // Genre-specific templates (sci-fi, fantasy, mystery)
    ROLE = 'role',                     // Story role templates (protagonist, supporting, etc.)
    PERSONALITY = 'personality',       // Personality-based templates
    CUSTOM = 'custom'                  // User-created templates
}

// Template origin enum
export enum TemplateOrigin {
    SYSTEM = 'system',                 // Built-in system templates
    COMMUNITY = 'community',           // Community-shared templates
    USER = 'user'                      // User-created templates
}

// Template schema
const characterTemplateSchema = new Schema({
    _id: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
        index: true
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    category: {
        type: String,
        enum: Object.values(TemplateCategory),
        required: true,
        index: true
    },
    origin: {
        type: String,
        enum: Object.values(TemplateOrigin),
        default: TemplateOrigin.SYSTEM,
        index: true
    },
    
    // Template data
    role: {
        type: String,
        enum: Object.values(CharacterRole),
        required: true,
        index: true
    },
    traits: [{ 
        type: String,
        trim: true,
        maxlength: 50
    }],
    motivations: [{ 
        type: String,
        trim: true,
        maxlength: 100
    }],
    fears: [{ 
        type: String,
        trim: true,
        maxlength: 100
    }],
    strengths: [{ 
        type: String,
        trim: true,
        maxlength: 100
    }],
    weaknesses: [{ 
        type: String,
        trim: true,
        maxlength: 100
    }],
    
    // Physical appearance suggestions
    physicalSuggestions: {
        build: [{ type: String }],
        hairColors: [{ type: String }],
        eyeColors: [{ type: String }],
        distinctiveFeatures: [{ type: String }],
        clothingStyles: [{ type: String }]
    },
    
    // Background suggestions
    backgroundSuggestions: {
        origins: [{ type: String }],
        occupations: [{ type: String }],
        skills: [{ type: String }],
        pastEventTypes: [{ type: String }]
    },
    
    // Story integration
    commonGoalTypes: [{ type: String }],
    arcSuggestions: {
        startingPoints: [{ type: String }],
        transformationTypes: [{ type: String }],
        endingTypes: [{ type: String }]
    },
    
    // Usage metadata
    genre: [{ 
        type: String,
        trim: true,
        maxlength: 50
    }],
    tags: [{ 
        type: String,
        trim: true,
        maxlength: 50,
        index: true
    }],
    difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner'
    },
    
    // Template settings
    isPublic: {
        type: Boolean,
        default: true,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    
    // Creation metadata
    createdBy: {
        type: String,  // user ID
        index: true
    },
    
    // Usage statistics
    usageCount: {
        type: Number,
        default: 0,
        min: 0
    },
    rating: {
        average: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        count: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    
    // Version control
    version: {
        type: Number,
        default: 1,
        min: 1
    },
    
    // Template customization
    allowCustomization: {
        type: Boolean,
        default: true
    },
    
    // AI generation hints
    aiPromptHints: {
        type: String,
        maxlength: 1000
    }
}, {
    _id: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
characterTemplateSchema.index({ category: 1, role: 1 });
characterTemplateSchema.index({ origin: 1, isPublic: 1, isActive: 1 });
characterTemplateSchema.index({ genre: 1, difficulty: 1 });
characterTemplateSchema.index({ tags: 1, isPublic: 1 });
characterTemplateSchema.index({ usageCount: -1, rating: -1 }); // For popular templates
characterTemplateSchema.index({ createdBy: 1, createdAt: -1 });

// Virtual for popularity score
characterTemplateSchema.virtual('popularityScore').get(function() {
    return (this.usageCount * 0.3) + (this.rating.average * this.rating.count * 0.7);
});

// Static method to get popular templates
characterTemplateSchema.statics.getPopular = function(limit = 10) {
    return this.aggregate([
        { $match: { isPublic: true, isActive: true } },
        {
            $addFields: {
                popularityScore: {
                    $add: [
                        { $multiply: ['$usageCount', 0.3] },
                        { $multiply: ['$rating.average', '$rating.count', 0.7] }
                    ]
                }
            }
        },
        { $sort: { popularityScore: -1, createdAt: -1 } },
        { $limit: limit }
    ]);
};

// Export interface
export interface ICharacterTemplate {
    _id: string;
    name: string;
    description: string;
    category: TemplateCategory;
    origin: TemplateOrigin;
    role: CharacterRole;
    traits: string[];
    motivations: string[];
    fears: string[];
    strengths: string[];
    weaknesses: string[];
    physicalSuggestions: {
        build: string[];
        hairColors: string[];
        eyeColors: string[];
        distinctiveFeatures: string[];
        clothingStyles: string[];
    };
    backgroundSuggestions: {
        origins: string[];
        occupations: string[];
        skills: string[];
        pastEventTypes: string[];
    };
    commonGoalTypes: string[];
    arcSuggestions: {
        startingPoints: string[];
        transformationTypes: string[];
        endingTypes: string[];
    };
    genre: string[];
    tags: string[];
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    isPublic: boolean;
    isActive: boolean;
    createdBy?: string;
    usageCount: number;
    rating: {
        average: number;
        count: number;
    };
    version: number;
    allowCustomization: boolean;
    aiPromptHints?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CharacterTemplateDocument extends ICharacterTemplate, Document {
    popularityScore: number;
}

// Create and export the model
export const CharacterTemplate = mongoose.model<CharacterTemplateDocument>('CharacterTemplate', characterTemplateSchema);
export default CharacterTemplate;
