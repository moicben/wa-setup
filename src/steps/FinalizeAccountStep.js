/**
 * FinalizeAccountStep - Étape de finalisation du compte WhatsApp
 * Extrait de workflow.js lignes 1366-1442
 */

const { BaseStep } = require('../workflows/base/BaseStep');

class FinalizeAccountStep extends BaseStep {
    constructor() {
        super('FinalizeAccountStep');
        this.description = 'Finaliser la création du compte WhatsApp';
        this.screenshotPrefix = 'finalize_account';
    }

    /**
     * Validation des prérequis
     */
    validatePrerequisites(context) {
        if (!context.bluestackController) {
            throw new Error('BlueStack Controller requis pour la finalisation');
        }
        
        return true;
    }

    /**
     * Exécuter l'étape de finalisation du compte
     */
    async _execute(context) {
        const bluestack = context.bluestackController;
        
        console.log('🏁 Finalisation du compte...');
        
        try {
            // Attendre les écrans de configuration
            await bluestack.wait('long');
            
            // Accepter le stockage des données
            await this._acceptDataStorage(bluestack);
            
            // Accepter les permissions de Contacts
            await this._acceptContactsPermissions(bluestack);
            
            // Attendre la configuration du compte
            await bluestack.wait('long');
            await bluestack.wait('long');
            
            // Générer et saisir un nom aléatoire
            const accountName = this._generateRandomAccountName();
            await this._inputAccountName(bluestack, accountName);
            
            // Sauvegarder le nom du compte
            await this._saveAccountName(bluestack);
            
            // Skip l'ajout de l'email (optionnel)
            await this._skipEmailStep(bluestack);
            
            // Essayer de cliquer sur des boutons de continuation (optionnel)
            await this._handleOptionalContinueButtons(bluestack);
            
            // Screenshot final
            await this._takeScreenshot(context, 'final');
            
            console.log('✅ Compte finalisé');
            
            // Enregistrer dans le contexte
            context.setAccountName(accountName);
            context.recordMetric('account_finalized', true);
            context.recordMetric('account_name', accountName);
            
            return {
                success: true,
                accountName: accountName,
                finalized: true
            };
            
        } catch (error) {
            console.error(`❌ Erreur finalisation: ${error.message}`);
            
            // Screenshot d'erreur
            await this._takeScreenshot(context, 'error');
            
            // Enregistrer l'échec dans les métriques
            context.recordMetric('finalization_failed', true);
            context.recordMetric('finalization_error', error.message);
            
            throw new Error(`Erreur finalisation: ${error.message}`);
        }
    }

    /**
     * Accepter le stockage des données
     */
    async _acceptDataStorage(bluestack) {
        await bluestack.pressKey(61); // Tab
        await bluestack.wait('short');
        await bluestack.pressKey(61); // Tab
        await bluestack.wait('short');
        await bluestack.pressKey(62); // Space
        await bluestack.wait('long');
    }

    /**
     * Accepter les permissions de Contacts
     */
    async _acceptContactsPermissions(bluestack) {
        await bluestack.pressKey(61); // Tab
        await bluestack.wait('medium');
        await bluestack.pressKey(62); // Space
        await bluestack.wait('short');
        await bluestack.pressKey(62); // Space
    }

    /**
     * Générer un nom de compte aléatoire
     */
    _generateRandomAccountName() {
        const randomNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Emma', 'Frank', 'Grace', 'Henry'];
        const randomSurnames = ['Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson'];
        
        const firstName = randomNames[Math.floor(Math.random() * randomNames.length)];
        const lastName = randomSurnames[Math.floor(Math.random() * randomSurnames.length)];
        
        return `${firstName} ${lastName}`;
    }

    /**
     * Saisir le nom du compte
     */
    async _inputAccountName(bluestack, accountName) {
        console.log(`📝 Nom du compte: ${accountName}`);
        console.log('🔤 Saisie du nom du compte...');
        
        // Cliquer sur le champ de nom
        await bluestack.click(175, 720);
        await bluestack.wait('short');
        
        // Saisir le nom
        await bluestack.inputText(accountName);
        await bluestack.wait('medium');
    }

    /**
     * Sauvegarder le nom du compte
     */
    async _saveAccountName(bluestack) {
        await bluestack.pressKey(61); // Tab
        await bluestack.wait('short');
        await bluestack.pressKey(61); // Tab
        await bluestack.wait('short');
        await bluestack.pressKey(62); // Space
        await bluestack.wait('long');
    }

    /**
     * Ignorer l'étape d'ajout d'email
     */
    async _skipEmailStep(bluestack) {
        await bluestack.pressKey(61); // Tab
        await bluestack.wait('short');
        await bluestack.pressKey(61); // Tab
        await bluestack.wait('short');
        await bluestack.pressKey(61); // Tab
        await bluestack.wait('short');
        await bluestack.pressKey(62); // Space
        await bluestack.wait('long');
    }

    /**
     * Gérer les boutons de continuation optionnels
     */
    async _handleOptionalContinueButtons(bluestack) {
        try {
            await bluestack.click(600, 900);
            await bluestack.wait('medium');
            
            await bluestack.click(600, 900);
            await bluestack.wait('medium');
        } catch (e) {
            // Ignorer si les boutons n'existent pas
            console.debug('Boutons de continuation optionnels non trouvés');
        }
    }

    /**
     * Nettoyage en cas d'erreur
     */
    async cleanup(context, error) {
        if (error) {
            console.warn(`⚠️ Nettoyage après erreur finalisation: ${error.message}`);
            
            // Tenter de prendre un screenshot de diagnostic
            try {
                await this._takeScreenshot(context, 'cleanup_error');
            } catch (screenshotError) {
                console.warn('⚠️ Impossible de prendre screenshot de cleanup');
            }
        }
    }

    /**
     * Obtenir les métriques de l'étape
     */
    getStepMetrics(context) {
        return {
            account_name: context.getAccountName(),
            finalization_attempted: true,
            finalization_success: context.getAccountName() ? true : false
        };
    }

    /**
     * Obtenir les dépendances de l'étape
     */
    getDependencies() {
        return ['InputSMSCodeStep'];
    }
}

module.exports = {
    FinalizeAccountStep
};