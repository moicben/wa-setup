/**
 * WhatsApp Services - Point d'entrée unifié
 * Phase 5: Services Unifiés
 * 
 * Export du service WhatsApp unifié
 */

const { WhatsAppService } = require('./WhatsAppService');

// Export des classes principales
module.exports = {
    WhatsAppService,
    
    // Fonction utilitaire pour créer un service WhatsApp
    createWhatsAppService: (config = {}) => {
        return new WhatsAppService(config);
    }
};