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
 * List static export files with comprehensive metadata
 * GET /api/exports/static/list
 */
router.get('/static/list', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');

    // Get the exports directory path
    const exportsDir = path.join(process.cwd(), 'exports');

    try {
      const files = await fs.readdir(exportsDir);
      const htmlFiles = files.filter((file) => file.endsWith('.html'));

      // Get detailed information for each file
      const fileDetails = await Promise.all(
        htmlFiles.map(async (filename) => {
          try {
            const filePath = path.join(exportsDir, filename);
            const stats = await fs.stat(filePath);

            return {
              filename,
              size: stats.size,
              created: stats.birthtime,
              modified: stats.mtime,
              url: `/c/exports/${filename}`,
              downloadUrl: `/api/exports/static/download/${filename}`,
              directUrl: `http://localhost:3080/c/exports/${filename}`,
              accessible: true,
            };
          } catch (error) {
            logger.warn('Error getting file stats', { filename, error: error.message });
            return {
              filename,
              size: 0,
              created: null,
              modified: null,
              url: `/c/exports/${filename}`,
              downloadUrl: `/api/exports/static/download/${filename}`,
              directUrl: `http://localhost:3080/c/exports/${filename}`,
              accessible: false,
              error: error.message,
            };
          }
        }),
      );

      // Sort by modification date (newest first)
      fileDetails.sort((a, b) => new Date(b.modified) - new Date(a.modified));

      res.json({
        success: true,
        files: fileDetails,
        count: fileDetails.length,
        exportsDir,
        baseUrl: '/c/exports',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.warn('Exports directory not found or not accessible', {
        exportsDir,
        error: error.message,
      });

      res.json({
        success: true,
        files: [],
        count: 0,
        exportsDir,
        baseUrl: '/c/exports',
        error: 'Exports directory not accessible',
      });
    }
  } catch (error) {
    logger.error('Error listing static export files', {
      error: error.message,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to list static export files',
      message: error.message,
    });
  }
});

/**
 * Download static export file directly
 * GET /api/exports/static/download/:filename
 */
router.get('/static/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const path = require('path');

    // Validate filename (basic security check)
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename',
      });
    }

    // Get the exports directory path
    const exportsDir = path.join(process.cwd(), 'exports');
    const filePath = path.join(exportsDir, filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      logger.warn('Static export file not found', { filename, filePath });
      return res.status(404).json({
        success: false,
        error: 'Export file not found',
      });
    }

    // Set appropriate headers
    let contentType = 'application/octet-stream';
    const extension = path.extname(filename).toLowerCase();

    switch (extension) {
      case '.html':
        contentType = 'text/html; charset=utf-8';
        break;
      case '.pdf':
        contentType = 'application/pdf';
        break;
      case '.txt':
        contentType = 'text/plain; charset=utf-8';
        break;
      case '.epub':
        contentType = 'application/epub+zip';
        break;
      case '.docx':
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        break;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Stream the file
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      logger.error('File stream error for static export', {
        filename,
        filePath,
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
      logger.info('Static export download completed', { filename });
    });
  } catch (error) {
    logger.error('Error downloading static export', {
      error: error.message,
      filename: req.params.filename,
    });

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to download static export',
        message: error.message,
      });
    }
  }
});

/**
 * Save HTML content to exports directory
 * POST /api/exports/save-html
 */
router.post('/save-html', requireJwtAuth, async (req, res) => {
  try {
    const { htmlContent, filename } = req.body;
    const userId = req.user.id;
    const path = require('path');

    logger.info('Saving HTML content to exports', {
      userId,
      filename,
      contentLength: htmlContent?.length,
    });

    // Validate input
    if (!htmlContent || typeof htmlContent !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'HTML content is required',
      });
    }

    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Filename is required',
      });
    }

    // Validate filename (basic security check)
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filename',
      });
    }

    // Ensure filename has .html extension
    const sanitizedFilename = filename.endsWith('.html') ? filename : `${filename}.html`;

    // Get the exports directory path
    const exportsDir = path.join(process.cwd(), 'exports');
    const filePath = path.join(exportsDir, sanitizedFilename);

    // Ensure exports directory exists
    try {
      await fs.mkdir(exportsDir, { recursive: true });
    } catch (mkdirError) {
      logger.error('Failed to create exports directory', {
        exportsDir,
        error: mkdirError.message,
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to create exports directory',
      });
    }

    // Write the HTML content to file
    await fs.writeFile(filePath, htmlContent, 'utf8');

    // Get file stats for response
    const stats = await fs.stat(filePath);

    logger.info('HTML content saved successfully', {
      userId,
      filename: sanitizedFilename,
      filePath,
      size: stats.size,
    });

    res.json({
      success: true,
      filename: sanitizedFilename,
      filePath: filePath,
      size: stats.size,
      url: `/c/exports/${sanitizedFilename}`,
      downloadUrl: `/api/exports/static/download/${sanitizedFilename}`,
      message: 'HTML content saved successfully',
    });
  } catch (error) {
    logger.error('Failed to save HTML content', {
      error: error.message,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to save HTML content',
      message: error.message,
    });
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
