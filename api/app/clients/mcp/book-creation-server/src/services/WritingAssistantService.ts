/**
 * Writing Assistant Service - AI-powered writing assistance and style guidance
 */

import axios from 'axios';
import { BaseService } from '../core/BaseService.js';
import { ILogger } from '../core/Logger.js';
import { IBook, IWritingStyle } from '../../types/book.js';
import { generateShortLivedToken } from '~/server/services/AuthService.js';

export interface WritingAssistanceRequest {
    bookId: string;
    userId: string;
    content: string;
    context: {
        chapterId?: string;
        sectionType?: 'dialogue' | 'narrative' | 'description' | 'action';
        characterContext?: string[];
        previousParagraphs?: string[];
        targetStyle?: IWritingStyle;
    };
    assistanceType: 'suggestions' | 'continuation' | 'dialogue_enhancement' | 'style_check';
}

export interface WritingSuggestion {
    type: 'grammar' | 'style' | 'clarity' | 'engagement' | 'consistency';
    severity: 'low' | 'medium' | 'high';
    message: string;
    suggestion: string;
    position: {
        start: number;
        end: number;
        line?: number;
        column?: number;
    };
    originalText: string;
    suggestedText: string;
    explanation: string;
    examples?: string[];
}

export interface ContentContinuation {
    suggestions: Array<{
        content: string;
        confidence: number;
        approach: string;
        reasoning: string;
        wordCount: number;
    }>;
    styleAnalysis: {
        maintainedElements: string[];
        suggestedAdjustments: string[];
    };
}

export interface DialogueEnhancement {
    originalDialogue: string;
    enhancedVersions: Array<{
        dialogue: string;
        improvements: string[];
        characterVoice: {
            consistency: number;
            distinctiveness: number;
            authenticity: number;
        };
        reasoning: string;
    }>;
    voiceAnalysis: {
        characterName?: string;
        traits: string[];
        speechPatterns: string[];
        vocabularyLevel: string;
        emotionalTone: string;
    };
}

export interface StyleConsistencyReport {
    overallScore: number;
    elements: {
        tone: {
            score: number;
            issues: string[];
            examples: Array<{ text: string; issue: string; suggestion: string }>;
        };
        voice: {
            score: number;
            inconsistencies: string[];
            recommendations: string[];
        };
        vocabulary: {
            score: number;
            levelVariations: string[];
            suggestions: string[];
        };
        sentenceStructure: {
            score: number;
            patterns: string[];
            recommendations: string[];
        };
    };
    referenceComparison?: {
        similarityScore: number;
        matchingElements: string[];
        deviations: string[];
    };
}

export interface RealTimeWritingFeedback {
    suggestions: WritingSuggestion[];
    styleScore: number;
    readabilityScore: number;
    engagementMetrics: {
        dialogueRatio: number;
        averageSentenceLength: number;
        vocabularyComplexity: number;
        paceIndicators: string[];
    };
    nextSentenceSuggestions?: string[];
}

export class WritingAssistantService extends BaseService {
    private readonly CHARACTER_VOICE_CACHE = new Map<string, any>();
    private readonly STYLE_PATTERNS_CACHE = new Map<string, any>();

    constructor(logger: ILogger) {
        super(logger);
    }

    protected async onInitialize(): Promise<void> {
        // Initialize AI writing models and load common style patterns
        await this.loadStylePatterns();
        this.logger.info('WritingAssistantService initialized');
    }

    protected async onDispose(): Promise<void> {
        this.CHARACTER_VOICE_CACHE.clear();
        this.STYLE_PATTERNS_CACHE.clear();
        this.logger.info('WritingAssistantService disposed');
    }

    protected async performHealthCheck() {
        return {
            status: 'healthy' as const,
            message: 'Writing Assistant Service operational',
            lastCheck: new Date(),
        };
    }

    /**
     * Provide real-time writing suggestions based on style analysis
     */
    async getWritingSuggestions(request: WritingAssistanceRequest): Promise<WritingSuggestion[]> {
        return this.executeWithLogging('getWritingSuggestions', async () => {
            const { content, context, bookId } = request;

            // Analyze current content
            const suggestions: WritingSuggestion[] = [];

            // Grammar and basic style checks
            const grammarSuggestions = await this.analyzeGrammarAndStyle(content);
            suggestions.push(...grammarSuggestions);

            // Style consistency checks against target style
            if (context.targetStyle) {
                const styleSuggestions = await this.analyzeStyleConsistency(content, context.targetStyle, bookId);
                suggestions.push(...styleSuggestions);
            }

            // Context-specific suggestions
            if (context.sectionType) {
                const contextSuggestions = await this.getContextSpecificSuggestions(content, context.sectionType);
                suggestions.push(...contextSuggestions);
            }

            // Character voice consistency (for dialogue)
            if (context.sectionType === 'dialogue' && context.characterContext) {
                const voiceSuggestions = await this.analyzeCharacterVoice(content, context.characterContext, bookId);
                suggestions.push(...voiceSuggestions);
            }

            // Rank suggestions by importance
            return this.rankSuggestions(suggestions);
        }, { bookId: request.bookId, contentLength: request.content.length });
    }

    /**
     * Generate content continuation when writers hit blocks
     */
    async generateContentContinuation(request: WritingAssistanceRequest): Promise<ContentContinuation> {
        return this.executeWithLogging('generateContentContinuation', async () => {
            const { content, context, bookId } = request;

            // Analyze existing content style
            const styleAnalysis = await this.analyzeExistingStyle(content, context.targetStyle);

            // Generate multiple continuation options
            const continuationPrompts = this.buildContinuationPrompts(content, context);
            const suggestions: ContentContinuation['suggestions'] = [];

            for (const prompt of continuationPrompts) {
                try {
                    const continuation = await this.generateAIContent({
                        prompt,
                        context: {
                            bookId,
                            previousContent: content,
                            style: context.targetStyle,
                            characters: context.characterContext
                        },
                        options: {
                            maxTokens: 300,
                            temperature: 0.7,
                            creativity: 'balanced'
                        }
                    });

                    suggestions.push({
                        content: continuation.content,
                        confidence: continuation.confidence,
                        approach: prompt.approach,
                        reasoning: continuation.reasoning,
                        wordCount: continuation.content.split(' ').length
                    });
                } catch (error) {
                    this.logger.warn('Failed to generate continuation', error as Error, { approach: prompt.approach });
                }
            }

            return {
                suggestions: suggestions.slice(0, 5), // Top 5 suggestions
                styleAnalysis: {
                    maintainedElements: styleAnalysis.maintainedElements,
                    suggestedAdjustments: styleAnalysis.adjustments
                }
            };
        }, { bookId: request.bookId });
    }

    /**
     * Enhance dialogue for realism and character voice consistency
     */
    async enhanceDialogue(request: WritingAssistanceRequest): Promise<DialogueEnhancement> {
        return this.executeWithLogging('enhanceDialogue', async () => {
            const { content, context, bookId } = request;

            // Extract dialogue from content
            const dialogue = this.extractDialogue(content);
            if (!dialogue) {
                throw new Error('No dialogue found in provided content');
            }

            // Analyze character voice
            const voiceAnalysis = await this.analyzeDialogueVoice(dialogue, context.characterContext, bookId);

            // Generate enhanced versions
            const enhancedVersions: DialogueEnhancement['enhancedVersions'] = [];

            // Approach 1: Improve authenticity
            const authenticVersion = await this.enhanceForAuthenticity(dialogue, voiceAnalysis);
            enhancedVersions.push(authenticVersion);

            // Approach 2: Improve character distinctiveness
            const distinctiveVersion = await this.enhanceForDistinctiveness(dialogue, voiceAnalysis, context.characterContext);
            enhancedVersions.push(distinctiveVersion);

            // Approach 3: Improve emotional resonance
            const emotionalVersion = await this.enhanceForEmotion(dialogue, voiceAnalysis);
            enhancedVersions.push(emotionalVersion);

            return {
                originalDialogue: dialogue,
                enhancedVersions,
                voiceAnalysis
            };
        }, { bookId: request.bookId });
    }

    /**
     * Check style consistency throughout the book
     */
    async checkStyleConsistency(bookId: string, userId: string, targetStyle?: IWritingStyle): Promise<StyleConsistencyReport> {
        return this.executeWithLogging('checkStyleConsistency', async () => {
            // Get book content from database/RAG
            const bookContent = await this.getBookContent(bookId, userId);
            const analysisStyle = targetStyle || await this.inferBookStyle(bookContent);

            // Analyze different style elements
            const toneAnalysis = await this.analyzeToneConsistency(bookContent, analysisStyle);
            const voiceAnalysis = await this.analyzeVoiceConsistency(bookContent, analysisStyle);
            const vocabularyAnalysis = await this.analyzeVocabularyConsistency(bookContent, analysisStyle);
            const structureAnalysis = await this.analyzeSentenceStructureConsistency(bookContent, analysisStyle);

            // Calculate overall score
            const overallScore = (
                toneAnalysis.score * 0.3 +
                voiceAnalysis.score * 0.25 +
                vocabularyAnalysis.score * 0.25 +
                structureAnalysis.score * 0.2
            );

            // Compare with reference books if available
            let referenceComparison;
            if (targetStyle) {
                referenceComparison = await this.compareWithReferences(bookContent, targetStyle, bookId);
            }

            return {
                overallScore,
                elements: {
                    tone: toneAnalysis,
                    voice: voiceAnalysis,
                    vocabulary: vocabularyAnalysis,
                    sentenceStructure: structureAnalysis
                },
                referenceComparison
            };
        }, { bookId });
    }

    /**
     * Get real-time writing feedback as user types
     */
    async getRealTimeFeedback(request: WritingAssistanceRequest): Promise<RealTimeWritingFeedback> {
        return this.executeWithLogging('getRealTimeFeedback', async () => {
            const { content, context } = request;

            // Quick analysis for real-time feedback
            const suggestions = await this.getQuickSuggestions(content, context);
            const styleScore = await this.calculateQuickStyleScore(content, context.targetStyle);
            const readabilityScore = this.calculateReadabilityScore(content);
            const engagementMetrics = this.calculateEngagementMetrics(content);

            // Generate next sentence suggestions
            let nextSentenceSuggestions;
            if (content.length > 50) {
                nextSentenceSuggestions = await this.generateNextSentenceSuggestions(content, context);
            }

            return {
                suggestions,
                styleScore,
                readabilityScore,
                engagementMetrics,
                nextSentenceSuggestions
            };
        }, { contentLength: request.content.length });
    }

    // Private helper methods

    private async loadStylePatterns(): Promise<void> {
        // Load common writing style patterns for analysis
        const patterns = {
            formal: {
                sentenceLength: { min: 15, max: 25 },
                vocabulary: 'advanced',
                contractions: false,
                personalPronouns: 'minimal'
            },
            casual: {
                sentenceLength: { min: 8, max: 18 },
                vocabulary: 'simple',
                contractions: true,
                personalPronouns: 'frequent'
            },
            literary: {
                sentenceLength: { min: 12, max: 30 },
                vocabulary: 'varied',
                metaphors: 'frequent',
                complexStructures: true
            }
        };

        this.STYLE_PATTERNS_CACHE.set('patterns', patterns);
    }

    private async analyzeGrammarAndStyle(content: string): Promise<WritingSuggestion[]> {
        const suggestions: WritingSuggestion[] = [];

        // Basic grammar checks
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        sentences.forEach((sentence, index) => {
            const trimmed = sentence.trim();
            
            // Check for passive voice
            if (this.hasPassiveVoice(trimmed)) {
                suggestions.push({
                    type: 'style',
                    severity: 'medium',
                    message: 'Consider using active voice for stronger impact',
                    suggestion: 'Convert to active voice',
                    position: { start: 0, end: trimmed.length },
                    originalText: trimmed,
                    suggestedText: this.convertToActiveVoice(trimmed),
                    explanation: 'Active voice makes your writing more direct and engaging',
                    examples: ['Instead of "The ball was thrown by John" try "John threw the ball"']
                });
            }

            // Check sentence length
            const wordCount = trimmed.split(' ').length;
            if (wordCount > 30) {
                suggestions.push({
                    type: 'clarity',
                    severity: 'medium',
                    message: 'This sentence is quite long and may be hard to follow',
                    suggestion: 'Consider breaking into shorter sentences',
                    position: { start: 0, end: trimmed.length },
                    originalText: trimmed,
                    suggestedText: this.suggestSentenceBreaking(trimmed),
                    explanation: 'Shorter sentences improve readability and comprehension'
                });
            }

            // Check for repeated words
            const words = trimmed.toLowerCase().split(' ');
            const wordCounts = new Map<string, number>();
            words.forEach(word => {
                if (word.length > 3) {
                    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
                }
            });

            wordCounts.forEach((count, word) => {
                if (count > 2) {
                    suggestions.push({
                        type: 'style',
                        severity: 'low',
                        message: `The word "${word}" is repeated ${count} times`,
                        suggestion: 'Consider using synonyms for variety',
                        position: { start: 0, end: trimmed.length },
                        originalText: trimmed,
                        suggestedText: this.suggestSynonyms(trimmed, word),
                        explanation: 'Word variety keeps readers engaged and improves flow'
                    });
                }
            });
        });

        return suggestions;
    }

    private async analyzeStyleConsistency(content: string, targetStyle: IWritingStyle, bookId: string): Promise<WritingSuggestion[]> {
        const suggestions: WritingSuggestion[] = [];

        // Analyze against target style
        const currentTone = this.analyzeTone(content);
        if (currentTone !== targetStyle.tone) {
            suggestions.push({
                type: 'consistency',
                severity: 'high',
                message: `Tone inconsistency detected. Expected ${targetStyle.tone}, found ${currentTone}`,
                suggestion: `Adjust tone to match ${targetStyle.tone} style`,
                position: { start: 0, end: content.length },
                originalText: content,
                suggestedText: await this.adjustTone(content, targetStyle.tone),
                explanation: `Maintaining consistent tone is crucial for reader engagement`
            });
        }

        // Check vocabulary level consistency
        const vocabLevel = this.analyzeVocabularyLevel(content);
        if (vocabLevel !== targetStyle.vocabulary) {
            suggestions.push({
                type: 'consistency',
                severity: 'medium',
                message: `Vocabulary level mismatch. Expected ${targetStyle.vocabulary}, found ${vocabLevel}`,
                suggestion: `Adjust vocabulary to ${targetStyle.vocabulary} level`,
                position: { start: 0, end: content.length },
                originalText: content,
                suggestedText: await this.adjustVocabulary(content, targetStyle.vocabulary),
                explanation: 'Consistent vocabulary level maintains reader accessibility'
            });
        }

        return suggestions;
    }

    private async getContextSpecificSuggestions(content: string, sectionType: string): Promise<WritingSuggestion[]> {
        const suggestions: WritingSuggestion[] = [];

        switch (sectionType) {
            case 'dialogue':
                if (!this.hasDialogue(content)) {
                    suggestions.push({
                        type: 'engagement',
                        severity: 'medium',
                        message: 'No dialogue found in dialogue section',
                        suggestion: 'Add character dialogue to bring the scene to life',
                        position: { start: 0, end: content.length },
                        originalText: content,
                        suggestedText: await this.suggestDialogueAddition(content),
                        explanation: 'Dialogue adds personality and moves the story forward'
                    });
                }
                break;

            case 'action':
                if (this.getAverageVerbCount(content) < 0.15) {
                    suggestions.push({
                        type: 'engagement',
                        severity: 'medium',
                        message: 'Action scene lacks dynamic verbs',
                        suggestion: 'Add more action verbs to increase pace and excitement',
                        position: { start: 0, end: content.length },
                        originalText: content,
                        suggestedText: await this.enhanceActionVerbs(content),
                        explanation: 'Strong verbs create vivid action sequences'
                    });
                }
                break;

            case 'description':
                if (this.getSensoryDetailCount(content) < 2) {
                    suggestions.push({
                        type: 'engagement',
                        severity: 'low',
                        message: 'Description could benefit from more sensory details',
                        suggestion: 'Add details that appeal to different senses',
                        position: { start: 0, end: content.length },
                        originalText: content,
                        suggestedText: await this.enhanceSensoryDetails(content),
                        explanation: 'Sensory details help readers visualize and connect with the scene'
                    });
                }
                break;
        }

        return suggestions;
    }

    private async analyzeCharacterVoice(content: string, characters: string[], bookId: string): Promise<WritingSuggestion[]> {
        const suggestions: WritingSuggestion[] = [];

        for (const character of characters) {
            const characterVoice = await this.getCharacterVoice(character, bookId);
            if (characterVoice) {
                const voiceConsistency = this.checkVoiceConsistency(content, characterVoice);
                if (voiceConsistency.score < 0.7) {
                    suggestions.push({
                        type: 'consistency',
                        severity: 'high',
                        message: `${character}'s dialogue doesn't match established voice`,
                        suggestion: `Adjust dialogue to match ${character}'s speaking patterns`,
                        position: { start: 0, end: content.length },
                        originalText: content,
                        suggestedText: await this.adjustCharacterVoice(content, character, characterVoice),
                        explanation: `Consistent character voice helps readers distinguish between speakers`
                    });
                }
            }
        }

        return suggestions;
    }

    private rankSuggestions(suggestions: WritingSuggestion[]): WritingSuggestion[] {
        // Sort by severity and type importance
        const severityWeight = { high: 3, medium: 2, low: 1 };
        const typeWeight = { consistency: 3, clarity: 2, engagement: 2, style: 1, grammar: 3 };

        return suggestions.sort((a, b) => {
            const scoreA = severityWeight[a.severity] + typeWeight[a.type];
            const scoreB = severityWeight[b.severity] + typeWeight[b.type];
            return scoreB - scoreA;
        });
    }

    private async analyzeExistingStyle(content: string, targetStyle?: IWritingStyle): Promise<{
        maintainedElements: string[];
        adjustments: string[];
    }> {
        const maintainedElements: string[] = [];
        const adjustments: string[] = [];

        // Analyze current style elements
        const currentTone = this.analyzeTone(content);
        const currentVocab = this.analyzeVocabularyLevel(content);
        const currentPacing = this.analyzePacing(content);

        if (targetStyle) {
            if (currentTone === targetStyle.tone) {
                maintainedElements.push(`Consistent ${currentTone} tone`);
            } else {
                adjustments.push(`Adjust tone from ${currentTone} to ${targetStyle.tone}`);
            }

            if (currentVocab === targetStyle.vocabulary) {
                maintainedElements.push(`Appropriate ${currentVocab} vocabulary level`);
            } else {
                adjustments.push(`Adjust vocabulary from ${currentVocab} to ${targetStyle.vocabulary}`);
            }
        } else {
            maintainedElements.push(`${currentTone} tone`, `${currentVocab} vocabulary`, `${currentPacing} pacing`);
        }

        return { maintainedElements, adjustments };
    }

    private buildContinuationPrompts(content: string, context: any): Array<{
        prompt: string;
        approach: string;
    }> {
        const lastSentence = content.split(/[.!?]+/).slice(-1)[0]?.trim();
        const prompts = [];

        // Approach 1: Direct continuation
        prompts.push({
            prompt: `Continue this story naturally from where it left off: "${lastSentence}"`,
            approach: 'direct_continuation'
        });

        // Approach 2: Character action
        if (context.characterContext) {
            prompts.push({
                prompt: `Continue the story by having ${context.characterContext[0]} take action based on: "${lastSentence}"`,
                approach: 'character_action'
            });
        }

        // Approach 3: Scene transition
        prompts.push({
            prompt: `Transition to a new scene or moment following: "${lastSentence}"`,
            approach: 'scene_transition'
        });

        // Approach 4: Dialogue introduction
        prompts.push({
            prompt: `Continue with dialogue that naturally follows: "${lastSentence}"`,
            approach: 'dialogue_focus'
        });

        // Approach 5: Tension escalation
        prompts.push({
            prompt: `Increase tension and conflict following this moment: "${lastSentence}"`,
            approach: 'tension_escalation'
        });

        return prompts;
    }

    private async generateAIContent(params: {
        prompt: string;
        context: any;
        options: any;
    }): Promise<{
        content: string;
        confidence: number;
        reasoning: string;
    }> {
        // Mock AI content generation - in reality, integrate with AI service
        const mockContent = this.generateMockContinuation(params.prompt, params.context);
        
        return {
            content: mockContent,
            confidence: Math.random() * 0.3 + 0.7, // 0.7-1.0
            reasoning: `Generated based on ${params.options.creativity} approach with style consistency`
        };
    }

    private generateMockContinuation(prompt: string, context: any): string {
        const continuations = [
            "The silence stretched between them, heavy with unspoken words.",
            "Without warning, the door burst open, flooding the room with harsh light.",
            "She knew then that nothing would ever be the same again.",
            "The sound of footsteps echoed down the empty corridor.",
            "Time seemed to slow as the realization dawned on him."
        ];
        
        return continuations[Math.floor(Math.random() * continuations.length)];
    }

    // Utility methods for text analysis
    private hasPassiveVoice(sentence: string): boolean {
        const passivePatterns = /\b(was|were|been|being)\s+\w+ed\b/i;
        return passivePatterns.test(sentence);
    }

    private convertToActiveVoice(sentence: string): string {
        // Simple conversion logic - in practice, this would be more sophisticated
        return sentence.replace(/\b(was|were)\s+(\w+ed)\s+by\s+(\w+)/i, '$3 $2');
    }

    private suggestSentenceBreaking(sentence: string): string {
        // Find appropriate break points (conjunctions, relative clauses)
        const breakPoints = [', and ', ', but ', ', which ', ', that '];
        for (const point of breakPoints) {
            if (sentence.includes(point)) {
                return sentence.replace(point, '. ');
            }
        }
        return sentence;
    }

    private suggestSynonyms(text: string, word: string): string {
        // Mock synonym replacement - in practice, use a thesaurus API
        const synonyms: Record<string, string[]> = {
            'said': ['declared', 'mentioned', 'stated', 'remarked'],
            'went': ['traveled', 'moved', 'proceeded', 'ventured'],
            'big': ['large', 'enormous', 'massive', 'substantial']
        };
        
        const wordSynonyms = synonyms[word.toLowerCase()];
        if (wordSynonyms) {
            return text.replace(new RegExp(`\\b${word}\\b`, 'gi'), wordSynonyms[0]);
        }
        return text;
    }

    private analyzeTone(content: string): string {
        // Simple tone analysis based on word patterns
        const positiveWords = content.match(/\b(bright|happy|joy|love|hope|success)\b/gi)?.length || 0;
        const negativeWords = content.match(/\b(dark|sad|fear|hate|despair|failure)\b/gi)?.length || 0;
        const formalWords = content.match(/\b(however|therefore|consequently|furthermore)\b/gi)?.length || 0;
        
        if (formalWords > 0) return 'formal';
        if (positiveWords > negativeWords) return 'optimistic';
        if (negativeWords > positiveWords) return 'serious';
        return 'neutral';
    }

    private analyzeVocabularyLevel(content: string): string {
        const words = content.split(' ');
        const complexWords = words.filter(word => word.length > 7).length;
        const ratio = complexWords / words.length;
        
        if (ratio > 0.3) return 'advanced';
        if (ratio > 0.15) return 'intermediate';
        return 'simple';
    }

    private analyzePacing(content: string): string {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
        
        if (avgLength < 50) return 'fast';
        if (avgLength > 100) return 'slow';
        return 'moderate';
    }

    private async adjustTone(content: string, targetTone: string): string {
        // Mock tone adjustment - in practice, use AI to rewrite
        return `[Adjusted to ${targetTone} tone] ${content}`;
    }

    private async adjustVocabulary(content: string, targetLevel: string): string {
        // Mock vocabulary adjustment
        return `[Adjusted to ${targetLevel} vocabulary] ${content}`;
    }

    private hasDialogue(content: string): boolean {
        return /["'].*["']/.test(content);
    }

    private async suggestDialogueAddition(content: string): string {
        return `${content}\n\n"Let me think about this," she said, pausing to consider the implications.`;
    }

    private getAverageVerbCount(content: string): number {
        const words = content.split(' ');
        const verbs = words.filter(word => this.isActionVerb(word));
        return verbs.length / words.length;
    }

    private isActionVerb(word: string): boolean {
        const actionVerbs = ['run', 'jump', 'fight', 'chase', 'grab', 'throw', 'hit', 'strike'];
        return actionVerbs.includes(word.toLowerCase());
    }

    private async enhanceActionVerbs(content: string): string {
        return content.replace(/\bwent\b/g, 'rushed').replace(/\bmoved\b/g, 'darted');
    }

    private getSensoryDetailCount(content: string): number {
        const sensoryWords = content.match(/\b(see|hear|smell|taste|feel|touch|bright|loud|soft|rough|sweet|bitter)\b/gi);
        return sensoryWords?.length || 0;
    }

    private async enhanceSensoryDetails(content: string): string {
        return `${content} The air carried the scent of rain and distant flowers.`;
    }

    private async getCharacterVoice(character: string, bookId: string): Promise<any> {
        // Mock character voice retrieval
        return this.CHARACTER_VOICE_CACHE.get(`${bookId}-${character}`) || {
            vocabulary: 'casual',
            patterns: ['uses contractions', 'short sentences'],
            tone: 'friendly'
        };
    }

    private checkVoiceConsistency(content: string, characterVoice: any): { score: number } {
        // Mock voice consistency check
        return { score: Math.random() * 0.4 + 0.6 }; // 0.6-1.0
    }

    private async adjustCharacterVoice(content: string, character: string, voice: any): string {
        return `[Adjusted to match ${character}'s voice] ${content}`;
    }

    private extractDialogue(content: string): string | null {
        const dialogueMatch = content.match(/"[^"]*"/);
        return dialogueMatch ? dialogueMatch[0] : null;
    }

    private async analyzeDialogueVoice(dialogue: string, characters?: string[], bookId?: string): Promise<DialogueEnhancement['voiceAnalysis']> {
        return {
            characterName: characters?.[0],
            traits: ['direct', 'confident'],
            speechPatterns: ['uses contractions', 'casual tone'],
            vocabularyLevel: 'intermediate',
            emotionalTone: 'neutral'
        };
    }

    private async enhanceForAuthenticity(dialogue: string, voice: any): Promise<DialogueEnhancement['enhancedVersions'][0]> {
        return {
            dialogue: dialogue.replace(/cannot/g, "can't").replace(/will not/g, "won't"),
            improvements: ['Added contractions for natural speech', 'Simplified formal language'],
            characterVoice: {
                consistency: 0.9,
                distinctiveness: 0.8,
                authenticity: 0.95
            },
            reasoning: 'Made dialogue more natural by using contractions and casual language'
        };
    }

    private async enhanceForDistinctiveness(dialogue: string, voice: any, characters?: string[]): Promise<DialogueEnhancement['enhancedVersions'][0]> {
        return {
            dialogue: dialogue + ' (with character-specific speech patterns)',
            improvements: ['Added unique speech patterns', 'Enhanced character-specific vocabulary'],
            characterVoice: {
                consistency: 0.85,
                distinctiveness: 0.95,
                authenticity: 0.8
            },
            reasoning: 'Enhanced unique speaking patterns to distinguish from other characters'
        };
    }

    private async enhanceForEmotion(dialogue: string, voice: any): Promise<DialogueEnhancement['enhancedVersions'][0]> {
        return {
            dialogue: dialogue + ' (with emotional undertones)',
            improvements: ['Added emotional subtext', 'Enhanced emotional resonance'],
            characterVoice: {
                consistency: 0.8,
                distinctiveness: 0.7,
                authenticity: 0.9
            },
            reasoning: 'Added emotional depth and subtext to enhance reader connection'
        };
    }

    private async getBookContent(bookId: string, userId: string): Promise<string> {
        // Mock book content retrieval
        return "Sample book content for analysis...";
    }

    private async inferBookStyle(content: string): Promise<IWritingStyle> {
        return {
            tone: this.analyzeTone(content),
            vocabulary: this.analyzeVocabularyLevel(content),
            voice: 'third_person'
        };
    }

    private async analyzeToneConsistency(content: string, style: IWritingStyle): Promise<StyleConsistencyReport['elements']['tone']> {
        return {
            score: 0.8,
            issues: ['Occasional formal language in casual sections'],
            examples: [
                {
                    text: 'Therefore, one must consider...',
                    issue: 'Formal tone in casual context',
                    suggestion: 'So, you should think about...'
                }
            ]
        };
    }

    private async analyzeVoiceConsistency(content: string, style: IWritingStyle): Promise<StyleConsistencyReport['elements']['voice']> {
        return {
            score: 0.9,
            inconsistencies: ['Minor perspective shifts'],
            recommendations: ['Maintain consistent narrative voice throughout']
        };
    }

    private async analyzeVocabularyConsistency(content: string, style: IWritingStyle): Promise<StyleConsistencyReport['elements']['vocabulary']> {
        return {
            score: 0.85,
            levelVariations: ['Some advanced terms in simple contexts'],
            suggestions: ['Maintain vocabulary level appropriate for target audience']
        };
    }

    private async analyzeSentenceStructureConsistency(content: string, style: IWritingStyle): Promise<StyleConsistencyReport['elements']['sentenceStructure']> {
        return {
            score: 0.75,
            patterns: ['Mix of short and long sentences'],
            recommendations: ['Balance sentence variety for better flow']
        };
    }

    private async compareWithReferences(content: string, style: IWritingStyle, bookId: string): Promise<StyleConsistencyReport['referenceComparison']> {
        return {
            similarityScore: 0.8,
            matchingElements: ['Tone consistency', 'Appropriate vocabulary level'],
            deviations: ['More complex sentence structures than typical for genre']
        };
    }

    private async getQuickSuggestions(content: string, context: any): Promise<WritingSuggestion[]> {
        // Lightweight version of suggestion analysis for real-time feedback
        const suggestions: WritingSuggestion[] = [];
        
        if (content.length > 200 && !this.hasDialogue(content)) {
            suggestions.push({
                type: 'engagement',
                severity: 'low',
                message: 'Consider adding dialogue to break up narrative',
                suggestion: 'Add character speech or internal thoughts',
                position: { start: content.length - 50, end: content.length },
                originalText: content.slice(-50),
                suggestedText: content.slice(-50) + '\n\n"What should I do now?" she wondered.',
                explanation: 'Dialogue adds variety and character voice'
            });
        }

        return suggestions;
    }

    private async calculateQuickStyleScore(content: string, targetStyle?: IWritingStyle): Promise<number> {
        if (!targetStyle) return 0.8;
        
        let score = 0;
        const currentTone = this.analyzeTone(content);
        const currentVocab = this.analyzeVocabularyLevel(content);
        
        if (currentTone === targetStyle.tone) score += 0.5;
        if (currentVocab === targetStyle.vocabulary) score += 0.5;
        
        return Math.max(score, 0.1);
    }

    private calculateReadabilityScore(content: string): number {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const words = content.split(' ').filter(w => w.length > 0);
        const avgWordsPerSentence = words.length / sentences.length;
        
        // Simple readability calculation
        let score = 1.0;
        if (avgWordsPerSentence > 20) score -= 0.2;
        if (avgWordsPerSentence > 30) score -= 0.3;
        
        return Math.max(score, 0.1);
    }

    private calculateEngagementMetrics(content: string): RealTimeWritingFeedback['engagementMetrics'] {
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const words = content.split(' ').filter(w => w.length > 0);
        const dialogueMatches = content.match(/["'][^"']*["']/g) || [];
        
        return {
            dialogueRatio: dialogueMatches.length / sentences.length,
            averageSentenceLength: words.length / sentences.length,
            vocabularyComplexity: this.calculateVocabularyComplexity(content),
            paceIndicators: this.analyzePaceIndicators(content)
        };
    }

    private calculateVocabularyComplexity(content: string): number {
        const words = content.split(' ');
        const complexWords = words.filter(word => word.length > 7);
        return complexWords.length / words.length;
    }

    private analyzePaceIndicators(content: string): string[] {
        const indicators: string[] = [];
        
        if (content.includes('!')) indicators.push('Exclamation points indicate excitement');
        if (content.match(/\b(suddenly|quickly|fast|rapid)\b/i)) indicators.push('Action words suggest fast pace');
        if (content.match(/\b(slowly|gradually|deliberate)\b/i)) indicators.push('Descriptive words suggest slower pace');
        
        return indicators;
    }

    private async generateNextSentenceSuggestions(content: string, context: any): Promise<string[]> {
        // Generate 3-5 possible next sentences
        return [
            "The silence stretched between them.",
            "Without hesitation, she stepped forward.",
            "Something felt different about the room.",
            "The sound echoed through the empty hallway."
        ];
    }
}

export default WritingAssistantService;
