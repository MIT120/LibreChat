import axios from 'axios';
import fs from 'fs';
import OpenAI from 'openai';
import path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { Image } from '../models/Image.js';

export class ImageService {
    constructor(bookService) {
        this.bookService = bookService;
        this.imagesDir = path.join(process.cwd(), 'exports', 'images');
        this.ensureImagesDirectory();

        // Initialize OpenAI client if API key is available
        this.openai = process.env.OPENAI_API_KEY
            ? new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
            })
            : null;
    }

    ensureImagesDirectory() {
        try {
            if (!fs.existsSync(this.imagesDir)) {
                fs.mkdirSync(this.imagesDir, { recursive: true });
            }
            // Test write permissions by creating a test file
            const testFile = path.join(this.imagesDir, '.write-test');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
        } catch (error) {
            if (error.code === 'EACCES' || error.code === 'ENOENT') {
                console.warn(
                    `Permission denied or directory not accessible: ${this.imagesDir}. Falling back to temporary directory.`,
                );
                // Try to create in a different location if the main one fails
                const fallbackDir = path.join('/tmp', 'exports', 'images');
                console.log(`Falling back to ${fallbackDir}`);
                this.imagesDir = fallbackDir;
                try {
                    fs.mkdirSync(this.imagesDir, { recursive: true });
                    console.log(`Successfully created fallback directory: ${this.imagesDir}`);
                } catch (fallbackError) {
                    console.error('Failed to create fallback directory:', fallbackError);
                    throw new Error(
                        `Cannot create images directory in either ${path.join(process.cwd(), 'exports', 'images')} or ${fallbackDir}`,
                    );
                }
            } else {
                console.error('Unexpected error creating images directory:', error);
                throw error;
            }
        }
    }

    /**
     * Analyzes story content and generates contextual images
     * @param {Object} params - Image generation parameters
     * @returns {Promise<Object>} Generated image information
     */
    async generateContextualImage(params) {
        const {
            bookId,
            chapterId,
            targetPageNumber,
            imagePrompt,
            style = 'book_illustration',
            authorId,
        } = params;

        try {
            // Get book and chapter context
            const bookData = await this.bookService.getBook(bookId, {
                includeChapters: true,
                includePages: true,
            });

            if (!bookData) {
                throw new Error('Book not found');
            }

            if (bookData.authorId !== authorId) {
                throw new Error('Unauthorized: You can only generate images for your own books');
            }

            const chapter = bookData.chapters.find((ch) => ch._id === chapterId);
            if (!chapter) {
                throw new Error('Chapter not found');
            }

            // Analyze story context around the target page
            const contextAnalysis = await this.analyzeStoryContext(chapter, targetPageNumber);

            // Generate image prompt based on context
            const enhancedPrompt = await this.createEnhancedPrompt(
                imagePrompt,
                contextAnalysis,
                bookData,
                style,
            );

            // Generate the image (placeholder for AI service integration)
            const imageData = await this.generateImage(enhancedPrompt, style);

            // Save image metadata and determine optimal placement
            const optimalPlacement = this.determineOptimalPlacement(
                chapter,
                targetPageNumber,
                contextAnalysis,
            );

            // Save image to database
            const imageRecord = new Image({
                _id: uuidv4(),
                bookId,
                chapterId,
                targetPageNumber,
                url: imageData.url,
                localPath: imageData.localPath,
                filename: imageData.filename,
                placement: optimalPlacement,
                prompt: {
                    original: imagePrompt,
                    enhanced: enhancedPrompt,
                },
                style,
                contextAnalysis,
                generationData: imageData.generationData || {},
                status: 'generated',
                authorId,
                metadata: imageData.metadata || {},
            });

            const savedImage = await imageRecord.save();
            return savedImage;
        } catch (error) {
            throw new Error(`Failed to generate contextual image: ${error.message}`);
        }
    }

    /**
     * Analyzes the story context around a target page
     * @param {Object} chapter - Chapter data with pages
     * @param {number} targetPageNumber - Target page for image placement
     * @returns {Object} Context analysis
     */
    async analyzeStoryContext(chapter, targetPageNumber) {
        const pages = chapter.pages || [];
        const sortedPages = pages.sort((a, b) => a.pageNumber - b.pageNumber);

        // Get pages before and after target
        const beforePages = sortedPages.filter((p) => p.pageNumber < targetPageNumber);
        const afterPages = sortedPages.filter((p) => p.pageNumber >= targetPageNumber);

        // Analyze content themes and mood
        const recentContent = beforePages.slice(-2); // Last 2 pages before
        const upcomingContent = afterPages.slice(0, 2); // Next 2 pages after

        const contextText = [
            ...recentContent.map((p) => p.content),
            ...upcomingContent.map((p) => p.content),
        ].join(' ');

        // Extract key themes, characters, settings, and mood
        const analysis = {
            targetPageNumber,
            contextualThemes: this.extractThemes(contextText),
            characters: this.extractCharacters(contextText),
            setting: this.extractSetting(contextText),
            mood: this.extractMood(contextText),
            actionLevel: this.assessActionLevel(contextText),
            storyBeat: this.identifyStoryBeat(recentContent, upcomingContent),
            suggestedPlacement: this.suggestPlacement(recentContent, upcomingContent),
        };

        return analysis;
    }

    /**
     * Creates an enhanced image prompt based on story context
     * @param {string} basePrompt - Base user prompt
     * @param {Object} context - Story context analysis
     * @param {Object} bookData - Complete book data
     * @param {string} style - Image style
     * @returns {string} Enhanced prompt
     */
    async createEnhancedPrompt(basePrompt, context, bookData, style) {
        const genreStyles = {
            fantasy: 'magical, ethereal, fantasy art style',
            'sci-fi': 'futuristic, technological, science fiction art',
            mystery: 'noir, atmospheric, mysterious lighting',
            romance: 'warm, soft lighting, emotional',
            horror: 'dark, ominous, dramatic shadows',
            adventure: 'dynamic, action-packed, heroic',
            historical: 'period-accurate, historical art style',
            children: 'colorful, friendly, whimsical illustration',
        };

        const moodStyles = {
            tense: 'dramatic lighting, high contrast',
            peaceful: 'soft lighting, serene atmosphere',
            exciting: 'dynamic composition, vibrant colors',
            mysterious: 'shadowy, atmospheric, moody',
            romantic: 'warm tones, soft focus',
            sad: 'muted colors, melancholic mood',
            joyful: 'bright colors, uplifting composition',
        };

        let enhancedPrompt = basePrompt;

        // Add context from story
        if (context.setting) {
            enhancedPrompt += `, set in ${context.setting}`;
        }

        if (context.characters.length > 0) {
            enhancedPrompt += `, featuring ${context.characters.slice(0, 3).join(', ')}`;
        }

        // Add genre and mood styling
        const genreStyle = genreStyles[bookData.genre.toLowerCase()] || '';
        const moodStyle = moodStyles[context.mood] || '';

        if (genreStyle) {
            enhancedPrompt += `, ${genreStyle}`;
        }

        if (moodStyle) {
            enhancedPrompt += `, ${moodStyle}`;
        }

        // Add technical specifications
        enhancedPrompt += `, high quality digital art, book illustration style, suitable for publication`;

        return enhancedPrompt;
    }

    /**
     * Generates an image using OpenAI DALL-E or fallback to placeholder
     * @param {string} prompt - Image generation prompt
     * @param {string} style - Image style
     * @returns {Object} Generated image data
     */
    async generateImage(prompt, style) {
        const imageId = uuidv4();
        const filename = `book_image_${imageId}.png`;
        const localPath = path.join(this.imagesDir, filename);

        try {
            if (this.openai) {
                // Use OpenAI DALL-E for real image generation
                const response = await this.openai.images.generate({
                    model: 'dall-e-3',
                    prompt: prompt,
                    n: 1,
                    size: '1024x1024',
                    quality: 'standard',
                    response_format: 'url',
                });

                const imageUrl = response.data[0].url;
                const revisedPrompt = response.data[0].revised_prompt;

                // Download the generated image
                const imageResponse = await axios.get(imageUrl, {
                    responseType: 'arraybuffer',
                });

                // Process and save the image
                await sharp(imageResponse.data).png().toFile(localPath);

                // Get image metadata
                const metadata = await sharp(localPath).metadata();

                return {
                    url: `/exports/images/${filename}`,
                    localPath: localPath,
                    filename: filename,
                    id: imageId,
                    generationData: {
                        model: 'dall-e-3',
                        size: '1024x1024',
                        quality: 'standard',
                        revisedPrompt: revisedPrompt,
                    },
                    metadata: {
                        fileSize: fs.statSync(localPath).size,
                        dimensions: {
                            width: metadata.width,
                            height: metadata.height,
                        },
                        format: metadata.format,
                    },
                };
            } else {
                // Fallback to placeholder image
                return await this.generatePlaceholderImage(prompt, style, imageId, filename, localPath);
            }
        } catch (error) {
            console.warn('Image generation failed, using placeholder:', error.message);
            return await this.generatePlaceholderImage(prompt, style, imageId, filename, localPath);
        }
    }

    /**
     * Generates a placeholder image when AI generation fails or is unavailable
     * @param {string} prompt - Image generation prompt
     * @param {string} style - Image style
     * @param {string} imageId - Image ID
     * @param {string} filename - Filename
     * @param {string} localPath - Local file path
     * @returns {Object} Placeholder image data
     */
    async generatePlaceholderImage(prompt, style, imageId, filename, localPath) {
        // Create a simple placeholder image using Sharp
        const placeholderText = `Image: ${prompt.substring(0, 100)}...`;

        await sharp({
            create: {
                width: 800,
                height: 600,
                channels: 4,
                background: { r: 240, g: 240, b: 240, alpha: 1 },
            },
        })
            .png()
            .toFile(localPath);

        const metadata = await sharp(localPath).metadata();

        return {
            url: `/exports/images/${filename}`,
            localPath: localPath,
            filename: filename,
            id: imageId,
            generationData: {
                model: 'placeholder',
                size: '800x600',
                quality: 'standard',
                revisedPrompt: prompt,
            },
            metadata: {
                fileSize: fs.statSync(localPath).size,
                dimensions: {
                    width: metadata.width,
                    height: metadata.height,
                },
                format: metadata.format,
            },
        };
    }

    /**
     * Determines optimal placement for the image within the story flow
     * @param {Object} chapter - Chapter data
     * @param {number} targetPageNumber - Target page number
     * @param {Object} context - Context analysis
     * @returns {Object} Placement recommendation
     */
    determineOptimalPlacement(chapter, targetPageNumber, context) {
        const placement = {
            pageNumber: targetPageNumber,
            position: 'between', // 'before', 'after', 'between'
            reason: '',
            confidence: 0.8,
        };

        // Analyze story beats to determine best placement
        switch (context.storyBeat) {
            case 'scene_transition':
                placement.position = 'between';
                placement.reason = 'Perfect for scene transition visualization';
                placement.confidence = 0.9;
                break;
            case 'character_introduction':
                placement.position = 'after';
                placement.reason = 'Illustrate character after introduction';
                placement.confidence = 0.85;
                break;
            case 'setting_description':
                placement.position = 'between';
                placement.reason = 'Visualize setting during description';
                placement.confidence = 0.9;
                break;
            case 'action_sequence':
                placement.position = 'after';
                placement.reason = 'Show action aftermath or climax';
                placement.confidence = 0.8;
                break;
            case 'emotional_moment':
                placement.position = 'before';
                placement.reason = 'Set emotional tone before key moment';
                placement.confidence = 0.75;
                break;
            default:
                placement.position = 'between';
                placement.reason = 'General story illustration';
                placement.confidence = 0.7;
        }

        return placement;
    }

    // Helper methods for content analysis
    extractThemes(text) {
        // Simple keyword-based theme extraction
        const themes = [];
        const themeKeywords = {
            love: ['love', 'romance', 'heart', 'kiss', 'embrace'],
            conflict: ['fight', 'battle', 'war', 'struggle', 'conflict'],
            mystery: ['secret', 'hidden', 'mystery', 'unknown', 'discover'],
            adventure: ['journey', 'quest', 'explore', 'adventure', 'travel'],
            magic: ['magic', 'spell', 'wizard', 'enchant', 'mystical'],
        };

        for (const [theme, keywords] of Object.entries(themeKeywords)) {
            if (keywords.some((keyword) => text.toLowerCase().includes(keyword))) {
                themes.push(theme);
            }
        }

        return themes;
    }

    extractCharacters(text) {
        // Simple character extraction (capitalized words that appear multiple times)
        const words = text.match(/\b[A-Z][a-z]+\b/g) || [];
        const characterCounts = {};

        words.forEach((word) => {
            if (word.length > 2) {
                // Skip short words
                characterCounts[word] = (characterCounts[word] || 0) + 1;
            }
        });

        return Object.entries(characterCounts)
            .filter(([word, count]) => count > 1)
            .map(([word]) => word)
            .slice(0, 5); // Top 5 potential characters
    }

    extractSetting(text) {
        const settingKeywords = {
            forest: ['forest', 'trees', 'woods', 'woodland'],
            castle: ['castle', 'palace', 'fortress', 'tower'],
            city: ['city', 'street', 'building', 'urban'],
            mountain: ['mountain', 'peak', 'summit', 'cliff'],
            ocean: ['ocean', 'sea', 'beach', 'waves', 'shore'],
            desert: ['desert', 'sand', 'dune', 'oasis'],
            house: ['house', 'home', 'room', 'kitchen', 'bedroom'],
        };

        for (const [setting, keywords] of Object.entries(settingKeywords)) {
            if (keywords.some((keyword) => text.toLowerCase().includes(keyword))) {
                return setting;
            }
        }

        return 'unknown';
    }

    extractMood(text) {
        const moodKeywords = {
            tense: ['tense', 'nervous', 'anxious', 'worried', 'afraid'],
            peaceful: ['peaceful', 'calm', 'serene', 'quiet', 'tranquil'],
            exciting: ['exciting', 'thrilling', 'exhilarating', 'dynamic'],
            mysterious: ['mysterious', 'strange', 'weird', 'eerie', 'cryptic'],
            romantic: ['romantic', 'tender', 'intimate', 'gentle', 'loving'],
            sad: ['sad', 'melancholy', 'sorrowful', 'gloomy', 'depressed'],
            joyful: ['happy', 'joyful', 'cheerful', 'delighted', 'elated'],
        };

        for (const [mood, keywords] of Object.entries(moodKeywords)) {
            if (keywords.some((keyword) => text.toLowerCase().includes(keyword))) {
                return mood;
            }
        }

        return 'neutral';
    }

    assessActionLevel(text) {
        const actionWords = ['run', 'fight', 'chase', 'jump', 'climb', 'race', 'battle', 'struggle'];
        const actionCount = actionWords.filter((word) => text.toLowerCase().includes(word)).length;

        if (actionCount >= 3) return 'high';
        if (actionCount >= 1) return 'medium';
        return 'low';
    }

    identifyStoryBeat(beforePages, afterPages) {
        const allText = [...beforePages.map((p) => p.content), ...afterPages.map((p) => p.content)]
            .join(' ')
            .toLowerCase();

        if (allText.includes('entered') || allText.includes('arrived') || allText.includes('came to')) {
            return 'scene_transition';
        }
        if (allText.includes('introduced') || allText.includes('met') || allText.includes('appeared')) {
            return 'character_introduction';
        }
        if (allText.includes('looked') || allText.includes('saw') || allText.includes('observed')) {
            return 'setting_description';
        }
        if (allText.includes('fought') || allText.includes('ran') || allText.includes('chased')) {
            return 'action_sequence';
        }
        if (allText.includes('felt') || allText.includes('emotion') || allText.includes('heart')) {
            return 'emotional_moment';
        }

        return 'general';
    }

    suggestPlacement(beforePages, afterPages) {
        // Analyze content flow to suggest optimal placement
        if (beforePages.length === 0) return 'beginning';
        if (afterPages.length === 0) return 'end';

        const beforeContent = beforePages[beforePages.length - 1]?.content || '';
        const afterContent = afterPages[0]?.content || '';

        // If there's a clear narrative break, suggest between
        if (beforeContent.includes('.') && afterContent.match(/^[A-Z]/)) {
            return 'between_paragraphs';
        }

        return 'between_pages';
    }

    /**
     * Gets all images for a book
     * @param {string} bookId - Book ID
     * @param {Object} options - Query options
     * @returns {Array} List of images
     */
    async getBookImages(bookId, options = {}) {
        try {
            await this.bookService.ensureConnection();

            const query = { bookId };

            if (options.chapterId) {
                query.chapterId = options.chapterId;
            }

            if (options.status) {
                query.status = options.status;
            }

            const images = await Image.find(query).sort({ chapterId: 1, targetPageNumber: 1 }).lean();

            return images;
        } catch (error) {
            throw new Error(`Failed to get book images: ${error.message}`);
        }
    }

    /**
     * Gets images for a specific chapter
     * @param {string} chapterId - Chapter ID
     * @returns {Array} List of images
     */
    async getChapterImages(chapterId) {
        try {
            await this.bookService.ensureConnection();

            const images = await Image.find({ chapterId }).sort({ targetPageNumber: 1 }).lean();

            return images;
        } catch (error) {
            throw new Error(`Failed to get chapter images: ${error.message}`);
        }
    }

    /**
     * Updates image placement based on story changes
     * @param {string} imageId - Image ID
     * @param {Object} newPlacement - New placement information
     * @param {string} authorId - Author ID for authorization
     * @returns {Object} Updated image record
     */
    async updateImagePlacement(imageId, newPlacement, authorId) {
        try {
            await this.bookService.ensureConnection();

            const image = await Image.findById(imageId);
            if (!image) {
                throw new Error('Image not found');
            }

            if (image.authorId !== authorId) {
                throw new Error('Unauthorized: You can only update your own images');
            }

            image.placement = { ...image.placement, ...newPlacement };
            const updatedImage = await image.save();

            return updatedImage;
        } catch (error) {
            throw new Error(`Failed to update image placement: ${error.message}`);
        }
    }

    /**
     * Approves an image for publication
     * @param {string} imageId - Image ID
     * @param {string} authorId - Author ID for authorization
     * @returns {Object} Updated image record
     */
    async approveImage(imageId, authorId) {
        try {
            await this.bookService.ensureConnection();

            const image = await Image.findById(imageId);
            if (!image) {
                throw new Error('Image not found');
            }

            if (image.authorId !== authorId) {
                throw new Error('Unauthorized: You can only approve your own images');
            }

            image.status = 'approved';
            image.approved = true;
            image.approvedAt = new Date();
            image.approvedBy = authorId;

            const updatedImage = await image.save();
            return updatedImage;
        } catch (error) {
            throw new Error(`Failed to approve image: ${error.message}`);
        }
    }

    /**
     * Deletes an image and its associated files
     * @param {string} imageId - Image ID
     * @param {string} authorId - Author ID for authorization
     * @returns {Object} Deletion result
     */
    async deleteImage(imageId, authorId) {
        try {
            await this.bookService.ensureConnection();

            const image = await Image.findById(imageId);
            if (!image) {
                throw new Error('Image not found');
            }

            if (image.authorId !== authorId) {
                throw new Error('Unauthorized: You can only delete your own images');
            }

            // Delete the physical file
            if (fs.existsSync(image.localPath)) {
                fs.unlinkSync(image.localPath);
            }

            // Delete from database
            await Image.findByIdAndDelete(imageId);

            return {
                success: true,
                imageId,
                deletedAt: new Date(),
            };
        } catch (error) {
            throw new Error(`Failed to delete image: ${error.message}`);
        }
    }

    /**
     * Regenerates an image with a new prompt
     * @param {string} imageId - Image ID
     * @param {string} newPrompt - New image prompt
     * @param {string} authorId - Author ID for authorization
     * @returns {Object} Updated image record
     */
    async regenerateImage(imageId, newPrompt, authorId) {
        try {
            await this.bookService.ensureConnection();

            const existingImage = await Image.findById(imageId);
            if (!existingImage) {
                throw new Error('Image not found');
            }

            if (existingImage.authorId !== authorId) {
                throw new Error('Unauthorized: You can only regenerate your own images');
            }

            // Delete old image file
            if (fs.existsSync(existingImage.localPath)) {
                fs.unlinkSync(existingImage.localPath);
            }

            // Get book context for enhanced prompt
            const bookData = await this.bookService.getBook(existingImage.bookId, {
                includeChapters: true,
                includePages: true,
            });

            const chapter = bookData.chapters.find((ch) => ch._id === existingImage.chapterId);
            const contextAnalysis = await this.analyzeStoryContext(
                chapter,
                existingImage.targetPageNumber,
            );

            // Generate enhanced prompt
            const enhancedPrompt = await this.createEnhancedPrompt(
                newPrompt,
                contextAnalysis,
                bookData,
                existingImage.style,
            );

            // Generate new image
            const imageData = await this.generateImage(enhancedPrompt, existingImage.style);

            // Update image record
            existingImage.url = imageData.url;
            existingImage.localPath = imageData.localPath;
            existingImage.filename = imageData.filename;
            existingImage.prompt.original = newPrompt;
            existingImage.prompt.enhanced = enhancedPrompt;
            existingImage.contextAnalysis = contextAnalysis;
            existingImage.generationData = imageData.generationData || {};
            existingImage.metadata = imageData.metadata || {};
            existingImage.status = 'generated';

            const updatedImage = await existingImage.save();
            return updatedImage;
        } catch (error) {
            throw new Error(`Failed to regenerate image: ${error.message}`);
        }
    }
}
