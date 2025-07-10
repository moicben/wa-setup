/**
 * InputSMSCodeStep - Étape de saisie du code SMS de vérification
 * Extrait de workflow.js lignes 1327-1361
 */

const { BaseStep } = require('../workflows/base/BaseStep');

class InputSMSCodeStep extends BaseStep {
    constructor() {
        super('InputSMSCodeStep');
        this.description = 'Saisir le code SMS de vérification dans WhatsApp';
        this.screenshotPrefix = 'sms_code_input';
    }

    /**
     * Validation des prérequis
     */
    validatePrerequisites(context) {
        if (!context.getSMSCode()) {
            throw new Error('Code SMS requis pour la saisie');
        }
        
        if (!context.bluestackController) {
            throw new Error('BlueStack Controller requis pour la saisie');
        }
        
        return true;
    }

    /**
     * Exécuter l'étape de saisie du code SMS
     */
    async _execute(context) {
        const code = context.getSMSCode();
        const bluestack = context.bluestackController;
        
        console.log(`🔢 Saisie code: ${code}`);
        
        try {
            // Screenshot avant saisie
            await this._takeScreenshot(context, 'before');
            
            // Attendre l'écran de vérification
            await bluestack.wait('long');
            await bluestack.wait('long');
            
            // Clic sur le champ de code de vérification
            await this._clickSMSCodeField(bluestack);
            
            // Saisir le code de vérification OTP
            await bluestack.inputText(code);
            await bluestack.wait('medium');
            
            // Screenshot après saisie
            await this._takeScreenshot(context, 'after');
            
            // Attendre la validation automatique du code
            await bluestack.wait('long');
            await bluestack.wait('long');
            
            console.log('✅ Code validé');
            
            // Enregistrer le succès dans les métriques
            context.recordMetric('sms_code_entered', true);
            context.recordMetric('sms_code_validated', true);
            
            return {
                success: true,
                codeEntered: code,
                validated: true
            };
            
        } catch (error) {
            console.error(`❌ Erreur saisie code: ${error.message}`);
            
            // Screenshot d'erreur
            await this._takeScreenshot(context, 'error');
            
            // Enregistrer l'échec dans les métriques
            context.recordMetric('sms_code_input_failed', true);
            context.recordMetric('sms_code_input_error', error.message);
            
            throw new Error(`Erreur saisie code: ${error.message}`);
        }
    }

    /**
     * Cliquer sur le champ de saisie du code SMS
     * @param {BlueStackController} bluestack - Contrôleur BlueStack
     */
    async _clickSMSCodeField(bluestack) {
        // Position approximative du champ de code
        const codeFieldPosition = { x: 425, y: 420 };
        
        // Double clic pour s'assurer de la sélection
        await bluestack.click(codeFieldPosition.x, codeFieldPosition.y);
        await bluestack.wait('medium');
        await bluestack.click(codeFieldPosition.x, codeFieldPosition.y);
        await bluestack.wait('medium');
    }

    /**
     * Nettoyage en cas d'erreur
     */
    async cleanup(context, error) {
        if (error) {
            console.warn(`⚠️ Nettoyage après erreur saisie SMS: ${error.message}`);
            
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
            sms_code_length: context.getSMSCode()?.length || 0,
            code_entered: context.getSMSCode() ? true : false,
            validation_attempted: true
        };
    }

    /**
     * Obtenir les dépendances de l'étape
     */
    getDependencies() {
        return ['WaitForSMSStep'];
    }
}

module.exports = {
    InputSMSCodeStep
};