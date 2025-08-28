/**
 * Image Style Analyzer - Determines appropriate image generation style based on book context
 */

import { ILogger } from '../core/Logger.js';
import { BaseService } from '../core/BaseService.js';
import { IBook, IWritingStyle, WritingTone, VocabularyLevel } from '../../types/book.js';
import { ImageStyleConfigService, IImageStyleConfigService } from './ImageStyleConfigService.js';
import type { IImageStyleConfig } from 'librechat-data-provider';

export interface StyleAnalysisResult {
    primaryStyle: string;
    styleModifiers: string[];
    appropriateForAudience: boolean;
    confidenceScore: number; // 0-1, how confident we are in the style selection
    fallbackToUserPrompt: boolean;
    reasoning: string;
}



export class ImageStyleAnalyzer extends BaseService {
    private styleConfigService: IImageStyleConfigService;

    constructor(logger: ILogger) {
        super(logger);
        this.styleConfigService = ImageStyleConfigService.getInstance(logger);
    }

    protected async onInitialize(): Promise<void> {
        // Initialize the style config service
        await this.styleConfigService.initialize();
    }

    protected async onDispose(): Promise<void> {
        // No cleanup needed
    }

    protected async performHealthCheck() {
        return {
            status: 'healthy' as const,
            message: 'Image Style Analyzer operational',
            lastCheck: new Date(),
        };
    }

    /**
     * Analyze book context and determine the most appropriate image style
     */
    async analyzeBookForImageStyle(book: IBook): Promise<StyleAnalysisResult> {
        return this.executeWithLogging('analyzeBookForImageStyle', async () => {
            const result = await this.performStyleAnalysis(book);

            this.logger.info('Style analysis completed', {
                bookId: book._id,
                bookTitle: book.title,
                primaryStyle: result.primaryStyle,
                confidenceScore: result.confidenceScore,
                fallbackToUserPrompt: result.fallbackToUserPrompt
            });

            return result;
        }, { bookId: book._id });
    }

    /**
     * Analyze specific text content to determine if it's appropriate for current style
     */
    async analyzeContentAppropriatenesss(content: string, currentStyle: string): Promise<boolean> {
        // Check for adult themes, violence, mature content
        const matureContentPatterns = [
            /\b(violence|blood|death|murder|kill|weapon|gun|knife|sword)\b/i,
            /\b(sex|sexual|intimate|romance|kiss|embrace|love)\b/i,
            /\b(alcohol|drug|beer|wine|drunk|intoxicated)\b/i,
            /\b(war|battle|fight|combat|conflict)\b/i
        ];

        const hasMaturedContent = matureContentPatterns.some(pattern => pattern.test(content));

        // Get current style configuration from database
        const styleConfig = await this.styleConfigService.getActiveConfig();
        const style = styleConfig.styles.get ? styleConfig.styles.get(currentStyle) : styleConfig.styles[currentStyle];

        if (!style) return true; // If style not found, allow it

        // If content has mature themes but style is all-ages, it's inappropriate
        if (hasMaturedContent && style.ageRating === 'all-ages') {
            return false;
        }

        return true;
    }

    private async performStyleAnalysis(book: IBook): Promise<StyleAnalysisResult> {
        // Get current style configuration from database
        const styleConfig = await this.styleConfigService.getActiveConfig();

        const analysis = {
            genre: this.analyzeGenre(book.genre, styleConfig),
            audience: this.analyzeAudience(book.targetAudience, styleConfig),
            writingStyle: this.analyzeWritingStyle(book.writingStyle, styleConfig),
            theme: this.analyzeTheme(book.theme),
            spec: this.analyzeBookSpec(book.spec)
        };

        // Calculate confidence score
        let confidenceScore = 0;
        let totalFactors = 0;

        if (analysis.genre.confidence > 0) {
            confidenceScore += analysis.genre.confidence;
            totalFactors++;
        }
        if (analysis.audience.confidence > 0) {
            confidenceScore += analysis.audience.confidence;
            totalFactors++;
        }
        if (analysis.writingStyle.confidence > 0) {
            confidenceScore += analysis.writingStyle.confidence;
            totalFactors++;
        }

        confidenceScore = totalFactors > 0 ? confidenceScore / totalFactors : 0;

        // Determine primary style
        const styleVotes = new Map<string, number>();

        analysis.genre.suggestedStyles.forEach(style => {
            styleVotes.set(style, (styleVotes.get(style) || 0) + analysis.genre.confidence);
        });

        analysis.audience.suggestedStyles.forEach(style => {
            styleVotes.set(style, (styleVotes.get(style) || 0) + analysis.audience.confidence);
        });

        analysis.writingStyle.suggestedStyles.forEach(style => {
            styleVotes.set(style, (styleVotes.get(style) || 0) + analysis.writingStyle.confidence);
        });

        // If book spec has image style, give it high priority
        if (analysis.spec.suggestedStyles.length > 0) {
            analysis.spec.suggestedStyles.forEach(style => {
                styleVotes.set(style, (styleVotes.get(style) || 0) + 0.8);
            });
        }

        const sortedStyles = Array.from(styleVotes.entries())
            .sort((a, b) => b[1] - a[1]);

        const primaryStyle = sortedStyles.length > 0 ? sortedStyles[0][0] : 'children_book_illustration';

        // Check if we should fallback to user prompt
        const fallbackToUserPrompt = confidenceScore < 0.5 || styleVotes.size === 0;

        // Generate style modifiers
        const styleModifiers = this.generateStyleModifiers(analysis, book);

        // Check audience appropriateness
        const appropriateForAudience = this.checkAudienceAppropriateness(primaryStyle, book, styleConfig);

        return {
            primaryStyle,
            styleModifiers,
            appropriateForAudience,
            confidenceScore,
            fallbackToUserPrompt,
            reasoning: this.generateReasoning(analysis, primaryStyle, confidenceScore)
        };
    }

    private analyzeGenre(genre: string, styleConfig: IImageStyleConfig): { suggestedStyles: string[], confidence: number } {
        const genreLower = genre.toLowerCase();

        const genreMapping = styleConfig.genreMapping.get ?
            Object.fromEntries(styleConfig.genreMapping) :
            styleConfig.genreMapping;

        if (genreMapping[genreLower]) {
            return {
                suggestedStyles: genreMapping[genreLower],
                confidence: 0.8
            };
        }

        // Fuzzy matching for common genres
        if (genreLower.includes('children') || genreLower.includes('kid')) {
            return { suggestedStyles: ['children_book_illustration', 'cartoon_colorful'], confidence: 0.9 };
        }
        if (genreLower.includes('romance')) {
            return { suggestedStyles: ['romantic_artistic', 'watercolor_soft'], confidence: 0.7 };
        }
        if (genreLower.includes('fantasy')) {
            return { suggestedStyles: ['fantasy_illustration', 'digital_art'], confidence: 0.7 };
        }
        if (genreLower.includes('mystery') || genreLower.includes('thriller')) {
            return { suggestedStyles: ['noir_illustration', 'realistic_dramatic'], confidence: 0.7 };
        }
        if (genreLower.includes('horror')) {
            return { suggestedStyles: ['dark_artistic', 'gothic_illustration'], confidence: 0.8 };
        }

        return { suggestedStyles: [], confidence: 0 };
    }

    private analyzeAudience(targetAudience: string | undefined, styleConfig: IImageStyleConfig): { suggestedStyles: string[], confidence: number } {
        if (!targetAudience) {
            return { suggestedStyles: [], confidence: 0 };
        }

        const audienceLower = targetAudience.toLowerCase();

        const audienceMapping = styleConfig.audienceMapping.get ?
            Object.fromEntries(styleConfig.audienceMapping) :
            styleConfig.audienceMapping;

        if (audienceMapping[audienceLower]) {
            return {
                suggestedStyles: audienceMapping[audienceLower],
                confidence: 0.9
            };
        }

        // Age-based analysis
        if (audienceLower.includes('children') || audienceLower.includes('kids') || audienceLower.includes('young')) {
            return { suggestedStyles: ['children_book_illustration', 'cartoon_colorful'], confidence: 0.9 };
        }
        if (audienceLower.includes('teen') || audienceLower.includes('young adult')) {
            return { suggestedStyles: ['digital_art', 'anime_style'], confidence: 0.8 };
        }
        if (audienceLower.includes('adult')) {
            return { suggestedStyles: ['realistic_artistic', 'watercolor_soft'], confidence: 0.7 };
        }

        return { suggestedStyles: [], confidence: 0 };
    }

    private analyzeWritingStyle(writingStyle: IWritingStyle, styleConfig: IImageStyleConfig): { suggestedStyles: string[], confidence: number } {
        const tone = writingStyle.tone;
        const vocabulary = writingStyle.vocabulary;

        let suggestedStyles: string[] = [];
        let confidence = 0;

        // Tone-based suggestions
        const toneMapping = styleConfig.toneMapping.get ?
            Object.fromEntries(styleConfig.toneMapping) :
            styleConfig.toneMapping;

        if (toneMapping[tone]) {
            suggestedStyles.push(...toneMapping[tone]);
            confidence += 0.6;
        }

        // Vocabulary-based suggestions
        switch (vocabulary) {
            case VocabularyLevel.SIMPLE:
                suggestedStyles.push('children_book_illustration', 'cartoon_colorful');
                confidence += 0.7;
                break;
            case VocabularyLevel.INTERMEDIATE:
                suggestedStyles.push('digital_art', 'watercolor_soft');
                confidence += 0.5;
                break;
            case VocabularyLevel.ADVANCED:
            case VocabularyLevel.TECHNICAL:
                suggestedStyles.push('realistic_artistic', 'professional_illustration');
                confidence += 0.6;
                break;
        }

        return {
            suggestedStyles: [...new Set(suggestedStyles)], // Remove duplicates
            confidence: Math.min(confidence, 1.0)
        };
    }

    private analyzeTheme(theme: string): { suggestedStyles: string[], confidence: number } {
        const themeLower = theme.toLowerCase();

        if (themeLower.includes('adventure')) {
            return { suggestedStyles: ['adventure_illustration', 'digital_art'], confidence: 0.6 };
        }
        if (themeLower.includes('friendship') || themeLower.includes('family')) {
            return { suggestedStyles: ['children_book_illustration', 'watercolor_soft'], confidence: 0.7 };
        }
        if (themeLower.includes('dark') || themeLower.includes('serious')) {
            return { suggestedStyles: ['noir_illustration', 'realistic_dramatic'], confidence: 0.6 };
        }

        return { suggestedStyles: [], confidence: 0 };
    }

    private analyzeBookSpec(spec?: any): { suggestedStyles: string[], confidence: number } {
        if (!spec || !spec.imageStyle) {
            return { suggestedStyles: [], confidence: 0 };
        }

        // If book has specific image style specification, use it
        const specifiedStyle = spec.imageStyle.style;
        if (specifiedStyle) {
            return { suggestedStyles: [specifiedStyle], confidence: 1.0 };
        }

        return { suggestedStyles: [], confidence: 0 };
    }

    private generateStyleModifiers(analysis: any, book: IBook): string[] {
        const modifiers: string[] = [];

        // Add color palette from spec
        if (book.spec?.colorPalette?.primary) {
            modifiers.push(`primary colors: ${book.spec.colorPalette.primary}`);
        }

        // Add mood from writing style
        switch (book.writingStyle.tone) {
            case WritingTone.HUMOROUS:
                modifiers.push('bright and cheerful');
                break;
            case WritingTone.SERIOUS:
                modifiers.push('muted and contemplative');
                break;
            case WritingTone.INSPIRATIONAL:
                modifiers.push('uplifting and vibrant');
                break;
        }

        // Add style specific modifiers
        if (book.spec?.imageStyle?.rendering) {
            modifiers.push(book.spec.imageStyle.rendering);
        }

        return modifiers;
    }

    private checkAudienceAppropriateness(style: string, book: IBook, styleConfig: IImageStyleConfig): boolean {
        const styles = styleConfig.styles.get ? styleConfig.styles.get(style) : styleConfig.styles[style];
        if (!styles) return true;

        // Check if target audience matches style age rating
        const audience = book.targetAudience?.toLowerCase() || '';

        if (audience.includes('children') || audience.includes('kids')) {
            return styles.ageRating === 'all-ages';
        }

        return true; // Allow other combinations for now
    }

    private generateReasoning(analysis: any, primaryStyle: string, confidenceScore: number): string {
        const reasons: string[] = [];

        if (analysis.genre.confidence > 0.5) {
            reasons.push(`Genre "${analysis.genre.suggestedStyles.join(', ')}" suggests appropriate style`);
        }

        if (analysis.audience.confidence > 0.5) {
            reasons.push(`Target audience indicates suitable visual approach`);
        }

        if (analysis.spec.confidence > 0.5) {
            reasons.push(`Book specification provides explicit style guidance`);
        }

        if (confidenceScore < 0.5) {
            reasons.push(`Low confidence (${(confidenceScore * 100).toFixed(0)}%) - user input recommended`);
        }

        return reasons.length > 0 ? reasons.join('. ') : `Selected ${primaryStyle} as default style`;
    }



    /**
     * Get human-readable description of a style
     */
    async getStyleDescription(styleName: string): Promise<string> {
        const styleConfig = await this.styleConfigService.getActiveConfig();
        const styles = styleConfig.styles.get ? styleConfig.styles.get(styleName) : styleConfig.styles[styleName];
        return styles?.description || 'Standard illustration style';
    }

    /**
     * Get all available styles for user selection
     */
    async getAvailableStyles(): Promise<Array<{ name: string; description: string; ageRating: string }>> {
        const styleConfig = await this.styleConfigService.getActiveConfig();
        const styles = styleConfig.styles.get ?
            Object.fromEntries(styleConfig.styles) :
            styleConfig.styles;

        return Object.entries(styles).map(([name, config]: [string, any]) => ({
            name,
            description: config.description,
            ageRating: config.ageRating
        }));
    }
}

export default ImageStyleAnalyzer;
