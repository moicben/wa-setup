/**
 * Configuration du nettoyage global SMS
 * Permet d'activer/désactiver et configurer le nettoyage global
 */

const CLEANUP_CONFIG = {
    // Configuration par défaut du nettoyage global SMS
    globalSMS: {
        // Activer le nettoyage global par défaut
        enabled: process.env.ENABLE_GLOBAL_SMS_CLEANUP === 'true' || false,
        
        // Options par défaut
        options: {
            maxConcurrent: 3,     // Maximum 3 annulations en parallèle
            ignoreErrors: true,   // Ignorer les erreurs d'annulation
            onlyWhatsApp: true,   // Annuler seulement les numéros WhatsApp
            logProgress: true,    // Logger le progrès
            minDelay: 0          // Pas de délai minimum pour le nettoyage global
        },
        
        // Quand déclencher le nettoyage global
        triggers: {
            onWorkflowEnd: true,      // À la fin de chaque workflow
            onWorkflowError: false,   // Lors d'erreur de workflow
            onApplicationExit: true,  // À la fermeture de l'application
            onCleanupCommand: true    // Via commande manuelle
        },
        
        // Timing et limites
        timing: {
            timeout: 60000,       // 1 minute timeout pour le nettoyage complet
            batchDelay: 1000,     // 1 seconde entre les batches
            retryDelay: 2000      // 2 secondes avant retry en cas d'erreur
        }
    },
    
    // Configuration des autres types de nettoyage
    screenshots: {
        enabled: true,
        keepSuccessful: true,   // Garder les screenshots de succès
        keepErrored: true,      // Garder les screenshots d'erreur
        cleanupTempOnly: true   // Nettoyer seulement les fichiers temporaires
    },
    
    logs: {
        enabled: true,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
        maxSize: 100 * 1024 * 1024       // 100MB
    }
};

/**
 * Obtenir la configuration de nettoyage global SMS
 */
function getGlobalSMSCleanupConfig() {
    return {
        ...CLEANUP_CONFIG.globalSMS,
        enabled: process.env.ENABLE_GLOBAL_SMS_CLEANUP === 'true' || CLEANUP_CONFIG.globalSMS.enabled
    };
}

/**
 * Vérifier si le nettoyage global SMS est activé
 */
function isGlobalSMSCleanupEnabled() {
    return getGlobalSMSCleanupConfig().enabled;
}

/**
 * Obtenir les options de nettoyage global avec overrides
 */
function getGlobalSMSCleanupOptions(overrides = {}) {
    const config = getGlobalSMSCleanupConfig();
    return {
        ...config.options,
        ...overrides,
        enabled: true  // Forcer l'activation si on appelle cette fonction
    };
}

/**
 * Vérifier si un trigger spécifique est activé
 */
function isTriggerEnabled(triggerName) {
    const config = getGlobalSMSCleanupConfig();
    return config.triggers[triggerName] || false;
}

/**
 * Créer les options de nettoyage pour différents contextes
 */
function createCleanupOptions(context = 'default', overrides = {}) {
    const baseOptions = getGlobalSMSCleanupOptions();
    
    const contextOptions = {
        // Nettoyage de fin de workflow (plus conservateur)
        workflowEnd: {
            maxConcurrent: 2,
            logProgress: true,
            ignoreErrors: true,
            onlyWhatsApp: true
        },
        
        // Nettoyage d'erreur (plus agressif)
        workflowError: {
            maxConcurrent: 3,
            logProgress: true,
            ignoreErrors: true,
            onlyWhatsApp: true,
            force: true
        },
        
        // Nettoyage à la fermeture (maximum)
        applicationExit: {
            maxConcurrent: 5,
            logProgress: true,
            ignoreErrors: true,
            onlyWhatsApp: false, // Nettoyer tous les services
            force: true
        },
        
        // Nettoyage manuel (configurable)
        manual: {
            maxConcurrent: 3,
            logProgress: true,
            ignoreErrors: false, // Ne pas ignorer les erreurs en mode manuel
            onlyWhatsApp: true
        }
    };
    
    return {
        ...baseOptions,
        ...(contextOptions[context] || {}),
        ...overrides
    };
}

/**
 * Configuration d'environnement
 */
function getEnvironmentConfig() {
    const env = process.env.NODE_ENV || 'development';
    
    const envConfigs = {
        development: {
            enabled: false,  // Désactivé par défaut en dev
            logProgress: true,
            ignoreErrors: true
        },
        
        staging: {
            enabled: true,   // Activé en staging
            logProgress: true,
            ignoreErrors: true
        },
        
        production: {
            enabled: true,   // Activé en production
            logProgress: false, // Moins de logs en prod
            ignoreErrors: true
        },
        
        testing: {
            enabled: false,  // Désactivé pour les tests
            logProgress: false,
            ignoreErrors: true
        }
    };
    
    return envConfigs[env] || envConfigs.development;
}

/**
 * Merger la configuration avec l'environnement
 */
function getFinalCleanupConfig(context = 'default', overrides = {}) {
    const baseOptions = createCleanupOptions(context);
    const envConfig = getEnvironmentConfig();
    
    return {
        ...baseOptions,
        ...envConfig,
        ...overrides
    };
}

module.exports = {
    CLEANUP_CONFIG,
    getGlobalSMSCleanupConfig,
    isGlobalSMSCleanupEnabled,
    getGlobalSMSCleanupOptions,
    isTriggerEnabled,
    createCleanupOptions,
    getEnvironmentConfig,
    getFinalCleanupConfig
};