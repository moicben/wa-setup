/**
 * SMSService - Service SMS unifié avec factory pattern
 * Phase 5: Services Unifiés
 * 
 * Service abstrait pour unifier tous les providers SMS
 * Permet de switcher facilement entre SMS-Activate, 5Sim, etc.
 */

/**
 * Interface abstraite pour tous les providers SMS
 */
class SMSService {
    constructor(config = {}) {
        this.config = config;
        this.provider = null;
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0
        };
    }

    /**
     * Initialiser le service
     */
    async initialize() {
        throw new Error('initialize() must be implemented by provider');
    }

    /**
     * Acheter un numéro de téléphone
     * @param {string} country - Code pays (UK, FR, US)
     * @param {Object} options - Options additionnelles
     * @returns {Promise<Object>} Résultat avec numéro et ID
     */
    async buyNumber(country, options = {}) {
        throw new Error('buyNumber() must be implemented by provider');
    }

    /**
     * Attendre la réception d'un SMS
     * @param {string} numberId - ID du numéro
     * @param {number} timeout - Timeout en ms
     * @returns {Promise<Object>} Résultat avec code SMS
     */
    async waitForSMS(numberId, timeout = 300000) {
        throw new Error('waitForSMS() must be implemented by provider');
    }

    /**
     * Annuler un numéro
     * @param {string} numberId - ID du numéro à annuler
     * @returns {Promise<boolean>} Succès de l'annulation
     */
    async cancelNumber(numberId) {
        throw new Error('cancelNumber() must be implemented by provider');
    }

    /**
     * Obtenir le statut d'un numéro
     * @param {string} numberId - ID du numéro
     * @returns {Promise<Object>} Statut actuel
     */
    async getNumberStatus(numberId) {
        throw new Error('getNumberStatus() must be implemented by provider');
    }

    /**
     * Obtenir la liste des pays supportés
     * @returns {Promise<Array>} Liste des pays avec prix
     */
    async getSupportedCountries() {
        throw new Error('getSupportedCountries() must be implemented by provider');
    }

    /**
     * Obtenir le solde du compte
     * @returns {Promise<number>} Solde en euros/dollars
     */
    async getBalance() {
        throw new Error('getBalance() must be implemented by provider');
    }

    /**
     * Valider la configuration du provider
     * @returns {boolean} True si configuration valide
     */
    validateConfig() {
        return true;
    }

    /**
     * Obtenir les métriques du provider
     * @returns {Object} Métriques de performance
     */
    getMetrics() {
        return {
            ...this.metrics,
            provider: this.constructor.name,
            successRate: this.metrics.totalRequests > 0 ? 
                (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 : 0
        };
    }

    /**
     * Enregistrer une métrique
     * @param {string} operation - Type d'opération
     * @param {number} duration - Durée en ms
     * @param {boolean} success - Succès/échec
     */
    recordMetric(operation, duration, success) {
        this.metrics.totalRequests++;
        if (success) {
            this.metrics.successfulRequests++;
        } else {
            this.metrics.failedRequests++;
        }
        
        // Mise à jour temps de réponse moyen
        this.metrics.averageResponseTime = 
            (this.metrics.averageResponseTime + duration) / 2;
    }

    /**
     * Nettoyer les ressources
     */
    async cleanup() {
        // Implémentation par défaut vide
    }
}

/**
 * Factory pour créer les instances de providers SMS
 */
class SMSServiceFactory {
    static providers = new Map();

    /**
     * Enregistrer un provider
     * @param {string} name - Nom du provider
     * @param {class} providerClass - Classe du provider
     */
    static registerProvider(name, providerClass) {
        this.providers.set(name, providerClass);
    }

    /**
     * Créer une instance de provider
     * @param {string} providerName - Nom du provider (sms-activate, 5sim, etc.)
     * @param {Object} config - Configuration du provider
     * @returns {SMSService} Instance du provider
     */
    static createProvider(providerName, config = {}) {
        const ProviderClass = this.providers.get(providerName);
        
        if (!ProviderClass) {
            throw new Error(`Provider SMS '${providerName}' not found. Available: ${Array.from(this.providers.keys()).join(', ')}`);
        }

        return new ProviderClass(config);
    }

    /**
     * Obtenir la liste des providers disponibles
     * @returns {Array} Liste des noms de providers
     */
    static getAvailableProviders() {
        return Array.from(this.providers.keys());
    }

    /**
     * Créer le meilleur provider selon les critères
     * @param {Object} criteria - Critères de sélection
     * @returns {SMSService} Instance du meilleur provider
     */
    static createBestProvider(criteria = {}) {
        const { country, budget, speed, reliability } = criteria;
        
        // Logique de sélection du meilleur provider
        const availableProviders = this.getAvailableProviders();
        
        // Pour l'instant, utiliser SMS-Activate par défaut
        const defaultProvider = availableProviders.includes('sms-activate') 
            ? 'sms-activate' 
            : availableProviders[0];
        
        if (!defaultProvider) {
            throw new Error('No SMS providers available');
        }

        return this.createProvider(defaultProvider, criteria);
    }
}

/**
 * Gestionnaire unifié SMS avec fallback automatique
 */
class UnifiedSMSManager {
    constructor(config = {}) {
        this.config = config;
        this.primaryProvider = null;
        this.fallbackProviders = [];
        this.currentProvider = null;
        this.metrics = {
            totalAttempts: 0,
            successfulAttempts: 0,
            fallbackUsed: 0,
            providerSwitches: 0
        };
    }

    /**
     * Initialiser avec providers primaire et fallback
     * @param {string} primaryProviderName - Provider principal
     * @param {Array} fallbackProviderNames - Providers de fallback
     */
    async initialize(primaryProviderName, fallbackProviderNames = []) {
        try {
            // Créer le provider principal
            this.primaryProvider = SMSServiceFactory.createProvider(
                primaryProviderName, 
                this.config
            );
            await this.primaryProvider.initialize();
            this.currentProvider = this.primaryProvider;

            // Créer les providers de fallback
            for (const providerName of fallbackProviderNames) {
                const provider = SMSServiceFactory.createProvider(providerName, this.config);
                await provider.initialize();
                this.fallbackProviders.push(provider);
            }

            console.log(`📱 SMS Manager initialisé: ${primaryProviderName} + ${fallbackProviderNames.length} fallbacks`);
            
        } catch (error) {
            console.error('❌ Erreur initialisation SMS Manager:', error);
            throw error;
        }
    }

    /**
     * Acheter un numéro avec fallback automatique
     * @param {string} country - Code pays
     * @param {Object} options - Options
     * @returns {Promise<Object>} Résultat avec numéro
     */
    async buyNumber(country, options = {}) {
        this.metrics.totalAttempts++;
        
        // Essayer le provider principal
        try {
            const result = await this.currentProvider.buyNumber(country, options);
            if (result.success) {
                this.metrics.successfulAttempts++;
                return result;
            }
        } catch (error) {
            console.warn(`⚠️ Échec provider principal: ${error.message}`);
        }

        // Essayer les providers de fallback
        for (const fallbackProvider of this.fallbackProviders) {
            try {
                console.log(`🔄 Tentative fallback: ${fallbackProvider.constructor.name}`);
                const result = await fallbackProvider.buyNumber(country, options);
                if (result.success) {
                    this.metrics.successfulAttempts++;
                    this.metrics.fallbackUsed++;
                    this.currentProvider = fallbackProvider;
                    return result;
                }
            } catch (error) {
                console.warn(`⚠️ Échec fallback: ${error.message}`);
            }
        }

        throw new Error('Tous les providers SMS ont échoué');
    }

    /**
     * Attendre SMS avec le provider actuel
     * @param {string} numberId - ID du numéro
     * @param {number} timeout - Timeout
     * @returns {Promise<Object>} Résultat avec code SMS
     */
    async waitForSMS(numberId, timeout = 300000) {
        return await this.currentProvider.waitForSMS(numberId, timeout);
    }

    /**
     * Annuler un numéro
     * @param {string} numberId - ID du numéro
     * @returns {Promise<boolean>} Succès
     */
    async cancelNumber(numberId) {
        return await this.currentProvider.cancelNumber(numberId);
    }

    /**
     * Obtenir le statut d'un numéro
     * @param {string} numberId - ID du numéro
     * @returns {Promise<Object>} Statut
     */
    async getNumberStatus(numberId) {
        return await this.currentProvider.getNumberStatus(numberId);
    }

    /**
     * Obtenir la liste des pays supportés
     * @returns {Promise<Array>} Liste des pays avec prix
     */
    async getSupportedCountries() {
        return await this.currentProvider.getSupportedCountries();
    }

    /**
     * Obtenir le solde du compte
     * @returns {Promise<number>} Solde
     */
    async getBalance() {
        return await this.currentProvider.getBalance();
    }

    /**
     * Obtenir les métriques combinées
     * @returns {Object} Métriques du manager et providers
     */
    getMetrics() {
        return {
            manager: this.metrics,
            currentProvider: this.currentProvider?.getMetrics(),
            primaryProvider: this.primaryProvider?.getMetrics(),
            fallbackProviders: this.fallbackProviders.map(p => p.getMetrics())
        };
    }

    /**
     * Nettoyer toutes les ressources
     */
    async cleanup() {
        if (this.primaryProvider) {
            await this.primaryProvider.cleanup();
        }
        
        for (const provider of this.fallbackProviders) {
            await provider.cleanup();
        }
    }
}

module.exports = {
    SMSService,
    SMSServiceFactory,
    UnifiedSMSManager
};