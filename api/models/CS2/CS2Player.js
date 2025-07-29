const { CS2Player } = require('../../db/models');

/**
 * Create a new CS2 player record
 * @param {Object} playerData - The player data to create
 * @returns {Promise<Object>} The created player document
 */
const createPlayer = async (playerData) => {
  return await CS2Player.create(playerData);
};

/**
 * Find a player by HLTV ID
 * @param {string} hltvId - The HLTV player ID
 * @returns {Promise<Object|null>} The player document or null if not found
 */
const findPlayerByHltvId = async (hltvId) => {
  return await CS2Player.findOne({ hltvId })
    .populate('currentTeam.team', 'name logo country ranking.current')
    .populate('teamHistory.team', 'name logo')
    .lean();
};

/**
 * Find a player by nickname
 * @param {string} nickname - The player nickname
 * @returns {Promise<Object|null>} The player document or null if not found
 */
const findPlayerByNickname = async (nickname) => {
  return await CS2Player.findOne({
    nickname: { $regex: new RegExp(nickname, 'i') },
  })
    .populate('currentTeam.team', 'name logo country ranking.current')
    .lean();
};

/**
 * Update a player by HLTV ID
 * @param {string} hltvId - The HLTV player ID
 * @param {Object} updateData - The data to update
 * @returns {Promise<Object|null>} The updated player document
 */
const updatePlayerByHltvId = async (hltvId, updateData) => {
  return await CS2Player.findOneAndUpdate(
    { hltvId },
    { ...updateData, 'metadata.lastUpdated': new Date() },
    { new: true, upsert: false },
  ).lean();
};

/**
 * Find top players by rating
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of player documents
 */
const findTopPlayers = async (options = {}) => {
  const { limit = 50, activeOnly = true, minMaps = 50 } = options;

  const query = {
    'statistics.overall.totalMaps': { $gte: minMaps },
  };

  if (activeOnly) {
    query['metadata.isActive'] = true;
  }

  return await CS2Player.find(query)
    .populate('currentTeam.team', 'name logo country ranking.current')
    .sort({ 'statistics.overall.rating': -1 })
    .limit(limit)
    .lean();
};

/**
 * Find players by team
 * @param {string} teamId - The team ObjectId
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of player documents
 */
const findPlayersByTeam = async (teamId, options = {}) => {
  const { activeOnly = true } = options;

  const query = {
    'currentTeam.team': teamId,
  };

  if (activeOnly) {
    query['metadata.isActive'] = true;
  }

  return await CS2Player.find(query).sort({ 'statistics.overall.rating': -1 }).lean();
};

/**
 * Find players by country
 * @param {string} country - The country code
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of player documents
 */
const findPlayersByCountry = async (country, options = {}) => {
  const { limit = 30, activeOnly = true } = options;

  const query = { country };
  if (activeOnly) {
    query['metadata.isActive'] = true;
  }

  return await CS2Player.find(query)
    .populate('currentTeam.team', 'name logo ranking.current')
    .sort({ 'statistics.overall.rating': -1 })
    .limit(limit)
    .lean();
};

/**
 * Update player statistics
 * @param {string} hltvId - The HLTV player ID
 * @param {Object} statsData - The statistics data to update
 * @returns {Promise<Object|null>} The updated player document
 */
const updatePlayerStatistics = async (hltvId, statsData) => {
  const updateData = {};

  if (statsData.overall) {
    updateData['statistics.overall'] = statsData.overall;
  }

  if (statsData.recent) {
    updateData['statistics.recent'] = {
      ...statsData.recent,
      lastUpdated: new Date(),
    };
  }

  updateData['metadata.lastUpdated'] = new Date();

  return await CS2Player.findOneAndUpdate({ hltvId }, { $set: updateData }, { new: true }).lean();
};

/**
 * Update player map statistics
 * @param {string} hltvId - The HLTV player ID
 * @param {string} mapName - The map name
 * @param {Object} mapStats - The map statistics
 * @returns {Promise<Object|null>} The updated player document
 */
const updatePlayerMapStats = async (hltvId, mapName, mapStats) => {
  // First try to update existing map stats
  const updated = await CS2Player.findOneAndUpdate(
    { hltvId, 'mapStats.mapName': mapName },
    {
      $set: {
        'mapStats.$': { mapName, ...mapStats },
        'metadata.lastUpdated': new Date(),
      },
    },
    { new: true },
  ).lean();

  // If no existing map stats, add new entry
  if (!updated) {
    return await CS2Player.findOneAndUpdate(
      { hltvId },
      {
        $push: { mapStats: { mapName, ...mapStats } },
        $set: { 'metadata.lastUpdated': new Date() },
      },
      { new: true },
    ).lean();
  }

  return updated;
};

/**
 * Update player current team
 * @param {string} hltvId - The HLTV player ID
 * @param {Object} teamData - The team data
 * @returns {Promise<Object|null>} The updated player document
 */
const updatePlayerCurrentTeam = async (hltvId, teamData) => {
  // Add current team to history if exists
  const player = await CS2Player.findOne({ hltvId });
  if (player && player.currentTeam && player.currentTeam.team) {
    await CS2Player.findOneAndUpdate(
      { hltvId },
      {
        $push: {
          teamHistory: {
            team: player.currentTeam.team,
            startDate: player.currentTeam.joinDate,
            endDate: new Date(),
            role: player.currentTeam.role,
          },
        },
      },
    );
  }

  // Update current team
  return await CS2Player.findOneAndUpdate(
    { hltvId },
    {
      $set: {
        currentTeam: teamData,
        'metadata.lastUpdated': new Date(),
      },
    },
    { new: true },
  ).lean();
};

/**
 * Update player weapon statistics
 * @param {string} hltvId - The HLTV player ID
 * @param {Object} weaponStats - The weapon statistics
 * @returns {Promise<Object|null>} The updated player document
 */
const updatePlayerWeaponStats = async (hltvId, weaponStats) => {
  return await CS2Player.findOneAndUpdate(
    { hltvId },
    {
      $set: {
        weaponStats,
        'metadata.lastUpdated': new Date(),
      },
    },
    { new: true },
  ).lean();
};

/**
 * Add achievement to player
 * @param {string} hltvId - The HLTV player ID
 * @param {Object} achievement - The achievement data
 * @returns {Promise<Object|null>} The updated player document
 */
const addPlayerAchievement = async (hltvId, achievement) => {
  return await CS2Player.findOneAndUpdate(
    { hltvId },
    {
      $push: { achievements: achievement },
      $set: { 'metadata.lastUpdated': new Date() },
    },
    { new: true },
  ).lean();
};

/**
 * Update player embeddings
 * @param {string} hltvId - The HLTV player ID
 * @param {Object} embeddings - The embeddings to update
 * @returns {Promise<Object|null>} The updated player document
 */
const updatePlayerEmbeddings = async (hltvId, embeddings) => {
  return await CS2Player.findOneAndUpdate(
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
 * Search players by nickname (fuzzy search)
 * @param {string} searchTerm - The search term
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of player documents
 */
const searchPlayers = async (searchTerm, options = {}) => {
  const { limit = 10, activeOnly = true } = options;

  const query = {
    nickname: { $regex: new RegExp(searchTerm, 'i') },
  };

  if (activeOnly) {
    query['metadata.isActive'] = true;
  }

  return await CS2Player.find(query)
    .populate('currentTeam.team', 'name logo')
    .select('nickname realName country photo statistics.overall.rating currentTeam')
    .sort({ 'statistics.overall.rating': -1 })
    .limit(limit)
    .lean();
};

/**
 * Find players with similar performance (for recommendations)
 * @param {string} hltvId - The reference player HLTV ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of similar player documents
 */
const findSimilarPlayers = async (hltvId, options = {}) => {
  const { limit = 5, ratingTolerance = 0.1 } = options;

  const player = await CS2Player.findOne({ hltvId }).lean();
  if (!player) return [];

  const targetRating = player.statistics.overall.rating;

  return await CS2Player.find({
    hltvId: { $ne: hltvId },
    'statistics.overall.rating': {
      $gte: targetRating - ratingTolerance,
      $lte: targetRating + ratingTolerance,
    },
    'metadata.isActive': true,
  })
    .populate('currentTeam.team', 'name logo')
    .select('nickname country photo statistics.overall currentTeam')
    .sort({ 'statistics.overall.rating': -1 })
    .limit(limit)
    .lean();
};

module.exports = {
  createPlayer,
  findPlayerByHltvId,
  findPlayerByNickname,
  updatePlayerByHltvId,
  findTopPlayers,
  findPlayersByTeam,
  findPlayersByCountry,
  updatePlayerStatistics,
  updatePlayerMapStats,
  updatePlayerCurrentTeam,
  updatePlayerWeaponStats,
  addPlayerAchievement,
  updatePlayerEmbeddings,
  searchPlayers,
  findSimilarPlayers,
};
