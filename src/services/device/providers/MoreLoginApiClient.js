/**
 * MoreLoginApiClient - Client API pour MoreLogin
 * Gère toutes les interactions avec l'API MoreLogin locale
 */

const https = require('https');
const http = require('http');

class MoreLoginApiClient {
    constructor(config = {}) {
        // Validation de configuration
        this.config = {
            apiUrl: config.apiUrl || process.env.MORELOGIN_API_URL,
            apiKey: config.apiKey || process.env.MORELOGIN_API_KEY,
            apiId: config.apiId || process.env.MORELOGIN_API_ID,
            timeout: config.timeout || 30000,
            retries: config.retries || 3
        };

        // Validation des paramètres requis
        if (!this.config.apiUrl) {
            throw new Error('MoreLogin API URL est requis (MORELOGIN_API_URL)');
        }
        if (!this.config.apiKey) {
            throw new Error('MoreLogin API Key est requis (MORELOGIN_API_KEY)');
        }
        if (!this.config.apiId) {
            throw new Error('MoreLogin API ID est requis (MORELOGIN_API_ID)');
        }

        // Parser l'URL pour déterminer le protocole
        this.baseUrl = this.config.apiUrl;
        this.isHttps = this.baseUrl.startsWith('https://');
        this.httpModule = this.isHttps ? https : http;

        // Métriques
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            lastRequestTime: null
        };
    }

    /**
     * Effectuer une requête HTTP
     * @param {string} method - Méthode HTTP (GET, POST, DELETE)
     * @param {string} endpoint - Endpoint API
     * @param {Object} data - Données à envoyer (pour POST)
     * @returns {Promise<Object>} Réponse de l'API
     */
    async request(method, endpoint, data = null) {
        const startTime = Date.now();
        this.metrics.totalRequests++;
        
        try {
            const response = await this._makeRequest(method, endpoint, data);
            
            // Mettre à jour les métriques
            const responseTime = Date.now() - startTime;
            this.metrics.successfulRequests++;
            this.metrics.averageResponseTime = 
                (this.metrics.averageResponseTime + responseTime) / 2;
            this.metrics.lastRequestTime = Date.now();
            
            return response;
            
        } catch (error) {
            this.metrics.failedRequests++;
            throw error;
        }
    }

    /**
     * Effectuer la requête HTTP réelle
     * @param {string} method - Méthode HTTP
     * @param {string} endpoint - Endpoint API
     * @param {Object} data - Données à envoyer
     * @returns {Promise<Object>} Réponse parsée
     */
    _makeRequest(method, endpoint, data) {
        return new Promise((resolve, reject) => {
            const url = `${this.baseUrl}${endpoint}`;
            const urlObj = new URL(url);
            
            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`,
                    'X-API-ID': this.config.apiId
                },
                timeout: this.config.timeout
            };

            // Ajouter les données pour POST
            let postData = null;
            if (data && (method === 'POST' || method === 'PUT')) {
                postData = JSON.stringify(data);
                options.headers['Content-Length'] = Buffer.byteLength(postData);
            }

            const req = this.httpModule.request(options, (res) => {
                let body = '';
                
                res.on('data', (chunk) => {
                    body += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const response = body ? JSON.parse(body) : {};
                        
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(response);
                        } else {
                            reject(new Error(`API Error ${res.statusCode}: ${response.message || body}`));
                        }
                    } catch (parseError) {
                        reject(new Error(`Parse error: ${parseError.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Request error: ${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error(`Request timeout (${this.config.timeout}ms)`));
            });

            // Envoyer les données si présentes
            if (postData) {
                req.write(postData);
            }

            req.end();
        });
    }

    /**
     * Vérifier la santé de l'API
     * @returns {Promise<Object>} Statut de l'API
     */
    async healthCheck() {
        try {
            const response = await this.request('GET', '/api/health');
            return {
                status: 'healthy',
                ...response
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    /**
     * Obtenir tous les profils
     * @returns {Promise<Array>} Liste des profils
     */
    async getProfiles() {
        const response = await this.request('GET', '/api/profiles');
        return response.profiles || [];
    }

    /**
     * Créer un nouveau profil
     * @param {Object} profileData - Données du profil
     * @returns {Promise<Object>} Profil créé
     */
    async createProfile(profileData) {
        const response = await this.request('POST', '/api/profile/create', profileData);
        return response;
    }

    /**
     * Créer un profil Phone Cloud Model X avec proxy et ADB
     * @param {Object} options - Options du profil
     * @param {string} options.name - Nom du profil
     * @param {string} options.country - Pays (UK, FR, US)
     * @returns {Promise<Object>} Profil créé avec proxy et ADB
     */
    async createPhoneCloudProfile(options = {}) {
        const { name, country = 'UK' } = options;
        
        // Configuration Phone Cloud Model X
        const profileData = {
            name: name || `PhoneCloud_${Date.now()}`,
            phoneType: 'PhoneCloudModelX',
            country: country,
            enableADB: true,
            autoAssignProxy: true,
            config: {
                deviceModel: 'Samsung Galaxy S21',
                androidVersion: '11',
                resolution: '1080x2400',
                dpi: 420,
                memory: '8GB',
                storage: '256GB'
            }
        };

        const response = await this.request('POST', '/api/profile/create', profileData);
        return response;
    }

    /**
     * Supprimer un profil
     * @param {string} profileId - ID du profil
     * @returns {Promise<boolean>} Succès de la suppression
     */
    async deleteProfile(profileId) {
        await this.request('DELETE', `/api/profile/${profileId}`);
        return true;
    }

    /**
     * Démarrer un profil
     * @param {string} profileId - ID du profil
     * @returns {Promise<Object>} Informations de démarrage
     */
    async startProfile(profileId) {
        const response = await this.request('POST', `/api/profile/${profileId}/start`);
        return response;
    }

    /**
     * Arrêter un profil
     * @param {string} profileId - ID du profil
     * @returns {Promise<boolean>} Succès de l'arrêt
     */
    async stopProfile(profileId) {
        await this.request('POST', `/api/profile/${profileId}/stop`);
        return true;
    }

    /**
     * Obtenir le statut d'un profil
     * @param {string} profileId - ID du profil
     * @returns {Promise<Object>} Statut du profil
     */
    async getProfileStatus(profileId) {
        const response = await this.request('GET', `/api/profile/${profileId}/status`);
        return response;
    }

    /**
     * Obtenir la liste des proxies disponibles
     * @returns {Promise<Array>} Liste des proxies
     */
    async getProxyList() {
        const response = await this.request('GET', '/api/proxy/list');
        return response.proxies || [];
    }

    /**
     * Obtenir les métriques du client
     * @returns {Object} Métriques de performance
     */
    getMetrics() {
        return {
            ...this.metrics,
            successRate: this.metrics.totalRequests > 0 ? 
                (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 : 0,
            config: {
                apiUrl: this.config.apiUrl,
                timeout: this.config.timeout,
                retries: this.config.retries
            }
        };
    }
}

module.exports = { MoreLoginApiClient };