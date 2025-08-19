/**
 * Character Voice Service - AI-powered character voice consistency for dialogue
 */

import { BaseService } from '../core/BaseService';
import { ILogger } from '../interfaces/ILogger.js';
import { ContentEnhancementService } from './ContentEnhancementService';
import { NarrativeConsistencyService } from './NarrativeConsistencyService';

interface Character {
    _id: string;
    name: string;
    role: string;
    personality: {
        coreTraits: string[];
        motivations: string[];
        fears: string[];
        speechPattern?: string;
        mannerisms: string[];
    };
    background: {
        origin?: string;
        education?: string;
        occupation?: string;
    };
    voiceProfile?: CharacterVoiceProfile;
}

interface CharacterVoiceProfile {
    characterId: string;
    voiceCharacteristics: {
        tone: 'formal' | 'casual' | 'aggressive' | 'gentle' | 'sarcastic' | 'humble' | 'confident' | 'nervous';
        speechPatterns: string[];
        vocabulary: 'basic' | 'standard' | 'advanced' | 'technical' | 'archaic' | 'street';
        dialectFeatures: string[];
        emotionalRange: 'restricted' | 'moderate' | 'expressive' | 'dramatic';
        characteristicPhrases: string[];
        avoidedWords: string[];
    };
    dialogueExamples: Array<{
        situation: string;
        emotion: string;
        dialogue: string;
        context?: string;
    }>;
    consistencyRules: string[];
    lastAnalyzed: Date;
    consistencyScore: number;
}

interface DialogueGenerationRequest {
    characterId: string;
    situation: string;
    emotion?: string;
    targetCharacter?: string;
    context?: string;
    tone?: string;
    length?: 'short' | 'medium' | 'long';
    includeAction?: boolean;
}

interface DialogueGenerationResult {
    dialogue: string;
    alternativeOptions: string[];
    voiceConsistency: number;
    emotionalTone: string;
    characteristicElements: string[];
    suggestions: string[];
}

export class CharacterVoiceService extends BaseService {
    protected async onInitialize(): Promise<void> {
        this.logger.info('CharacterVoiceService initialized');
    }

    protected async onDispose(): Promise<void> {
        this.logger.info('CharacterVoiceService disposed');
    }
    private contentEnhancementService?: ContentEnhancementService;
    private narrativeService?: NarrativeConsistencyService;
    private voiceProfiles = new Map<string, CharacterVoiceProfile>();
    private dialogueHistory = new Map<string, Array<{ dialogue: string; context: string; timestamp: Date }>>();

    constructor(
        logger: ILogger,
        contentEnhancementService?: ContentEnhancementService,
        narrativeService?: NarrativeConsistencyService
    ) {
        super(logger);
        this.contentEnhancementService = contentEnhancementService;
        this.narrativeService = narrativeService;
    }

    protected async performHealthCheck() {
        return {
            status: 'healthy' as const,
            message: 'Character Voice Service is operational',
            details: {
                voiceProfilesLoaded: this.voiceProfiles.size,
                totalDialogueHistory: Array.from(this.dialogueHistory.values()).reduce((sum, arr) => sum + arr.length, 0)
            },
            lastCheck: new Date()
        };
    }

    /**
     * Generate voice profile for a character
     */
    async generateVoiceProfile(character: Character): Promise<CharacterVoiceProfile> {
        return this.executeWithLogging('generateVoiceProfile', async () => {
            this.logger.info('Generating voice profile for character', {
                characterId: character._id,
                name: character.name
            });

            // Analyze character traits to determine voice characteristics
            const voiceCharacteristics = this.analyzeCharacterForVoice(character);

            // Generate consistency rules
            const consistencyRules = this.generateConsistencyRules(character, voiceCharacteristics);

            // Create dialogue examples if we have enough character data
            const dialogueExamples = await this.generateBaselineDialogue(character, voiceCharacteristics);

            const voiceProfile: CharacterVoiceProfile = {
                characterId: character._id,
                voiceCharacteristics,
                dialogueExamples,
                consistencyRules,
                lastAnalyzed: new Date(),
                consistencyScore: 1.0 // Start with perfect score
            };

            // Store the profile
            this.voiceProfiles.set(character._id, voiceProfile);

            this.logger.info('Voice profile generated successfully', {
                characterId: character._id,
                tone: voiceCharacteristics.tone,
                vocabulary: voiceCharacteristics.vocabulary
            });

            return voiceProfile;
        }, { characterId: character._id });
    }

    /**
     * Generate character dialogue with voice consistency
     */
    async generateDialogue(request: DialogueGenerationRequest): Promise<DialogueGenerationResult> {
        return this.executeWithLogging('generateDialogue', async () => {
            this.logger.info('Generating dialogue for character', {
                characterId: request.characterId,
                situation: request.situation,
                emotion: request.emotion
            });

            // Get or create voice profile
            let voiceProfile = this.voiceProfiles.get(request.characterId);
            if (!voiceProfile) {
                throw new Error(`Voice profile not found for character: ${request.characterId}`);
            }

            // Get character dialogue history for context
            const history = this.dialogueHistory.get(request.characterId) || [];
            const recentDialogue = history.slice(-5); // Last 5 dialogue entries

            // Build context-aware prompt
            const prompt = this.buildDialoguePrompt(request, voiceProfile, recentDialogue);

            // Generate dialogue using AI service
            const generatedDialogue = await this.generateDialogueWithAI(prompt, voiceProfile);

            // Analyze consistency
            const consistencyScore = this.analyzeDialogueConsistency(generatedDialogue, voiceProfile);

            // Generate alternative options
            const alternatives = await this.generateAlternativeDialogue(request, voiceProfile, 2);

            // Extract characteristic elements
            const characteristicElements = this.extractCharacteristicElements(generatedDialogue, voiceProfile);

            // Generate suggestions for improvement
            const suggestions = this.generateImprovementSuggestions(generatedDialogue, voiceProfile, consistencyScore);

            // Store in dialogue history
            this.addToDialogueHistory(request.characterId, generatedDialogue, request.situation);

            // Update consistency score in profile
            voiceProfile.consistencyScore = this.updateConsistencyScore(voiceProfile.consistencyScore, consistencyScore);

            const result: DialogueGenerationResult = {
                dialogue: generatedDialogue,
                alternativeOptions: alternatives,
                voiceConsistency: consistencyScore,
                emotionalTone: request.emotion || 'neutral',
                characteristicElements,
                suggestions
            };

            this.logger.info('Dialogue generated successfully', {
                characterId: request.characterId,
                consistencyScore,
                dialogueLength: generatedDialogue.length
            });

            return result;
        }, { characterId: request.characterId });
    }

    /**
     * Update voice profile based on new dialogue examples
     */
    async updateVoiceProfile(characterId: string, newDialogue: string, context: string): Promise<void> {
        return this.executeWithLogging('updateVoiceProfile', async () => {
            const voiceProfile = this.voiceProfiles.get(characterId);
            if (!voiceProfile) {
                throw new Error(`Voice profile not found for character: ${characterId}`);
            }

            // Analyze new dialogue for patterns
            const extractedPatterns = this.extractSpeechPatterns(newDialogue);
            const extractedPhrases = this.extractCharacteristicPhrases(newDialogue);

            // Update voice characteristics
            voiceProfile.voiceCharacteristics.speechPatterns = [
                ...new Set([...voiceProfile.voiceCharacteristics.speechPatterns, ...extractedPatterns])
            ].slice(0, 10); // Keep top 10

            voiceProfile.voiceCharacteristics.characteristicPhrases = [
                ...new Set([...voiceProfile.voiceCharacteristics.characteristicPhrases, ...extractedPhrases])
            ].slice(0, 15); // Keep top 15

            // Add to dialogue examples
            voiceProfile.dialogueExamples.push({
                situation: context,
                emotion: 'neutral', // Could be analyzed from context
                dialogue: newDialogue,
                context
            });

            // Keep only most recent 20 examples
            if (voiceProfile.dialogueExamples.length > 20) {
                voiceProfile.dialogueExamples = voiceProfile.dialogueExamples.slice(-20);
            }

            voiceProfile.lastAnalyzed = new Date();

            this.logger.info('Voice profile updated', {
                characterId,
                patternsCount: voiceProfile.voiceCharacteristics.speechPatterns.length,
                examplesCount: voiceProfile.dialogueExamples.length
            });
        }, { characterId });
    }

    /**
     * Get voice profile for character
     */
    async getVoiceProfile(characterId: string): Promise<CharacterVoiceProfile | null> {
        return this.voiceProfiles.get(characterId) || null;
    }

    /**
     * Analyze character traits to determine voice characteristics
     */
    private analyzeCharacterForVoice(character: Character) {
        const traits = character.personality.coreTraits;
        const background = character.background;

        // Determine tone based on personality traits
        let tone: CharacterVoiceProfile['voiceCharacteristics']['tone'] = 'casual';

        if (traits.includes('formal') || traits.includes('proper') || traits.includes('dignified')) {
            tone = 'formal';
        } else if (traits.includes('aggressive') || traits.includes('angry') || traits.includes('hostile')) {
            tone = 'aggressive';
        } else if (traits.includes('gentle') || traits.includes('kind') || traits.includes('soft-spoken')) {
            tone = 'gentle';
        } else if (traits.includes('sarcastic') || traits.includes('witty') || traits.includes('cynical')) {
            tone = 'sarcastic';
        } else if (traits.includes('humble') || traits.includes('modest') || traits.includes('self-deprecating')) {
            tone = 'humble';
        } else if (traits.includes('confident') || traits.includes('bold') || traits.includes('assertive')) {
            tone = 'confident';
        } else if (traits.includes('nervous') || traits.includes('anxious') || traits.includes('timid')) {
            tone = 'nervous';
        }

        // Determine vocabulary level based on education and occupation
        let vocabulary: CharacterVoiceProfile['voiceCharacteristics']['vocabulary'] = 'standard';

        if (background.education?.includes('university') || background.education?.includes('college') ||
            background.occupation?.includes('professor') || background.occupation?.includes('doctor') ||
            background.occupation?.includes('lawyer')) {
            vocabulary = 'advanced';
        } else if (background.education?.includes('technical') ||
            background.occupation?.includes('engineer') || background.occupation?.includes('scientist')) {
            vocabulary = 'technical';
        } else if (background.origin?.includes('street') || background.origin?.includes('urban') ||
            traits.includes('rough') || traits.includes('street-smart')) {
            vocabulary = 'street';
        } else if (background.origin?.includes('ancient') || background.origin?.includes('medieval') ||
            traits.includes('old-fashioned') || traits.includes('traditional')) {
            vocabulary = 'archaic';
        }

        // Determine emotional range
        let emotionalRange: CharacterVoiceProfile['voiceCharacteristics']['emotionalRange'] = 'moderate';

        if (traits.includes('stoic') || traits.includes('controlled') || traits.includes('reserved')) {
            emotionalRange = 'restricted';
        } else if (traits.includes('expressive') || traits.includes('passionate') || traits.includes('emotional')) {
            emotionalRange = 'expressive';
        } else if (traits.includes('dramatic') || traits.includes('theatrical') || traits.includes('flamboyant')) {
            emotionalRange = 'dramatic';
        }

        // Extract speech patterns from existing data
        const speechPatterns = character.personality.speechPattern ? [character.personality.speechPattern] : [];

        // Generate initial characteristic phrases based on traits
        const characteristicPhrases = this.generateInitialPhrases(traits, tone);

        return {
            tone,
            speechPatterns,
            vocabulary,
            dialectFeatures: [], // Could be enhanced based on origin
            emotionalRange,
            characteristicPhrases,
            avoidedWords: [] // Could be populated based on character background
        };
    }

    /**
     * Generate consistency rules for character voice
     */
    private generateConsistencyRules(character: Character, voiceCharacteristics: any): string[] {
        const rules: string[] = [];

        rules.push(`Always maintain ${voiceCharacteristics.tone} tone`);
        rules.push(`Use ${voiceCharacteristics.vocabulary} vocabulary level`);
        rules.push(`Express emotions within ${voiceCharacteristics.emotionalRange} range`);

        // Add trait-based rules
        character.personality.coreTraits.forEach(trait => {
            switch (trait.toLowerCase()) {
                case 'sarcastic':
                    rules.push('Include subtle sarcasm in responses when appropriate');
                    break;
                case 'formal':
                    rules.push('Avoid contractions and casual expressions');
                    break;
                case 'nervous':
                    rules.push('Include hesitation markers and incomplete sentences');
                    break;
                case 'confident':
                    rules.push('Use direct statements and assertive language');
                    break;
                case 'humble':
                    rules.push('Avoid boastful language and acknowledge others');
                    break;
            }
        });

        // Add mannerism-based rules
        character.personality.mannerisms.forEach(mannerism => {
            rules.push(`Incorporate verbal mannerism: ${mannerism}`);
        });

        return rules;
    }

    /**
     * Generate baseline dialogue examples
     */
    private async generateBaselineDialogue(character: Character, voiceCharacteristics: any): Promise<Array<{
        situation: string;
        emotion: string;
        dialogue: string;
        context?: string;
    }>> {
        const examples = [];

        // Generate basic dialogue examples for common situations
        const situations = [
            { situation: 'greeting someone new', emotion: 'neutral' },
            { situation: 'expressing anger', emotion: 'angry' },
            { situation: 'showing concern', emotion: 'worried' },
            { situation: 'being happy', emotion: 'joy' },
            { situation: 'refusing a request', emotion: 'firm' }
        ];

        for (const { situation, emotion } of situations) {
            const dialogue = await this.generateBasicDialogue(character, situation, emotion, voiceCharacteristics);
            examples.push({
                situation,
                emotion,
                dialogue,
                context: `Baseline example for ${character.name}`
            });
        }

        return examples;
    }

    /**
     * Generate basic dialogue for character
     */
    private async generateBasicDialogue(character: Character, situation: string, emotion: string, voiceCharacteristics: any): Promise<string> {
        // This would integrate with your AI service to generate character-specific dialogue
        // For now, return template-based dialogue

        const templates = {
            'greeting someone new': {
                formal: "Good day. I am {name}. It is a pleasure to make your acquaintance.",
                casual: "Hey there! I'm {name}. Nice to meet you!",
                aggressive: "Who are you? I'm {name}, and I don't have time for games.",
                gentle: "Hello, I'm {name}. I hope you're having a lovely day.",
                sarcastic: "Oh, wonderful. Another new face. I'm {name}, in case you're wondering.",
                humble: "Hi, I'm just {name}. Nothing special, really.",
                confident: "I'm {name}. You'll want to remember that name.",
                nervous: "Um, hi... I'm {name}. Sorry, I'm not great with introductions..."
            }
        };

        const template = templates[situation]?.[voiceCharacteristics.tone] ||
            templates[situation]?.casual ||
            "I'm {name}.";

        return template.replace('{name}', character.name);
    }

    /**
     * Build dialogue generation prompt
     */
    private buildDialoguePrompt(request: DialogueGenerationRequest, voiceProfile: CharacterVoiceProfile, recentDialogue: any[]): string {
        let prompt = `Generate dialogue for a character with the following voice profile:\n\n`;

        prompt += `Character Voice Characteristics:\n`;
        prompt += `- Tone: ${voiceProfile.voiceCharacteristics.tone}\n`;
        prompt += `- Vocabulary: ${voiceProfile.voiceCharacteristics.vocabulary}\n`;
        prompt += `- Emotional Range: ${voiceProfile.voiceCharacteristics.emotionalRange}\n`;

        if (voiceProfile.voiceCharacteristics.speechPatterns.length > 0) {
            prompt += `- Speech Patterns: ${voiceProfile.voiceCharacteristics.speechPatterns.join(', ')}\n`;
        }

        if (voiceProfile.voiceCharacteristics.characteristicPhrases.length > 0) {
            prompt += `- Characteristic Phrases: ${voiceProfile.voiceCharacteristics.characteristicPhrases.join(', ')}\n`;
        }

        prompt += `\nConsistency Rules:\n`;
        voiceProfile.consistencyRules.forEach(rule => {
            prompt += `- ${rule}\n`;
        });

        if (voiceProfile.dialogueExamples.length > 0) {
            prompt += `\nPrevious Dialogue Examples:\n`;
            voiceProfile.dialogueExamples.slice(-3).forEach(example => {
                prompt += `- ${example.situation}: "${example.dialogue}"\n`;
            });
        }

        if (recentDialogue.length > 0) {
            prompt += `\nRecent Dialogue History:\n`;
            recentDialogue.forEach(entry => {
                prompt += `- "${entry.dialogue}"\n`;
            });
        }

        prompt += `\nGenerate dialogue for this situation:\n`;
        prompt += `Situation: ${request.situation}\n`;
        prompt += `Emotion: ${request.emotion || 'neutral'}\n`;

        if (request.targetCharacter) {
            prompt += `Speaking to: ${request.targetCharacter}\n`;
        }

        if (request.context) {
            prompt += `Context: ${request.context}\n`;
        }

        prompt += `\nGenerate appropriate dialogue that maintains voice consistency:`;

        return prompt;
    }

    /**
     * Generate dialogue using AI service
     */
    private async generateDialogueWithAI(prompt: string, voiceProfile: CharacterVoiceProfile): Promise<string> {
        try {
            if (this.contentEnhancementService) {
                // This would use your AI service to generate the dialogue
                // For now, return a placeholder
                return `"This is AI-generated dialogue that maintains the ${voiceProfile.voiceCharacteristics.tone} tone."`;
            } else {
                // Fallback to template-based generation
                return this.generateTemplateDialogue(voiceProfile);
            }
        } catch (error) {
            this.logger.warn('AI dialogue generation failed, using fallback', error as Error);
            return this.generateTemplateDialogue(voiceProfile);
        }
    }

    /**
     * Generate template-based dialogue as fallback
     */
    private generateTemplateDialogue(voiceProfile: CharacterVoiceProfile): string {
        const tone = voiceProfile.voiceCharacteristics.tone;
        const phrases = voiceProfile.voiceCharacteristics.characteristicPhrases;

        const templates = {
            formal: "I must express my sentiments regarding this matter.",
            casual: "Yeah, I've got some thoughts on this.",
            aggressive: "Listen here, this is how it's going to be.",
            gentle: "I hope you don't mind me saying this, but...",
            sarcastic: "Oh, how absolutely wonderful this is.",
            humble: "I might be wrong, but I think...",
            confident: "Here's exactly what we need to do.",
            nervous: "Um, well... I suppose we could try..."
        };

        let dialogue = templates[tone] || templates.casual;

        // Add characteristic phrases if available
        if (phrases.length > 0) {
            const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
            dialogue = `${randomPhrase} ${dialogue}`;
        }

        return `"${dialogue}"`;
    }

    /**
     * Analyze dialogue consistency with voice profile
     */
    private analyzeDialogueConsistency(dialogue: string, voiceProfile: CharacterVoiceProfile): number {
        let score = 1.0;
        const lowerDialogue = dialogue.toLowerCase();

        // Check tone consistency
        const toneIndicators = {
            formal: ['indeed', 'certainly', 'shall', 'would'],
            casual: ['yeah', 'hey', 'gonna', 'wanna'],
            aggressive: ['damn', 'hell', 'shut up', 'listen'],
            gentle: ['please', 'kindly', 'perhaps', 'might'],
            sarcastic: ['wonderful', 'great', 'fantastic', 'brilliant'],
            nervous: ['um', 'uh', 'maybe', 'i think'],
            confident: ['will', 'definitely', 'absolutely', 'certainly']
        };

        const expectedIndicators = toneIndicators[voiceProfile.voiceCharacteristics.tone] || [];
        const foundIndicators = expectedIndicators.filter(indicator => lowerDialogue.includes(indicator));

        if (foundIndicators.length === 0 && expectedIndicators.length > 0) {
            score -= 0.2;
        }

        // Check for characteristic phrases
        const foundPhrases = voiceProfile.voiceCharacteristics.characteristicPhrases.filter(phrase =>
            lowerDialogue.includes(phrase.toLowerCase())
        );

        if (foundPhrases.length > 0) {
            score += 0.1;
        }

        // Check vocabulary level
        const complexWords = dialogue.split(' ').filter(word => word.length > 8).length;
        const totalWords = dialogue.split(' ').length;
        const complexWordRatio = complexWords / totalWords;

        switch (voiceProfile.voiceCharacteristics.vocabulary) {
            case 'basic':
                if (complexWordRatio > 0.1) score -= 0.15;
                break;
            case 'advanced':
                if (complexWordRatio < 0.05) score -= 0.15;
                break;
            case 'technical':
                // Could check for technical terms
                break;
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Generate alternative dialogue options
     */
    private async generateAlternativeDialogue(request: DialogueGenerationRequest, voiceProfile: CharacterVoiceProfile, count: number): Promise<string[]> {
        const alternatives: string[] = [];

        for (let i = 0; i < count; i++) {
            // Generate variations with slightly different approaches
            const variation = this.generateDialogueVariation(request, voiceProfile, i);
            alternatives.push(variation);
        }

        return alternatives;
    }

    /**
     * Generate dialogue variation
     */
    private generateDialogueVariation(request: DialogueGenerationRequest, voiceProfile: CharacterVoiceProfile, variationIndex: number): string {
        const tone = voiceProfile.voiceCharacteristics.tone;
        const situation = request.situation;

        // Simple variation logic - in real implementation, this would be more sophisticated
        const variations = [
            `"Here's another way to express this about ${situation}."`,
            `"Alternative perspective on ${situation}, maintaining ${tone} tone."`,
            `"Different approach to discussing ${situation}."`
        ];

        return variations[variationIndex % variations.length];
    }

    /**
     * Extract characteristic elements from dialogue
     */
    private extractCharacteristicElements(dialogue: string, voiceProfile: CharacterVoiceProfile): string[] {
        const elements: string[] = [];
        const lowerDialogue = dialogue.toLowerCase();

        // Check for tone indicators
        const toneIndicators = {
            formal: ['indeed', 'certainly', 'shall'],
            casual: ['yeah', 'hey', 'gonna'],
            aggressive: ['damn', 'hell'],
            gentle: ['please', 'kindly'],
            sarcastic: ['wonderful', 'great'],
            nervous: ['um', 'uh'],
            confident: ['definitely', 'absolutely']
        };

        const expectedIndicators = toneIndicators[voiceProfile.voiceCharacteristics.tone] || [];
        expectedIndicators.forEach(indicator => {
            if (lowerDialogue.includes(indicator)) {
                elements.push(`Tone indicator: "${indicator}"`);
            }
        });

        // Check for characteristic phrases
        voiceProfile.voiceCharacteristics.characteristicPhrases.forEach(phrase => {
            if (lowerDialogue.includes(phrase.toLowerCase())) {
                elements.push(`Characteristic phrase: "${phrase}"`);
            }
        });

        return elements;
    }

    /**
     * Generate improvement suggestions
     */
    private generateImprovementSuggestions(dialogue: string, voiceProfile: CharacterVoiceProfile, consistencyScore: number): string[] {
        const suggestions: string[] = [];

        if (consistencyScore < 0.7) {
            suggestions.push(`Consider adding more ${voiceProfile.voiceCharacteristics.tone} tone indicators`);
        }

        if (voiceProfile.voiceCharacteristics.characteristicPhrases.length > 0 &&
            !voiceProfile.voiceCharacteristics.characteristicPhrases.some(phrase =>
                dialogue.toLowerCase().includes(phrase.toLowerCase())
            )) {
            suggestions.push('Consider incorporating character-specific phrases');
        }

        if (dialogue.length < 20) {
            suggestions.push('Dialogue might be too brief for the situation');
        }

        if (dialogue.length > 200) {
            suggestions.push('Dialogue might be too lengthy - consider breaking into multiple exchanges');
        }

        return suggestions;
    }

    /**
     * Add dialogue to character history
     */
    private addToDialogueHistory(characterId: string, dialogue: string, context: string): void {
        if (!this.dialogueHistory.has(characterId)) {
            this.dialogueHistory.set(characterId, []);
        }

        const history = this.dialogueHistory.get(characterId)!;
        history.push({
            dialogue,
            context,
            timestamp: new Date()
        });

        // Keep only last 50 entries
        if (history.length > 50) {
            history.splice(0, history.length - 50);
        }
    }

    /**
     * Update consistency score using exponential moving average
     */
    private updateConsistencyScore(currentScore: number, newScore: number): number {
        const alpha = 0.3; // Learning rate
        return (alpha * newScore) + ((1 - alpha) * currentScore);
    }

    /**
     * Extract speech patterns from dialogue
     */
    private extractSpeechPatterns(dialogue: string): string[] {
        const patterns: string[] = [];

        // Simple pattern extraction - could be enhanced
        if (dialogue.includes('...')) {
            patterns.push('Uses ellipses for pauses');
        }

        if (dialogue.match(/\b(um|uh|er)\b/i)) {
            patterns.push('Uses hesitation markers');
        }

        if (dialogue.match(/[!]{2,}/)) {
            patterns.push('Uses multiple exclamation marks');
        }

        return patterns;
    }

    /**
     * Extract characteristic phrases from dialogue
     */
    private extractCharacteristicPhrases(dialogue: string): string[] {
        const phrases: string[] = [];

        // Extract short phrases (2-4 words) that might be characteristic
        const words = dialogue.split(/\s+/);
        for (let i = 0; i < words.length - 1; i++) {
            if (i + 2 < words.length) {
                const phrase = words.slice(i, i + 2).join(' ').toLowerCase().replace(/[^\w\s]/g, '');
                if (phrase.length > 4 && !this.isCommonPhrase(phrase)) {
                    phrases.push(phrase);
                }
            }
        }

        return phrases.slice(0, 3); // Return top 3
    }

    /**
     * Check if phrase is too common to be characteristic
     */
    private isCommonPhrase(phrase: string): boolean {
        const commonPhrases = [
            'i am', 'you are', 'it is', 'we are', 'they are',
            'i have', 'you have', 'we have', 'they have',
            'i will', 'you will', 'we will', 'they will',
            'i can', 'you can', 'we can', 'they can',
            'i think', 'i know', 'i see', 'i hear'
        ];

        return commonPhrases.includes(phrase.toLowerCase());
    }

    /**
     * Generate initial characteristic phrases based on traits
     */
    private generateInitialPhrases(traits: string[], tone: string): string[] {
        const phrases: string[] = [];

        // Add tone-specific phrases
        switch (tone) {
            case 'formal':
                phrases.push('I must say', 'If I may', 'Indeed so');
                break;
            case 'casual':
                phrases.push('You know', 'I mean', 'Whatever');
                break;
            case 'sarcastic':
                phrases.push('Oh wonderful', 'How lovely', 'Perfect, just perfect');
                break;
            case 'nervous':
                phrases.push('Um, well', 'I suppose', 'Maybe I\'m wrong but');
                break;
            case 'confident':
                phrases.push('Mark my words', 'Trust me', 'Without a doubt');
                break;
        }

        // Add trait-specific phrases
        traits.forEach(trait => {
            switch (trait.toLowerCase()) {
                case 'wise':
                    phrases.push('In my experience', 'As I\'ve learned');
                    break;
                case 'young':
                    phrases.push('This is so cool', 'Whatever dude');
                    break;
                case 'old':
                    phrases.push('Back in my day', 'Young folks these days');
                    break;
            }
        });

        return phrases.slice(0, 5); // Return top 5
    }
}
