/**
 * Configuration centralisée des timeouts et délais
 * Permet de configurer tous les timeouts depuis un seul endroit
 */

const TIMEOUTS = {
    // SMS Provider timeouts
    SMS: {
        // Délai minimum avant annulation (évite EARLY_CANCEL_DENIED)
        MIN_CANCEL_DELAY: 30000, // 30 secondes
        
        // Timeout pour les appels API SMS
        API_TIMEOUT: 10000, // 10 secondes
        
        // Timeout pour l'attente de réception SMS
        WAIT_SMS_TIMEOUT: 300000, // 5 minutes
        
        // Intervalle de vérification SMS
        SMS_CHECK_INTERVAL: 10000, // 10 secondes
        
        // Timeout pour obtenir le solde
        BALANCE_TIMEOUT: 5000, // 5 secondes
        
        // Timeout pour obtenir les pays supportés
        COUNTRIES_TIMEOUT: 15000, // 15 secondes
        
        // Timeout pour vérifier le statut des numéros
        STATUS_CHECK_TIMEOUT: 8000, // 8 secondes
    },
    
    // Database timeouts
    DATABASE: {
        // Timeout pour les requêtes Supabase
        QUERY_TIMEOUT: 15000, // 15 secondes
        
        // Timeout pour les opérations de création
        CREATE_TIMEOUT: 20000, // 20 secondes
        
        // Timeout pour les opérations de mise à jour
        UPDATE_TIMEOUT: 10000, // 10 secondes
        
        // Délai avant retry des requêtes DB
        RETRY_DELAY: 2000, // 2 secondes
        
        // Nombre maximum de retries pour les requêtes DB
        MAX_RETRIES: 3,
    },
    
    // Workflow timeouts
    WORKFLOW: {
        // Timeout pour l'exécution d'une étape
        STEP_TIMEOUT: 120000, // 2 minutes
        
        // Timeout pour l'initialisation des services
        INIT_TIMEOUT: 30000, // 30 secondes
        
        // Délai entre les retries de workflow
        RETRY_DELAY: 5000, // 5 secondes
        
        // Timeout pour les prises de screenshot
        SCREENSHOT_TIMEOUT: 10000, // 10 secondes
        
        // Timeout pour les actions BlueStack
        BLUESTACK_ACTION_TIMEOUT: 15000, // 15 secondes
    },
    
    // Device/BlueStack timeouts
    DEVICE: {
        // Timeout pour les commandes ADB
        ADB_TIMEOUT: 20000, // 20 secondes
        
        // Timeout pour les actions de clic
        CLICK_TIMEOUT: 5000, // 5 secondes
        
        // Timeout pour la saisie de texte
        INPUT_TIMEOUT: 10000, // 10 secondes
        
        // Délai entre les actions
        ACTION_DELAY: 1000, // 1 seconde
        
        // Timeout pour le démarrage d'application
        APP_START_TIMEOUT: 30000, // 30 secondes
    },
    
    // OCR et analyse timeouts
    OCR: {
        // Timeout pour l'analyse OCR
        ANALYSIS_TIMEOUT: 30000, // 30 secondes
        
        // Timeout pour l'analyse d'erreur SMS
        SMS_ERROR_ANALYSIS_TIMEOUT: 20000, // 20 secondes
        
        // Timeout pour la prise de screenshot
        SCREENSHOT_TIMEOUT: 10000, // 10 secondes
    },
    
    // Network timeouts génériques
    NETWORK: {
        // Timeout par défaut pour les requêtes HTTP
        DEFAULT_HTTP_TIMEOUT: 15000, // 15 secondes
        
        // Timeout pour les requêtes rapides
        FAST_REQUEST_TIMEOUT: 5000, // 5 secondes
        
        // Timeout pour les requêtes lentes
        SLOW_REQUEST_TIMEOUT: 60000, // 1 minute
        
        // Délai avant retry network
        RETRY_DELAY: 1000, // 1 seconde
    }
};

/**
 * Délais spécifiques pour les opérations
 */
const DELAYS = {
    // Délais entre les actions
    ACTION_DELAY: 1000, // 1 seconde
    
    // Délai après erreur avant retry
    ERROR_RETRY_DELAY: 3000, // 3 secondes
    
    // Délai après succès avant action suivante
    SUCCESS_DELAY: 500, // 0.5 seconde
    
    // Délai pour éviter la surcharge API
    API_RATE_LIMIT_DELAY: 500, // 0.5 seconde
    
    // Délai avant annulation SMS (évite EARLY_CANCEL_DENIED)
    SMS_CANCEL_DELAY: 30000, // 30 secondes
    
    // Délai entre les vérifications SMS
    SMS_CHECK_DELAY: 10000, // 10 secondes
    
    // Délai avant cleanup automatique
    CLEANUP_DELAY: 2000, // 2 secondes
};

/**
 * Backoff exponentiel pour les retries
 */
const BACKOFF = {
    // Facteur de multiplication pour backoff
    MULTIPLIER: 2,
    
    // Délai initial
    INITIAL_DELAY: 1000, // 1 seconde
    
    // Délai maximum
    MAX_DELAY: 30000, // 30 secondes
    
    // Ajouter du jitter (randomness)
    JITTER: true,
    
    // Fonction de calcul du délai
    calculateDelay(attempt, baseDelay = BACKOFF.INITIAL_DELAY) {
        let delay = baseDelay * Math.pow(BACKOFF.MULTIPLIER, attempt - 1);
        delay = Math.min(delay, BACKOFF.MAX_DELAY);
        
        // Ajouter du jitter pour éviter les pics de charge
        if (BACKOFF.JITTER) {
            delay = delay + (Math.random() * 1000); // +0-1s de jitter
        }
        
        return Math.round(delay);
    }
};

/**
 * Configuration environnementale des timeouts
 */
const ENV_TIMEOUTS = {
    development: {
        // Timeouts plus longs en développement
        multiplier: 2,
        enableDebugDelays: true
    },
    
    production: {
        // Timeouts optimisés pour production
        multiplier: 1,
        enableDebugDelays: false
    },
    
    testing: {
        // Timeouts réduits pour les tests
        multiplier: 0.5,
        enableDebugDelays: false
    }
};

/**
 * Obtenir la configuration de timeout pour l'environnement actuel
 */
function getTimeoutConfig(category, key, environment = process.env.NODE_ENV || 'development') {
    const baseTimeout = TIMEOUTS[category] && TIMEOUTS[category][key];
    if (!baseTimeout) {
        throw new Error(`Timeout configuration not found: ${category}.${key}`);
    }
    
    const envConfig = ENV_TIMEOUTS[environment] || ENV_TIMEOUTS.development;
    const adjustedTimeout = Math.round(baseTimeout * envConfig.multiplier);
    
    return adjustedTimeout;
}

/**
 * Obtenir un délai avec backoff exponentiel
 */
function getBackoffDelay(attempt, baseDelay = DELAYS.ERROR_RETRY_DELAY) {
    return BACKOFF.calculateDelay(attempt, baseDelay);
}

/**
 * Créer un timeout configurable
 */
function createTimeout(category, key, defaultValue = 10000) {
    try {
        return getTimeoutConfig(category, key);
    } catch (error) {
        console.warn(`⚠️ Timeout configuration error: ${error.message}, using default: ${defaultValue}ms`);
        return defaultValue;
    }
}

/**
 * Wrapper pour Promise avec timeout
 */
function withTimeout(promise, timeoutMs, errorMessage = 'Operation timed out') {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
        })
    ]);
}

/**
 * Sleep avec timeout configurable
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry avec backoff exponentiel
 */
async function retryWithBackoff(operation, maxAttempts = 3, baseDelay = DELAYS.ERROR_RETRY_DELAY, context = 'operation') {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(`🔄 Tentative ${attempt}/${maxAttempts} pour ${context}`);
            const result = await operation();
            
            if (attempt > 1) {
                console.log(`✅ Succès après ${attempt} tentatives pour ${context}`);
            }
            
            return result;
        } catch (error) {
            lastError = error;
            console.warn(`⚠️ Tentative ${attempt}/${maxAttempts} échouée pour ${context}: ${error.message}`);
            
            if (attempt < maxAttempts) {
                const delay = getBackoffDelay(attempt, baseDelay);
                console.log(`⏳ Attente ${delay}ms avant retry...`);
                await sleep(delay);
            }
        }
    }
    
    throw new Error(`${context} échoué après ${maxAttempts} tentatives: ${lastError.message}`);
}

module.exports = {
    TIMEOUTS,
    DELAYS,
    BACKOFF,
    ENV_TIMEOUTS,
    getTimeoutConfig,
    getBackoffDelay,
    createTimeout,
    withTimeout,
    sleep,
    retryWithBackoff
};