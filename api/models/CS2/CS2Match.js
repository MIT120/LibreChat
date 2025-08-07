const { CS2Match } = require('../../db/models');

/**
 * Create a new CS2 match record
 * @param {Object} matchData - The match data to create
 * @returns {Promise<Object>} The created match document
 */
const createMatch = async (matchData) => {
  return await CS2Match.create(matchData);
};

/**
 * Find a match by HLTV ID
 * @param {string} hltvId - The HLTV match ID
 * @returns {Promise<Object|null>} The match document or null if not found
 */
const findMatchByHltvId = async (hltvId) => {
  return await CS2Match.findOne({ hltvId }).lean();
};

/**
 * Update a match by HLTV ID
 * @param {string} hltvId - The HLTV match ID
 * @param {Object} updateData - The data to update
 * @returns {Promise<Object|null>} The updated match document
 */
const updateMatchByHltvId = async (hltvId, updateData) => {
  return await CS2Match.findOneAndUpdate(
    { hltvId },
    { ...updateData, 'metadata.lastUpdated': new Date() },
    { new: true, upsert: false },
  ).lean();
};

/**
 * Find matches by team
 * @param {string} teamId - The team ObjectId
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of match documents
 */
const findMatchesByTeam = async (teamId, options = {}) => {
  const { limit = 50, status, dateFrom, dateTo } = options;

  const query = {
    'teams.team': teamId,
  };

  if (status) {
    query.status = status;
  }

  if (dateFrom || dateTo) {
    query.date = {};
    if (dateFrom) query.date.$gte = new Date(dateFrom);
    if (dateTo) query.date.$lte = new Date(dateTo);
  }

  return await CS2Match.find(query)
    .populate('teams.team', 'name logo country')
    .sort({ date: -1 })
    .limit(limit)
    .lean();
};

/**
 * Find live matches
 * @returns {Promise<Array>} Array of live match documents
 */
const findLiveMatches = async () => {
  return await CS2Match.find({ status: 'live' })
    .populate('teams.team', 'name logo country')
    .sort({ date: -1 })
    .lean();
};

/**
 * Find upcoming matches
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of upcoming match documents
 */
const findUpcomingMatches = async (options = {}) => {
  const { limit = 20, hours = 24 } = options;
  const now = new Date();
  const futureDate = new Date(now.getTime() + hours * 60 * 60 * 1000);

  return await CS2Match.find({
    status: 'upcoming',
    date: { $gte: now, $lte: futureDate },
  })
    .populate('teams.team', 'name logo country ranking.current')
    .sort({ date: 1 })
    .limit(limit)
    .lean();
};

/**
 * Find recent matches for prediction accuracy tracking
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of recent finished matches
 */
const findRecentFinishedMatches = async (options = {}) => {
  const { limit = 100, days = 7 } = options;
  const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return await CS2Match.find({
    status: 'finished',
    date: { $gte: dateFrom },
    $or: [
      { 'predictions.halfTime.predicted': true },
      { 'predictions.mapWinner.predicted': true },
      { 'predictions.seriesOutcome.predicted': true },
    ],
  })
    .populate('teams.team', 'name')
    .sort({ date: -1 })
    .limit(limit)
    .lean();
};

/**
 * Update match predictions
 * @param {string} hltvId - The HLTV match ID
 * @param {Object} predictions - The predictions to update
 * @returns {Promise<Object|null>} The updated match document
 */
const updateMatchPredictions = async (hltvId, predictions) => {
  const updateData = {};

  if (predictions.halfTime) {
    updateData['predictions.halfTime'] = predictions.halfTime;
  }

  if (predictions.mapWinner) {
    updateData['predictions.mapWinner'] = predictions.mapWinner;
  }

  if (predictions.seriesOutcome) {
    updateData['predictions.seriesOutcome'] = predictions.seriesOutcome;
  }

  updateData['metadata.lastUpdated'] = new Date();

  return await CS2Match.findOneAndUpdate({ hltvId }, { $set: updateData }, { new: true }).lean();
};

/**
 * Update match embeddings
 * @param {string} hltvId - The HLTV match ID
 * @param {Object} embeddings - The embeddings to update
 * @returns {Promise<Object|null>} The updated match document
 */
const updateMatchEmbeddings = async (hltvId, embeddings) => {
  return await CS2Match.findOneAndUpdate(
    { hltvId },
    {
      $set: {
        embeddings,
        'metadata.lastUpdated': new Date(),
      },
    },
    { new: true },
  ).lean();
};

/**
 * Delete old matches (for cleanup)
 * @param {number} daysOld - Number of days old to delete
 * @returns {Promise<Object>} Delete result
 */
const deleteOldMatches = async (daysOld = 365) => {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

  return await CS2Match.deleteMany({
    date: { $lt: cutoffDate },
    status: 'finished',
  });
};

module.exports = {
  createMatch,
  findMatchByHltvId,
  updateMatchByHltvId,
  findMatchesByTeam,
  findLiveMatches,
  findUpcomingMatches,
  findRecentFinishedMatches,
  updateMatchPredictions,
  updateMatchEmbeddings,
  deleteOldMatches,
};
