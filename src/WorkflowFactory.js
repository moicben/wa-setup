/**
 * WorkflowFactory - Factory pour créer des workflows configurés
 * Remplace la logique de configuration de workflow.js
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');

const { WhatsAppAccountWorkflow } = require('./workflows/WhatsAppAccountWorkflow');

class WorkflowFactory {
    /**
     * Créer un workflow WhatsApp configuré
     * @param {Object} config - Configuration du workflow
     * @returns {WhatsAppAccountWorkflow} Instance du workflow
     */
    static createWhatsAppWorkflow(config = {}) {
        const defaultConfig = {
            country: config.country || 'UK',
            deviceId: config.deviceId || '127.0.0.1:5585',
            smsApiKey: config.smsApiKey || process.env.SMS_ACTIVATE_API_KEY,
            verbose: config.verbose !== false,
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 10000
        };

        // Validation de la configuration
        this._validateConfig(defaultConfig);
        
        // Créer le dossier screenshots s'il n'existe pas
        this._ensureScreenshotDirectory();
        
        // Créer et retourner le workflow
        return new WhatsAppAccountWorkflow(defaultConfig);
    }

    /**
     * Valider la configuration
     * @param {Object} config - Configuration à valider
     */
    static _validateConfig(config) {
        if (!config.smsApiKey) {
            throw new Error('Clé API SMS requise. Utilisez "npm run setup" pour configurer.');
        }
        
        const validCountries = ['UK', 'FR', 'US'];
        if (!validCountries.includes(config.country)) {
            throw new Error(`Pays non supporté: ${config.country}. Pays supportés: ${validCountries.join(', ')}`);
        }
    }

    /**
     * Créer le dossier screenshots s'il n'existe pas
     */
    static _ensureScreenshotDirectory() {
        const screenshotDir = path.join(__dirname, '../screenshots');
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }
    }

    /**
     * Créer un workflow avec configuration par défaut pour un pays
     * @param {string} country - Pays cible
     * @returns {WhatsAppAccountWorkflow} Instance du workflow
     */
    static createForCountry(country) {
        return this.createWhatsAppWorkflow({ country });
    }

    /**
     * Créer un workflow avec configuration de test
     * @returns {WhatsAppAccountWorkflow} Instance du workflow de test
     */
    static createTestWorkflow() {
        return this.createWhatsAppWorkflow({
            country: 'UK',
            verbose: true,
            maxRetries: 1
        });
    }
}

module.exports = {
    WorkflowFactory
};