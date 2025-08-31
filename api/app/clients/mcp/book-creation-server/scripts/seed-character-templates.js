/**
 * Seed Character Templates - Populate database with initial character templates
 */

const { Character, CharacterTemplate } = require('../models/index.js');
const { v4: uuidv4 } = require('uuid');

const characterTemplates = [
    {
        _id: `template_${uuidv4()}`,
        name: 'Classic Hero',
        description: 'A traditional heroic protagonist with noble qualities and a strong moral compass',
        category: 'archetype',
        origin: 'system',
        role: 'protagonist',
        traits: ['brave', 'determined', 'loyal', 'compassionate', 'selfless'],
        motivations: ['save the world', 'protect loved ones', 'uphold justice', 'prove worthiness'],
        fears: ['failure', 'losing loved ones', 'corruption', 'inadequacy'],
        strengths: ['courage', 'leadership', 'moral clarity', 'resilience'],
        weaknesses: ['self-doubt', 'over-responsibility', 'naivety', 'stubbornness'],
        physicalSuggestions: {
            build: ['athletic', 'strong', 'tall', 'well-built'],
            hairColors: ['brown', 'blonde', 'black', 'auburn'],
            eyeColors: ['blue', 'green', 'brown', 'hazel'],
            distinctiveFeatures: ['strong jawline', 'piercing eyes', 'confident posture', 'warm smile'],
            clothingStyles: ['practical', 'clean', 'modest', 'functional']
        },
        backgroundSuggestions: {
            origins: ['small town', 'humble beginnings', 'noble family', 'tragedy survivor'],
            occupations: ['knight', 'farmer', 'student', 'soldier', 'craftsperson'],
            skills: ['swordsmanship', 'leadership', 'healing', 'diplomacy', 'survival'],
            pastEventTypes: ['family tragedy', 'mentor death', 'great loss', 'awakening moment']
        },
        commonGoalTypes: ['defeat evil', 'save kingdom', 'rescue loved one', 'fulfill destiny'],
        arcSuggestions: {
            startingPoints: ['reluctant call', 'ordinary life', 'tragedy strikes', 'discovers power'],
            transformationTypes: ['learns humility', 'gains confidence', 'accepts responsibility', 'finds inner strength'],
            endingTypes: ['triumphant victory', 'noble sacrifice', 'peaceful resolution', 'new beginning']
        },
        genre: ['fantasy', 'adventure', 'epic', 'young adult'],
        tags: ['hero', 'protagonist', 'noble', 'traditional'],
        difficulty: 'beginner',
        aiPromptHints: 'Focus on moral clarity, noble motivations, and a journey of growth and self-discovery'
    },
    {
        _id: `template_${uuidv4()}`,
        name: 'Cunning Villain',
        description: 'A sophisticated antagonist who uses intellect and manipulation to achieve their goals',
        category: 'archetype',
        origin: 'system',
        role: 'antagonist',
        traits: ['cunning', 'ruthless', 'charismatic', 'intelligent', 'ambitious'],
        motivations: ['power', 'revenge', 'control', 'validation', 'legacy'],
        fears: ['defeat', 'irrelevance', 'vulnerability', 'exposure'],
        strengths: ['strategic thinking', 'manipulation', 'charisma', 'resources'],
        weaknesses: ['arrogance', 'paranoia', 'obsession', 'isolation'],
        physicalSuggestions: {
            build: ['elegant', 'imposing', 'lean', 'graceful'],
            hairColors: ['black', 'silver', 'dark brown', 'platinum'],
            eyeColors: ['dark', 'piercing', 'cold', 'calculating'],
            distinctiveFeatures: ['sharp features', 'commanding presence', 'subtle scars', 'elegant hands'],
            clothingStyles: ['elegant', 'dark', 'expensive', 'refined']
        },
        backgroundSuggestions: {
            origins: ['fallen nobility', 'betrayed ally', 'ambitious scholar', 'corrupted hero'],
            occupations: ['noble', 'scholar', 'merchant', 'military leader', 'advisor'],
            skills: ['manipulation', 'strategy', 'magic', 'politics', 'deception'],
            pastEventTypes: ['great betrayal', 'lost love', 'fall from grace', 'corruption event']
        },
        commonGoalTypes: ['seize throne', 'destroy enemy', 'gain ultimate power', 'reshape world'],
        arcSuggestions: {
            startingPoints: ['already powerful', 'rising threat', 'hidden enemy', 'corrupted ally'],
            transformationTypes: ['grows more ruthless', 'reveals true nature', 'becomes desperate', 'loses humanity'],
            endingTypes: ['ultimate defeat', 'pyrrhic victory', 'redemption', 'eternal punishment']
        },
        genre: ['fantasy', 'thriller', 'drama', 'epic'],
        tags: ['villain', 'antagonist', 'cunning', 'sophisticated'],
        difficulty: 'intermediate',
        aiPromptHints: 'Emphasize intelligence and manipulation over brute force, with complex motivations'
    },
    {
        _id: `template_${uuidv4()}`,
        name: 'Wise Mentor',
        description: 'An experienced guide who helps the protagonist on their journey with wisdom and knowledge',
        category: 'archetype',
        origin: 'system',
        role: 'mentor',
        traits: ['wise', 'patient', 'experienced', 'mysterious', 'caring'],
        motivations: ['guide the hero', 'pass on knowledge', 'atone for past', 'prevent disaster'],
        fears: ['student failure', 'past mistakes', 'running out of time', 'being forgotten'],
        strengths: ['vast knowledge', 'life experience', 'magical abilities', 'connections'],
        weaknesses: ['age', 'past regrets', 'secrecy', 'physical limitations'],
        physicalSuggestions: {
            build: ['aged', 'frail but strong', 'weathered', 'dignified'],
            hairColors: ['gray', 'white', 'silver', 'long beard'],
            eyeColors: ['wise', 'twinkling', 'deep', 'knowing'],
            distinctiveFeatures: ['weathered face', 'kind eyes', 'walking stick', 'robes'],
            clothingStyles: ['robes', 'simple', 'worn', 'mystical']
        },
        backgroundSuggestions: {
            origins: ['former hero', 'ancient being', 'retired warrior', 'scholar'],
            occupations: ['wizard', 'teacher', 'hermit', 'priest', 'advisor'],
            skills: ['magic', 'lore', 'fighting', 'healing', 'prophecy'],
            pastEventTypes: ['great victory', 'terrible failure', 'lost love', 'cursed fate']
        },
        commonGoalTypes: ['train hero', 'prevent catastrophe', 'pass on legacy', 'find redemption'],
        arcSuggestions: {
            startingPoints: ['living in exile', 'sought out', 'reluctant teacher', 'mysterious arrival'],
            transformationTypes: ['grows attached', 'faces past', 'prepares for sacrifice', 'finds peace'],
            endingTypes: ['heroic sacrifice', 'peaceful death', 'mysterious disappearance', 'transcendence']
        },
        genre: ['fantasy', 'adventure', 'epic', 'coming of age'],
        tags: ['mentor', 'wise', 'guide', 'teacher'],
        difficulty: 'beginner',
        aiPromptHints: 'Balance wisdom with mystery, and consider the mentor\'s own journey and sacrifices'
    },
    {
        _id: `template_${uuidv4()}`,
        name: 'Loyal Sidekick',
        description: 'A faithful companion who supports the protagonist with unwavering loyalty and complementary skills',
        category: 'role',
        origin: 'system',
        role: 'supporting',
        traits: ['loyal', 'brave', 'optimistic', 'resourceful', 'humble'],
        motivations: ['help friend', 'prove worth', 'adventure', 'belonging'],
        fears: ['abandonment', 'inadequacy', 'losing friends', 'being burden'],
        strengths: ['loyalty', 'specialized skills', 'moral support', 'different perspective'],
        weaknesses: ['self-doubt', 'over-dependence', 'recklessness', 'naivety'],
        physicalSuggestions: {
            build: ['smaller', 'agile', 'wiry', 'energetic'],
            hairColors: ['red', 'brown', 'sandy', 'curly'],
            eyeColors: ['bright', 'expressive', 'warm', 'lively'],
            distinctiveFeatures: ['freckles', 'gap-toothed smile', 'animated expressions', 'quick movements'],
            clothingStyles: ['practical', 'mismatched', 'travel-worn', 'colorful']
        },
        backgroundSuggestions: {
            origins: ['street orphan', 'village outcast', 'apprentice', 'refugee'],
            occupations: ['thief', 'scout', 'healer', 'bard', 'inventor'],
            skills: ['stealth', 'climbing', 'music', 'cooking', 'repair'],
            pastEventTypes: ['saved by hero', 'lost family', 'failed test', 'seeking purpose']
        },
        commonGoalTypes: ['support hero', 'find belonging', 'prove courage', 'master skill'],
        arcSuggestions: {
            startingPoints: ['meets hero', 'joins quest', 'reluctant companion', 'eager volunteer'],
            transformationTypes: ['gains confidence', 'proves loyalty', 'finds courage', 'discovers talent'],
            endingTypes: ['recognized hero', 'finds home', 'continues journey', 'new adventure']
        },
        genre: ['fantasy', 'adventure', 'comedy', 'young adult'],
        tags: ['sidekick', 'loyal', 'supporting', 'companion'],
        difficulty: 'beginner',
        aiPromptHints: 'Focus on the unique skills and perspective they bring, and their growth alongside the hero'
    },
    {
        _id: `template_${uuidv4()}`,
        name: 'Mysterious Love Interest',
        description: 'An enigmatic romantic partner with hidden depths and secrets that complicate the relationship',
        category: 'role',
        origin: 'system',
        role: 'love_interest',
        traits: ['mysterious', 'alluring', 'independent', 'complex', 'passionate'],
        motivations: ['protect secret', 'find love', 'complete mission', 'seek freedom'],
        fears: ['discovery', 'vulnerability', 'betrayal', 'loss of control'],
        strengths: ['allure', 'hidden knowledge', 'unique skills', 'determination'],
        weaknesses: ['secrecy', 'trust issues', 'conflicted loyalty', 'dangerous past'],
        physicalSuggestions: {
            build: ['graceful', 'elegant', 'striking', 'memorable'],
            hairColors: ['unusual', 'striking', 'dark', 'flowing'],
            eyeColors: ['captivating', 'mysterious', 'changing', 'intense'],
            distinctiveFeatures: ['enigmatic smile', 'graceful movement', 'hidden tattoo', 'unique jewelry'],
            clothingStyles: ['elegant', 'unusual', 'practical yet beautiful', 'concealing']
        },
        backgroundSuggestions: {
            origins: ['foreign land', 'hidden society', 'enemy faction', 'magical realm'],
            occupations: ['spy', 'noble', 'assassin', 'scholar', 'performer'],
            skills: ['seduction', 'combat', 'magic', 'languages', 'diplomacy'],
            pastEventTypes: ['secret mission', 'forbidden love', 'exile', 'magical curse']
        },
        commonGoalTypes: ['complete mission', 'find true love', 'break curse', 'gain freedom'],
        arcSuggestions: {
            startingPoints: ['chance encounter', 'arranged meeting', 'rescue situation', 'opposing sides'],
            transformationTypes: ['reveals truth', 'chooses love', 'faces past', 'finds balance'],
            endingTypes: ['love conquers all', 'bittersweet parting', 'new beginning', 'sacrifice for love']
        },
        genre: ['romance', 'fantasy', 'thriller', 'adventure'],
        tags: ['love interest', 'mysterious', 'complex', 'romantic'],
        difficulty: 'intermediate',
        aiPromptHints: 'Balance mystery with emotional depth, and consider how their secrets affect the relationship'
    },
    {
        _id: `template_${uuidv4()}`,
        name: 'Comic Relief',
        description: 'A humorous character who provides levity and entertainment while often having hidden depths',
        category: 'role',
        origin: 'system',
        role: 'comic_relief',
        traits: ['humorous', 'optimistic', 'eccentric', 'loyal', 'unpredictable'],
        motivations: ['make others happy', 'avoid conflict', 'find acceptance', 'have fun'],
        fears: ['being ignored', 'serious situations', 'letting others down', 'being alone'],
        strengths: ['humor', 'morale boost', 'unexpected wisdom', 'lightening mood'],
        weaknesses: ['inappropriate timing', 'avoiding seriousness', 'self-deprecation', 'attention-seeking'],
        physicalSuggestions: {
            build: ['distinctive', 'expressive', 'animated', 'memorable'],
            hairColors: ['wild', 'colorful', 'unkempt', 'unusual style'],
            eyeColors: ['twinkling', 'mischievous', 'expressive', 'bright'],
            distinctiveFeatures: ['expressive face', 'animated gestures', 'unique clothing', 'quirky accessories'],
            clothingStyles: ['colorful', 'mismatched', 'flamboyant', 'practical but quirky']
        },
        backgroundSuggestions: {
            origins: ['entertainer family', 'court jester', 'street performer', 'failed other profession'],
            occupations: ['bard', 'jester', 'merchant', 'servant', 'wanderer'],
            skills: ['comedy', 'music', 'storytelling', 'juggling', 'impersonation'],
            pastEventTypes: ['embarrassing failure', 'unexpected success', 'tragic loss masked by humor', 'discovery of talent']
        },
        commonGoalTypes: ['entertain others', 'find purpose', 'prove worth', 'overcome tragedy'],
        arcSuggestions: {
            startingPoints: ['joins for laughs', 'reluctant participant', 'hired entertainer', 'accidental hero'],
            transformationTypes: ['shows hidden depth', 'serious moment', 'proves courage', 'finds confidence'],
            endingTypes: ['beloved friend', 'unexpected hero', 'finds true calling', 'brings joy to world']
        },
        genre: ['comedy', 'adventure', 'fantasy', 'family'],
        tags: ['comic relief', 'funny', 'entertaining', 'loyal'],
        difficulty: 'beginner',
        aiPromptHints: 'Balance humor with genuine character development and occasional moments of depth'
    }
];

async function seedCharacterTemplates() {
    try {
        console.log('Starting character template seed...');

        // Check if templates already exist
        const existingCount = await CharacterTemplate.countDocuments();
        if (existingCount > 0) {
            console.log(`Found ${existingCount} existing templates. Skipping seed.`);
            return;
        }

        // Insert templates
        const inserted = await CharacterTemplate.insertMany(characterTemplates);
        console.log(`Successfully seeded ${inserted.length} character templates`);

        // Log template names
        inserted.forEach(template => {
            console.log(`- ${template.name} (${template.role})`);
        });

    } catch (error) {
        console.error('Error seeding character templates:', error);
        throw error;
    }
}

// Export for use in other scripts
module.exports = { seedCharacterTemplates, characterTemplates };

// Run if called directly
if (require.main === module) {
    const mongoose = require('mongoose');
    
    async function run() {
        try {
            // Connect to MongoDB
            const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/librechat';
            await mongoose.connect(mongoUri);
            console.log('Connected to MongoDB');

            await seedCharacterTemplates();
            
            await mongoose.disconnect();
            console.log('Disconnected from MongoDB');
            console.log('Seeding completed successfully!');
        } catch (error) {
            console.error('Seed failed:', error);
            process.exit(1);
        }
    }

    run();
}
