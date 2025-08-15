/**
 * Book Updates Routes - SSE endpoint for real-time book updates
 */

const express = require('express');
const { requireJwtAuth } = require('~/server/middleware');
const { logger } = require('~/config');
const bookUpdateService = require('~/server/services/BookUpdateService');
const jwt = require('jsonwebtoken');

const router = express.Router();

/**
 * Custom authentication middleware for SSE (supports query params and cookies)
 */
const sseAuth = (req, res, next) => {
  try {
    let token = null;

    // Try to get token from query parameter first (for EventSource)
    if (req.query.token) {
      token = req.query.token;
    }
    // Try to get from Authorization header
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }
    // Try to get from cookies
    else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      logger.warn('SSE Auth: No token provided');
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('SSE Auth: Token verification failed', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * SSE endpoint for book updates by bookId
 * GET /api/book-updates/stream/:bookId?token=<jwt_token>
 */
router.get('/stream/:bookId', sseAuth, (req, res) => {
  const { bookId } = req.params;
  const userId = req.user?.id || req.user?._id;

  if (!bookId) {
    return res.status(400).json({ error: 'bookId is required' });
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Send initial connection event
  res.write(
    `event: connected\ndata: ${JSON.stringify({
      bookId,
      timestamp: new Date().toISOString(),
    })}\n\n`,
  );

  // Subscribe to book updates for this specific book
  bookUpdateService.subscribeToBook(bookId, res);

  logger.info('Book-specific SSE connection established', {
    bookId,
    userId,
  });

  // Handle client disconnect
  req.on('close', () => {
    bookUpdateService.unsubscribeFromBook(bookId, res);
    logger.info('Book-specific SSE connection closed', {
      bookId,
      userId,
    });
  });

  req.on('aborted', () => {
    bookUpdateService.unsubscribeFromBook(bookId, res);
    logger.info('Book-specific SSE connection aborted', {
      bookId,
      userId,
    });
  });
});

/**
 * SSE endpoint for book updates by conversation
 * GET /api/book-updates/:conversationId?token=<jwt_token>
 */
router.get('/:conversationId', sseAuth, (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user?.id || req.user?._id;

  if (!conversationId) {
    return res.status(400).json({ error: 'conversationId is required' });
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Send initial connection event
  res.write(
    `event: connected\ndata: ${JSON.stringify({
      conversationId,
      timestamp: new Date().toISOString(),
    })}\n\n`,
  );

  // Subscribe to book updates for this conversation
  bookUpdateService.subscribe(conversationId, res);

  logger.info('Book updates SSE connection established', {
    conversationId,
    userId,
  });

  // Handle client disconnect
  req.on('close', () => {
    bookUpdateService.unsubscribe(conversationId, res);
    logger.info('Book updates SSE connection closed', {
      conversationId,
      userId,
    });
  });

  req.on('aborted', () => {
    bookUpdateService.unsubscribe(conversationId, res);
    logger.info('Book updates SSE connection aborted', {
      conversationId,
      userId,
    });
  });
});

/**
 * Associate a book with a conversation
 * POST /api/book-updates/:conversationId/book
 */
router.post('/:conversationId/book', requireJwtAuth, (req, res) => {
  const { conversationId } = req.params;
  const { bookId } = req.body;

  if (!conversationId || !bookId) {
    return res.status(400).json({
      error: 'conversationId and bookId are required',
    });
  }

  bookUpdateService.setBookForConversation(conversationId, bookId);

  res.json({
    success: true,
    conversationId,
    bookId,
    message: 'Book associated with conversation successfully',
  });
});

/**
 * Trigger book export
 * POST /api/book-updates/:conversationId/export
 */
router.post('/:conversationId/export', requireJwtAuth, async (req, res) => {
  const { conversationId } = req.params;
  const { bookId, format = 'html', ...exportOptions } = req.body;

  if (!conversationId) {
    return res.status(400).json({
      error: 'conversationId is required',
    });
  }

  let actualBookId = bookId;
  if (!actualBookId) {
    actualBookId = bookUpdateService.getBookForConversation(conversationId);
  }

  if (!actualBookId) {
    return res.status(400).json({
      error: 'No book associated with this conversation',
    });
  }

  try {
    // Trigger export asynchronously
    bookUpdateService.triggerExportWithNotification(actualBookId, conversationId, {
      format,
      ...exportOptions,
    });

    res.json({
      success: true,
      message: 'Export triggered, you will be notified when ready',
      bookId: actualBookId,
      conversationId,
    });
  } catch (error) {
    logger.error('Failed to trigger book export', {
      error: error.message,
      conversationId,
      bookId: actualBookId,
    });

    res.status(500).json({
      error: 'Failed to trigger export',
      message: error.message,
    });
  }
});

/**
 * Receive update notifications from MCP tools
 * POST /api/book-updates/notify
 */
router.post('/notify', (req, res) => {
  const { bookId, updateType, toolName, metadata } = req.body;

  if (!bookId || !updateType) {
    return res.status(400).json({
      error: 'bookId and updateType are required',
    });
  }

  // Notify all subscribers for this book
  bookUpdateService.notifyBookUpdate(bookId, updateType, {
    toolName,
    metadata,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    message: 'Notification sent to subscribers',
    bookId,
    updateType,
  });
});

/**
 * Get service statistics (for debugging)
 * GET /api/book-updates/stats
 */
router.get('/stats', requireJwtAuth, (req, res) => {
  const stats = bookUpdateService.getStats();
  res.json(stats);
});

/**
 * Health check endpoint
 * GET /api/book-updates/health
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'book-updates',
    timestamp: new Date().toISOString(),
    routes: {
      sse: '/api/book-updates/:conversationId',
      stats: '/api/book-updates/stats',
      test: '/api/book-updates/test',
    },
  });
});

/**
 * Test book update notification (for debugging)
 * POST /api/book-updates/test
 */
router.post('/test', requireJwtAuth, (req, res) => {
  const { bookId, conversationId, updateType = 'book_updated' } = req.body;

  if (!bookId) {
    return res.status(400).json({ error: 'bookId is required' });
  }

  // Associate book with conversation if provided
  if (conversationId) {
    bookUpdateService.setBookForConversation(conversationId, bookId);
  }

  // Trigger test notification
  bookUpdateService.notifyBookUpdate(bookId, updateType, {
    toolName: 'test_tool',
    userId: req.user?.id || req.user?._id,
    action: 'test_update',
    source: 'manual_test',
  });

  res.json({
    success: true,
    message: 'Test notification sent',
    bookId,
    conversationId,
    updateType,
  });
});

module.exports = router;
