/**
 * Visual Consistency Service - Tracks and maintains visual consistency across images
 */

import { BaseService } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';
import mongoose from 'mongoose';
import { DatabaseError, NotFoundError } from '../../types/errors.js';

// Visual Reference Schema for consistency tracking
const visualReferenceSchema = new mongoose.Schema({
    referenceId: { type: String, required: true, unique: true, index: true },
    bookId: { type: String, required: true, index: true },
    conversationId: { type: String, required: true, index: true },
    
    // Reference type and target
    referenceType: { 
        type: String, 
        enum: ['character', 'location', 'object', 'artifact', 'creature', 'vehicle'],
        required: true 
    },
    targetId: { type: String, required: true }, // Character ID, World Element ID, etc.
    targetName: { type: String, required: true },
    
    // Visual consistency data
    canonicalAppearance: {
        description: { type: String, required: true },
        keyFeatures: [{ type: String }],
        colorPalette: [{ type: String }],
        distinctiveElements: [{ type: String }],
        visualKeywords: [{ type: String }]
    },
    
    // Generated images using this reference
    imageInstances: [{
        imageUrl: { type: String, required: true },
        imageBase64: { type: String },
        pageId: { type: String, required: true },
        chapterId: { type: String, required: true },
        prompt: { type: String, required: true },
        generatedAt: { type: Date, default: Date.now },
        consistency: {
            score: { type: Number, min: 0, max: 10 }, // Consistency rating
            deviations: [{ type: String }], // Noted inconsistencies
            corrections: [{ type: String }] // Suggested corrections
        }
    }],
    
    // Version tracking
    version: { type: Number, default: 1 },
    lastUpdated: { type: Date, default: Date.now },
    updatedBy: { type: String, enum: ['user', 'ai_analysis', 'consistency_check'] }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Add indexes for performance
visualReferenceSchema.index({ bookId: 1, referenceType: 1 });
visualReferenceSchema.index({ targetId: 1, referenceType: 1 });

const VisualReference = mongoose.model('VisualReference', visualReferenceSchema);

export interface ConsistencyAnalysis {
    targetId: string;
    targetName: string;
    referenceType: string;
    
    // Current state
    hasVisualReference: boolean;
    canonicalAppearance?: any;
    
    // History analysis
    imageCount: number;
    consistencyTrend: 'improving' | 'stable' | 'declining' | 'unknown';
    averageConsistencyScore?: number;
    
    // Detected issues
    knownDeviations: string[];
    suggestedCorrections: string[];
    
    // Recommendations
    needsReferenceUpdate: boolean;
    recommendedPromptAdjustments: string[];
}

export interface VisualReferenceData {
    referenceId: string;
    referenceType: string;
    targetId: string;
    targetName: string;
    canonicalAppearance: {
        description: string;
        keyFeatures: string[];
        colorPalette: string[];
        distinctiveElements: string[];
        visualKeywords: string[];
    };
}

export class VisualConsistencyService extends BaseService {
    constructor(logger: ILogger) {
        super(logger);
    }

    protected async onInitialize(): Promise<void> {
        this.logger.info('VisualConsistencyService initialized');
    }

    protected async onDispose(): Promise<void> {
        this.logger.info('VisualConsistencyService disposed');
    }

    /**
     * Create or update a visual reference for consistency tracking
     */
    async upsertVisualReference(
        bookId: string,
        conversationId: string,
        referenceData: {
            referenceType: string;
            targetId: string;
            targetName: string;
            canonicalAppearance: {
                description: string;
                keyFeatures?: string[];
                colorPalette?: string[];
                distinctiveElements?: string[];
                visualKeywords?: string[];
            };
        }
    ): Promise<VisualReferenceData> {
        return this.executeWithLogging('upsertVisualReference', async () => {
            const referenceId = `${bookId}_${referenceData.referenceType}_${referenceData.targetId}`;
            
            const existingReference = await VisualReference.findOne({ referenceId });
            
            if (existingReference) {
                // Update existing reference
                existingReference.canonicalAppearance = {
                    description: referenceData.canonicalAppearance.description,
                    keyFeatures: referenceData.canonicalAppearance.keyFeatures || [],
                    colorPalette: referenceData.canonicalAppearance.colorPalette || [],
                    distinctiveElements: referenceData.canonicalAppearance.distinctiveElements || [],
                    visualKeywords: referenceData.canonicalAppearance.visualKeywords || []
                };
                existingReference.version += 1;
                existingReference.lastUpdated = new Date();
                existingReference.updatedBy = 'ai_analysis';
                
                await existingReference.save();
                
                return {
                    referenceId: existingReference.referenceId,
                    referenceType: existingReference.referenceType,
                    targetId: existingReference.targetId,
                    targetName: existingReference.targetName,
                    canonicalAppearance: existingReference.canonicalAppearance
                };
            } else {
                // Create new reference
                const newReference = new VisualReference({
                    referenceId,
                    bookId,
                    conversationId,
                    referenceType: referenceData.referenceType,
                    targetId: referenceData.targetId,
                    targetName: referenceData.targetName,
                    canonicalAppearance: {
                        description: referenceData.canonicalAppearance.description,
                        keyFeatures: referenceData.canonicalAppearance.keyFeatures || [],
                        colorPalette: referenceData.canonicalAppearance.colorPalette || [],
                        distinctiveElements: referenceData.canonicalAppearance.distinctiveElements || [],
                        visualKeywords: referenceData.canonicalAppearance.visualKeywords || []
                    },
                    imageInstances: [],
                    updatedBy: 'ai_analysis'
                });
                
                await newReference.save();
                
                return {
                    referenceId: newReference.referenceId,
                    referenceType: newReference.referenceType,
                    targetId: newReference.targetId,
                    targetName: newReference.targetName,
                    canonicalAppearance: newReference.canonicalAppearance
                };
            }
        }, { bookId, targetId: referenceData.targetId });
    }

    /**
     * Record a generated image for consistency tracking
     */
    async recordImageGeneration(
        bookId: string,
        targetId: string,
        referenceType: string,
        imageData: {
            imageUrl: string;
            imageBase64?: string;
            pageId: string;
            chapterId: string;
            prompt: string;
        }
    ): Promise<void> {
        return this.executeWithLogging('recordImageGeneration', async () => {
            const referenceId = `${bookId}_${referenceType}_${targetId}`;
            
            const reference = await VisualReference.findOne({ referenceId });
            if (!reference) {
                this.logger.warn('No visual reference found for image generation', { referenceId });
                return;
            }
            
            // Add image instance
            reference.imageInstances.push({
                imageUrl: imageData.imageUrl,
                imageBase64: imageData.imageBase64,
                pageId: imageData.pageId,
                chapterId: imageData.chapterId,
                prompt: imageData.prompt,
                generatedAt: new Date(),
                consistency: {
                    score: undefined, // Will be analyzed later
                    deviations: [],
                    corrections: []
                }
            });
            
            await reference.save();
        }, { bookId, targetId, referenceType });
    }

    /**
     * Get visual reference for generating consistent images
     */
    async getVisualReference(
        bookId: string,
        targetId: string,
        referenceType: string
    ): Promise<VisualReferenceData | null> {
        return this.executeWithLogging('getVisualReference', async () => {
            const referenceId = `${bookId}_${referenceType}_${targetId}`;
            
            const reference = await VisualReference.findOne({ referenceId });
            if (!reference) {
                return null;
            }
            
            return {
                referenceId: reference.referenceId,
                referenceType: reference.referenceType,
                targetId: reference.targetId,
                targetName: reference.targetName,
                canonicalAppearance: reference.canonicalAppearance
            };
        }, { bookId, targetId, referenceType });
    }

    /**
     * Analyze consistency for a specific target across all its images
     */
    async analyzeConsistency(
        bookId: string,
        targetId: string,
        referenceType: string
    ): Promise<ConsistencyAnalysis> {
        return this.executeWithLogging('analyzeConsistency', async () => {
            const referenceId = `${bookId}_${referenceType}_${targetId}`;
            
            const reference = await VisualReference.findOne({ referenceId });
            
            if (!reference) {
                return {
                    targetId,
                    targetName: 'Unknown',
                    referenceType,
                    hasVisualReference: false,
                    imageCount: 0,
                    consistencyTrend: 'unknown',
                    knownDeviations: [],
                    suggestedCorrections: [],
                    needsReferenceUpdate: true,
                    recommendedPromptAdjustments: ['Create initial visual reference for consistency tracking']
                };
            }
            
            const imageInstances = reference.imageInstances || [];
            const consistencyScores = imageInstances
                .map(img => img.consistency?.score)
                .filter(score => score !== undefined) as number[];
            
            const averageScore = consistencyScores.length > 0 
                ? consistencyScores.reduce((sum, score) => sum + score, 0) / consistencyScores.length
                : undefined;
            
            // Analyze trend
            let trend: 'improving' | 'stable' | 'declining' | 'unknown' = 'unknown';
            if (consistencyScores.length >= 3) {
                const recentScores = consistencyScores.slice(-3);
                const olderScores = consistencyScores.slice(0, -3);
                if (olderScores.length > 0) {
                    const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
                    const olderAvg = olderScores.reduce((sum, score) => sum + score, 0) / olderScores.length;
                    
                    if (recentAvg > olderAvg + 0.5) trend = 'improving';
                    else if (recentAvg < olderAvg - 0.5) trend = 'declining';
                    else trend = 'stable';
                }
            }
            
            // Collect known deviations
            const knownDeviations = Array.from(new Set(
                imageInstances.flatMap(img => img.consistency?.deviations || [])
            ));
            
            // Collect suggested corrections
            const suggestedCorrections = Array.from(new Set(
                imageInstances.flatMap(img => img.consistency?.corrections || [])
            ));
            
            // Determine if reference needs updating
            const needsUpdate = averageScore !== undefined && averageScore < 6 && imageInstances.length >= 3;
            
            // Generate prompt adjustments
            const promptAdjustments: string[] = [];
            if (reference.canonicalAppearance.keyFeatures.length > 0) {
                promptAdjustments.push(`Emphasize key features: ${reference.canonicalAppearance.keyFeatures.join(', ')}`);
            }
            if (reference.canonicalAppearance.colorPalette.length > 0) {
                promptAdjustments.push(`Use consistent colors: ${reference.canonicalAppearance.colorPalette.join(', ')}`);
            }
            if (knownDeviations.length > 0) {
                promptAdjustments.push(`Avoid common deviations: ${knownDeviations.slice(0, 3).join(', ')}`);
            }
            
            return {
                targetId,
                targetName: reference.targetName,
                referenceType,
                hasVisualReference: true,
                canonicalAppearance: reference.canonicalAppearance,
                imageCount: imageInstances.length,
                consistencyTrend: trend,
                averageConsistencyScore: averageScore,
                knownDeviations,
                suggestedCorrections,
                needsReferenceUpdate: needsUpdate,
                recommendedPromptAdjustments: promptAdjustments
            };
        }, { bookId, targetId, referenceType });
    }

    /**
     * Get all visual references for a book
     */
    async getBookVisualReferences(bookId: string): Promise<VisualReferenceData[]> {
        return this.executeWithLogging('getBookVisualReferences', async () => {
            const references = await VisualReference.find({ bookId });
            
            return references.map(ref => ({
                referenceId: ref.referenceId,
                referenceType: ref.referenceType,
                targetId: ref.targetId,
                targetName: ref.targetName,
                canonicalAppearance: ref.canonicalAppearance
            }));
        }, { bookId });
    }

    /**
     * Build consistency-aware prompt additions
     */
    async buildConsistencyPrompt(
        bookId: string,
        targetIds: string[],
        referenceTypes: string[]
    ): Promise<string> {
        return this.executeWithLogging('buildConsistencyPrompt', async () => {
            const promptParts: string[] = [];
            
            for (let i = 0; i < targetIds.length; i++) {
                const targetId = targetIds[i];
                const referenceType = referenceTypes[i] || referenceTypes[0];
                
                const reference = await this.getVisualReference(bookId, targetId, referenceType);
                if (reference) {
                    const appearance = reference.canonicalAppearance;
                    const parts: string[] = [];
                    
                    if (appearance.description) {
                        parts.push(appearance.description);
                    }
                    
                    if (appearance.keyFeatures.length > 0) {
                        parts.push(`key features: ${appearance.keyFeatures.join(', ')}`);
                    }
                    
                    if (appearance.colorPalette.length > 0) {
                        parts.push(`colors: ${appearance.colorPalette.join(', ')}`);
                    }
                    
                    if (appearance.distinctiveElements.length > 0) {
                        parts.push(`distinctive: ${appearance.distinctiveElements.join(', ')}`);
                    }
                    
                    if (parts.length > 0) {
                        promptParts.push(`${reference.targetName} (${parts.join(', ')})`);
                    }
                }
            }
            
            return promptParts.length > 0 ? `Visual consistency: ${promptParts.join('; ')}` : '';
        }, { bookId, targetCount: targetIds.length });
    }

    /**
     * Update consistency score for an image
     */
    async updateImageConsistency(
        bookId: string,
        targetId: string,
        referenceType: string,
        imageUrl: string,
        consistencyData: {
            score: number;
            deviations?: string[];
            corrections?: string[];
        }
    ): Promise<void> {
        return this.executeWithLogging('updateImageConsistency', async () => {
            const referenceId = `${bookId}_${referenceType}_${targetId}`;
            
            const reference = await VisualReference.findOne({ referenceId });
            if (!reference) {
                throw new NotFoundError('VisualReference', referenceId);
            }
            
            const imageInstance = reference.imageInstances.find(img => img.imageUrl === imageUrl);
            if (!imageInstance) {
                throw new NotFoundError('ImageInstance', imageUrl);
            }
            
            imageInstance.consistency = {
                score: consistencyData.score,
                deviations: consistencyData.deviations || [],
                corrections: consistencyData.corrections || []
            };
            
            await reference.save();
        }, { bookId, targetId, referenceType });
    }
}
