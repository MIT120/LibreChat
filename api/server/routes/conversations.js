/**
 * Conversation routes - REST API for book conversations
 */

const express = require('express');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

// Get conversation summaries for UI
router.get('/summaries', requireJwtAuth, async (req, res) => {
    try {
        const {
            bookId,
            workspaceId,
            status,
            type,
            includeArchived = 'false',
            limit = '50',
            sortBy = 'updatedAt'
        } = req.query;

        const options = {
            userId: req.user.id,
            bookId,
            workspaceId,
            status,
            type,
            includeArchived: includeArchived === 'true',
            limit: parseInt(limit),
            sortBy
        };

        // Remove undefined values
        Object.keys(options).forEach((key) => {
            if (options[key] === undefined) {
                delete options[key];
            }
        });

        // TODO: Replace with actual MCP client call
        const result = {
            success: true,
            summaries: [],
            count: 0
        };

        res.json({
            success: true,
            summaries: result.summaries,
            count: result.count
        });
    } catch (error) {
        console.error('Error getting conversation summaries:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create book conversation
router.post('/', requireJwtAuth, async (req, res) => {
    try {
        const conversationData = {
            ...req.body,
            userId: req.user.id
        };

        // TODO: Replace with actual MCP client call
        const result = {
            success: true,
            conversationLinkId: 'temp-id',
            conversation: conversationData,
            message: 'Conversation created successfully'
        };

        res.status(201).json({
            success: true,
            conversationLinkId: result.conversationLinkId,
            conversation: result.conversation,
            message: result.message
        });
    } catch (error) {
        console.error('Error creating conversation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get conversation by ID
router.get('/:id', requireJwtAuth, async (req, res) => {
    try {
        // TODO: Replace with actual MCP client call
        const result = {
            success: true,
            conversation: { id: req.params.id }
        };

        res.json({
            success: true,
            conversation: result.conversation
        });
    } catch (error) {
        console.error('Error getting conversation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get conversation by conversation ID
router.get('/by-conversation/:conversationId', requireJwtAuth, async (req, res) => {
    try {
        // TODO: Replace with actual MCP client call
        const result = {
            success: true,
            found: true,
            conversation: { conversationId: req.params.conversationId }
        };

        if (!result.success || !result.found) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        res.json({
            success: true,
            conversation: result.conversation
        });
    } catch (error) {
        console.error('Error getting conversation by ID:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update conversation
router.put('/:id', requireJwtAuth, async (req, res) => {
    try {
        // TODO: Replace with actual MCP client call
        const result = {
            success: true,
            conversation: { id: req.params.id, ...req.body },
            message: 'Conversation updated successfully'
        };

        res.json({
            success: true,
            conversation: result.conversation,
            message: result.message
        });
    } catch (error) {
        console.error('Error updating conversation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Pin/unpin conversation
router.post('/:id/pin', requireJwtAuth, async (req, res) => {
    try {
        const { pinned = true } = req.body;

        // TODO: Replace with actual MCP client call
        const result = {
            success: true,
            conversation: { id: req.params.id, pinned },
            message: `Conversation ${pinned ? 'pinned' : 'unpinned'} successfully`
        };

        res.json({
            success: true,
            conversation: result.conversation,
            message: result.message
        });
    } catch (error) {
        console.error('Error pinning conversation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Archive conversation
router.post('/:id/archive', requireJwtAuth, async (req, res) => {
    try {
        const { reason } = req.body;

        // TODO: Replace with actual MCP client call
        const result = {
            success: true,
            conversation: { id: req.params.id, archived: true, reason },
            message: 'Conversation archived successfully'
        };

        res.json({
            success: true,
            conversation: result.conversation,
            message: result.message
        });
    } catch (error) {
        console.error('Error archiving conversation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;