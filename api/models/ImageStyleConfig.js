const { logger } = require('@librechat/data-schemas');
const { ImageStyleConfig } = require('../db/models');

/**
 * Get the active image style configuration
 */
const getActiveImageStyleConfig = async () => {
    try {
        let config = await ImageStyleConfig.findOne({
            isActive: true,
            isDefault: true
        }).lean();

        // If no default active config, get the first active one
        if (!config) {
            config = await ImageStyleConfig.findOne({ isActive: true }).lean();
        }

        return config;
    } catch (error) {
        logger.error('[getActiveImageStyleConfig] Error getting active image style config', error);
        throw error;
    }
};

/**
 * Get all image style configurations
 */
const getAllImageStyleConfigs = async (filter = {}) => {
    try {
        return await ImageStyleConfig.find(filter)
            .sort({ isDefault: -1, createdAt: -1 })
            .lean();
    } catch (error) {
        logger.error('[getAllImageStyleConfigs] Error getting image style configs', error);
        throw error;
    }
};

/**
 * Get image style configuration by ID
 */
const getImageStyleConfigById = async (configId) => {
    try {
        return await ImageStyleConfig.findOne({ configId }).lean();
    } catch (error) {
        logger.error('[getImageStyleConfigById] Error getting image style config by ID', error);
        throw error;
    }
};

/**
 * Create a new image style configuration
 */
const createImageStyleConfig = async (configData) => {
    try {
        // Generate configId if not provided
        if (!configData.configId) {
            configData.configId = `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        const newConfig = new ImageStyleConfig(configData);
        return await newConfig.save();
    } catch (error) {
        logger.error('[createImageStyleConfig] Error creating image style config', error);
        throw error;
    }
};

/**
 * Update an image style configuration
 */
const updateImageStyleConfig = async (configId, updates) => {
    try {
        const updatedConfig = await ImageStyleConfig.findOneAndUpdate(
            { configId },
            {
                ...updates,
                $inc: { version: 1 },
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        );

        return updatedConfig;
    } catch (error) {
        logger.error('[updateImageStyleConfig] Error updating image style config', error);
        throw error;
    }
};

/**
 * Delete an image style configuration
 */
const deleteImageStyleConfig = async (configId) => {
    try {
        // Don't allow deletion of default config
        const config = await ImageStyleConfig.findOne({ configId });
        if (config && config.isDefault) {
            throw new Error('Cannot delete default image style configuration');
        }

        const result = await ImageStyleConfig.deleteOne({ configId });
        return result.deletedCount > 0;
    } catch (error) {
        logger.error('[deleteImageStyleConfig] Error deleting image style config', error);
        throw error;
    }
};

/**
 * Set a configuration as the default
 */
const setDefaultImageStyleConfig = async (configId) => {
    try {
        const session = await ImageStyleConfig.startSession();

        try {
            await session.withTransaction(async () => {
                // First, unset all other defaults
                await ImageStyleConfig.updateMany(
                    { isDefault: true },
                    { $set: { isDefault: false } },
                    { session }
                );

                // Then set the new default
                const result = await ImageStyleConfig.updateOne(
                    { configId },
                    {
                        $set: {
                            isDefault: true,
                            isActive: true,
                            updatedAt: new Date()
                        }
                    },
                    { session }
                );

                if (result.matchedCount === 0) {
                    throw new Error(`Image style configuration '${configId}' not found`);
                }
            });

            return true;
        } finally {
            await session.endSession();
        }
    } catch (error) {
        logger.error('[setDefaultImageStyleConfig] Error setting default image style config', error);
        throw error;
    }
};

module.exports = {
    getActiveImageStyleConfig,
    getAllImageStyleConfigs,
    getImageStyleConfigById,
    createImageStyleConfig,
    updateImageStyleConfig,
    deleteImageStyleConfig,
    setDefaultImageStyleConfig,
};
