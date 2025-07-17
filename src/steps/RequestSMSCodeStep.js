/**
 * Étape de demande du code SMS
 * Sélectionne l'option SMS et demande l'envoi du code
 */

const { BaseStep } = require('../base/BaseStep');
const { getLogger } = require('../utils/logger');

class RequestSMSCodeStep extends BaseStep {
    constructor() {
        super('Request SMS Code', ['Check SMS Availability']);
    }

    /**
     * Exécuter l'étape de demande du code SMS
     */
    async _execute(context) {
        try {
            // Vérifier que le SMS est disponible
            const availabilityResult = this._getDependencyResult(context, 'Check SMS Availability');
            if (!availabilityResult.canReceiveSMS) {
                throw new Error('SMS non disponible selon la vérification précédente');
            }

            console.log('🔘 Demande de code SMS...');

            // Étape 1: Sélectionner l'option SMS
            await this._selectSMSOption(context);

            // Étape 2: Confirmer et envoyer la demande
            await this._confirmSMSRequest(context);

            // Étape 3: Attendre la soumission
            await this._waitForSubmission(context);

            // Étape 4: Prendre un screenshot post-soumission
            const afterSelectionScreen = await this._takeScreenshot(context, 'after_sms_selection');

            console.log('🔘 SMS envoyé, attente de réception...');

            return {
                success: true,
                smsRequested: true,
                screenshotPath: afterSelectionScreen,
                timestamp: Date.now()
            };

        } catch (error) {
            // Prendre un screenshot d'erreur
            await this._takeScreenshot(context, 'error');
            
            // Logger l'erreur
            const logger = getLogger();
            logger.error('SMS request failed', { error: error.message });
            
            throw new Error(`Erreur demande SMS: ${error.message}`);
        }
    }

    /**
     * Sélectionner l'option SMS
     */
    async _selectSMSOption(context) {
        console.log('🔘 Sélection de l\'option SMS...');

        // Navigation vers l'option SMS
        await this._pressKey(context, 61); // Tab
        await this._wait(context, 'medium');
        await this._pressKey(context, 61); // Tab
        await this._wait(context, 'medium');
        await this._pressKey(context, 62); // Space
        await this._wait(context, 'medium');

        // Prendre un screenshot après sélection
        await this._takeScreenshot(context, 'sms_option_selected');
    }

    /**
     * Confirmer la demande de SMS
     */
    async _confirmSMSRequest(context) {
        console.log('🔘 Confirmation de la demande SMS...');

        // Cliquer sur "Continue" pour envoyer le SMS
        console.log('🔘 Clic sur Continue...');
        await this._click(context, 540, 1800); // Position du bouton Continue

        // Attendre la confirmation
        await this._wait(context, 'medium');
    }

    /**
     * Attendre la soumission du SMS
     */
    async _waitForSubmission(context) {
        console.log('⏳ Attente de la soumission...');

        // Attendre l'envoi du SMS de vérification
        await this._wait(context, 'long');
        await this._wait(context, 'long');
    }

    /**
     * Méthode fallback si la sélection principale échoue
     */
    async _fallbackSMSRequest(context) {
        console.log('🔄 Tentative fallback: clic direct sur Continue...');
        
        try {
            // Essayer de cliquer directement sur Continue
            await this._click(context, 383, 1310);
            await this._wait(context, 'medium');
            console.log('✅ Continue cliqué en fallback');
            return true;
        } catch (fallbackError) {
            console.error(`❌ Fallback échoué: ${fallbackError.message}`);
            throw new Error('Impossible de demander le code SMS');
        }
    }

    /**
     * Vérifications préalables
     */
    async canExecute(context) {
        try {
            // Vérifier la vérification de disponibilité SMS
            const availabilityResult = this._getDependencyResult(context, 'Check SMS Availability');
            if (!availabilityResult || !availabilityResult.success) {
                throw new Error('Vérification SMS non terminée');
            }

            if (!availabilityResult.canReceiveSMS) {
                throw new Error('SMS non disponible selon la vérification');
            }

            // Vérifier le service BlueStack
            if (!context.bluestack) {
                throw new Error('Service BlueStack non configuré');
            }

            // Vérifier que nous avons un ID SMS
            const buyResult = this._getDependencyResult(context, 'Buy Phone Number');
            if (!buyResult || !buyResult.smsId) {
                throw new Error('ID SMS non disponible');
            }

            return true;
        } catch (error) {
            console.error(`❌ Prérequis non satisfaits pour demande SMS: ${error.message}`);
            return false;
        }
    }

    /**
     * Nettoyage si l'étape échoue
     */
    async cleanup(context) {
        try {
            // Prendre un screenshot de l'état actuel
            await this._takeScreenshot(context, 'cleanup');
            
            console.log('🧹 Nettoyage RequestSMSCode terminé');
        } catch (error) {
            console.warn(`⚠️ Erreur nettoyage RequestSMSCode: ${error.message}`);
        }
    }

    /**
     * Gestion des erreurs spécifiques
     */
    handleError(error, context) {
        if (error.message.includes('SMS non disponible')) {
            return {
                shouldRetry: false,
                isFatal: true,
                reason: 'SMS non disponible selon vérification précédente'
            };
        }

        if (error.message.includes('BlueStack') || error.message.includes('click')) {
            return {
                shouldRetry: true,
                isFatal: false,
                reason: 'Erreur interaction interface'
            };
        }

        if (error.message.includes('timeout') || error.message.includes('attente')) {
            return {
                shouldRetry: true,
                isFatal: false,
                reason: 'Timeout, retry possible'
            };
        }

        return {
            shouldRetry: true,
            isFatal: false,
            reason: 'Erreur générique, retry possible'
        };
    }

    /**
     * Validation des résultats
     */
    validateResult(result) {
        if (!result.success) {
            throw new Error('Résultat de demande SMS invalide');
        }

        if (!result.smsRequested) {
            throw new Error('SMS non demandé dans le résultat');
        }

        if (!result.screenshotPath) {
            throw new Error('Screenshot post-soumission manquant');
        }

        return true;
    }

    /**
     * Obtenir le numéro d'étape pour les screenshots
     */
    _getStepNumber() {
        return '05';
    }

    /**
     * Informations sur cette étape
     */
    getDescription() {
        return {
            name: this.name,
            description: 'Demande l\'envoi du code SMS de vérification WhatsApp',
            inputs: ['SMS disponible', 'Options de vérification', 'ID SMS'],
            outputs: ['SMS demandé', 'Screenshot post-soumission'],
            duration: '~5-15 secondes',
            canFail: true,
            retryable: true,
            uiInteractions: ['Sélection option SMS', 'Clic Continue', 'Attente soumission'],
            specialFeatures: ['Fallback automatique', 'Screenshots de suivi', 'Validation prérequis']
        };
    }
}

module.exports = { RequestSMSCodeStep };