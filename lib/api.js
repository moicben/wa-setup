/**
 * Fonctions API communes pour le projet WA Setup
 */

const { 
    MORELOGIN_CONFIG, 
    TIMEOUTS, 
    PHONE_STATUS,
    PROXY_STATUS 
} = require('./constants');
const { 
    getAuthHeaders, 
    getPhoneStatusText, 
    getProxyTypeText,
    withTimeout,
    retryWithBackoff 
} = require('./utils');

/**
 * Effectue une requête HTTP vers l'API MoreLogin locale (sans authentification)
 */
async function makeLocalApiRequest(endpoint, method = 'POST', data = null) {
    const fetch = (await import('node-fetch')).default;
    const url = `${MORELOGIN_CONFIG.baseUrl}${endpoint}`;
    
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        console.log(`📡 Requête API locale: ${method} ${url}`);
        
        const response = await withTimeout(
            fetch(url, options),
            TIMEOUTS.API_REQUEST,
            'Timeout de requête API'
        );
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${response.statusText}\nRéponse: ${errorText}`);
        }
        
        const result = await response.json();
        
        if (result.code !== 0) {
            throw new Error(`Erreur API: ${result.msg || 'Erreur inconnue'} (Code: ${result.code})`);
        }
        
        return result;
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            throw new Error('MoreLogin n\'est pas démarré ou l\'API locale n\'est pas accessible sur localhost:40000');
        }
        console.error(`❌ Erreur lors de la requête API: ${error.message}`);
        throw error;
    }
}

/**
 * Effectue une requête HTTP vers l'API MoreLogin avec authentification
 */
async function makeAuthenticatedApiRequest(endpoint, method = 'POST', data = null) {
    const fetch = (await import('node-fetch')).default;
    const url = `${MORELOGIN_CONFIG.baseUrl}${endpoint}`;
    
    const options = {
        method,
        headers: getAuthHeaders()
    };
    
    if (data) {
        options.body = JSON.stringify(data);
    }
    
    try {
        console.log(`📡 Requête API authentifiée: ${method} ${url}`);
        if (data) {
            console.log(`📋 Données envoyées:`, JSON.stringify(data, null, 2));
        }
        
        const response = await withTimeout(
            fetch(url, options),
            TIMEOUTS.API_REQUEST,
            'Timeout de requête API authentifiée'
        );
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${response.statusText}\nRéponse: ${errorText}`);
        }
        
        const result = await response.json();
        console.log(`📨 Réponse reçue:`, JSON.stringify(result, null, 2));
        
        if (result.code !== 0) {
            throw new Error(`Erreur API: ${result.msg || 'Erreur inconnue'} (Code: ${result.code})`);
        }
        
        return result;
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            throw new Error('MoreLogin n\'est pas démarré ou l\'API n\'est pas accessible. Vérifiez que MoreLogin est lancé et l\'API activée.');
        }
        console.error(`❌ Erreur lors de la requête API: ${error.message}`);
        throw error;
    }
}

/**
 * Vérifie la disponibilité de l'API MoreLogin
 */
async function checkApiAvailability() {
    console.log('🔍 Vérification de la disponibilité de l\'API MoreLogin...');
    
    try {
        // Essayer d'abord l'API locale
        await makeLocalApiRequest('/api/cloudphone/page', 'POST', { pageNo: 1, pageSize: 1 });
        console.log('✅ API locale MoreLogin accessible');
        return 'local';
    } catch (localError) {
        console.log('⚠️ API locale non accessible, tentative avec authentification...');
        
        try {
            // Essayer avec authentification
            await makeAuthenticatedApiRequest('/api/cloudphone/page', 'POST', { pageNo: 1, pageSize: 1 });
            console.log('✅ API MoreLogin accessible avec authentification');
            return 'authenticated';
        } catch (authError) {
            throw new Error(`Impossible d'accéder à l'API MoreLogin:\n- Local: ${localError.message}\n- Authentifié: ${authError.message}`);
        }
    }
}

/**
 * Récupère la liste des cloud phones existants
 */
async function getCloudPhoneList(apiType = 'local', pageSize = 20) {
    console.log('📱 Récupération de la liste des téléphones cloud...');
    
    const data = {
        pageNo: 1,
        pageSize: pageSize
    };
    
    const makeRequest = apiType === 'local' ? makeLocalApiRequest : makeAuthenticatedApiRequest;
    const result = await makeRequest('/api/cloudphone/page', 'POST', data);
    
    const phones = result.data.dataList || [];
    console.log(`📊 ${phones.length} téléphone(s) trouvé(s)`);
    
    phones.forEach((phone, index) => {
        console.log(`  ${index + 1}. ${phone.envName} (ID: ${phone.id}) - ${getPhoneStatusText(phone.envStatus)}`);
    });
    
    return phones;
}

/**
 * Démarre un téléphone cloud
 */
async function startCloudPhone(phoneId, apiType = 'local') {
    console.log(`🚀 Démarrage du téléphone cloud ID: ${phoneId}...`);
    
    const data = { id: phoneId };
    const makeRequest = apiType === 'local' ? makeLocalApiRequest : makeAuthenticatedApiRequest;
    const result = await makeRequest('/api/cloudphone/powerOn', 'POST', data);
    
    console.log('✅ Téléphone cloud démarré avec succès');
    return result;
}

/**
 * Active ADB pour un téléphone cloud
 */
async function enableADB(phoneId, apiType = 'local') {
    console.log(`🔧 Activation d'ADB pour le téléphone ID: ${phoneId}...`);
    
    const data = {
        ids: [phoneId],
        enableAdb: true
    };
    
    const makeRequest = apiType === 'local' ? makeLocalApiRequest : makeAuthenticatedApiRequest;
    const result = await makeRequest('/api/cloudphone/updateAdb', 'POST', data);
    
    console.log('✅ ADB activé avec succès');
    return result;
}

/**
 * Récupère les informations ADB d'un téléphone
 */
async function getADBInfo(phoneId, apiType = 'local') {
    console.log(`ℹ️ Récupération des informations ADB...`);
    
    const phones = await getCloudPhoneList(apiType, 50);
    const phone = phones.find(p => p.id === phoneId);
    
    if (!phone) {
        throw new Error(`Téléphone avec l'ID ${phoneId} non trouvé`);
    }
    
    if (phone.adbInfo && phone.adbInfo.success) {
        console.log(`✅ Informations ADB récupérées`);
        return phone.adbInfo;
    }
    
    throw new Error('Informations ADB non disponibles');
}

/**
 * Récupère la liste des proxies disponibles
 */
async function getAvailableProxies(apiType = 'local', pageSize = 50) {
    console.log('🌐 Récupération de la liste des proxies...');
    
    const data = {
        pageNo: 1,
        pageSize: pageSize
    };
    
    try {
        const makeRequest = apiType === 'local' ? makeLocalApiRequest : makeAuthenticatedApiRequest;
        const result = await makeRequest('/api/proxyInfo/page', 'POST', data);
        
        const proxies = result.data.dataList || [];
        console.log(`📊 ${proxies.length} proxy(ies) trouvé(s)`);
        
        proxies.forEach((proxy, index) => {
            const status = proxy.status === PROXY_STATUS.ACTIVE ? '✅ Actif' : '❌ Inactif';
            const type = getProxyTypeText(proxy.proxyType);
            console.log(`  ${index + 1}. ${proxy.proxyName || 'Sans nom'} (ID: ${proxy.id}) - ${type} - ${status}`);
            if (proxy.proxyHost) {
                console.log(`     ${proxy.proxyHost}:${proxy.proxyPort}`);
            }
        });
        
        return proxies;
    } catch (error) {
        console.error(`❌ Erreur lors de la récupération des proxies: ${error.message}`);
        return [];
    }
}

/**
 * Assigne un proxy à un cloud phone
 */
async function assignProxyToCloudPhone(phoneIds, proxyId, apiType = 'local') {
    console.log(`🔗 Assignation du proxy ${proxyId} aux cloud phones ${phoneIds}...`);
    
    // S'assurer que phoneIds est un tableau
    const idsArray = Array.isArray(phoneIds) ? phoneIds : [phoneIds];
    
    const data = {
        id: idsArray,
        proxyId: parseInt(proxyId)
    };
    
    try {
        const makeRequest = apiType === 'local' ? makeLocalApiRequest : makeAuthenticatedApiRequest;
        const result = await makeRequest('/api/cloudphone/edit/batch', 'POST', data);
        console.log('✅ Proxy assigné avec succès aux cloud phones !');
        return result;
    } catch (error) {
        console.error(`❌ Erreur lors de l'assignation du proxy: ${error.message}`);
        throw error;
    }
}

/**
 * Active un proxy
 */
async function activateProxy(proxyId, apiType = 'local') {
    console.log(`🔄 Activation du proxy ${proxyId}...`);
    
    const data = {
        id: proxyId,
        status: PROXY_STATUS.ACTIVE
    };
    
    try {
        const makeRequest = apiType === 'local' ? makeLocalApiRequest : makeAuthenticatedApiRequest;
        const result = await makeRequest('/api/proxyInfo/edit', 'POST', data);
        
        console.log('✅ Proxy activé avec succès !');
        return result;
    } catch (error) {
        console.error(`❌ Erreur lors de l'activation du proxy: ${error.message}`);
        throw error;
    }
}

/**
 * Crée un nouveau cloud phone
 */
async function createCloudPhone(quantity, skuId, envName, proxyId = null) {
    console.log(`🚀 Création de ${quantity} nouveau(x) cloud phone(s)...`);
    
    const data = {
        quantity: quantity,
        skuId: skuId,
        envName: envName
    };
    
    // Ajouter le proxy s'il est fourni
    if (proxyId) {
        data.proxyId = parseInt(proxyId);
        console.log(`🌐 Proxy ID ${proxyId} sera assigné automatiquement lors de la création`);
    }
    
    console.log('📋 Paramètres de création:');
    console.log(`   - Quantité: ${data.quantity}`);
    console.log(`   - SKU: ${data.skuId}`);
    console.log(`   - Nom: ${data.envName}`);
    if (data.proxyId) {
        console.log(`   - Proxy ID: ${data.proxyId}`);
    }
    
    try {
        const result = await makeAuthenticatedApiRequest('/api/cloudphone/create', 'POST', data);
        
        console.log('✅ Cloud phone créé avec succès !');
        if (data.proxyId) {
            console.log('✅ Proxy assigné automatiquement lors de la création !');
        }
        
        return result.data;
        
    } catch (error) {
        console.error('❌ Échec de la création du cloud phone');
        
        // Messages d'erreur spécifiques
        if (error.message.includes('insufficient balance') || error.message.includes('solde insuffisant')) {
            console.error('💳 Erreur: Solde insuffisant pour créer un cloud phone');
            console.error('   Veuillez recharger votre compte MoreLogin');
        } else if (error.message.includes('quota exceeded') || error.message.includes('quota dépassé')) {
            console.error('📊 Erreur: Quota de cloud phones dépassé');
            console.error('   Vérifiez les limites de votre plan MoreLogin');
        } else if (error.message.includes('unauthorized') || error.message.includes('authentication')) {
            console.error('🔐 Erreur d\'authentification');
            console.error('   Vérifiez vos clés API dans le fichier .env');
        }
        
        throw error;
    }
}

module.exports = {
    makeLocalApiRequest,
    makeAuthenticatedApiRequest,
    checkApiAvailability,
    getCloudPhoneList,
    startCloudPhone,
    enableADB,
    getADBInfo,
    getAvailableProxies,
    assignProxyToCloudPhone,
    activateProxy,
    createCloudPhone
}; 