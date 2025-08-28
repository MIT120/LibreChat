/**
 * Seed script for Image Style Configuration
 * This script initializes the database with default image style configurations
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { ImageStyleConfig } = require('../api/db/models');

const defaultImageStyleConfig = {
    configId: 'default_image_styles',
    name: 'Default Image Styles',
    description: 'Default image style configuration for book creation',
    isActive: true,
    isDefault: true,
    styles: new Map([
        ['children_book_illustration', {
            description: 'Bright, colorful illustrations perfect for children\'s books',
            dallePrompt: 'children\'s book illustration, bright colors, cartoon style, friendly characters, simple composition, kid-friendly',
            appropriateGenres: ['children', 'educational', 'fantasy', 'adventure'],
            appropriateAudiences: ['children', 'kids', 'young readers'],
            ageRating: 'all-ages',
            visualCharacteristics: ['bright colors', 'simple shapes', 'friendly characters']
        }],
        ['cartoon_colorful', {
            description: 'Vibrant cartoon-style illustrations',
            dallePrompt: 'cartoon illustration, vibrant colors, animated style, expressive characters, dynamic composition',
            appropriateGenres: ['comedy', 'adventure', 'children'],
            appropriateAudiences: ['children', 'family', 'young adult'],
            ageRating: 'all-ages',
            visualCharacteristics: ['bold colors', 'exaggerated features', 'dynamic poses']
        }],
        ['watercolor_soft', {
            description: 'Soft watercolor paintings with gentle aesthetics',
            dallePrompt: 'watercolor painting, soft colors, gentle brushstrokes, artistic illustration, dreamy atmosphere, pastel tones',
            appropriateGenres: ['romance', 'drama', 'poetry', 'literary fiction'],
            appropriateAudiences: ['adult', 'young adult', 'artistic readers'],
            ageRating: 'all-ages',
            visualCharacteristics: ['soft edges', 'flowing colors', 'artistic texture']
        }],
        ['realistic_artistic', {
            description: 'Realistic artistic illustrations for mature content',
            dallePrompt: 'realistic illustration, detailed artwork, professional quality, sophisticated composition, natural lighting',
            appropriateGenres: ['literary fiction', 'biography', 'historical', 'drama'],
            appropriateAudiences: ['adult', 'mature readers'],
            ageRating: 'adult',
            visualCharacteristics: ['realistic proportions', 'detailed textures', 'natural lighting']
        }],
        ['fantasy_illustration', {
            description: 'Epic fantasy artwork with magical elements',
            dallePrompt: 'fantasy illustration, magical elements, epic composition, detailed fantasy art, mythical creatures, enchanted atmosphere',
            appropriateGenres: ['fantasy', 'science fiction', 'adventure', 'mythology'],
            appropriateAudiences: ['young adult', 'adult', 'fantasy fans'],
            ageRating: 'teen',
            visualCharacteristics: ['magical effects', 'elaborate details', 'fantastical elements']
        }],
        ['noir_illustration', {
            description: 'Dark, moody illustrations for mystery and thriller',
            dallePrompt: 'noir illustration, dark atmosphere, dramatic shadows, black and white tones, mysterious mood, film noir style',
            appropriateGenres: ['mystery', 'thriller', 'crime', 'noir'],
            appropriateAudiences: ['adult', 'mature readers'],
            ageRating: 'adult',
            visualCharacteristics: ['high contrast', 'dramatic lighting', 'mysterious atmosphere']
        }],
        ['romantic_artistic', {
            description: 'Romantic and elegant artistic illustrations',
            dallePrompt: 'romantic illustration, elegant style, soft lighting, beautiful composition, artistic quality, warm tones',
            appropriateGenres: ['romance', 'drama', 'contemporary fiction'],
            appropriateAudiences: ['adult', 'young adult', 'romance readers'],
            ageRating: 'teen',
            visualCharacteristics: ['warm colors', 'soft lighting', 'elegant composition']
        }],
        ['digital_art', {
            description: 'Modern digital art style',
            dallePrompt: 'digital art, modern illustration, clean lines, contemporary style, polished finish, digital painting',
            appropriateGenres: ['science fiction', 'contemporary', 'young adult'],
            appropriateAudiences: ['young adult', 'adult', 'tech-savvy readers'],
            ageRating: 'teen',
            visualCharacteristics: ['clean lines', 'modern aesthetic', 'digital finish']
        }],
        ['anime_style', {
            description: 'Anime-inspired illustrations',
            dallePrompt: 'anime style illustration, manga-inspired art, detailed characters, dynamic poses, colorful anime aesthetic',
            appropriateGenres: ['young adult', 'adventure', 'fantasy', 'romance'],
            appropriateAudiences: ['young adult', 'teen', 'anime fans'],
            ageRating: 'teen',
            visualCharacteristics: ['anime character design', 'dynamic poses', 'detailed backgrounds']
        }],
        ['dark_artistic', {
            description: 'Dark and moody artistic style for mature themes',
            dallePrompt: 'dark artistic illustration, moody atmosphere, dramatic composition, mature themes, sophisticated art style',
            appropriateGenres: ['horror', 'thriller', 'dark fantasy', 'gothic'],
            appropriateAudiences: ['adult', 'mature readers'],
            ageRating: 'mature',
            visualCharacteristics: ['dark colors', 'dramatic mood', 'complex composition']
        }]
    ]),
    genreMapping: new Map([
        ['children', ['children_book_illustration', 'cartoon_colorful']],
        ['childrens', ['children_book_illustration', 'cartoon_colorful']],
        ['kids', ['children_book_illustration', 'cartoon_colorful']],
        ['young adult', ['digital_art', 'anime_style', 'fantasy_illustration']],
        ['romance', ['romantic_artistic', 'watercolor_soft']],
        ['fantasy', ['fantasy_illustration', 'digital_art']],
        ['science fiction', ['digital_art', 'fantasy_illustration']],
        ['mystery', ['noir_illustration', 'realistic_artistic']],
        ['thriller', ['noir_illustration', 'dark_artistic']],
        ['horror', ['dark_artistic', 'noir_illustration']],
        ['drama', ['realistic_artistic', 'watercolor_soft']],
        ['comedy', ['cartoon_colorful', 'children_book_illustration']],
        ['adventure', ['fantasy_illustration', 'digital_art', 'children_book_illustration']]
    ]),
    audienceMapping: new Map([
        ['children', ['children_book_illustration', 'cartoon_colorful']],
        ['kids', ['children_book_illustration', 'cartoon_colorful']],
        ['young readers', ['children_book_illustration', 'cartoon_colorful']],
        ['family', ['children_book_illustration', 'watercolor_soft']],
        ['young adult', ['digital_art', 'anime_style', 'fantasy_illustration']],
        ['teen', ['anime_style', 'digital_art', 'fantasy_illustration']],
        ['adult', ['realistic_artistic', 'watercolor_soft', 'romantic_artistic']],
        ['mature readers', ['realistic_artistic', 'noir_illustration', 'dark_artistic']]
    ]),
    toneMapping: new Map([
        ['humorous', ['cartoon_colorful', 'children_book_illustration']],
        ['serious', ['realistic_artistic', 'noir_illustration']],
        ['inspirational', ['watercolor_soft', 'fantasy_illustration']],
        ['conversational', ['digital_art', 'watercolor_soft']],
        ['formal', ['realistic_artistic', 'professional_illustration']],
        ['informal', ['cartoon_colorful', 'digital_art']],
        ['academic', ['realistic_artistic', 'professional_illustration']]
    ]),
    createdBy: 'system',
    version: 1
};

async function seedImageStyleConfig() {
    try {
        console.log('🌱 Starting Image Style Configuration seeding...');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/LibreChat');
        console.log('✅ Connected to MongoDB');

        // Check if configuration already exists
        const existingConfig = await ImageStyleConfig.findOne({ configId: 'default_image_styles' });

        if (existingConfig) {
            console.log('ℹ️  Default image style configuration already exists');
            console.log(`   Config ID: ${existingConfig.configId}`);
            console.log(`   Name: ${existingConfig.name}`);
            console.log(`   Version: ${existingConfig.version}`);
            console.log(`   Styles Count: ${existingConfig.styles.size}`);
            console.log('   Skipping seed operation');
            return;
        }

        // Create the default configuration
        const config = new ImageStyleConfig(defaultImageStyleConfig);
        await config.save();

        console.log('✅ Successfully seeded Image Style Configuration');
        console.log(`   Config ID: ${config.configId}`);
        console.log(`   Name: ${config.name}`);
        console.log(`   Version: ${config.version}`);
        console.log(`   Styles Count: ${config.styles.size}`);
        console.log(`   Genre Mappings: ${config.genreMapping.size}`);
        console.log(`   Audience Mappings: ${config.audienceMapping.size}`);
        console.log(`   Tone Mappings: ${config.toneMapping.size}`);
        console.log(`   Created At: ${config.createdAt}`);

    } catch (error) {
        console.error('❌ Error seeding Image Style Configuration:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

async function main() {
    try {
        await seedImageStyleConfig();
        console.log('🎉 Image Style Configuration seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('💥 Image Style Configuration seeding failed:', error);
        process.exit(1);
    }
}

// Run the seeder if this script is executed directly
if (require.main === module) {
    main();
}

module.exports = { seedImageStyleConfig, defaultImageStyleConfig };
