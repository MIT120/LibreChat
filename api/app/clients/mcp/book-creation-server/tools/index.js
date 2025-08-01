/**
 * MCP Tools Registry
 * 
 * This module exports all available MCP tools for the book creation server.
 * All tools have been implemented as part of task 5.
 */

// Tool implementations
const createBookTool = require('./createBook.js');
const approveOutlineTool = require('./approveOutline.js');
const approveChapterTool = require('./approveChapter.js');
const regenerateChapterTool = require('./regenerateChapter.js');
const listBooksTool = require('./listBooks.js');
const getBookProgressTool = require('./getBookProgress.js');
const exportBookTool = require('./exportBook.js');
const deleteBookTool = require('./deleteBook.js');
const getStatusUpdatesTool = require('./getStatusUpdates.js');

/**
 * Get all available tools
 * @returns {Array} Array of tool objects
 */
function getAllTools() {
  return [
    createBookTool,
    approveOutlineTool,
    approveChapterTool,
    regenerateChapterTool,
    listBooksTool,
    getBookProgressTool,
    exportBookTool,
    deleteBookTool,
    getStatusUpdatesTool,
  ];
}

/**
 * Get tool by name
 * @param {string} toolName - Name of the tool to retrieve
 * @returns {Object|null} Tool object or null if not found
 */
function getToolByName(toolName) {
  const tools = getAllTools();
  return tools.find(tool => tool.name === toolName) || null;
}

/**
 * Get tool names
 * @returns {Array} Array of tool names
 */
function getToolNames() {
  return getAllTools().map(tool => tool.name);
}

/**
 * Validate tool exists
 * @param {string} toolName - Name of the tool to validate
 * @returns {boolean} True if tool exists
 */
function isValidTool(toolName) {
  return getToolNames().includes(toolName);
}

module.exports = {
  getAllTools,
  getToolByName,
  getToolNames,
  isValidTool,
  // Individual tool exports
  createBookTool,
  approveOutlineTool,
  approveChapterTool,
  regenerateChapterTool,
  listBooksTool,
  getBookProgressTool,
  exportBookTool,
  deleteBookTool,
  getStatusUpdatesTool,
};