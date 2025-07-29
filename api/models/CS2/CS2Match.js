const { CS2Match } = require('~/db/models');

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
  return await CS2Match.findOne({ hltvId })
    .populate('teams.team', 'name logo country ranking.current')
    .populate('maps.winner', 'name logo')
    .populate('maps.pickBy', 'name logo')
    .lean();
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
  const { limit = 20, status, dateFrom, dateTo } = options;

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
    .populate('teams.team', 'name logo country ranking.current')
    .populate('tournament')
    .sort({ date: -1 })
    .limit(limit)
    .lean();
};

/**
 * Find matches by tournament
 * @param {string} tournamentName - The tournament name
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of match documents
 */
const findMatchesByTournament = async (tournamentName, options = {}) => {
  const { limit = 50, status } = options;

  const query = {
    'tournament.name': { $regex: new RegExp(tournamentName, 'i') },
  };

  if (status) {
    query.status = status;
  }

  return await CS2Match.find(query)
    .populate('teams.team', 'name logo country ranking.current')
    .sort({ date: -1 })
    .limit(limit)
    .lean();
};

/**
 * Find live matches
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of live match documents
 */
const findLiveMatches = async (options = {}) => {
  const { limit = 10 } = options;

  return await CS2Match.find({ status: 'live' })
    .populate('teams.team', 'name logo country ranking.current')
    .populate('tournament')
    .sort({ date: -1 })
    .limit(limit)
    .lean();
};

/**
 * Find upcoming matches
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of upcoming match documents
 */
const findUpcomingMatches = async (options = {}) => {
  const { limit = 20, hoursAhead = 24 } = options;

  const now = new Date();
  const futureDate = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  return await CS2Match.find({
    status: 'upcoming',
    date: { $gte: now, $lte: futureDate },
  })
    .populate('teams.team', 'name logo country ranking.current')
    .populate('tournament')
    .sort({ date: 1 })
    .limit(limit)
    .lean();
};

/**
 * Find recent finished matches
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of finished match documents
 */
const findRecentMatches = async (options = {}) => {
  const { limit = 30, daysBack = 7 } = options;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  return await CS2Match.find({
    status: 'finished',
    date: { $gte: cutoffDate },
  })
    .populate('teams.team', 'name logo country ranking.current')
    .populate('tournament')
    .sort({ date: -1 })
    .limit(limit)
    .lean();
};

/**
 * Update match status
 * @param {string} hltvId - The HLTV match ID
 * @param {string} status - The new status
 * @param {Object} additionalData - Additional data to update
 * @returns {Promise<Object|null>} The updated match document
 */
const updateMatchStatus = async (hltvId, status, additionalData = {}) => {
  const updateData = {
    status,
    ...additionalData,
    'metadata.lastUpdated': new Date(),
  };

  return await CS2Match.findOneAndUpdate({ hltvId }, { $set: updateData }, { new: true }).lean();
};

/**
 * Update match live data
 * @param {string} hltvId - The HLTV match ID
 * @param {Object} liveData - The live data to update
 * @returns {Promise<Object|null>} The updated match document
 */
const updateMatchLiveData = async (hltvId, liveData) => {
  return await CS2Match.findOneAndUpdate(
    { hltvId },
    {
      $set: {
        liveData,
        'metadata.lastUpdated': new Date(),
      },
    },
    { new: true },
  ).lean();
};

/**
 * Add map result to match
 * @param {string} hltvId - The HLTV match ID
 * @param {Object} mapData - The map data to add
 * @returns {Promise<Object|null>} The updated match document
 */
const addMatchMapResult = async (hltvId, mapData) => {
  return await CS2Match.findOneAndUpdate(
    { hltvId },
    {
      $push: { maps: mapData },
      $set: { 'metadata.lastUpdated': new Date() },
    },
    { new: true },
  ).lean();
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
    Object.keys(predictions.halfTime).forEach((key) => {
      updateData[`predictions.halfTime.${key}`] = predictions.halfTime[key];
    });
  }

  if (predictions.mapWinner) {
    Object.keys(predictions.mapWinner).forEach((key) => {
      updateData[`predictions.mapWinner.${key}`] = predictions.mapWinner[key];
    });
  }

  if (predictions.seriesOutcome) {
    Object.keys(predictions.seriesOutcome).forEach((key) => {
      updateData[`predictions.seriesOutcome.${key}`] = predictions.seriesOutcome[key];
    });
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
 * Find matches for prediction analysis
 * @param {Object} criteria - Search criteria
 * @returns {Promise<Array>} Array of match documents suitable for prediction
 */
const findMatchesForPrediction = async (criteria = {}) => {
  const { teamIds, mapName, tournamentTier, limit = 100 } = criteria;

  const query = {
    status: 'finished',
    'maps.0': { $exists: true }, // Has at least one map
  };

  if (teamIds && teamIds.length > 0) {
    query['teams.team'] = { $in: teamIds };
  }

  if (mapName) {
    query['maps.name'] = mapName;
  }

  if (tournamentTier) {
    query['tournament.tier'] = tournamentTier;
  }

  return await CS2Match.find(query)
    .populate('teams.team', 'name ranking.current')
    .select('hltvId date tournament teams maps predictions')
    .sort({ date: -1 })
    .limit(limit)
    .lean();
};

/**
 * Get match statistics for a team
 * @param {string} teamId - The team ObjectId
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Match statistics
 */
const getTeamMatchStats = async (teamId, options = {}) => {
  const { daysBack = 90, mapName } = options;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  const query = {
    'teams.team': teamId,
    status: 'finished',
    date: { $gte: cutoffDate },
  };

  if (mapName) {
    query['maps.name'] = mapName;
  }

  const matches = await CS2Match.find(query).select('teams maps date').lean();

  let wins = 0;
  let losses = 0;
  let totalRounds = 0;
  let roundsWon = 0;

  matches.forEach((match) => {
    const teamData = match.teams.find((t) => t.team.toString() === teamId);
    if (teamData) {
      if (teamData.isWinner) wins++;
      else losses++;

      match.maps.forEach((map) => {
        if (map.winner && map.winner.toString() === teamId) {
          roundsWon += Math.max(map.score.team1, map.score.team2);
          totalRounds += map.score.team1 + map.score.team2;
        } else {
          roundsWon += Math.min(map.score.team1, map.score.team2);
          totalRounds += map.score.team1 + map.score.team2;
        }
      });
    }
  });

  return {
    totalMatches: matches.length,
    wins,
    losses,
    winRate: matches.length > 0 ? wins / matches.length : 0,
    roundsWon,
    totalRounds,
    roundWinRate: totalRounds > 0 ? roundsWon / totalRounds : 0,
  };
};

/**
 * Find head-to-head matches between two teams
 * @param {string} team1Id - First team ObjectId
 * @param {string} team2Id - Second team ObjectId
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of head-to-head match documents
 */
const findHeadToHeadMatches = async (team1Id, team2Id, options = {}) => {
  const { limit = 10, daysBack = 365 } = options;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);

  return await CS2Match.find({
    'teams.team': { $all: [team1Id, team2Id] },
    status: 'finished',
    date: { $gte: cutoffDate },
  })
    .populate('teams.team', 'name logo')
    .populate('tournament', 'name tier')
    .sort({ date: -1 })
    .limit(limit)
    .lean();
};

/**
 * Search matches by criteria
 * @param {Object} searchCriteria - Search criteria
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of matching documents
 */
const searchMatches = async (searchCriteria, options = {}) => {
  const { limit = 20, sortBy = 'date', sortOrder = -1 } = options;
  const { teamName, tournamentName, status, dateFrom, dateTo } = searchCriteria;

  const query = {};

  if (status) {
    query.status = status;
  }

  if (dateFrom || dateTo) {
    query.date = {};
    if (dateFrom) query.date.$gte = new Date(dateFrom);
    if (dateTo) query.date.$lte = new Date(dateTo);
  }

  if (tournamentName) {
    query['tournament.name'] = { $regex: new RegExp(tournamentName, 'i') };
  }

  let matchQuery = CS2Match.find(query);

  if (teamName) {
    // First find teams matching the name
    const { CS2Team } = require('~/db/models');
    const teams = await CS2Team.find({
      name: { $regex: new RegExp(teamName, 'i') },
    })
      .select('_id')
      .lean();

    if (teams.length > 0) {
      const teamIds = teams.map((t) => t._id);
      query['teams.team'] = { $in: teamIds };
    } else {
      // No teams found, return empty result
      return [];
    }
  }

  return await matchQuery
    .populate('teams.team', 'name logo country')
    .populate('tournament')
    .sort({ [sortBy]: sortOrder })
    .limit(limit)
    .lean();
};

module.exports = {
  createMatch,
  findMatchByHltvId,
  updateMatchByHltvId,
  findMatchesByTeam,
  findMatchesByTournament,
  findLiveMatches,
  findUpcomingMatches,
  findRecentMatches,
  updateMatchStatus,
  updateMatchLiveData,
  addMatchMapResult,
  updateMatchPredictions,
  updateMatchEmbeddings,
  findMatchesForPrediction,
  getTeamMatchStats,
  findHeadToHeadMatches,
  searchMatches,
};
