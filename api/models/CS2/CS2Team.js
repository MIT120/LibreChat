const { CS2Team } = require('~/db/models');

/**
 * Create a new CS2 team record
 * @param {Object} teamData - The team data to create
 * @returns {Promise<Object>} The created team document
 */
const createTeam = async (teamData) => {
  return await CS2Team.create(teamData);
};

/**
 * Find a team by HLTV ID
 * @param {string} hltvId - The HLTV team ID
 * @returns {Promise<Object|null>} The team document or null if not found
 */
const findTeamByHltvId = async (hltvId) => {
  return await CS2Team.findOne({ hltvId })
    .populate('players.player', 'nickname country photo statistics.overall.rating')
    .lean();
};

/**
 * Find a team by name
 * @param {string} name - The team name
 * @returns {Promise<Object|null>} The team document or null if not found
 */
const findTeamByName = async (name) => {
  return await CS2Team.findOne({ 
    name: { $regex: new RegExp(name, 'i') }
  })
    .populate('players.player', 'nickname country photo statistics.overall.rating')
    .lean();
};

/**
 * Update a team by HLTV ID
 * @param {string} hltvId - The HLTV team ID
 * @param {Object} updateData - The data to update
 * @returns {Promise<Object|null>} The updated team document
 */
const updateTeamByHltvId = async (hltvId, updateData) => {
  return await CS2Team.findOneAndUpdate(
    { hltvId },
    { ...updateData, 'metadata.lastUpdated': new Date() },
    { new: true, upsert: false }
  ).lean();
};

/**
 * Find top teams by ranking
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of team documents
 */
const findTopTeams = async (options = {}) => {
  const { limit = 30, activeOnly = true } = options;
  
  const query = {};
  if (activeOnly) {
    query['metadata.isActive'] = true;
  }
  
  return await CS2Team.find(query)
    .populate('players.player', 'nickname country statistics.overall.rating')
    .sort({ 'ranking.current': 1 })
    .limit(limit)
    .lean();
};

/**
 * Find teams by country
 * @param {string} country - The country code
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of team documents
 */
const findTeamsByCountry = async (country, options = {}) => {
  const { limit = 20, activeOnly = true } = options;
  
  const query = { country };
  if (activeOnly) {
    query['metadata.isActive'] = true;
  }
  
  return await CS2Team.find(query)
    .populate('players.player', 'nickname country statistics.overall.rating')
    .sort({ 'ranking.current': 1 })
    .limit(limit)
    .lean();
};

/**
 * Update team ranking
 * @param {string} hltvId - The HLTV team ID
 * @param {Object} rankingData - The ranking data to update
 * @returns {Promise<Object|null>} The updated team document
 */
const updateTeamRanking = async (hltvId, rankingData) => {
  return await CS2Team.findOneAndUpdate(
    { hltvId },
    { 
      $set: { 
        ranking: {
          ...rankingData,
          lastUpdated: new Date()
        },
        'metadata.lastUpdated': new Date()
      }
    },
    { new: true }
  ).lean();
};

/**
 * Update team recent form
 * @param {string} hltvId - The HLTV team ID
 * @param {Object} formData - The form data to add
 * @returns {Promise<Object|null>} The updated team document
 */
const updateTeamRecentForm = async (hltvId, formData) => {
  // Add new form entry and keep only last 10 matches
  return await CS2Team.findOneAndUpdate(
    { hltvId },
    { 
      $push: { 
        recentForm: {
          $each: [formData],
          $slice: -10 // Keep only last 10 matches
        }
      },
      $set: { 'metadata.lastUpdated': new Date() }
    },
    { new: true }
  ).lean();
};

/**
 * Update team map statistics
 * @param {string} hltvId - The HLTV team ID
 * @param {string} mapName - The map name
 * @param {Object} mapStats - The map statistics
 * @returns {Promise<Object|null>} The updated team document
 */
const updateTeamMapStats = async (hltvId, mapName, mapStats) => {
  // First try to update existing map stats
  const updated = await CS2Team.findOneAndUpdate(
    { hltvId, 'mapStats.mapName': mapName },
    { 
      $set: { 
        'mapStats.$': { mapName, ...mapStats },
        'metadata.lastUpdated': new Date()
      }
    },
    { new: true }
  ).lean();
  
  // If no existing map stats, add new entry
  if (!updated) {
    return await CS2Team.findOneAndUpdate(
      { hltvId },
      { 
        $push: { mapStats: { mapName, ...mapStats } },
        $set: { 'metadata.lastUpdated': new Date() }
      },
      { new: true }
    ).lean();
  }
  
  return updated;
};

/**
 * Add player to team
 * @param {string} hltvId - The HLTV team ID
 * @param {Object} playerData - The player data to add
 * @returns {Promise<Object|null>} The updated team document
 */
const addPlayerToTeam = async (hltvId, playerData) => {
  return await CS2Team.findOneAndUpdate(
    { hltvId },
    { 
      $push: { players: playerData },
      $set: { 'metadata.lastUpdated': new Date() }
    },
    { new: true }
  ).lean();
};

/**
 * Remove player from team
 * @param {string} hltvId - The HLTV team ID
 * @param {string} playerId - The player ObjectId
 * @returns {Promise<Object|null>} The updated team document
 */
const removePlayerFromTeam = async (hltvId, playerId) => {
  return await CS2Team.findOneAndUpdate(
    { hltvId },
    { 
      $pull: { players: { player: playerId } },
      $set: { 'metadata.lastUpdated': new Date() }
    },
    { new: true }
  ).lean();
};

/**
 * Update team embeddings
 * @param {string} hltvId - The HLTV team ID
 * @param {Object} embeddings - The embeddings to update
 * @returns {Promise<Object|null>} The updated team document
 */
const updateTeamEmbeddings = async (hltvId, embeddings) => {
  return await CS2Team.findOneAndUpdate(
    { hltvId },
    { 
      $set: { 
        embeddings,
        'metadata.lastUpdated': new Date()
      }
    },
    { new: true }
  ).lean();
};

/**
 * Search teams by name (fuzzy search)
 * @param {string} searchTerm - The search term
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of team documents
 */
const searchTeams = async (searchTerm, options = {}) => {
  const { limit = 10, activeOnly = true } = options;
  
  const query = {
    name: { $regex: new RegExp(searchTerm, 'i') }
  };
  
  if (activeOnly) {
    query['metadata.isActive'] = true;
  }
  
  return await CS2Team.find(query)
    .select('name logo country ranking.current')
    .sort({ 'ranking.current': 1 })
    .limit(limit)
    .lean();
};

module.exports = {
  createTeam,
  findTeamByHltvId,
  findTeamByName,
  updateTeamByHltvId,
  findTopTeams,
  findTeamsByCountry,
  updateTeamRanking,
  updateTeamRecentForm,
  updateTeamMapStats,
  addPlayerToTeam,
  removePlayerFromTeam,
  updateTeamEmbeddings,
  searchTeams,
};