/**
 * Parsers Index
 *
 * Exports all parser classes for HLTV data parsing
 */

const MatchParser = require('./MatchParser');
const TeamParser = require('./TeamParser');
const PlayerParser = require('./PlayerParser');

module.exports = {
  MatchParser,
  TeamParser,
  PlayerParser,
};
