/**
 * Legal Documents API Routes
 * Handles PDF export, download, and management for legal documents
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

// Path to the legal MCP server
const LEGAL_MCP_PATH = path.join(__dirname, '../../app/clients/mcp/mcp-legal-bulgaria');
const PDF_EXPORTS_PATH = path.join(LEGAL_MCP_PATH, 'exports/pdf');

/**
 * Execute MCP tool
 */
async function executeMCPTool(toolName, args = {}) {
  try {
    // Import the Bulgarian Legal Server
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // Create a temporary input file for the MCP server
    const inputData = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    });

    // Execute the MCP server with the input
    const { stdout, stderr } = await execAsync(
      `echo '${inputData}' | node index.js`,
      { 
        cwd: LEGAL_MCP_PATH,
        timeout: 30000 
      }
    );

    if (stderr) {
      console.error('MCP Server Error:', stderr);
    }

    // Parse the response
    const lines = stdout.trim().split('\n');
    const responseLine = lines.find(line => {
      try {
        const parsed = JSON.parse(line);
        return parsed.result || parsed.error;
      } catch {
        return false;
      }
    });

    if (responseLine) {
      const response = JSON.parse(responseLine);
      return response.result || { error: response.error };
    }

    return { error: 'No valid response from MCP server' };
  } catch (error) {
    console.error('MCP Execution Error:', error);
    return { error: error.message };
  }
}

/**
 * List exported PDFs
 */
router.post('/pdfs', requireJwtAuth, async (req, res) => {
  try {
    const result = await executeMCPTool('list_exported_pdfs');
    res.json(result);
  } catch (error) {
    console.error('Error listing PDFs:', error);
    res.status(500).json({ error: 'Failed to list PDF documents' });
  }
});

/**
 * Export document to PDF
 */
router.post('/export', requireJwtAuth, async (req, res) => {
  try {
    const { tool, arguments: args } = req.body;
    
    // Validate tool name
    const validTools = [
      'export_case_law_to_pdf',
      'export_legal_analysis_to_pdf', 
      'export_contract_to_pdf'
    ];
    
    if (!validTools.includes(tool)) {
      return res.status(400).json({ error: 'Invalid export tool' });
    }

    // Add user context to the export
    const enhancedArgs = {
      ...args,
      lawyerName: req.user?.name || 'LibreChat User',
      clientName: args.clientName || '',
      watermark: args.watermark || 'LibreChat Legal Assistant'
    };

    const result = await executeMCPTool(tool, enhancedArgs);
    
    if (result.error) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Error exporting PDF:', error);
    res.status(500).json({ error: 'Failed to export document' });
  }
});

/**
 * Delete PDF document
 */
router.post('/delete', requireJwtAuth, async (req, res) => {
  try {
    const { arguments: args } = req.body;
    
    if (!args.filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const result = await executeMCPTool('delete_exported_pdf', args);
    res.json(result);
  } catch (error) {
    console.error('Error deleting PDF:', error);
    res.status(500).json({ error: 'Failed to delete PDF document' });
  }
});

/**
 * Download PDF document
 */
router.get('/download/:filename', requireJwtAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validate filename to prevent path traversal
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(PDF_EXPORTS_PATH, filename);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'PDF document not found' });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the file
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download file' });
      }
    });
  } catch (error) {
    console.error('Error downloading PDF:', error);
    res.status(500).json({ error: 'Failed to download PDF document' });
  }
});

/**
 * Preview PDF document (inline)
 */
router.get('/preview/:filename', requireJwtAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validate filename
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(PDF_EXPORTS_PATH, filename);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'PDF document not found' });
    }

    // Set headers for inline viewing
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    
    // Stream the file
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      console.error('File stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to preview file' });
      }
    });
  } catch (error) {
    console.error('Error previewing PDF:', error);
    res.status(500).json({ error: 'Failed to preview PDF document' });
  }
});

/**
 * Get PDF document metadata
 */
router.get('/metadata/:filename', requireJwtAuth, async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Validate filename
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(PDF_EXPORTS_PATH, filename);
    
    try {
      const stats = await fs.stat(filePath);
      
      const metadata = {
        filename,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isFile: stats.isFile(),
        type: filename.includes('case_law') ? 'case_law' :
              filename.includes('legal_analysis') ? 'legal_analysis' :
              filename.includes('contract') ? 'contract' : 'unknown'
      };
      
      res.json(metadata);
    } catch {
      res.status(404).json({ error: 'PDF document not found' });
    }
  } catch (error) {
    console.error('Error getting PDF metadata:', error);
    res.status(500).json({ error: 'Failed to get PDF metadata' });
  }
});

/**
 * Health check for legal documents service
 */
router.get('/health', async (req, res) => {
  try {
    // Check if MCP server is accessible
    const result = await executeMCPTool('list_exported_pdfs');
    
    const health = {
      status: result.error ? 'unhealthy' : 'healthy',
      mcpServer: result.error ? 'error' : 'ok',
      exportsDirectory: 'unknown',
      timestamp: new Date().toISOString()
    };
    
    // Check exports directory
    try {
      await fs.access(PDF_EXPORTS_PATH);
      health.exportsDirectory = 'accessible';
    } catch {
      health.exportsDirectory = 'inaccessible';
      health.status = 'unhealthy';
    }
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Bulk operations
 */
router.post('/bulk/delete', requireJwtAuth, async (req, res) => {
  try {
    const { filenames } = req.body;
    
    if (!Array.isArray(filenames) || filenames.length === 0) {
      return res.status(400).json({ error: 'Filenames array is required' });
    }
    
    const results = [];
    
    for (const filename of filenames) {
      try {
        const result = await executeMCPTool('delete_exported_pdf', { filename });
        results.push({ filename, success: !result.error, error: result.error });
      } catch (error) {
        results.push({ filename, success: false, error: error.message });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    res.json({
      results,
      summary: {
        total: filenames.length,
        successful: successCount,
        failed: filenames.length - successCount
      }
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    res.status(500).json({ error: 'Failed to perform bulk delete' });
  }
});

module.exports = router;
