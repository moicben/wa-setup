/**
 * Fonctions utilitaires communes pour le projet WA Setup
 */

const crypto = require('crypto');
const {
    MORELOGIN_CONFIG,
    PHONE_STATUS_TEXT,
    PROXY_TYPE_TEXT,
    TIMEOUTS
} = require('./constants.js');

/**
 * Génère un nonce unique pour l'authentification
 */
function generateNonce() {
    return Date.now().toString() + Math.random().toString(36).substring(2);
}

/**
 * Génère le hash MD5 pour l'authentification API
 */
function generateAuthHash(apiId, nonce, apiSecret) {
    const data = apiId + nonce + apiSecret;
    return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Génère les headers d'authentification requis pour l'API MoreLogin
 */
function getAuthHeaders() {
    if (!MORELOGIN_CONFIG.apiId || !MORELOGIN_CONFIG.apiSecret) {
        throw new Error('API ID et API Key requis. Configurez MORELOGIN_API_ID et MORELOGIN_API_KEY dans votre fichier .env');
    }

    const nonce = generateNonce();
    const authHash = generateAuthHash(MORELOGIN_CONFIG.apiId, nonce, MORELOGIN_CONFIG.apiSecret);

    return {
        'X-Api-Id': MORELOGIN_CONFIG.apiId,
        'X-Nonce-Id': nonce,
        'Authorization': authHash,
        'Content-Type': 'application/json'
    };
}

/**
 * Retourne le texte lisible du statut d'un téléphone
 */
function getPhoneStatusText(status) {
    return PHONE_STATUS_TEXT[status] || `❓ Statut inconnu (${status})`;
}

/**
 * Retourne le texte lisible du type de proxy
 */
function getProxyTypeText(proxyType) {
    return PROXY_TYPE_TEXT[proxyType] || `Type ${proxyType}`;
}

/**
 * Valide la configuration de l'application
 */
function validateConfiguration() {
    const errors = [];

    // Vérifier les variables d'environnement MoreLogin
    if (!MORELOGIN_CONFIG.apiId) {
        errors.push('❌ MORELOGIN_API_ID manquant dans les variables d\'environnement');
    }

    if (!MORELOGIN_CONFIG.apiSecret) {
        errors.push('❌ MORELOGIN_API_KEY manquant dans les variables d\'environnement');
    }

    // Vérifier la validité des IDs (doivent être numériques)
    if (MORELOGIN_CONFIG.apiId && isNaN(MORELOGIN_CONFIG.apiId)) {
        errors.push('❌ MORELOGIN_API_ID doit être numérique');
    }

    if (errors.length > 0) {
        console.error('💥 Erreurs de configuration détectées:');
        errors.forEach(error => console.error(`   ${error}`));
        console.error('\n📝 Vérifiez votre fichier .env ou vos variables d\'environnement');
        console.error('💡 Exemple de configuration:');
        console.error('   MORELOGIN_API_ID=1646630984117576');
        console.error('   MORELOGIN_API_KEY=b97e5f1ee08047a589dfb17735037bbc');
        return false;
    }

    console.log('✅ Configuration API complète');
    return true;
}

/**
 * Trouve un téléphone dans une liste par différents critères
 */
function findPhone(phones, identifier) {
    if (!identifier) {
        return phones[0]; // Premier téléphone par défaut
    }

    // Essayer par ID exact
    let phone = phones.find(p => p.id === identifier);
    if (phone) return phone;

    // Essayer par nom exact
    phone = phones.find(p => p.envName === identifier);
    if (phone) return phone;

    // Essayer par nom partiel (insensible à la casse)
    phone = phones.find(p => p.envName.toLowerCase().includes(identifier.toLowerCase()));
    if (phone) return phone;

    // Essayer par index (1-based)
    const index = parseInt(identifier);
    if (!isNaN(index) && index >= 1 && index <= phones.length) {
        return phones[index - 1];
    }

    return null;
}

/**
 * Trouve le meilleur proxy residential disponible
 */
function findBestResidentialProxy(proxies) {
    // Chercher un proxy residential actif
    const residentialProxies = proxies.filter(proxy => 
        proxy.status === 1 && // Actif
        (proxy.proxyName?.toLowerCase().includes('residential') || 
         proxy.proxyName?.toLowerCase().includes('résidentiel'))
    );

    if (residentialProxies.length > 0) {
        return residentialProxies[0]; // Prendre le premier proxy residential actif
    }

    // Si pas de proxy spécifiquement "residential", prendre le premier proxy actif
    const activeProxies = proxies.filter(proxy => proxy.status === 1);
    if (activeProxies.length > 0) {
        console.log('⚠️ Aucun proxy residential trouvé, utilisation du premier proxy actif');
        return activeProxies[0];
    }

    return null;
}

/**
 * Attendre un délai spécifié (utilitaire pour les timeouts)
 */
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exécute une fonction avec un timeout
 */
function withTimeout(promise, timeoutMs, errorMessage = 'Timeout') {
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    );
    
    return Promise.race([promise, timeoutPromise]);
}

/**
 * Retry une fonction avec un nombre maximum de tentatives
 */
async function retryWithBackoff(fn, maxRetries, baseDelay = 1000, maxDelay = 30000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            if (attempt < maxRetries) {
                const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
                console.log(`⏳ Tentative ${attempt}/${maxRetries} échouée, retry dans ${delay}ms...`);
                await wait(delay);
            }
        }
    }
    
    throw lastError;
}

/**
 * Formate une durée en millisecondes en texte lisible
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

module.exports = {
    generateNonce,
    generateAuthHash,
    getAuthHeaders,
    getPhoneStatusText,
    getProxyTypeText,
    validateConfiguration,
    findPhone,
    findBestResidentialProxy,
    wait,
    withTimeout,
    retryWithBackoff,
    formatDuration
}; 