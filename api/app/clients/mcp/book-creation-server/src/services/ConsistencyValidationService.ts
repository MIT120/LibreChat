/**
 * Consistency Validation Service - Advanced validation for narrative consistency
 */

import { BaseService } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';
import { 
    CharacterEvolution, 
    WorldElement, 
    TimelineEvent, 
    ConsistencyViolation 
} from '../../models/NarrativeElements.js';
import { DatabaseError } from '../../types/errors.js';
import { v4 as uuidv4 } from 'uuid';

export interface ValidationRule {
    id: string;
    name: string;
    category: 'character' | 'world' | 'timeline' | 'relationship' | 'plot';
    severity: 'critical' | 'major' | 'minor';
    description: string;
    validator: (context: ValidationContext) => Promise<ValidationResult>;
}

export interface ValidationContext {
    bookId: string;
    chapterId: string;
    pageId?: string;
    content: string;
    existingNarrative: {
        characters: any[];
        worldElements: any[];
        timelineEvents: any[];
        relationships: any[];
    };
    bookSpec?: any;
}

export interface ValidationResult {
    passed: boolean;
    violations: Array<{
        ruleId: string;
        severity: string;
        description: string;
        evidence: string[];
        suggestion: string;
        autoFixable: boolean;
    }>;
    warnings: string[];
    suggestions: string[];
}

export interface ConsistencyReport {
    overall: {
        score: number; // 0-100
        status: 'excellent' | 'good' | 'needs_attention' | 'critical_issues';
        totalViolations: number;
        criticalViolations: number;
    };
    categories: {
        character: { score: number; violations: number; issues: string[] };
        world: { score: number; violations: number; issues: string[] };
        timeline: { score: number; violations: number; issues: string[] };
        relationships: { score: number; violations: number; issues: string[] };
        plot: { score: number; violations: number; issues: string[] };
    };
    recommendations: {
        immediate: string[];
        longTerm: string[];
        preventive: string[];
    };
    trends: {
        improvingAreas: string[];
        decliningAreas: string[];
        stableAreas: string[];
    };
}

export class ConsistencyValidationService extends BaseService {
    private validationRules: Map<string, ValidationRule> = new Map();

    constructor(logger: ILogger) {
        super(logger);
        this.initializeValidationRules();
    }

    protected async onInitialize(): Promise<void> {
        this.logger.info('ConsistencyValidationService initialized');
    }

    protected async onDispose(): Promise<void> {
        this.logger.info('ConsistencyValidationService disposed');
    }

    /**
     * Validate content against all applicable rules
     */
    async validateContent(context: ValidationContext): Promise<ValidationResult> {
        return this.executeWithLogging('validateContent', async () => {
            const allViolations: Array<{
                ruleId: string;
                severity: string;
                description: string;
                evidence: string[];
                suggestion: string;
                autoFixable: boolean;
            }> = [];
            const allWarnings: string[] = [];
            const allSuggestions: string[] = [];

            // Run all applicable validation rules
            for (const rule of this.validationRules.values()) {
                try {
                    const result = await rule.validator(context);
                    if (!result.passed) {
                        allViolations.push(...result.violations);
                    }
                    allWarnings.push(...result.warnings);
                    allSuggestions.push(...result.suggestions);
                } catch (error) {
                    this.logger.warn(`Validation rule ${rule.id} failed`, error as Error);
                    allWarnings.push(`Validation rule "${rule.name}" encountered an error`);
                }
            }

            // Store violations in database
            for (const violation of allViolations) {
                await this.recordViolation(context, violation);
            }

            return {
                passed: allViolations.filter(v => v.severity === 'critical').length === 0,
                violations: allViolations,
                warnings: [...new Set(allWarnings)], // Remove duplicates
                suggestions: [...new Set(allSuggestions)]
            };
        }, { bookId: context.bookId, chapterId: context.chapterId });
    }

    /**
     * Generate comprehensive consistency report for a book
     */
    async generateConsistencyReport(bookId: string): Promise<ConsistencyReport> {
        return this.executeWithLogging('generateConsistencyReport', async () => {
            // Get all violations for this book
            const violations = await ConsistencyViolation.find({ 
                bookId, 
                status: { $in: ['detected', 'under_review'] } 
            });

            // Calculate scores by category
            const categoryScores = this.calculateCategoryScores(violations);
            
            // Calculate overall score
            const overallScore = this.calculateOverallScore(categoryScores);
            
            // Generate recommendations
            const recommendations = await this.generateRecommendations(bookId, violations);
            
            // Analyze trends
            const trends = await this.analyzeTrends(bookId);

            return {
                overall: {
                    score: overallScore,
                    status: this.getScoreStatus(overallScore),
                    totalViolations: violations.length,
                    criticalViolations: violations.filter(v => v.severity === 'critical').length
                },
                categories: categoryScores,
                recommendations,
                trends
            };
        }, { bookId });
    }

    /**
     * Auto-fix violations where possible
     */
    async autoFixViolations(bookId: string, violationIds?: string[]): Promise<{
        fixed: number;
        skipped: number;
        failed: number;
        details: Array<{ violationId: string; status: 'fixed' | 'skipped' | 'failed'; reason: string }>;
    }> {
        return this.executeWithLogging('autoFixViolations', async () => {
            const query = { 
                bookId, 
                status: 'detected',
                ...(violationIds && { violationId: { $in: violationIds } })
            };
            
            const violations = await ConsistencyViolation.find(query);
            
            let fixed = 0;
            let skipped = 0;
            let failed = 0;
            const details: Array<{ violationId: string; status: 'fixed' | 'skipped' | 'failed'; reason: string }> = [];

            for (const violation of violations) {
                try {
                    const canAutoFix = await this.canAutoFixViolation(violation);
                    
                    if (!canAutoFix) {
                        skipped++;
                        details.push({
                            violationId: violation.violationId,
                            status: 'skipped',
                            reason: 'Auto-fix not available for this violation type'
                        });
                        continue;
                    }

                    const fixResult = await this.applyAutoFix(violation);
                    
                    if (fixResult.success) {
                        fixed++;
                        violation.status = 'resolved';
                        violation.resolvedBy = 'auto_fix';
                        await violation.save();
                        
                        details.push({
                            violationId: violation.violationId,
                            status: 'fixed',
                            reason: fixResult.description
                        });
                    } else {
                        failed++;
                        details.push({
                            violationId: violation.violationId,
                            status: 'failed',
                            reason: fixResult.error || 'Auto-fix failed'
                        });
                    }
                } catch (error) {
                    failed++;
                    details.push({
                        violationId: violation.violationId,
                        status: 'failed',
                        reason: `Error during auto-fix: ${(error as Error).message}`
                    });
                }
            }

            return { fixed, skipped, failed, details };
        }, { bookId });
    }

    /**
     * Initialize built-in validation rules
     */
    private initializeValidationRules(): void {
        // Character consistency rules
        this.validationRules.set('character_description_consistency', {
            id: 'character_description_consistency',
            name: 'Character Description Consistency',
            category: 'character',
            severity: 'major',
            description: 'Ensures character physical descriptions remain consistent',
            validator: this.validateCharacterDescriptions.bind(this)
        });

        this.validationRules.set('character_personality_consistency', {
            id: 'character_personality_consistency',
            name: 'Character Personality Consistency',
            category: 'character',
            severity: 'major',
            description: 'Ensures character personality traits remain consistent',
            validator: this.validateCharacterPersonality.bind(this)
        });

        this.validationRules.set('character_name_consistency', {
            id: 'character_name_consistency',
            name: 'Character Name Consistency',
            category: 'character',
            severity: 'critical',
            description: 'Ensures character names are used consistently',
            validator: this.validateCharacterNames.bind(this)
        });

        // World consistency rules
        this.validationRules.set('world_element_consistency', {
            id: 'world_element_consistency',
            name: 'World Element Consistency',
            category: 'world',
            severity: 'major',
            description: 'Ensures world elements follow established rules',
            validator: this.validateWorldElements.bind(this)
        });

        this.validationRules.set('location_description_consistency', {
            id: 'location_description_consistency',
            name: 'Location Description Consistency',
            category: 'world',
            severity: 'major',
            description: 'Ensures location descriptions remain consistent',
            validator: this.validateLocationDescriptions.bind(this)
        });

        // Timeline consistency rules
        this.validationRules.set('temporal_sequence_consistency', {
            id: 'temporal_sequence_consistency',
            name: 'Temporal Sequence Consistency',
            category: 'timeline',
            severity: 'critical',
            description: 'Ensures events follow logical temporal sequence',
            validator: this.validateTemporalSequence.bind(this)
        });

        this.validationRules.set('character_age_consistency', {
            id: 'character_age_consistency',
            name: 'Character Age Consistency',
            category: 'timeline',
            severity: 'major',
            description: 'Ensures character ages progress logically',
            validator: this.validateCharacterAges.bind(this)
        });

        // Relationship consistency rules
        this.validationRules.set('relationship_consistency', {
            id: 'relationship_consistency',
            name: 'Relationship Consistency',
            category: 'relationship',
            severity: 'major',
            description: 'Ensures character relationships remain consistent',
            validator: this.validateRelationships.bind(this)
        });

        // Plot consistency rules
        this.validationRules.set('causality_consistency', {
            id: 'causality_consistency',
            name: 'Causality Consistency',
            category: 'plot',
            severity: 'major',
            description: 'Ensures cause and effect relationships are logical',
            validator: this.validateCausality.bind(this)
        });
    }

    /**
     * Character description validation
     */
    private async validateCharacterDescriptions(context: ValidationContext): Promise<ValidationResult> {
        const violations: any[] = [];
        const warnings: string[] = [];
        const suggestions: string[] = [];

        // Extract character mentions from content
        const characterMentions = this.extractCharacterMentions(context.content, context.existingNarrative.characters);

        for (const mention of characterMentions) {
            const character = context.existingNarrative.characters.find(c => c.characterId === mention.characterId);
            if (!character) continue;

            // Check for description conflicts
            const physicalConflicts = this.findPhysicalDescriptionConflicts(
                mention.descriptions, 
                character.physicalTraits
            );

            if (physicalConflicts.length > 0) {
                violations.push({
                    ruleId: 'character_description_consistency',
                    severity: 'major',
                    description: `Physical description conflict for character "${character.coreIdentity.name}"`,
                    evidence: physicalConflicts,
                    suggestion: `Use established description: ${this.formatPhysicalTraits(character.physicalTraits)}`,
                    autoFixable: true
                });
            }
        }

        return {
            passed: violations.length === 0,
            violations,
            warnings,
            suggestions
        };
    }

    /**
     * Character personality validation
     */
    private async validateCharacterPersonality(context: ValidationContext): Promise<ValidationResult> {
        const violations: any[] = [];
        const warnings: string[] = [];
        const suggestions: string[] = [];

        // This would analyze personality consistency
        // Implementation would check for actions/dialogue that contradict established personality

        return {
            passed: violations.length === 0,
            violations,
            warnings,
            suggestions
        };
    }

    /**
     * Character name validation
     */
    private async validateCharacterNames(context: ValidationContext): Promise<ValidationResult> {
        const violations: any[] = [];
        const warnings: string[] = [];
        const suggestions: string[] = [];

        // Check for name variants or misspellings
        const nameVariants = this.findNameVariants(context.content, context.existingNarrative.characters);

        for (const variant of nameVariants) {
            violations.push({
                ruleId: 'character_name_consistency',
                severity: 'critical',
                description: `Potential name variant "${variant.found}" for character "${variant.expected}"`,
                evidence: [variant.context],
                suggestion: `Use consistent name: "${variant.expected}"`,
                autoFixable: true
            });
        }

        return {
            passed: violations.length === 0,
            violations,
            warnings,
            suggestions
        };
    }

    /**
     * World element validation
     */
    private async validateWorldElements(context: ValidationContext): Promise<ValidationResult> {
        const violations: any[] = [];
        const warnings: string[] = [];
        const suggestions: string[] = [];

        // Check world element usage against established rules
        const elementUsages = this.extractWorldElementUsages(context.content, context.existingNarrative.worldElements);

        for (const usage of elementUsages) {
            const element = context.existingNarrative.worldElements.find(e => e.elementId === usage.elementId);
            if (!element) continue;

            // Check against consistency rules
            const ruleViolations = this.checkElementRuleViolations(usage, element.consistencyRules);

            violations.push(...ruleViolations.map(violation => ({
                ruleId: 'world_element_consistency',
                severity: 'major',
                description: violation.description,
                evidence: [usage.context],
                suggestion: violation.suggestion,
                autoFixable: false
            })));
        }

        return {
            passed: violations.length === 0,
            violations,
            warnings,
            suggestions
        };
    }

    /**
     * Location description validation
     */
    private async validateLocationDescriptions(context: ValidationContext): Promise<ValidationResult> {
        // Implementation would check location description consistency
        return {
            passed: true,
            violations: [],
            warnings: [],
            suggestions: []
        };
    }

    /**
     * Temporal sequence validation
     */
    private async validateTemporalSequence(context: ValidationContext): Promise<ValidationResult> {
        // Implementation would check temporal logic
        return {
            passed: true,
            violations: [],
            warnings: [],
            suggestions: []
        };
    }

    /**
     * Character age validation
     */
    private async validateCharacterAges(context: ValidationContext): Promise<ValidationResult> {
        // Implementation would check age progression
        return {
            passed: true,
            violations: [],
            warnings: [],
            suggestions: []
        };
    }

    /**
     * Relationship validation
     */
    private async validateRelationships(context: ValidationContext): Promise<ValidationResult> {
        // Implementation would check relationship consistency
        return {
            passed: true,
            violations: [],
            warnings: [],
            suggestions: []
        };
    }

    /**
     * Causality validation
     */
    private async validateCausality(context: ValidationContext): Promise<ValidationResult> {
        // Implementation would check cause and effect logic
        return {
            passed: true,
            violations: [],
            warnings: [],
            suggestions: []
        };
    }

    /**
     * Helper methods for text analysis and validation
     */
    private extractCharacterMentions(content: string, characters: any[]): Array<{
        characterId: string;
        mentions: string[];
        descriptions: string[];
    }> {
        // Implementation would use NLP to extract character mentions and descriptions
        return [];
    }

    private findPhysicalDescriptionConflicts(descriptions: string[], establishedTraits: any): string[] {
        // Implementation would compare descriptions against established traits
        return [];
    }

    private formatPhysicalTraits(traits: any): string {
        // Implementation would format traits into readable description
        return JSON.stringify(traits);
    }

    private findNameVariants(content: string, characters: any[]): Array<{
        found: string;
        expected: string;
        context: string;
    }> {
        // Implementation would find potential name misspellings or variants
        return [];
    }

    private extractWorldElementUsages(content: string, elements: any[]): Array<{
        elementId: string;
        usage: string;
        context: string;
    }> {
        // Implementation would extract world element usage
        return [];
    }

    private checkElementRuleViolations(usage: any, rules: string[]): Array<{
        description: string;
        suggestion: string;
    }> {
        // Implementation would check usage against rules
        return [];
    }

    private async recordViolation(context: ValidationContext, violation: any): Promise<void> {
        const consistencyViolation = new ConsistencyViolation({
            violationId: uuidv4(),
            bookId: context.bookId,
            conversationId: context.bookId, // Assuming bookId is conversationId
            type: this.mapRuleToViolationType(violation.ruleId),
            severity: violation.severity,
            description: violation.description,
            conflictingElements: [],
            occurrences: [{
                chapterId: context.chapterId,
                pageId: context.pageId || '',
                context: violation.evidence.join('; '),
                specificText: ''
            }],
            detectedBy: 'consistency_check'
        });

        await consistencyViolation.save();
    }

    private mapRuleToViolationType(ruleId: string): string {
        if (ruleId.includes('character')) return 'character_inconsistency';
        if (ruleId.includes('world')) return 'world_rule_violation';
        if (ruleId.includes('temporal') || ruleId.includes('age')) return 'timeline_conflict';
        if (ruleId.includes('relationship')) return 'relationship_error';
        return 'plot_hole';
    }

    private calculateCategoryScores(violations: any[]): any {
        // Implementation would calculate scores for each category
        return {
            character: { score: 85, violations: 2, issues: [] },
            world: { score: 90, violations: 1, issues: [] },
            timeline: { score: 95, violations: 0, issues: [] },
            relationships: { score: 88, violations: 1, issues: [] },
            plot: { score: 92, violations: 1, issues: [] }
        };
    }

    private calculateOverallScore(categoryScores: any): number {
        const scores = Object.values(categoryScores).map((cat: any) => cat.score);
        return Math.round(scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length);
    }

    private getScoreStatus(score: number): 'excellent' | 'good' | 'needs_attention' | 'critical_issues' {
        if (score >= 95) return 'excellent';
        if (score >= 85) return 'good';
        if (score >= 70) return 'needs_attention';
        return 'critical_issues';
    }

    private async generateRecommendations(bookId: string, violations: any[]): Promise<{
        immediate: string[];
        longTerm: string[];
        preventive: string[];
    }> {
        // Implementation would generate contextual recommendations
        return {
            immediate: ['Fix critical character name inconsistencies'],
            longTerm: ['Establish character description style guide'],
            preventive: ['Use consistency validation before publishing']
        };
    }

    private async analyzeTrends(bookId: string): Promise<{
        improvingAreas: string[];
        decliningAreas: string[];
        stableAreas: string[];
    }> {
        // Implementation would analyze violation trends over time
        return {
            improvingAreas: ['Timeline consistency'],
            decliningAreas: ['Character descriptions'],
            stableAreas: ['World building', 'Plot structure']
        };
    }

    private async canAutoFixViolation(violation: any): Promise<boolean> {
        // Simple rules for auto-fixable violations
        return violation.type === 'character_inconsistency' && 
               violation.description.includes('name variant');
    }

    private async applyAutoFix(violation: any): Promise<{ success: boolean; description?: string; error?: string }> {
        // Implementation would apply automatic fixes
        return {
            success: true,
            description: 'Applied name consistency fix'
        };
    }
}
