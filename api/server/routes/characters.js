/**
 * Character routes - REST API for character management
 */

const express = require('express');
const { requireJwtAuth } = require('~/server/middleware');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Create character
router.post('/', requireJwtAuth, async (req, res) => {
    try {
        // TODO: Replace with actual MCP client call
        const mcpResponse = await global.mcpClient?.callTool('create_character', {
            ...req.body,
            generateAIProfile: req.body.generateAIProfile || false
        });

        res.status(201).json({
            success: true,
            character: mcpResponse,
            message: 'Character created successfully'
        });
    } catch (error) {
        console.error('Error creating character:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Get characters for a book
router.get('/book/:bookId', requireJwtAuth, async (req, res) => {
    try {
        const { role, tags } = req.query;

        // TODO: Replace with actual MCP client call
        const mcpResponse = await global.mcpClient?.callTool('get_characters', {
            bookId: req.params.bookId,
            role: role || undefined,
            tags: tags ? tags.split(',') : undefined
        });

        res.json({
            success: true,
            characters: mcpResponse || [],
            total: mcpResponse?.length || 0
        });
    } catch (error) {
        console.error('Error getting characters:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Get single character
router.get('/:characterId', requireJwtAuth, async (req, res) => {
    try {
        // TODO: Replace with actual MCP client call
        const mcpResponse = await global.mcpClient?.callTool('get_character', {
            characterId: req.params.characterId
        });

        if (!mcpResponse) {
            return res.status(404).json({
                error: 'Character not found'
            });
        }

        res.json({
            success: true,
            character: mcpResponse
        });
    } catch (error) {
        console.error('Error getting character:', error);
        if (error.message.includes('not found')) {
            res.status(404).json({
                error: 'Character not found',
                message: error.message
            });
        } else {
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }
});

// Update character
router.put('/:characterId', requireJwtAuth, async (req, res) => {
    try {
        // TODO: Replace with actual MCP client call
        const mcpResponse = await global.mcpClient?.callTool('update_character', {
            characterId: req.params.characterId,
            updates: req.body
        });

        res.json({
            success: true,
            character: mcpResponse,
            message: 'Character updated successfully'
        });
    } catch (error) {
        console.error('Error updating character:', error);
        if (error.message.includes('not found')) {
            res.status(404).json({
                error: 'Character not found',
                message: error.message
            });
        } else {
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }
});

// Delete character
router.delete('/:characterId', requireJwtAuth, async (req, res) => {
    try {
        // TODO: Replace with actual MCP client call
        const mcpResponse = await global.mcpClient?.callTool('delete_character', {
            characterId: req.params.characterId
        });

        res.json({
            success: true,
            message: 'Character deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting character:', error);
        if (error.message.includes('not found')) {
            res.status(404).json({
                error: 'Character not found',
                message: error.message
            });
        } else {
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }
});

// Upload character avatar
router.post('/:characterId/avatar', requireJwtAuth, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No avatar file provided'
            });
        }

        // Convert buffer to base64
        const base64Data = req.file.buffer.toString('base64');

        // TODO: Replace with actual MCP client call
        const mcpResponse = await global.mcpClient?.callTool('upload_character_avatar', {
            characterId: req.params.characterId,
            imageData: base64Data,
            filename: req.file.originalname,
            description: req.body.description || 'Character avatar'
        });

        res.json({
            success: true,
            avatar: mcpResponse.avatar,
            character: mcpResponse.character,
            message: 'Avatar uploaded successfully'
        });
    } catch (error) {
        console.error('Error uploading avatar:', error);
        if (error.message.includes('not found')) {
            res.status(404).json({
                error: 'Character not found',
                message: error.message
            });
        } else {
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }
});

// Upload character reference image
router.post('/:characterId/reference-images', requireJwtAuth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No image file provided'
            });
        }

        const { type, description } = req.body;
        if (!type) {
            return res.status(400).json({
                error: 'Image type is required'
            });
        }

        // Convert buffer to base64
        const base64Data = req.file.buffer.toString('base64');

        // TODO: Replace with actual MCP client call
        const mcpResponse = await global.mcpClient?.callTool('upload_character_reference_image', {
            characterId: req.params.characterId,
            imageData: base64Data,
            filename: req.file.originalname,
            description: description || '',
            type: type
        });

        res.json({
            success: true,
            referenceImage: mcpResponse.referenceImage,
            character: mcpResponse.character,
            message: 'Reference image uploaded successfully'
        });
    } catch (error) {
        console.error('Error uploading reference image:', error);
        if (error.message.includes('not found')) {
            res.status(404).json({
                error: 'Character not found',
                message: error.message
            });
        } else {
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }
});

// Generate character with AI
router.post('/generate-ai', requireJwtAuth, async (req, res) => {
    try {
        const { bookId, name, role, genre, existingTraits, storyContext } = req.body;

        if (!bookId || !name || !role || !genre) {
            return res.status(400).json({
                error: 'bookId, name, role, and genre are required'
            });
        }

        // TODO: Replace with actual MCP client call
        const mcpResponse = await global.mcpClient?.callTool('generate_character_with_ai', {
            bookId,
            name,
            role,
            genre,
            existingTraits: existingTraits || [],
            storyContext: storyContext || ''
        });

        res.status(201).json({
            success: true,
            character: mcpResponse,
            message: 'Character generated with AI successfully'
        });
    } catch (error) {
        console.error('Error generating character with AI:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Generate character image
router.post('/:characterId/generate-image', requireJwtAuth, async (req, res) => {
    try {
        const { prompt, type = 'portrait', style, useReferenceImages = true } = req.body;

        // TODO: Replace with actual MCP client call
        const mcpResponse = await global.mcpClient?.callTool('generate_character_image', {
            characterId: req.params.characterId,
            prompt,
            type,
            style,
            useReferenceImages
        });

        res.json({
            success: true,
            image: mcpResponse,
            message: 'Character image generated successfully'
        });
    } catch (error) {
        console.error('Error generating character image:', error);
        if (error.message.includes('not found')) {
            res.status(404).json({
                error: 'Character not found',
                message: error.message
            });
        } else {
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }
});

// Get character relationships
router.get('/:characterId/relationships', requireJwtAuth, async (req, res) => {
    try {
        const { targetCharacterId } = req.query;

        // TODO: Replace with actual MCP client call
        const mcpResponse = await global.mcpClient?.callTool('get_character_relationships', {
            characterId: req.params.characterId,
            targetCharacterId: targetCharacterId || undefined
        });

        res.json({
            success: true,
            relationships: mcpResponse || []
        });
    } catch (error) {
        console.error('Error getting character relationships:', error);
        if (error.message.includes('not found')) {
            res.status(404).json({
                error: 'Character not found',
                message: error.message
            });
        } else {
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }
});

// Create character relationship
router.post('/:characterId/relationships', requireJwtAuth, async (req, res) => {
    try {
        const { targetCharacterId, relationship, description, dynamic } = req.body;

        if (!targetCharacterId || !relationship || !dynamic) {
            return res.status(400).json({
                error: 'targetCharacterId, relationship, and dynamic are required'
            });
        }

        // TODO: Replace with actual MCP client call
        const mcpResponse = await global.mcpClient?.callTool('create_character_relationship', {
            characterId: req.params.characterId,
            targetCharacterId,
            relationship,
            description: description || '',
            dynamic
        });

        res.status(201).json({
            success: true,
            relationship: mcpResponse,
            message: 'Character relationship created successfully'
        });
    } catch (error) {
        console.error('Error creating character relationship:', error);
        if (error.message.includes('not found')) {
            res.status(404).json({
                error: 'Character not found',
                message: error.message
            });
        } else {
            res.status(500).json({
                error: 'Internal server error',
                message: error.message
            });
        }
    }
});

// Export characters
router.get('/export/:bookId', requireJwtAuth, async (req, res) => {
    try {
        const { format = 'json', includeImages = false } = req.query;

        if (!['json', 'csv', 'yaml'].includes(format)) {
            return res.status(400).json({
                error: 'Invalid export format. Must be json, csv, or yaml'
            });
        }

        // Get all characters for the book
        const characters = await global.mcpClient?.callTool('get_characters', {
            bookId: req.params.bookId
        });

        if (!characters || characters.length === 0) {
            return res.status(404).json({
                error: 'No characters found for this book'
            });
        }

        // Process characters for export
        const exportData = characters.map(char => {
            const exportChar = {
                name: char.name,
                role: char.role,
                age: char.age,
                gender: char.gender,
                occupation: char.occupation,
                physicalDescription: char.physicalDescription,
                personality: char.personality,
                background: char.background,
                goals: char.goals,
                arc: char.arc,
                tags: char.tags,
                notes: char.notes
            };

            if (includeImages === 'true') {
                exportChar.avatar = char.avatar;
                exportChar.referenceImages = char.referenceImages;
            }

            return exportChar;
        });

        // Set appropriate headers
        const filename = `characters-${req.params.bookId}.${format}`;
        let contentType = 'application/json';
        let data = JSON.stringify(exportData, null, 2);

        if (format === 'csv') {
            contentType = 'text/csv';
            // Convert to CSV (simplified)
            const headers = ['name', 'role', 'age', 'gender', 'occupation'];
            const csvData = [
                headers.join(','),
                ...exportData.map(char =>
                    headers.map(header => `"${char[header] || ''}"`).join(',')
                )
            ].join('\n');
            data = csvData;
        } else if (format === 'yaml') {
            contentType = 'text/yaml';
            // Basic YAML conversion (you might want to use a proper YAML library)
            data = exportData.map(char =>
                Object.entries(char).map(([key, value]) =>
                    `${key}: ${typeof value === 'string' ? `"${value}"` : JSON.stringify(value)}`
                ).join('\n')
            ).join('\n---\n');
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(data);

    } catch (error) {
        console.error('Error exporting characters:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Import characters
router.post('/import/:bookId', requireJwtAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No import file provided'
            });
        }

        const fileContent = req.file.buffer.toString('utf8');
        let characters;

        try {
            characters = JSON.parse(fileContent);
        } catch (parseError) {
            return res.status(400).json({
                error: 'Invalid JSON format in import file'
            });
        }

        if (!Array.isArray(characters)) {
            return res.status(400).json({
                error: 'Import file must contain an array of characters'
            });
        }

        const importResults = {
            imported: [],
            failed: [],
            total: characters.length
        };

        // Import each character
        for (const charData of characters) {
            try {
                const mcpResponse = await global.mcpClient?.callTool('create_character', {
                    bookId: req.params.bookId,
                    ...charData,
                    generateAIProfile: false // Don't auto-generate for imports
                });

                importResults.imported.push({
                    name: charData.name,
                    characterId: mcpResponse._id
                });
            } catch (error) {
                importResults.failed.push({
                    name: charData.name || 'Unknown',
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            results: importResults,
            message: `Import completed: ${importResults.imported.length} successful, ${importResults.failed.length} failed`
        });

    } catch (error) {
        console.error('Error importing characters:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Get character voice profile
router.get('/:characterId/voice-profile', requireJwtAuth, async (req, res) => {
    try {
        // TODO: Implement character voice profile retrieval
        const voiceProfile = {
            characterId: req.params.characterId,
            voiceCharacteristics: {
                tone: 'neutral',
                speechPatterns: [],
                vocabulary: 'standard',
                dialectFeatures: [],
                emotionalRange: 'moderate'
            },
            dialogueExamples: [],
            consistencyScore: 0.85,
            lastUpdated: new Date().toISOString()
        };

        res.json({
            success: true,
            voiceProfile: voiceProfile
        });
    } catch (error) {
        console.error('Error getting character voice profile:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Generate character dialogue
router.post('/:characterId/generate-dialogue', requireJwtAuth, async (req, res) => {
    try {
        const { situation, emotion, targetCharacter, context } = req.body;

        if (!situation) {
            return res.status(400).json({
                error: 'Situation is required for dialogue generation'
            });
        }

        // TODO: Replace with actual MCP client call for character dialogue generation
        const dialogue = {
            characterId: req.params.characterId,
            situation,
            emotion: emotion || 'neutral',
            generatedDialogue: `"This is a sample dialogue line for the situation: ${situation}"`,
            voiceConsistency: 0.9,
            alternativeOptions: [
                `"Alternative dialogue option 1 for: ${situation}"`,
                `"Alternative dialogue option 2 for: ${situation}"`
            ],
            generatedAt: new Date().toISOString()
        };

        res.json({
            success: true,
            dialogue: dialogue,
            message: 'Character dialogue generated successfully'
        });
    } catch (error) {
        console.error('Error generating character dialogue:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

module.exports = router;
