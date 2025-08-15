const express = require('express');
const fs = require('fs').promises;
const { requireJwtAuth } = require('~/server/middleware');
const { logger } = require('~/config');
// Function to dynamically import the ES module
async function getExportModel() {
  const module = await import('~/app/clients/mcp/book-creation-server/dist/models/Export.js');
  return module.default || module.Export;
}

const router = express.Router();

/**
 * Get exports for a specific conversation
 * GET /api/exports/conversation/:conversationId
 */
router.get('/conversation/:conversationId', requireJwtAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { format, status = 'completed', limit = 20, skip = 0 } = req.query;
    const userId = req.user.id;

    logger.info('Getting exports for conversation', {
      conversationId,
      userId,
      format,
      status,
      limit: parseInt(limit),
      skip: parseInt(skip),
    });

    // Build query to find exports for this conversation
    const query = {
      conversationId,
      authorId: userId,
      status,
    };

    // Add format filter if specified
    if (format) {
      query.format = format;
    }

    // Fetch exports from database
    const Export = await getExportModel();
    const exports = await Export.find(query)
      .sort({ createdAt: -1, version: -1 }) // Latest first, then by version
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .lean();

    // Transform exports to include proper URLs
    const transformedExports = exports.map((exportDoc) => ({
      _id: exportDoc._id,
      bookId: exportDoc.bookId,
      conversationId: exportDoc.conversationId,
      format: exportDoc.format,
      filename: exportDoc.filename,
      size: exportDoc.size,
      version: exportDoc.version,
      status: exportDoc.status,
      createdAt: exportDoc.createdAt,
      updatedAt: exportDoc.updatedAt,
      downloadCount: exportDoc.downloadCount || 0,
      lastDownloaded: exportDoc.lastDownloaded,
      url: `/api/exports/download/${exportDoc._id}`,
      metadata: exportDoc.metadata,
    }));

    logger.info('Found exports for conversation', {
      conversationId,
      count: transformedExports.length,
    });

    res.json({
      success: true,
      data: transformedExports,
      pagination: {
        limit: parseInt(limit),
        skip: parseInt(skip),
        total: transformedExports.length,
      },
    });
  } catch (error) {
    logger.error('Failed to get exports for conversation', {
      error: error.message,
      conversationId: req.params.conversationId,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch exports',
      message: error.message,
    });
  }
});

/**
 * Download export file
 * GET /api/exports/download/:exportId
 */
router.get('/download/:exportId', requireJwtAuth, async (req, res) => {
  try {
    const { exportId } = req.params;
    const userId = req.user.id;

    logger.info('Download export requested', { exportId, userId });

    // Find the export record
    const Export = await getExportModel();
    const exportRecord = await Export.findOne({
      _id: exportId,
      authorId: userId,
    });

    if (!exportRecord) {
      logger.warn('Export not found or access denied', { exportId, userId });
      return res.status(404).json({
        success: false,
        error: 'Export not found or access denied',
      });
    }

    if (exportRecord.status !== 'completed') {
      logger.warn('Export not completed', { exportId, status: exportRecord.status });
      return res.status(400).json({
        success: false,
        error: 'Export is not completed',
        status: exportRecord.status,
      });
    }

    // Check if file exists
    try {
      await fs.access(exportRecord.filepath);
    } catch {
      logger.error('Export file not found on disk', {
        exportId,
        filepath: exportRecord.filepath,
      });
      return res.status(404).json({
        success: false,
        error: 'Export file not found on disk',
      });
    }

    // Update download count and last downloaded timestamp
    try {
      const Export = await getExportModel();
      await Export.findByIdAndUpdate(exportId, {
        $inc: { downloadCount: 1 },
        lastDownloaded: new Date(),
      });
    } catch (updateError) {
      logger.warn('Failed to update download stats', {
        exportId,
        error: updateError.message,
      });
    }

    // Set appropriate headers based on format
    let contentType = 'application/octet-stream';
    let disposition = 'attachment';

    switch (exportRecord.format.toLowerCase()) {
      case 'html':
        contentType = 'text/html';
        disposition = 'inline'; // Show HTML in browser
        break;
      case 'pdf':
        contentType = 'application/pdf';
        disposition = 'inline';
        break;
      case 'txt':
        contentType = 'text/plain';
        disposition = 'inline';
        break;
      case 'epub':
        contentType = 'application/epub+zip';
        break;
      case 'docx':
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${exportRecord.filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    // Stream the file
    const fileStream = require('fs').createReadStream(exportRecord.filepath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      logger.error('File stream error', {
        exportId,
        filepath: exportRecord.filepath,
        error: error.message,
      });
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to stream file',
        });
      }
    });

    fileStream.on('end', () => {
      logger.info('Export download completed', { exportId, userId });
    });
  } catch (error) {
    logger.error('Error downloading export', {
      error: error.message,
      exportId: req.params.exportId,
      userId: req.user?.id,
    });

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to download export',
        message: error.message,
      });
    }
  }
});

/**
 * Get export statistics for a conversation
 * GET /api/exports/conversation/:conversationId/stats
 */
router.get('/conversation/:conversationId/stats', requireJwtAuth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const Export = await getExportModel();
    const stats = await Export.aggregate([
      {
        $match: {
          conversationId,
          authorId: userId,
        },
      },
      {
        $group: {
          _id: '$format',
          count: { $sum: 1 },
          totalSize: { $sum: '$size' },
          latestVersion: { $max: '$version' },
          lastCreated: { $max: '$createdAt' },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const totalStats = await Export.aggregate([
      {
        $match: {
          conversationId,
          authorId: userId,
        },
      },
      {
        $group: {
          _id: null,
          totalExports: { $sum: 1 },
          totalSize: { $sum: '$size' },
          totalDownloads: { $sum: '$downloadCount' },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        byFormat: stats,
        totals: totalStats[0] || {
          totalExports: 0,
          totalSize: 0,
          totalDownloads: 0,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get export statistics', {
      error: error.message,
      conversationId: req.params.conversationId,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch export statistics',
      message: error.message,
    });
  }
});

module.exports = router;
