/**
 * Services Registry
 *
 * This module exports all business logic services for the book creation server.
 * All services have been implemented as part of tasks 4.1 and 4.2.
 */

// Service implementations
const BookService = require('./BookService.js');
const ChapterService = require('./ChapterService.js');
const ConfigService = require('./ConfigService.js');
const ProgressService = require('./ProgressService.js');
const StatusMessageService = require('./StatusMessageService.js');
const SummaryService = require('./SummaryService.js');

module.exports = {
  BookService,
  ChapterService,
  ConfigService,
  ProgressService,
  StatusMessageService,
  SummaryService,
};
