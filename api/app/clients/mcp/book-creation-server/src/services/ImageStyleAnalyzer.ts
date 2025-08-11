/**
 * Image Style Analyzer - Determines appropriate image generation style based on book context
 */

import { ILogger } from '../core/Logger.js';
import { BaseService } from '../core/BaseService.js';
import { IBook, IWritingStyle, WritingTone, VocabularyLevel } from '../../types/book.js';

export interface StyleAnalysisResult {
    primaryStyle: string;
    styleModifiers: string[];
    appropriateForAudience: boolean;
    confidenceScore: number; // 0-1, how confident we are in the style selection
    fallbackToUserPrompt: boolean;
    reasoning: string;
}

export interface ImageStyleConfig {
    styles: Record<string, {
        description: string;
        dallePrompt: string;
        appropriateGenres: string[];
        appropriateAudiences: string[];
        ageRating: 'all-ages' | 'teen' | 'adult' | 'mature';
        visualCharacteristics: string[];
    }>;
    genreMapping: Record<string, string[]>; // genre -> style preferences
    audienceMapping: Record<string, string[]>; // audience -> style preferences
    toneMapping: Record<string, string[]>; // tone -> style preferences
}

export class ImageStyleAnalyzer extends BaseService {
    private styleConfig: ImageStyleConfig;

    constructor(logger: ILogger) {
        super(logger);
        this.styleConfig = this.initializeStyleConfig();
    }

    protected async onInitialize(): Promise<void> {
        // No async initialization needed
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
            const result = this.performStyleAnalysis(book);
            
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
    analyzeContentAppropriatenesss(content: string, currentStyle: string): boolean {
        // Check for adult themes, violence, mature content
        const matureContentPatterns = [
            /\b(violence|blood|death|murder|kill|weapon|gun|knife|sword)\b/i,
            /\b(sex|sexual|intimate|romance|kiss|embrace|love)\b/i,
            /\b(alcohol|drug|beer|wine|drunk|intoxicated)\b/i,
            /\b(war|battle|fight|combat|conflict)\b/i
        ];

        const hasMaturedContent = matureContentPatterns.some(pattern => pattern.test(content));
        const style = this.styleConfig.styles[currentStyle];
        
        if (!style) return true; // If style not found, allow it
        
        // If content has mature themes but style is all-ages, it's inappropriate
        if (hasMaturedContent && style.ageRating === 'all-ages') {
            return false;
        }

        return true;
    }

    private performStyleAnalysis(book: IBook): StyleAnalysisResult {
        const analysis = {
            genre: this.analyzeGenre(book.genre),
            audience: this.analyzeAudience(book.targetAudience),
            writingStyle: this.analyzeWritingStyle(book.writingStyle),
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
        const appropriateForAudience = this.checkAudienceAppropriateness(primaryStyle, book);

        return {
            primaryStyle,
            styleModifiers,
            appropriateForAudience,
            confidenceScore,
            fallbackToUserPrompt,
            reasoning: this.generateReasoning(analysis, primaryStyle, confidenceScore)
        };
    }

    private analyzeGenre(genre: string): { suggestedStyles: string[], confidence: number } {
        const genreLower = genre.toLowerCase();
        
        if (this.styleConfig.genreMapping[genreLower]) {
            return {
                suggestedStyles: this.styleConfig.genreMapping[genreLower],
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

    private analyzeAudience(targetAudience?: string): { suggestedStyles: string[], confidence: number } {
        if (!targetAudience) {
            return { suggestedStyles: [], confidence: 0 };
        }

        const audienceLower = targetAudience.toLowerCase();
        
        if (this.styleConfig.audienceMapping[audienceLower]) {
            return {
                suggestedStyles: this.styleConfig.audienceMapping[audienceLower],
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

    private analyzeWritingStyle(writingStyle: IWritingStyle): { suggestedStyles: string[], confidence: number } {
        const tone = writingStyle.tone;
        const vocabulary = writingStyle.vocabulary;
        
        let suggestedStyles: string[] = [];
        let confidence = 0;

        // Tone-based suggestions
        if (this.styleConfig.toneMapping[tone]) {
            suggestedStyles.push(...this.styleConfig.toneMapping[tone]);
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

    private checkAudienceAppropriateness(style: string, book: IBook): boolean {
        const styleInfo = this.styleConfig.styles[style];
        if (!styleInfo) return true;

        // Check if target audience matches style age rating
        const audience = book.targetAudience?.toLowerCase() || '';
        
        if (audience.includes('children') || audience.includes('kids')) {
            return styleInfo.ageRating === 'all-ages';
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

    private initializeStyleConfig(): ImageStyleConfig {
        return {
            styles: {
                'children_book_illustration': {
                    description: 'Bright, colorful illustrations perfect for children\'s books',
                    dallePrompt: 'children\'s book illustration, bright colors, cartoon style, friendly characters, simple composition, kid-friendly',
                    appropriateGenres: ['children', 'educational', 'fantasy', 'adventure'],
                    appropriateAudiences: ['children', 'kids', 'young readers'],
                    ageRating: 'all-ages',
                    visualCharacteristics: ['bright colors', 'simple shapes', 'friendly characters']
                },
                'cartoon_colorful': {
                    description: 'Vibrant cartoon-style illustrations',
                    dallePrompt: 'cartoon illustration, vibrant colors, animated style, expressive characters, dynamic composition',
                    appropriateGenres: ['comedy', 'adventure', 'children'],
                    appropriateAudiences: ['children', 'family', 'young adult'],
                    ageRating: 'all-ages',
                    visualCharacteristics: ['bold colors', 'exaggerated features', 'dynamic poses']
                },
                'watercolor_soft': {
                    description: 'Soft watercolor paintings with gentle aesthetics',
                    dallePrompt: 'watercolor painting, soft colors, gentle brushstrokes, artistic illustration, dreamy atmosphere, pastel tones',
                    appropriateGenres: ['romance', 'drama', 'poetry', 'literary fiction'],
                    appropriateAudiences: ['adult', 'young adult', 'artistic readers'],
                    ageRating: 'all-ages',
                    visualCharacteristics: ['soft edges', 'flowing colors', 'artistic texture']
                },
                'realistic_artistic': {
                    description: 'Realistic artistic illustrations for mature content',
                    dallePrompt: 'realistic illustration, detailed artwork, professional quality, sophisticated composition, natural lighting',
                    appropriateGenres: ['literary fiction', 'biography', 'historical', 'drama'],
                    appropriateAudiences: ['adult', 'mature readers'],
                    ageRating: 'adult',
                    visualCharacteristics: ['realistic proportions', 'detailed textures', 'natural lighting']
                },
                'fantasy_illustration': {
                    description: 'Epic fantasy artwork with magical elements',
                    dallePrompt: 'fantasy illustration, magical elements, epic composition, detailed fantasy art, mythical creatures, enchanted atmosphere',
                    appropriateGenres: ['fantasy', 'science fiction', 'adventure', 'mythology'],
                    appropriateAudiences: ['young adult', 'adult', 'fantasy fans'],
                    ageRating: 'teen',
                    visualCharacteristics: ['magical effects', 'elaborate details', 'fantastical elements']
                },
                'noir_illustration': {
                    description: 'Dark, moody illustrations for mystery and thriller',
                    dallePrompt: 'noir illustration, dark atmosphere, dramatic shadows, black and white tones, mysterious mood, film noir style',
                    appropriateGenres: ['mystery', 'thriller', 'crime', 'noir'],
                    appropriateAudiences: ['adult', 'mature readers'],
                    ageRating: 'adult',
                    visualCharacteristics: ['high contrast', 'dramatic lighting', 'mysterious atmosphere']
                },
                'romantic_artistic': {
                    description: 'Romantic and elegant artistic illustrations',
                    dallePrompt: 'romantic illustration, elegant style, soft lighting, beautiful composition, artistic quality, warm tones',
                    appropriateGenres: ['romance', 'drama', 'contemporary fiction'],
                    appropriateAudiences: ['adult', 'young adult', 'romance readers'],
                    ageRating: 'teen',
                    visualCharacteristics: ['warm colors', 'soft lighting', 'elegant composition']
                },
                'digital_art': {
                    description: 'Modern digital art style',
                    dallePrompt: 'digital art, modern illustration, clean lines, contemporary style, polished finish, digital painting',
                    appropriateGenres: ['science fiction', 'contemporary', 'young adult'],
                    appropriateAudiences: ['young adult', 'adult', 'tech-savvy readers'],
                    ageRating: 'teen',
                    visualCharacteristics: ['clean lines', 'modern aesthetic', 'digital finish']
                },
                'anime_style': {
                    description: 'Anime-inspired illustrations',
                    dallePrompt: 'anime style illustration, manga-inspired art, detailed characters, dynamic poses, colorful anime aesthetic',
                    appropriateGenres: ['young adult', 'adventure', 'fantasy', 'romance'],
                    appropriateAudiences: ['young adult', 'teen', 'anime fans'],
                    ageRating: 'teen',
                    visualCharacteristics: ['anime character design', 'dynamic poses', 'detailed backgrounds']
                },
                'dark_artistic': {
                    description: 'Dark and moody artistic style for mature themes',
                    dallePrompt: 'dark artistic illustration, moody atmosphere, dramatic composition, mature themes, sophisticated art style',
                    appropriateGenres: ['horror', 'thriller', 'dark fantasy', 'gothic'],
                    appropriateAudiences: ['adult', 'mature readers'],
                    ageRating: 'mature',
                    visualCharacteristics: ['dark colors', 'dramatic mood', 'complex composition']
                }
            },
            genreMapping: {
                'children': ['children_book_illustration', 'cartoon_colorful'],
                'childrens': ['children_book_illustration', 'cartoon_colorful'],
                'kids': ['children_book_illustration', 'cartoon_colorful'],
                'young adult': ['digital_art', 'anime_style', 'fantasy_illustration'],
                'romance': ['romantic_artistic', 'watercolor_soft'],
                'fantasy': ['fantasy_illustration', 'digital_art'],
                'science fiction': ['digital_art', 'fantasy_illustration'],
                'mystery': ['noir_illustration', 'realistic_artistic'],
                'thriller': ['noir_illustration', 'dark_artistic'],
                'horror': ['dark_artistic', 'noir_illustration'],
                'drama': ['realistic_artistic', 'watercolor_soft'],
                'comedy': ['cartoon_colorful', 'children_book_illustration'],
                'adventure': ['fantasy_illustration', 'digital_art', 'children_book_illustration']
            },
            audienceMapping: {
                'children': ['children_book_illustration', 'cartoon_colorful'],
                'kids': ['children_book_illustration', 'cartoon_colorful'],
                'young readers': ['children_book_illustration', 'cartoon_colorful'],
                'family': ['children_book_illustration', 'watercolor_soft'],
                'young adult': ['digital_art', 'anime_style', 'fantasy_illustration'],
                'teen': ['anime_style', 'digital_art', 'fantasy_illustration'],
                'adult': ['realistic_artistic', 'watercolor_soft', 'romantic_artistic'],
                'mature readers': ['realistic_artistic', 'noir_illustration', 'dark_artistic']
            },
            toneMapping: {
                'humorous': ['cartoon_colorful', 'children_book_illustration'],
                'serious': ['realistic_artistic', 'noir_illustration'],
                'inspirational': ['watercolor_soft', 'fantasy_illustration'],
                'conversational': ['digital_art', 'watercolor_soft'],
                'formal': ['realistic_artistic', 'professional_illustration'],
                'informal': ['cartoon_colorful', 'digital_art'],
                'academic': ['realistic_artistic', 'professional_illustration']
            }
        };
    }

    /**
     * Get human-readable description of a style
     */
    getStyleDescription(styleName: string): string {
        return this.styleConfig.styles[styleName]?.description || 'Standard illustration style';
    }

    /**
     * Get all available styles for user selection
     */
    getAvailableStyles(): Array<{ name: string; description: string; ageRating: string }> {
        return Object.entries(this.styleConfig.styles).map(([name, config]) => ({
            name,
            description: config.description,
            ageRating: config.ageRating
        }));
    }
}

export default ImageStyleAnalyzer;
