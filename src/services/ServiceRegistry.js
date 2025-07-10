/**
 * ServiceRegistry - Registry unifié avec dependency injection
 * Phase 5: Services Unifiés
 * 
 * Gestionnaire centralisé de tous les services avec DI automatique
 */

const { createSMSManager } = require('./sms');
const { createBlueStacksDevice } = require('./device');
const { createWhatsAppService } = require('./whatsapp');
const { getDatabaseManager } = require('../database/DatabaseManager');
const { getAccountRepository } = require('../database/repositories/AccountRepository');
const { getMetricsCollector } = require('../database/collectors/MetricsCollector');

/**
 * Registry central pour tous les services
 */
class ServiceRegistry {
    constructor(config = {}) {
        this.config = config;
        this.services = new Map();
        this.factories = new Map();
        this.dependencies = new Map();
        this.initialized = new Set();
        this.metrics = {
            servicesCreated: 0,
            servicesInitialized: 0,
            dependenciesResolved: 0,
            errors: 0
        };
        
        // Enregistrer les factories par défaut
        this.registerDefaultFactories();
    }

    /**
     * Enregistrer les factories par défaut
     */
    registerDefaultFactories() {
        // Service SMS
        this.registerFactory('sms', async (config) => {
            return await createSMSManager(config);
        });

        // Service Device - Sélection automatique provider
        this.registerFactory('device', async (config) => {
            return await this.createDeviceProvider(config);
        });

        // Service Device MoreLogin conditionnel
        if (process.env.MORELOGIN_API_URL) {
            this.registerFactory('morelogin', async (config) => {
                const { MoreLoginProvider } = require('./device/providers/MoreLoginProvider');
                return new MoreLoginProvider(config);
            });
        }

        // Service Device BlueStacks
        this.registerFactory('bluestacks', async (config) => {
            return await createBlueStacksDevice(config);
        });

        // Service WhatsApp
        this.registerFactory('whatsapp', async (config) => {
            const whatsappService = createWhatsAppService(config);
            // Injection automatique du device
            const deviceService = await this.get('device');
            await whatsappService.initialize(deviceService);
            return whatsappService;
        }, ['device']);

        // Service Database
        this.registerFactory('database', async (config) => {
            const dbManager = getDatabaseManager();
            if (!dbManager.isConnected) {
                await dbManager.initialize();
            }
            return dbManager;
        });

        // Repository Account
        this.registerFactory('accountRepository', async (config) => {
            return getAccountRepository();
        });

        // Collector Metrics
        this.registerFactory('metricsCollector', async (config) => {
            return getMetricsCollector();
        });
    }

    /**
     * Enregistrer une factory de service
     * @param {string} name - Nom du service
     * @param {Function} factory - Factory function
     * @param {Array} deps - Dépendances requises
     */
    registerFactory(name, factory, deps = []) {
        this.factories.set(name, factory);
        this.dependencies.set(name, deps);
        console.log(`📋 Service factory enregistré: ${name} (deps: ${deps.join(', ')})`);
    }

    /**
     * Obtenir un service (avec création automatique)
     * @param {string} name - Nom du service
     * @param {Object} config - Configuration override
     * @returns {Promise<any>} Instance du service
     */
    async get(name, config = {}) {
        try {
            // Vérifier si le service existe déjà
            if (this.services.has(name)) {
                return this.services.get(name);
            }

            // Vérifier si la factory existe
            const factory = this.factories.get(name);
            if (!factory) {
                throw new Error(`Service factory '${name}' not found`);
            }

            // Résoudre les dépendances
            await this.resolveDependencies(name);

            // Créer le service
            const serviceConfig = { ...this.config, ...config };
            const service = await factory(serviceConfig);

            // Enregistrer le service
            this.services.set(name, service);
            this.initialized.add(name);
            this.metrics.servicesCreated++;
            this.metrics.servicesInitialized++;

            console.log(`✅ Service créé: ${name}`);
            return service;

        } catch (error) {
            this.metrics.errors++;
            console.error(`❌ Erreur création service '${name}': ${error.message}`);
            throw error;
        }
    }

    /**
     * Résoudre les dépendances d'un service
     * @param {string} name - Nom du service
     */
    async resolveDependencies(name) {
        const deps = this.dependencies.get(name) || [];
        
        for (const dep of deps) {
            if (!this.services.has(dep)) {
                console.log(`🔄 Résolution dépendance: ${dep} pour ${name}`);
                await this.get(dep);
                this.metrics.dependenciesResolved++;
            }
        }
    }

    /**
     * Enregistrer une instance de service directement
     * @param {string} name - Nom du service
     * @param {any} instance - Instance du service
     */
    register(name, instance) {
        this.services.set(name, instance);
        this.initialized.add(name);
        console.log(`📝 Service enregistré: ${name}`);
    }

    /**
     * Vérifier si un service est disponible
     * @param {string} name - Nom du service
     * @returns {boolean} True si disponible
     */
    has(name) {
        return this.services.has(name) || this.factories.has(name);
    }

    /**
     * Obtenir la liste des services disponibles
     * @returns {Array} Liste des noms de services
     */
    getAvailableServices() {
        const services = Array.from(this.services.keys());
        const factories = Array.from(this.factories.keys());
        return [...new Set([...services, ...factories])];
    }

    /**
     * Obtenir la liste des services initialisés
     * @returns {Array} Liste des services initialisés
     */
    getInitializedServices() {
        return Array.from(this.initialized);
    }

    /**
     * Initialiser tous les services de base
     */
    async initializeCore() {
        console.log('🚀 Initialisation des services de base...');
        
        try {
            // Initialiser dans l'ordre de dépendance
            await this.get('database');
            await this.get('accountRepository');
            await this.get('metricsCollector');
            await this.get('device');
            await this.get('sms');
            await this.get('whatsapp');
            
            console.log('✅ Services de base initialisés');
            
        } catch (error) {
            console.error('❌ Erreur initialisation services de base:', error);
            throw error;
        }
    }

    /**
     * Créer un contexte de services pour un workflow
     * @param {Object} config - Configuration du contexte
     * @returns {Object} Contexte avec tous les services
     */
    async createWorkflowContext(config = {}) {
        await this.initializeCore();
        
        return {
            sms: await this.get('sms', config),
            device: await this.get('device', config),
            whatsapp: await this.get('whatsapp', config),
            database: await this.get('database', config),
            accountRepository: await this.get('accountRepository', config),
            metricsCollector: await this.get('metricsCollector', config),
            
            // Méthodes utilitaires
            cleanup: async () => {
                await this.cleanup();
            },
            
            getMetrics: () => {
                return this.getAllMetrics();
            }
        };
    }

    /**
     * Vérifier la santé de tous les services
     * @returns {Object} Rapport de santé
     */
    async healthCheck() {
        const health = {
            status: 'healthy',
            services: {},
            summary: {
                total: 0,
                healthy: 0,
                unhealthy: 0,
                errors: []
            }
        };

        for (const [name, service] of this.services) {
            health.summary.total++;
            
            try {
                let serviceHealth = { status: 'healthy' };
                
                // Vérifier si le service a une méthode healthCheck
                if (service && typeof service.healthCheck === 'function') {
                    serviceHealth = await service.healthCheck();
                } else if (service && typeof service.getMetrics === 'function') {
                    serviceHealth = {
                        status: 'healthy',
                        metrics: service.getMetrics()
                    };
                }
                
                health.services[name] = serviceHealth;
                
                if (serviceHealth.status === 'healthy') {
                    health.summary.healthy++;
                } else {
                    health.summary.unhealthy++;
                }
                
            } catch (error) {
                health.services[name] = {
                    status: 'error',
                    error: error.message
                };
                health.summary.unhealthy++;
                health.summary.errors.push(`${name}: ${error.message}`);
            }
        }
        
        // Statut global
        if (health.summary.unhealthy > 0) {
            health.status = health.summary.unhealthy === health.summary.total ? 'critical' : 'degraded';
        }
        
        return health;
    }

    /**
     * Obtenir toutes les métriques des services
     * @returns {Object} Métriques combinées
     */
    getAllMetrics() {
        const metrics = {
            registry: this.metrics,
            services: {}
        };

        for (const [name, service] of this.services) {
            try {
                if (service && typeof service.getMetrics === 'function') {
                    metrics.services[name] = service.getMetrics();
                }
            } catch (error) {
                metrics.services[name] = { error: error.message };
            }
        }

        return metrics;
    }

    /**
     * Créer un provider device avec sélection automatique
     * @param {Object} config - Configuration du provider
     * @returns {Promise<DeviceService>} Instance du provider
     */
    async createDeviceProvider(config = {}) {
        const preferredProvider = config.deviceProvider || config.provider;
        
        // Si un provider spécifique est demandé
        if (preferredProvider) {
            if (preferredProvider === 'morelogin' && process.env.MORELOGIN_API_URL) {
                console.log('🌥️ Utilisation du provider MoreLogin');
                return await this.get('morelogin', config);
            } else if (preferredProvider === 'bluestacks') {
                console.log('📱 Utilisation du provider BlueStacks');
                return await this.get('bluestacks', config);
            }
        }
        
        // Sélection automatique avec fallback
        if (config.enableCloud && process.env.MORELOGIN_API_URL) {
            try {
                console.log('🌥️ Tentative d\'utilisation du provider MoreLogin (cloud activé)');
                const provider = await this.get('morelogin', config);
                
                // Vérifier que l'API est disponible
                await provider.initialize();
                
                console.log('✅ Provider MoreLogin sélectionné');
                return provider;
                
            } catch (error) {
                console.log('⚠️ MoreLogin indisponible, fallback vers BlueStacks');
                console.log(`   Erreur: ${error.message}`);
            }
        }
        
        // Fallback vers BlueStacks
        console.log('📱 Utilisation du provider BlueStacks (défaut)');
        return await this.get('bluestacks', config);
    }

    /**
     * Nettoyer tous les services
     */
    async cleanup() {
        console.log('🧹 Nettoyage des services...');
        
        const services = Array.from(this.services.entries()).reverse();
        
        for (const [name, service] of services) {
            try {
                if (service && typeof service.cleanup === 'function') {
                    await service.cleanup();
                    console.log(`✅ Service nettoyé: ${name}`);
                }
            } catch (error) {
                console.error(`❌ Erreur nettoyage service '${name}': ${error.message}`);
            }
        }
        
        // Vider le registry
        this.services.clear();
        this.initialized.clear();
        
        console.log('✅ Nettoyage terminé');
    }
}

// Instance singleton globale
let globalRegistry = null;

/**
 * Obtenir l'instance globale du registry
 * @param {Object} config - Configuration
 * @returns {ServiceRegistry} Instance du registry
 */
function getServiceRegistry(config = {}) {
    if (!globalRegistry) {
        globalRegistry = new ServiceRegistry(config);
    }
    return globalRegistry;
}

/**
 * Réinitialiser l'instance globale
 */
function resetServiceRegistry() {
    globalRegistry = null;
}

module.exports = {
    ServiceRegistry,
    getServiceRegistry,
    resetServiceRegistry
};