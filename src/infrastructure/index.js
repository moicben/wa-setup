/**
 * Infrastructure - Point d'entrée unifié
 * Phase 6: Infrastructure Simple
 * 
 * Export centralisé de toute l'infrastructure
 */

const { Logger, getLogger } = require('./Logger');
const { Validator, getValidator } = require('./Validator');
const { TranscriptManager, getTranscriptManager } = require('./TranscriptManager');
const { 
    FileHelper, 
    ConfigHelper, 
    CryptoHelper, 
    DateHelper, 
    ErrorHelper,
    getConfig 
} = require('./Helpers');

module.exports = {
    // Logging
    Logger,
    getLogger,
    
    // Transcripts
    TranscriptManager,
    getTranscriptManager,
    
    // Validation
    Validator,
    getValidator,
    
    // Helpers
    FileHelper,
    ConfigHelper,
    CryptoHelper,
    DateHelper,
    ErrorHelper,
    getConfig,
    
    // Fonction utilitaire pour initialiser l'infrastructure
    setupInfrastructure: (config = {}) => {
        const logger = getLogger(config.logger);
        const validator = getValidator();
        const transcriptManager = getTranscriptManager(config.transcriptManager);
        const configHelper = getConfig();
        
        // Validation de la configuration de base
        try {
            configHelper.validateRequired(['SMS_ACTIVATE_API_KEY', 'SUPABASE_URL', 'SUPABASE_KEY']);
            logger.info('Infrastructure initialisée avec succès', {
                components: ['Logger', 'Validator', 'TranscriptManager', 'Helpers']
            });
        } catch (error) {
            logger.error('Erreur initialisation infrastructure:', { error: error.message });
            throw error;
        }
        
        return {
            logger,
            validator,
            transcriptManager,
            config: configHelper
        };
    }
};