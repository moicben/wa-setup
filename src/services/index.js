/**
 * Services - Point d'entrée unifié pour tous les services
 * Phase 5: Services Unifiés
 * 
 * Export centralisé de tous les services avec registry
 */

const { ServiceRegistry, getServiceRegistry, resetServiceRegistry } = require('./ServiceRegistry');

// Import des services individuels
const smsServices = require('./sms');
const deviceServices = require('./device');
const whatsappServices = require('./whatsapp');

// Export complet
module.exports = {
    // Registry principal
    ServiceRegistry,
    getServiceRegistry,
    resetServiceRegistry,
    
    // Services SMS
    ...smsServices,
    
    // Services Device
    ...deviceServices,
    
    // Services WhatsApp
    ...whatsappServices,
    
    // Fonction utilitaire pour créer un contexte complet
    createWorkflowServices: async (config = {}) => {
        const registry = getServiceRegistry(config);
        return await registry.createWorkflowContext(config);
    },
    
    // Fonction utilitaire pour vérifier la santé des services
    checkServicesHealth: async (config = {}) => {
        const registry = getServiceRegistry(config);
        return await registry.healthCheck();
    }
};