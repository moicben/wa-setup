/**
 * Logger minimaliste
 * Logging simple en console avec niveaux
 */

// Niveaux de log
const LEVELS = {
            error: 0,
            warn: 1, 
            info: 2,
            debug: 3
        };

// Configuration par défaut
let currentLevel = LEVELS.info;

    /**
 * Logger principal
 */
const logger = {
  // Méthodes de log par niveau
  error(message, data) {
    if (currentLevel >= LEVELS.error) {
      console.error(`❌ [ERROR] ${message}`, data || '');
    }
  },

  warn(message, data) {
    if (currentLevel >= LEVELS.warn) {
      console.warn(`⚠️  [WARN] ${message}`, data || '');
    }
  },

  info(message, data) {
    if (currentLevel >= LEVELS.info) {
      console.log(`ℹ️  [INFO] ${message}`, data || '');
    }
  },

  debug(message, data) {
    if (currentLevel >= LEVELS.debug) {
      console.log(`🐛 [DEBUG] ${message}`, data || '');
        }
  },

  // Changer le niveau
    setLevel(level) {
    if (LEVELS[level] !== undefined) {
      currentLevel = LEVELS[level];
    }
        }
};

// Export du logger
module.exports = {
  logger,
  getLogger: () => logger
};