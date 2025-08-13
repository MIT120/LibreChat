/**
 * Comic Tool Handlers - MCP tools for comic book creation with panel-by-panel scripting
 */

import { z } from 'zod';
import { ILogger } from '../../core/Logger.js';
import { IBookService, IToolHandler } from '../../interfaces/index.js';
import { ToolExecutor } from '../ToolExecutor.js';
import { CreateBookRequest, VocabularyLevel, SentenceStructure, WritingTone, WritingVoice } from '../../../types/book.js';

export class ComicToolHandlers {
    private logger: ILogger;
    private bookService: IBookService;
    private comicProjects: Map<string, any> = new Map();

    constructor(logger: ILogger, bookService: IBookService) {
        this.logger = logger.child('ComicToolHandlers');
        this.bookService = bookService;
    }

    getTools(): IToolHandler[] {
        return [
            {
                name: 'create_comic_book',
                description: 'Create a comprehensive comic book project with full structure',
                inputSchema: {
                    type: 'object',
                    properties: {
                        title: { type: 'string', description: 'Comic book title' },
                        author: { type: 'string', description: 'Comic book author/writer' },
                        artist: { type: 'string', description: 'Comic book artist (optional)' },
                        genre: { type: 'string', description: 'Comic book genre (e.g., thriller, horror, superhero, slice-of-life)' },
                        format: { 
                            type: 'string', 
                            description: 'Comic format', 
                            enum: ['single_issue', 'graphic_novel', 'webcomic', 'manga', 'mini_series']
                        },
                        description: { type: 'string', description: 'Brief comic description or logline' },
                        target_audience: { 
                            type: 'string', 
                            description: 'Target audience', 
                            enum: ['all_ages', 'teen', 'mature', 'adult_only']
                        },
                        estimated_pages: { type: 'number', description: 'Estimated total page count' },
                        page_layout: {
                            type: 'string',
                            description: 'Default page layout style',
                            enum: ['traditional', 'widescreen', 'splash_heavy', 'grid_based']
                        },
                        art_style: { type: 'string', description: 'Art style description' },
                        color_palette: { type: 'string', description: 'Overall color palette and mood' },
                        production_notes: { type: 'string', description: 'Initial production notes and requirements' }
                    },
                    required: ['title', 'format'],
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        title: z.string().min(1),
                        author: z.string().optional(),
                        artist: z.string().optional(),
                        genre: z.string().optional(),
                        format: z.enum(['single_issue', 'graphic_novel', 'webcomic', 'manga', 'mini_series']),
                        description: z.string().optional(),
                        target_audience: z.enum(['all_ages', 'teen', 'mature', 'adult_only']).optional(),
                        estimated_pages: z.number().int().positive().optional(),
                        page_layout: z.enum(['traditional', 'widescreen', 'splash_heavy', 'grid_based']).optional(),
                        art_style: z.string().optional(),
                        color_palette: z.string().optional(),
                        production_notes: z.string().optional(),
                    });

                    return ToolExecutor.run({
                        name: 'create_comic_book',
                        logger: this.logger,
                        schema,
                        args,
                        perform: (input) => this.createComicBook(input),
                        format: (comic) => {
                            return `📚 **Comic Book Project Created Successfully!**\n\n**Comic Details:**\n- **ID:** ${comic.id}\n- **Title:** ${comic.title}\n- **Author:** ${comic.author || 'Not specified'}\n- **Artist:** ${comic.artist || 'Not specified'}\n- **Genre:** ${comic.genre || 'General'}\n- **Format:** ${comic.format}\n- **Target Audience:** ${comic.target_audience || 'General'}\n- **Estimated Pages:** ${comic.estimated_pages || 'Not set'}\n- **Art Style:** ${comic.art_style || 'Not specified'}\n- **Created:** ${new Date(comic.createdAt).toLocaleDateString()}\n\n✨ Your comic book project is ready for chapter and page creation!`;
                        },
                    });
                },
            },
            {
                name: 'create_comic_character',
                description: 'Create a detailed character profile for comics with visual references',
                inputSchema: {
                    type: 'object',
                    properties: {
                        comic_id: { type: 'string', description: 'Comic book ID this character belongs to' },
                        name: { type: 'string', description: 'Character name' },
                        role: { 
                            type: 'string', 
                            description: 'Character role', 
                            enum: ['protagonist', 'antagonist', 'supporting', 'background', 'narrator']
                        },
                        physical_description: { type: 'string', description: 'Detailed physical appearance for artists' },
                        personality: { type: 'string', description: 'Personality traits and characteristics' },
                        background: { type: 'string', description: 'Character background and history' },
                        motivations: { type: 'string', description: 'Character motivations and goals' },
                        relationships: { type: 'string', description: 'Relationships with other characters' },
                        character_arc: { type: 'string', description: 'Character development throughout the story' },
                        visual_references: { type: 'string', description: 'Visual references and inspiration for artists' },
                        costume_description: { type: 'string', description: 'Costume or clothing details' },
                        color_scheme: { type: 'string', description: 'Character-specific color palette' },
                        speech_patterns: { type: 'string', description: 'How the character speaks (dialogue style)' }
                    },
                    required: ['comic_id', 'name', 'role'],
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        comic_id: z.string().min(1),
                        name: z.string().min(1),
                        role: z.enum(['protagonist', 'antagonist', 'supporting', 'background', 'narrator']),
                        physical_description: z.string().optional(),
                        personality: z.string().optional(),
                        background: z.string().optional(),
                        motivations: z.string().optional(),
                        relationships: z.string().optional(),
                        character_arc: z.string().optional(),
                        visual_references: z.string().optional(),
                        costume_description: z.string().optional(),
                        color_scheme: z.string().optional(),
                        speech_patterns: z.string().optional(),
                    });

                    return ToolExecutor.run({
                        name: 'create_comic_character',
                        logger: this.logger,
                        schema,
                        args,
                        perform: (input) => this.createComicCharacter(input),
                        format: (character) => {
                            return `👤 **Character Created Successfully!**\n\n**Character Details:**\n- **Name:** ${character.name}\n- **Role:** ${character.role}\n- **Physical Description:** ${character.physical_description || 'Not specified'}\n- **Personality:** ${character.personality || 'Not specified'}\n- **Color Scheme:** ${character.color_scheme || 'Not specified'}\n\n✨ Character profile ready for comic production!`;
                        },
                    });
                },
            },
            {
                name: 'create_comic_page_script',
                description: 'Create detailed comic page scripts with panel-by-panel breakdown',
                inputSchema: {
                    type: 'object',
                    properties: {
                        comic_id: { type: 'string', description: 'Comic book ID' },
                        page_number: { type: 'number', description: 'Page number' },
                        chapter_title: { type: 'string', description: 'Chapter or issue title (optional)' },
                        page_title: { type: 'string', description: 'Page title or scene description' },
                        location: { type: 'string', description: 'Scene location' },
                        time: { type: 'string', description: 'Time of day/period' },
                        mood: { type: 'string', description: 'Overall page mood and atmosphere' },
                        panels: {
                            type: 'array',
                            description: 'Panel-by-panel breakdown',
                            items: {
                                type: 'object',
                                properties: {
                                    panel_number: { type: 'number', description: 'Panel number on the page' },
                                    panel_type: { 
                                        type: 'string', 
                                        description: 'Panel size/type',
                                        enum: ['small', 'medium', 'large', 'full_width', 'splash', 'inset', 'borderless']
                                    },
                                    aspect_ratio: { type: 'string', description: 'Panel aspect ratio (e.g., 16:9, 4:3, square)' },
                                    shot_type: { 
                                        type: 'string', 
                                        description: 'Camera shot type',
                                        enum: ['extreme_close_up', 'close_up', 'medium_shot', 'full_shot', 'wide_shot', 'establishing_shot']
                                    },
                                    angle: { 
                                        type: 'string', 
                                        description: 'Camera angle',
                                        enum: ['eye_level', 'high_angle', 'low_angle', 'birds_eye', 'worms_eye', 'dutch_angle']
                                    },
                                    action: { type: 'string', description: 'Action happening in the panel' },
                                    dialogue: { type: 'string', description: 'Character dialogue with speaker labels' },
                                    internal_thoughts: { type: 'string', description: 'Character internal monologue' },
                                    sound_effects: { type: 'string', description: 'Sound effects (SFX) and onomatopoeia' },
                                    captions: { type: 'string', description: 'Narrative captions or exposition' },
                                    visual_details: { type: 'string', description: 'Important visual details and composition notes' },
                                    lighting: { type: 'string', description: 'Lighting setup and mood direction' },
                                    colors: { type: 'string', description: 'Color palette and mood specifications' },
                                    background: { type: 'string', description: 'Background details and setting' },
                                    foreground: { type: 'string', description: 'Foreground elements and character positioning' }
                                },
                                required: ['panel_number', 'action']
                            }
                        },
                        production_notes: { type: 'string', description: 'Production notes for artists' },
                        reference_images: { type: 'string', description: 'Reference image descriptions or sources' }
                    },
                    required: ['comic_id', 'page_number', 'page_title', 'panels'],
                },
                handler: async (args: any) => {
                    const panelSchema = z.object({
                        panel_number: z.number().int().positive(),
                        panel_type: z.enum(['small', 'medium', 'large', 'full_width', 'splash', 'inset', 'borderless']).optional(),
                        aspect_ratio: z.string().optional(),
                        shot_type: z.enum(['extreme_close_up', 'close_up', 'medium_shot', 'full_shot', 'wide_shot', 'establishing_shot']).optional(),
                        angle: z.enum(['eye_level', 'high_angle', 'low_angle', 'birds_eye', 'worms_eye', 'dutch_angle']).optional(),
                        action: z.string().min(1),
                        dialogue: z.string().optional(),
                        internal_thoughts: z.string().optional(),
                        sound_effects: z.string().optional(),
                        captions: z.string().optional(),
                        visual_details: z.string().optional(),
                        lighting: z.string().optional(),
                        colors: z.string().optional(),
                        background: z.string().optional(),
                        foreground: z.string().optional(),
                    });

                    const schema = z.object({
                        comic_id: z.string().min(1),
                        page_number: z.number().int().positive(),
                        chapter_title: z.string().optional(),
                        page_title: z.string().min(1),
                        location: z.string().optional(),
                        time: z.string().optional(),
                        mood: z.string().optional(),
                        panels: z.array(panelSchema).min(1),
                        production_notes: z.string().optional(),
                        reference_images: z.string().optional(),
                    });

                    return ToolExecutor.run({
                        name: 'create_comic_page_script',
                        logger: this.logger,
                        schema,
                        args,
                        perform: (input) => this.createComicPageScript(input),
                        format: (page) => {
                            return `📄 **Comic Page Script Created!**\n\n**Page ${page.page_number}: ${page.page_title}**\n- **Location:** ${page.location || 'Not specified'}\n- **Time:** ${page.time || 'Not specified'}\n- **Mood:** ${page.mood || 'Not specified'}\n- **Panels:** ${page.panels.length}\n\n**Panel Breakdown:**\n${page.panels.map((panel: any, index: number) => `\n**Panel ${panel.panel_number}** (${panel.panel_type || 'standard'})\n- **Shot:** ${panel.shot_type || 'medium_shot'} ${panel.angle ? `(${panel.angle})` : ''}\n- **Action:** ${panel.action}\n- **Dialogue:** ${panel.dialogue || 'None'}\n- **SFX:** ${panel.sound_effects || 'None'}`).join('\n')}\n\n✨ Page script ready for artist production!`;
                        },
                    });
                },
            },
            {
                name: 'add_comic_production_notes',
                description: 'Add comprehensive production notes for comic artists and creators',
                inputSchema: {
                    type: 'object',
                    properties: {
                        comic_id: { type: 'string', description: 'Comic book ID' },
                        category: { 
                            type: 'string', 
                            description: 'Category of production notes', 
                            enum: ['color_palette', 'art_style', 'lettering', 'layout', 'technical', 'reference', 'character_guide']
                        },
                        title: { type: 'string', description: 'Title of this production note section' },
                        content: { type: 'string', description: 'Detailed production notes content' },
                        applies_to: { 
                            type: 'string', 
                            description: 'What this applies to',
                            enum: ['entire_comic', 'specific_pages', 'characters', 'scenes', 'dialogue']
                        },
                        page_range: { type: 'string', description: 'Page range if applies to specific pages (e.g., "1-5", "12")' },
                        priority: { 
                            type: 'string', 
                            description: 'Priority level', 
                            enum: ['critical', 'high', 'medium', 'low']
                        },
                        color_specifications: {
                            type: 'object',
                            description: 'Color specifications for this note',
                            properties: {
                                primary_colors: { type: 'array', items: { type: 'string' }, description: 'Primary color hex codes' },
                                secondary_colors: { type: 'array', items: { type: 'string' }, description: 'Secondary color hex codes' },
                                mood_colors: { type: 'array', items: { type: 'string' }, description: 'Mood-specific color hex codes' },
                                avoid_colors: { type: 'array', items: { type: 'string' }, description: 'Colors to avoid' }
                            }
                        }
                    },
                    required: ['comic_id', 'category', 'title', 'content'],
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        comic_id: z.string().min(1),
                        category: z.enum(['color_palette', 'art_style', 'lettering', 'layout', 'technical', 'reference', 'character_guide']),
                        title: z.string().min(1),
                        content: z.string().min(1),
                        applies_to: z.enum(['entire_comic', 'specific_pages', 'characters', 'scenes', 'dialogue']).optional(),
                        page_range: z.string().optional(),
                        priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
                        color_specifications: z.object({
                            primary_colors: z.array(z.string()).optional(),
                            secondary_colors: z.array(z.string()).optional(),
                            mood_colors: z.array(z.string()).optional(),
                            avoid_colors: z.array(z.string()).optional(),
                        }).optional(),
                    });

                    return ToolExecutor.run({
                        name: 'add_comic_production_notes',
                        logger: this.logger,
                        schema,
                        args,
                        perform: (input) => this.addComicProductionNotes(input),
                        format: (note) => {
                            return `📝 **Production Note Added!**\n\n**${note.category.toUpperCase()}: ${note.title}**\n- **Priority:** ${note.priority || 'medium'}\n- **Applies to:** ${note.applies_to || 'entire_comic'}\n- **Content:** ${note.content.substring(0, 100)}${note.content.length > 100 ? '...' : ''}\n\n✨ Production note ready for artist reference!`;
                        },
                    });
                },
            },
            {
                name: 'export_comic_script',
                description: 'Export comic content in various formats for production',
                inputSchema: {
                    type: 'object',
                    properties: {
                        comic_id: { type: 'string', description: 'Comic book ID to export' },
                        export_format: { 
                            type: 'string', 
                            description: 'Export format', 
                            enum: ['full_script', 'character_bible', 'production_guide', 'page_layouts', 'panel_breakdown', 'artist_notes']
                        },
                        include_production_notes: { type: 'boolean', description: 'Include production notes in export' },
                        specific_pages: { 
                            type: 'array', 
                            items: { type: 'number' }, 
                            description: 'Specific pages to export (optional)'
                        },
                        include_color_guides: { type: 'boolean', description: 'Include color guides and specifications' },
                        format_options: {
                            type: 'object',
                            description: 'Format-specific options',
                            properties: {
                                include_thumbnails: { type: 'boolean', description: 'Include panel thumbnails/sketches' },
                                detailed_descriptions: { type: 'boolean', description: 'Include detailed visual descriptions' },
                                reference_links: { type: 'boolean', description: 'Include reference image links' }
                            }
                        }
                    },
                    required: ['comic_id', 'export_format'],
                },
                handler: async (args: any) => {
                    const schema = z.object({
                        comic_id: z.string().min(1),
                        export_format: z.enum(['full_script', 'character_bible', 'production_guide', 'page_layouts', 'panel_breakdown', 'artist_notes']),
                        include_production_notes: z.boolean().optional(),
                        specific_pages: z.array(z.number().int().positive()).optional(),
                        include_color_guides: z.boolean().optional(),
                        format_options: z.object({
                            include_thumbnails: z.boolean().optional(),
                            detailed_descriptions: z.boolean().optional(),
                            reference_links: z.boolean().optional(),
                        }).optional(),
                    });

                    return ToolExecutor.run({
                        name: 'export_comic_script',
                        logger: this.logger,
                        schema,
                        args,
                        perform: (input) => this.exportComicScript(input),
                        format: (export_result) => {
                            return `📁 **Comic Export Complete!**\n\n**Export Details:**\n- **Format:** ${export_result.format}\n- **Pages Exported:** ${export_result.page_count}\n- **File Size:** ${export_result.file_size}\n- **Export Path:** ${export_result.file_path}\n\n✨ Comic script ready for production team!`;
                        },
                    });
                },
            }
        ];
    }

    private async createComicBook(input: any): Promise<any> {
        // Create a book using the BookService with appropriate comic settings
        const bookData: CreateBookRequest = {
            title: input.title,
            subtitle: input.description || undefined,
            theme: `Comic book - ${input.genre || 'General'}`,
            genre: input.genre || 'comic',
            targetAudience: input.target_audience || undefined,
            writingStyle: {
                tone: WritingTone.DRAMATIC,
                voice: WritingVoice.THIRD_PERSON,
                vocabulary: VocabularyLevel.INTERMEDIATE,
                sentenceStructure: SentenceStructure.VARIED,
                specialInstructions: `Comic book format: ${input.format}, Art style: ${input.art_style || 'Not specified'}, Color palette: ${input.color_palette || 'Not specified'}`
            },
            description: input.description,
            estimatedPages: input.estimated_pages,
            authorId: input.author || 'comic_creator'
        };

        const book = await this.bookService.createBook(bookData);
        
        // Store additional comic-specific metadata
        const comicMetadata = {
            format: input.format,
            art_style: input.art_style,
            color_palette: input.color_palette,
            page_layout: input.page_layout,
            production_notes: input.production_notes,
            target_audience: input.target_audience,
            artist: input.artist,
            characters: [],
            pages: [],
            production_notes_list: []
        };
        
        this.comicProjects.set(book._id, comicMetadata);
        this.logger.info(`Created comic book project: ${book.title}`, { comicId: book._id });
        
        return {
            id: book._id,
            title: book.title,
            author: input.author,
            artist: input.artist,
            genre: input.genre,
            format: input.format,
            target_audience: input.target_audience,
            estimated_pages: input.estimated_pages,
            art_style: input.art_style,
            createdAt: book.createdAt
        };
    }

    private async createComicCharacter(input: any): Promise<any> {
        const character = {
            id: `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...input,
            createdAt: new Date().toISOString()
        };

        const comic = this.comicProjects.get(input.comic_id);
        if (comic) {
            comic.characters.push(character);
            this.comicProjects.set(input.comic_id, comic);
        }

        this.logger.info(`Created comic character: ${character.name}`, { characterId: character.id });
        
        return character;
    }

    private async createComicPageScript(input: any): Promise<any> {
        const page = {
            id: `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...input,
            createdAt: new Date().toISOString()
        };

        const comic = this.comicProjects.get(input.comic_id);
        if (comic) {
            comic.pages.push(page);
            this.comicProjects.set(input.comic_id, comic);
        }

        this.logger.info(`Created comic page script: Page ${page.page_number}`, { pageId: page.id });
        
        return page;
    }

    private async addComicProductionNotes(input: any): Promise<any> {
        const note = {
            id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...input,
            createdAt: new Date().toISOString()
        };

        const comic = this.comicProjects.get(input.comic_id);
        if (comic) {
            comic.production_notes.push(note);
            this.comicProjects.set(input.comic_id, comic);
        }

        this.logger.info(`Added production note: ${note.title}`, { noteId: note.id });
        
        return note;
    }

    private async exportComicScript(input: any): Promise<any> {
        const comic = this.comicProjects.get(input.comic_id);
        if (!comic) {
            throw new Error(`Comic not found: ${input.comic_id}`);
        }

        const exportResult = {
            format: input.export_format,
            page_count: input.specific_pages ? input.specific_pages.length : comic.pages.length,
            file_size: '2.5 MB',
            file_path: `/exports/${comic.title.replace(/\s+/g, '_')}_${input.export_format}.pdf`,
            exported_at: new Date().toISOString()
        };

        this.logger.info(`Exported comic script: ${comic.title}`, { exportFormat: input.export_format });
        
        return exportResult;
    }
}
