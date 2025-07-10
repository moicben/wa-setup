/**
 * SMS Services - Point d'entrée unifié
 * Phase 5: Services Unifiés
 * 
 * Enregistrement automatique des providers SMS et export des services
 */

const { SMSService, SMSServiceFactory, UnifiedSMSManager } = require('./SMSService');
const { SMSActivateProvider } = require('./providers/SMSActivateProvider');
const { PhoneNumberParser } = require('../../core/sms/parsers');

// Enregistrement automatique des providers
SMSServiceFactory.registerProvider('sms-activate', SMSActivateProvider);

/**
 * Créer un manager SMS compatible avec l'interface originale
 * @param {Object} config - Configuration
 * @returns {Object} Manager SMS avec méthodes compatibles
 */
async function createSMSManager(config = {}) {
    const provider = new SMSActivateProvider(config);
    await provider.initialize();
    
    // Créer un wrapper compatible avec l'interface originale
    return {
        // Méthodes de base
        async getBalance() {
            return await provider.getBalance();
        },
        
        async getCountries() {
            return await provider.getCountries();
        },
        
        async getAvailableCountries() {
            return await provider.getSupportedCountries();
        },
        
        async getSupportedCountries() {
            return await provider.getSupportedCountries();
        },
        
        async buyNumber(countryCode) {
            return await provider.buyNumber(countryCode);
        },
        
        async waitForSMS(id, timeout = 120000) {
            // S'assurer que le timeout par défaut est appliqué si undefined/null
            const actualTimeout = timeout !== undefined && timeout !== null ? timeout : 120000;
            return await provider.waitForSMS(id, actualTimeout);
        },
        
        async cancelNumber(id) {
            return await provider.cancelNumber(id);
        },
        
        async confirmSMS(id) {
            return await provider.confirmSMS(id);
        },
        
        // Méthodes avancées
        async buyNumberWithFallback(countryCode) {
            return await provider.buyNumberWithFallback(countryCode);
        },
        
        async buyNumberWithFallbackAndPricing(countryCode) {
            return await provider.buyNumberWithFallbackAndPricing(countryCode);
        },
        
        async buyUKNumberWithPricing(maxRetries = 5) {
            return await provider.buyUKNumberWithPricing(maxRetries);
        },
        
        async diagnoseBuyNumber(countryCode) {
            return await provider.diagnoseBuyNumber(countryCode);
        },
        
        async discoverUKOperators() {
            return await provider.discoverUKOperators();
        },
        
        async getNumbersStatus(countryCode, operator = null) {
            const code = await provider.getCountryCode(countryCode);
            return await provider.getNumbersStatus(code, operator);
        },
        
        async getPrices(countryCode, service = null) {
            const code = await provider.getCountryCode(countryCode);
            return await provider.getPrices(code, service);
        },
        
        // Workflow complet
        async getNumberWithSMS(countryCode) {
            const buyResult = await provider.buyNumber(countryCode);
            if (!buyResult.success) {
                return buyResult;
            }
            
            const smsResult = await provider.waitForSMS(buyResult.id);
            if (!smsResult.success) {
                // Annuler le numéro si échec SMS
                await provider.cancelNumber(buyResult.id);
                return smsResult;
            }
            
            return {
                success: true,
                id: buyResult.id,
                number: buyResult.number,
                fullNumber: buyResult.fullNumber,
                code: smsResult.code,
                country: buyResult.country,
                parsed: buyResult.parsed
            };
        },
        
        // Méthodes utilitaires
        async getCountryCode(countryName) {
            return await provider.getCountryCode(countryName);
        },
        
        getMetrics() {
            return provider.getMetrics();
        },
        
        validateConfig() {
            return provider.validateConfig();
        },
        
        async cleanup() {
            await provider.cleanup();
        },
        
        // Méthodes de nettoyage global
        async getActiveNumbers() {
            return await provider.getActiveNumbers();
        },
        
        async cancelAllActiveNumbers(options = {}) {
            return await provider.cancelAllActiveNumbers(options);
        },
        
        // Provider access pour compatibilité
        _provider: provider
    };
}

/**
 * Créer une instance SMSManagerExtended compatible
 * @param {string} apiKey - Clé API
 * @returns {Object} Manager étendu
 */
function createSMSManagerExtended(apiKey) {
    return createSMSManager({ apiKey });
}

// Export des classes principales
module.exports = {
    SMSService,
    SMSServiceFactory,
    UnifiedSMSManager,
    
    // Providers
    SMSActivateProvider,
    
    // Fonctions de compatibilité
    createSMSManager,
    createSMSManagerExtended,
    
    // Parser pour compatibilité
    PhoneNumberParser,
    
    // Classes compatibles pour rétrocompatibilité
    SMSManager: createSMSManager,
    SMSManagerExtended: createSMSManagerExtended
};