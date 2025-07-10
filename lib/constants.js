/**
 * Constantes communes pour le projet WA Setup
 */

// Configuration de l'API MoreLogin
const MORELOGIN_CONFIG = {
    baseUrl: process.env.MORELOGIN_API_URL || 'http://127.0.0.1:40000',
    apiId: process.env.MORELOGIN_API_ID,
    apiSecret: process.env.MORELOGIN_API_KEY
};

// SKU IDs pour les différents modèles de cloud phones
const CLOUD_PHONE_MODELS = {
    MODEL_X: 10002,
    MODEL_Y: 10004
};

// Timeouts optimisés (réduites selon le plan d'optimisation)
const TIMEOUTS = {
    API_REQUEST: 15000,        // 15s au lieu de 30s
    ADB_CONNECT: 20000,        // 20s au lieu de 30s
    ADB_TEST: 8000,            // 8s au lieu de 15s
    PHONE_READY: 10000,        // 10s au lieu de 15s
    PHONE_STARTUP: 30000,      // 30s pour le démarrage complet
    ADB_ACTIVATION: 10000      // 10s pour l'activation ADB
};

// Retry intelligents (réduits selon le plan d'optimisation)
const MAX_RETRIES = {
    ADB_ENABLE: 2,             // 2 au lieu de 3
    API_REQUEST: 2,            // 2 au lieu de 3-5
    PHONE_STATUS: 3,           // 3 tentatives pour le statut
    ADB_CONNECT: 2,            // 2 tentatives pour la connexion
    PHONE_READY: 10            // 10 tentatives pour l'état ready
};

// Statuts des téléphones
const PHONE_STATUS = {
    NEW: 0,                    // Nouveau
    CREATION_FAILED: 1,        // Échec de création
    STOPPED: 2,                // Arrêté
    STARTING: 3,               // En cours de démarrage
    STARTED: 4,                // Démarré
    RESETTING: 5               // Réinitialisation en cours
};

// Textes des statuts
const PHONE_STATUS_TEXT = {
    [PHONE_STATUS.NEW]: '🆕 Nouveau',
    [PHONE_STATUS.CREATION_FAILED]: '❌ Échec de création',
    [PHONE_STATUS.STOPPED]: '⏹️ Arrêté',
    [PHONE_STATUS.STARTING]: '🚀 En cours de démarrage',
    [PHONE_STATUS.STARTED]: '✅ Démarré',
    [PHONE_STATUS.RESETTING]: '🔄 Réinitialisation en cours'
};

// Types de proxies
const PROXY_TYPES = {
    HTTP: 1,
    HTTPS: 2,
    SOCKS4: 3,
    SOCKS5: 4,
    SSH: 5
};

// Textes des types de proxies
const PROXY_TYPE_TEXT = {
    [PROXY_TYPES.HTTP]: 'HTTP',
    [PROXY_TYPES.HTTPS]: 'HTTPS',
    [PROXY_TYPES.SOCKS4]: 'SOCKS4',
    [PROXY_TYPES.SOCKS5]: 'SOCKS5',
    [PROXY_TYPES.SSH]: 'SSH'
};

// Statuts des proxies
const PROXY_STATUS = {
    INACTIVE: 0,
    ACTIVE: 1
};

module.exports = {
    MORELOGIN_CONFIG,
    CLOUD_PHONE_MODELS,
    TIMEOUTS,
    MAX_RETRIES,
    PHONE_STATUS,
    PHONE_STATUS_TEXT,
    PROXY_TYPES,
    PROXY_TYPE_TEXT,
    PROXY_STATUS
}; 