/**
 * ProxyRotator - Gestionnaire de rotation des proxies pour géolocalisation
 * Gestion des proxies UK/FR dédiés avec rotation intelligente et validation géo-IP
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class ProxyRotator {
    constructor(config = {}) {
        this.config = {
            proxies: config.proxies || [],
            rotationInterval: config.rotationInterval || 300000, // 5 minutes
            healthCheckInterval: config.healthCheckInterval || 60000, // 1 minute
            maxRetries: config.maxRetries || 3,
            timeout: config.timeout || 10000,
            geoValidationUrl: config.geoValidationUrl || 'https://ipapi.co/json/',
            allowedCountries: config.allowedCountries || ['UK', 'FR', 'GB'],
            ...config
        };

        // État des proxies
        this.proxies = new Map(); // proxyId -> ProxyInfo
        this.activeProxies = new Map(); // country -> ProxyInfo
        this.proxyQueue = {
            UK: [],
            FR: []
        };
        
        // Métriques
        this.metrics = {
            totalProxies: 0,
            activeProxies: 0,
            healthyProxies: 0,
            rotations: 0,
            geoValidations: 0,
            failures: 0,
            responseTime: {
                avg: 0,
                min: Infinity,
                max: 0
            }
        };

        // Timers
        this.rotationTimer = null;
        this.healthCheckTimer = null;
        
        this.initialized = false;
    }

    /**
     * Initialiser le gestionnaire
     */
    async initialize() {
        try {
            console.log('🌐 Initialisation ProxyRotator...');
            
            // Charger les proxies configurés
            await this._loadProxies();
            
            // Valider tous les proxies
            await this._validateAllProxies();
            
            // Démarrer les timers
            this._startRotationTimer();
            this._startHealthCheckTimer();
            
            this.initialized = true;
            console.log(`✅ ProxyRotator prêt (${this.metrics.healthyProxies}/${this.metrics.totalProxies} proxies sains)`);
            
            return true;
            
        } catch (error) {
            this.initialized = false;
            throw new Error(`Initialisation ProxyRotator échouée: ${error.message}`);
        }
    }

    /**
     * Obtenir un proxy pour un pays spécifique
     */
    async getProxy(country) {
        try {
            this._checkInitialized();
            
            const normalizedCountry = this._normalizeCountry(country);
            
            // Vérifier si un proxy est déjà actif pour ce pays
            const activeProxy = this.activeProxies.get(normalizedCountry);
            if (activeProxy && activeProxy.status === 'healthy') {
                return activeProxy;
            }

            // Trouver un proxy disponible
            const availableProxy = await this._findAvailableProxy(normalizedCountry);
            
            if (!availableProxy) {
                throw new Error(`Aucun proxy ${normalizedCountry} disponible`);
            }

            // Activer le proxy
            await this._activateProxy(availableProxy, normalizedCountry);
            
            return availableProxy;
            
        } catch (error) {
            this.metrics.failures++;
            throw error;
        }
    }

    /**
     * Forcer la rotation d'un proxy
     */
    async rotateProxy(country) {
        try {
            this._checkInitialized();
            
            const normalizedCountry = this._normalizeCountry(country);
            
            console.log(`🔄 Rotation proxy ${normalizedCountry}...`);

            // Désactiver le proxy actuel
            const currentProxy = this.activeProxies.get(normalizedCountry);
            if (currentProxy) {
                await this._deactivateProxy(currentProxy, normalizedCountry);
            }

            // Activer un nouveau proxy
            const newProxy = await this._findAvailableProxy(normalizedCountry);
            if (newProxy) {
                await this._activateProxy(newProxy, normalizedCountry);
                console.log(`✅ Proxy ${normalizedCountry} roté: ${newProxy.id}`);
            } else {
                console.warn(`⚠️ Aucun proxy ${normalizedCountry} disponible pour rotation`);
            }

            this.metrics.rotations++;
            return newProxy;
            
        } catch (error) {
            this.metrics.failures++;
            throw error;
        }
    }

    /**
     * Valider la géolocalisation d'un proxy
     */
    async validateProxyGeolocation(proxy) {
        try {
            const startTime = Date.now();
            
            console.log(`🌍 Validation géolocalisation proxy ${proxy.id}...`);
            
            // Faire une requête via le proxy
            const geoData = await this._makeProxyRequest(proxy, this.config.geoValidationUrl);
            
            // Analyser la réponse
            const responseTime = Date.now() - startTime;
            const location = this._parseGeoResponse(geoData);
            
            // Valider le pays
            const isValidCountry = this._validateCountry(location.country, proxy.expectedCountry);
            
            // Mettre à jour les métriques
            this._updateResponseTime(responseTime);
            this.metrics.geoValidations++;
            
            const validation = {
                isValid: isValidCountry,
                location,
                responseTime,
                timestamp: Date.now()
            };

            console.log(`${isValidCountry ? '✅' : '❌'} Proxy ${proxy.id}: ${location.country} (${responseTime}ms)`);
            
            return validation;
            
        } catch (error) {
            console.error(`❌ Validation géolocalisation proxy ${proxy.id} échouée: ${error.message}`);
            
            return {
                isValid: false,
                error: error.message,
                responseTime: null,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Obtenir les métriques détaillées
     */
    getMetrics() {
        const proxiesByCountry = {
            UK: this.proxyQueue.UK.length,
            FR: this.proxyQueue.FR.length
        };

        const activeProxiesByCountry = {
            UK: this.activeProxies.has('UK') ? 1 : 0,
            FR: this.activeProxies.has('FR') ? 1 : 0
        };

        return {
            ...this.metrics,
            proxiesByCountry,
            activeProxiesByCountry,
            queueSizes: {
                UK: this.proxyQueue.UK.length,
                FR: this.proxyQueue.FR.length
            }
        };
    }

    /**
     * Obtenir le statut des proxies
     */
    getProxiesStatus() {
        const proxies = Array.from(this.proxies.values());
        
        return {
            total: proxies.length,
            healthy: proxies.filter(p => p.status === 'healthy').length,
            unhealthy: proxies.filter(p => p.status === 'unhealthy').length,
            active: this.activeProxies.size,
            byCountry: {
                UK: proxies.filter(p => p.expectedCountry === 'UK').length,
                FR: proxies.filter(p => p.expectedCountry === 'FR').length
            }
        };
    }

    /**
     * Charger les proxies depuis la configuration
     */
    async _loadProxies() {
        if (!this.config.proxies || this.config.proxies.length === 0) {
            // Proxies par défaut pour développement
            this.config.proxies = [
                { id: 'uk-proxy-1', host: 'uk1.proxy.com', port: 8080, username: 'user1', password: 'pass1', country: 'UK' },
                { id: 'uk-proxy-2', host: 'uk2.proxy.com', port: 8080, username: 'user2', password: 'pass2', country: 'UK' },
                { id: 'fr-proxy-1', host: 'fr1.proxy.com', port: 8080, username: 'user3', password: 'pass3', country: 'FR' },
                { id: 'fr-proxy-2', host: 'fr2.proxy.com', port: 8080, username: 'user4', password: 'pass4', country: 'FR' }
            ];
        }

        for (const proxyConfig of this.config.proxies) {
            const proxy = {
                id: proxyConfig.id,
                host: proxyConfig.host,
                port: proxyConfig.port,
                username: proxyConfig.username,
                password: proxyConfig.password,
                expectedCountry: this._normalizeCountry(proxyConfig.country),
                status: 'unknown',
                lastCheck: null,
                lastValidation: null,
                responseTime: null,
                failureCount: 0,
                successCount: 0
            };

            this.proxies.set(proxy.id, proxy);
            this.metrics.totalProxies++;
        }
    }

    /**
     * Valider tous les proxies
     */
    async _validateAllProxies() {
        const validationPromises = Array.from(this.proxies.values())
            .map(proxy => this._validateProxy(proxy));

        await Promise.allSettled(validationPromises);
        
        // Organiser les proxies par pays
        this._organizeProxiesByCountry();
    }

    /**
     * Valider un proxy individuel
     */
    async _validateProxy(proxy) {
        try {
            // Vérifier la connectivité
            const healthCheck = await this._checkProxyHealth(proxy);
            
            if (!healthCheck.isHealthy) {
                proxy.status = 'unhealthy';
                proxy.failureCount++;
                return false;
            }

            // Valider la géolocalisation
            const geoValidation = await this.validateProxyGeolocation(proxy);
            
            if (!geoValidation.isValid) {
                proxy.status = 'unhealthy';
                proxy.failureCount++;
                return false;
            }

            // Proxy valide
            proxy.status = 'healthy';
            proxy.lastCheck = Date.now();
            proxy.lastValidation = geoValidation;
            proxy.responseTime = geoValidation.responseTime;
            proxy.successCount++;
            
            this.metrics.healthyProxies++;
            
            return true;
            
        } catch (error) {
            proxy.status = 'unhealthy';
            proxy.failureCount++;
            console.error(`❌ Validation proxy ${proxy.id} échouée: ${error.message}`);
            return false;
        }
    }

    /**
     * Vérifier la santé d'un proxy
     */
    async _checkProxyHealth(proxy) {
        try {
            const startTime = Date.now();
            
            // Test de connectivité simple
            await this._testProxyConnectivity(proxy);
            
            const responseTime = Date.now() - startTime;
            
            return {
                isHealthy: responseTime < this.config.timeout,
                responseTime
            };
            
        } catch (error) {
            return {
                isHealthy: false,
                error: error.message
            };
        }
    }

    /**
     * Tester la connectivité du proxy
     */
    async _testProxyConnectivity(proxy) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: proxy.host,
                port: proxy.port,
                method: 'CONNECT',
                path: 'google.com:80',
                timeout: this.config.timeout
            };

            if (proxy.username && proxy.password) {
                const auth = Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64');
                options.headers = {
                    'Proxy-Authorization': `Basic ${auth}`
                };
            }

            const req = http.request(options);
            
            req.on('connect', () => {
                req.end();
                resolve();
            });
            
            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Timeout')));
            
            req.end();
        });
    }

    /**
     * Faire une requête via un proxy
     */
    async _makeProxyRequest(proxy, url) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            
            const options = {
                hostname: proxy.host,
                port: proxy.port,
                method: 'GET',
                path: url,
                timeout: this.config.timeout,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            };

            if (proxy.username && proxy.password) {
                const auth = Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64');
                options.headers['Proxy-Authorization'] = `Basic ${auth}`;
            }

            const client = isHttps ? https : http;
            const req = client.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed);
                    } catch (error) {
                        reject(new Error(`Réponse invalide: ${data}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Timeout')));
            req.end();
        });
    }

    /**
     * Parser la réponse géographique
     */
    _parseGeoResponse(geoData) {
        return {
            country: geoData.country_code || geoData.country || 'UNKNOWN',
            city: geoData.city || 'UNKNOWN',
            region: geoData.region || 'UNKNOWN',
            ip: geoData.ip || 'UNKNOWN',
            timezone: geoData.timezone || 'UNKNOWN'
        };
    }

    /**
     * Valider le pays
     */
    _validateCountry(detectedCountry, expectedCountry) {
        const normalizedDetected = this._normalizeCountry(detectedCountry);
        const normalizedExpected = this._normalizeCountry(expectedCountry);
        
        return normalizedDetected === normalizedExpected;
    }

    /**
     * Normaliser le code pays
     */
    _normalizeCountry(country) {
        if (!country) return 'UNKNOWN';
        
        const normalized = country.toUpperCase();
        
        // Conversion GB -> UK
        if (normalized === 'GB') return 'UK';
        
        return normalized;
    }

    /**
     * Organiser les proxies par pays
     */
    _organizeProxiesByCountry() {
        this.proxyQueue.UK = [];
        this.proxyQueue.FR = [];

        for (const proxy of this.proxies.values()) {
            if (proxy.status === 'healthy') {
                if (proxy.expectedCountry === 'UK') {
                    this.proxyQueue.UK.push(proxy);
                } else if (proxy.expectedCountry === 'FR') {
                    this.proxyQueue.FR.push(proxy);
                }
            }
        }

        // Trier par temps de réponse
        this.proxyQueue.UK.sort((a, b) => (a.responseTime || 0) - (b.responseTime || 0));
        this.proxyQueue.FR.sort((a, b) => (a.responseTime || 0) - (b.responseTime || 0));
    }

    /**
     * Trouver un proxy disponible
     */
    async _findAvailableProxy(country) {
        const queue = this.proxyQueue[country];
        
        if (!queue || queue.length === 0) {
            return null;
        }

        // Rotation round-robin
        const proxy = queue.shift();
        queue.push(proxy);
        
        return proxy;
    }

    /**
     * Activer un proxy
     */
    async _activateProxy(proxy, country) {
        this.activeProxies.set(country, proxy);
        this.metrics.activeProxies++;
        
        console.log(`🔄 Proxy ${country} activé: ${proxy.id} (${proxy.responseTime}ms)`);
    }

    /**
     * Désactiver un proxy
     */
    async _deactivateProxy(proxy, country) {
        this.activeProxies.delete(country);
        this.metrics.activeProxies--;
        
        console.log(`⏸️ Proxy ${country} désactivé: ${proxy.id}`);
    }

    /**
     * Mettre à jour les métriques de temps de réponse
     */
    _updateResponseTime(responseTime) {
        this.metrics.responseTime.avg = 
            (this.metrics.responseTime.avg + responseTime) / 2;
        
        this.metrics.responseTime.min = 
            Math.min(this.metrics.responseTime.min, responseTime);
        
        this.metrics.responseTime.max = 
            Math.max(this.metrics.responseTime.max, responseTime);
    }

    /**
     * Démarrer la rotation automatique
     */
    _startRotationTimer() {
        this.rotationTimer = setInterval(() => {
            this.rotateProxy('UK').catch(console.error);
            this.rotateProxy('FR').catch(console.error);
        }, this.config.rotationInterval);
    }

    /**
     * Démarrer la vérification de santé
     */
    _startHealthCheckTimer() {
        this.healthCheckTimer = setInterval(() => {
            this._performHealthCheck().catch(console.error);
        }, this.config.healthCheckInterval);
    }

    /**
     * Effectuer une vérification de santé
     */
    async _performHealthCheck() {
        console.log('🔍 Vérification santé proxies...');
        
        const checkPromises = Array.from(this.proxies.values())
            .map(proxy => this._validateProxy(proxy));

        await Promise.allSettled(checkPromises);
        
        // Réorganiser les queues
        this._organizeProxiesByCountry();
        
        console.log(`✅ Vérification terminée: ${this.metrics.healthyProxies}/${this.metrics.totalProxies} proxies sains`);
    }

    /**
     * Vérifier l'initialisation
     */
    _checkInitialized() {
        if (!this.initialized) {
            throw new Error('ProxyRotator non initialisé - appelez initialize() d\'abord');
        }
    }

    /**
     * Nettoyage et fermeture
     */
    async cleanup() {
        try {
            console.log('🧹 Nettoyage ProxyRotator...');
            
            // Arrêter les timers
            if (this.rotationTimer) {
                clearInterval(this.rotationTimer);
            }
            
            if (this.healthCheckTimer) {
                clearInterval(this.healthCheckTimer);
            }
            
            // Nettoyer les états
            this.activeProxies.clear();
            this.proxyQueue.UK = [];
            this.proxyQueue.FR = [];
            
            this.initialized = false;
            console.log('✅ ProxyRotator nettoyé');
            
        } catch (error) {
            console.error(`❌ Erreur nettoyage: ${error.message}`);
        }
    }
}

module.exports = { ProxyRotator }; 