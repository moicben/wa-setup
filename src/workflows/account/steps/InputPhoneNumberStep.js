/**
 * Étape de saisie du numéro de téléphone dans WhatsApp
 * Gère la navigation, saisie et validation du numéro
 */

const { BaseStep } = require('../../base/BaseStep');
const { getWorkflowStatusManager } = require('../../utils/WorkflowStatusManager');

class InputPhoneNumberStep extends BaseStep {
    constructor() {
        super('Input Phone Number', ['Buy Phone Number']); // Dépend de l'achat du numéro
    }

    /**
     * Exécuter l'étape de saisie du numéro
     */
    async _execute(context) {
        try {
            // Récupérer les informations du numéro depuis l'étape précédente
            const buyResult = this._getDependencyResult(context, 'Buy Phone Number');
            if (!buyResult.success) {
                throw new Error('Numéro de téléphone non disponible');
            }

            const phoneNumber = buyResult.number;
            const parsedNumber = buyResult.parsedNumber;
            
            if (!parsedNumber || !parsedNumber.success) {
                throw new Error('Numéro de téléphone non parsé correctement');
            }

            console.log(`📝 Saisie: +${phoneNumber}`);
            console.log(`🌍 Indicatif pays: +${parsedNumber.countryCode}`);
            console.log(`📞 Numéro local: ${parsedNumber.localNumber}`);

            // Prendre un screenshot avant la saisie
            await this._takeScreenshot(context, 'before_input');

            // Étape 1: Configuration initiale de l'application
            await this._setupApplication(context);

            // Étape 2: Saisir l'indicatif pays
            await this._inputCountryCode(context, parsedNumber.countryCode);

            // Étape 3: Saisir le numéro local
            await this._inputLocalNumber(context, parsedNumber.localNumber);

            // Étape 4: Soumettre et valider
            await this._submitPhoneNumber(context);

            // Screenshot après saisie
            await this._takeScreenshot(context, 'after_input');

            console.log('🔘 Options de vérification affichées !');

            return {
                success: true,
                phoneNumber: phoneNumber,
                parsedNumber: parsedNumber,
                timestamp: Date.now()
            };

        } catch (error) {
            // Prendre un screenshot d'erreur
            await this._takeScreenshot(context, 'error');
            
            // Mettre à jour le statut en base de données
            const statusManager = getWorkflowStatusManager();
            await statusManager.initialize();
            await statusManager.markAsError(context, 'PHONE_INPUT_FAILED', error.message, context.getCurrentAttempt());
            
            throw new Error(`Erreur saisie numéro: ${error.message}`);
        }
    }

    /**
     * Configuration initiale de l'application
     */
    async _setupApplication(context) {
        console.log('🔧 Configuration initiale de l\'application...');

        // Choisir la langue de l'application
        await this._pressKey(context, 62); // Space
        await this._wait(context, 'short');
        await this._pressKey(context, 66); // Enter
        await this._wait(context, 'long');

        // Navigation pour lancer l'application
        await this._navigateToMainScreen(context);

        // Fermer la popup Notifications
        await this._pressKey(context, 62); // Space
        await this._wait(context, 'medium');
        await this._click(context, 570, 1060);
        await this._wait(context, 'medium');
    }

    /**
     * Navigation vers l'écran principal
     */
    async _navigateToMainScreen(context) {
        console.log('🧭 Navigation vers l\'écran principal...');

        // Séquence de navigation par Tab
        for (let i = 0; i < 5; i++) {
            await this._pressKey(context, 61); // Tab
            await this._wait(context, 'short');
        }

        await this._wait(context, 'medium');
        await this._pressKey(context, 66); // Enter/Space
        await this._wait(context, 'long');
    }

    /**
     * Saisir l'indicatif pays
     */
    async _inputCountryCode(context, countryCode) {
        console.log(`🌍 Saisie indicatif pays: +${countryCode}`);

        // Effacer le champ indicatif (double nettoyage pour assurer la suppression)
        await this._clearField(context, 355, 513);
        await this._wait(context, 'short');
        await this._clearField(context, 355, 513);
        await this._wait(context, 'medium');

        // Saisir l'indicatif pays correct
        await this._inputText(context, countryCode);
    }

    /**
     * Saisir le numéro local
     */
    async _inputLocalNumber(context, localNumber) {
        console.log(`📞 Saisie numéro local: ${localNumber}`);

        // Cliquer sur le champ numéro et l'effacer
        await this._click(context, 620, 513);
        await this._wait(context, 'short');
        await this._clearField(context, 620, 513);

        // Saisir le numéro local
        await this._inputText(context, localNumber);
    }

    /**
     * Soumettre le numéro de téléphone
     */
    async _submitPhoneNumber(context) {
        console.log('🔘 Soumission du numéro...');

        // Clic sur NEXT (via navigation clavier)
        console.log('🔘 Clic sur NEXT...');
        await this._wait(context, 'medium');
        await this._pressKey(context, 61); // Tab
        await this._wait(context, 'medium');
        await this._pressKey(context, 62); // Space

        // Attendre l'envoi du numéro
        await this._wait(context, 'long');
        await this._wait(context, 'long'); // Double attente

        // Confirmer le numéro
        await this._confirmPhoneNumber(context);

        // Attendre la soumission du numéro
        await this._wait(context, 'long');
        await this._wait(context, 'long');
    }

    /**
     * Confirmer le numéro de téléphone
     */
    async _confirmPhoneNumber(context) {
        console.log('✅ Confirmation du numéro...');

        await this._pressKey(context, 61); // Tab
        await this._wait(context, 'medium');
        await this._pressKey(context, 61); // Tab
        await this._wait(context, 'medium');
        await this._pressKey(context, 62); // Space
    }

    /**
     * Vérifications préalables
     */
    async canExecute(context) {
        try {
            // Vérifier le résultat de l'achat du numéro
            const buyResult = this._getDependencyResult(context, 'Buy Phone Number');
            if (!buyResult || !buyResult.success) {
                throw new Error('Numéro de téléphone non acheté');
            }

            // Vérifier le parsing du numéro
            const parsedNumber = buyResult.parsedNumber;
            if (!parsedNumber || !parsedNumber.success) {
                throw new Error('Numéro de téléphone non parsé correctement');
            }

            // Vérifier les composants requis
            if (!parsedNumber.countryCode || !parsedNumber.localNumber) {
                throw new Error('Composants du numéro manquants');
            }

            // Vérifier le service BlueStack
            if (!context.bluestack) {
                throw new Error('Service BlueStack non configuré');
            }

            return true;
        } catch (error) {
            console.error(`❌ Prérequis non satisfaits pour saisie numéro: ${error.message}`);
            return false;
        }
    }

    /**
     * Nettoyage si l'étape échoue
     */
    async cleanup(context) {
        try {
            // Prendre un screenshot de l'état actuel pour debug
            await this._takeScreenshot(context, 'cleanup');
            
            console.log('🧹 Nettoyage InputPhoneNumber terminé');
        } catch (error) {
            console.warn(`⚠️ Erreur nettoyage InputPhoneNumber: ${error.message}`);
        }
    }

    /**
     * Gestion des erreurs spécifiques
     */
    handleError(error, context) {
        if (error.message.includes('parsing') || error.message.includes('parsé')) {
            return {
                shouldRetry: false,
                isFatal: true,
                reason: 'Problème de parsing du numéro'
            };
        }

        if (error.message.includes('BlueStack') || error.message.includes('device')) {
            return {
                shouldRetry: true,
                isFatal: false,
                reason: 'Problème temporaire avec BlueStack'
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
            throw new Error('Résultat de saisie invalide');
        }

        if (!result.phoneNumber || !result.parsedNumber) {
            throw new Error('Données de numéro manquantes dans le résultat');
        }

        if (!result.parsedNumber.success) {
            throw new Error('Numéro parsé invalide');
        }

        return true;
    }

    /**
     * Obtenir le numéro d'étape pour les screenshots
     */
    _getStepNumber() {
        return '03';
    }

    /**
     * Informations sur cette étape
     */
    getDescription() {
        return {
            name: this.name,
            description: 'Saisit le numéro de téléphone dans WhatsApp avec navigation automatique',
            inputs: ['Numéro acheté', 'Numéro parsé', 'BlueStack connecté'],
            outputs: ['Numéro saisi', 'Écran options de vérification'],
            duration: '~10-20 secondes',
            canFail: true,
            retryable: true,
            uiInteractions: ['Navigation clavier', 'Saisie de texte', 'Clics de validation'],
            specialFeatures: ['Double nettoyage des champs', 'Navigation séquentielle', 'Confirmation automatique']
        };
    }
}

module.exports = { InputPhoneNumberStep };