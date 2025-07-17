/**
 * WaitForSMSStep - Étape d'attente et réception du SMS
 * Extrait de workflow.js lignes 307-315
 */

const { BaseStep } = require('../base/BaseStep');

class WaitForSMSStep extends BaseStep {
    constructor() {
        super('Wait For SMS', ['Analyze Post SMS']);
        this.description = 'Attendre la réception du SMS de vérification';
        this.timeout = 120000; // 2 minutes timeout
    }

    /**
     * Validation des prérequis
     */
    validatePrerequisites(context) {
        if (!context.getSMSId()) {
            throw new Error('SMS ID requis pour attendre la réception');
        }
        
        if (!context.sms) {
            throw new Error('Service SMS non configuré');
        }
        
        return true;
    }

    async canExecute(context) {
        try {
            // Vérifier l'analyse post-SMS au lieu de Request SMS Code
            const analysisResult = this._getDependencyResult(context, 'Analyze Post SMS');
            if (!analysisResult || !analysisResult.success) {
                throw new Error('Analyse post-SMS non terminée');
            }

            // Vérifier l'ID SMS
            if (!context.getSMSId()) {
                throw new Error('ID SMS non disponible');
            }

            // Vérifier le service SMS
            if (!context.sms) {
                throw new Error('Service SMS non configuré');
            }

            return true;
        } catch (error) {
            console.error(`❌ Prérequis non satisfaits pour attente SMS: ${error.message}`);
            return false;
        }
    }

    /**
     * Exécuter l'étape d'attente SMS
     */
    async _execute(context) {
        const smsId = context.getSMSId();
        const sms = context.sms;
        
        console.log(`📨 Attente SMS pour numéro ID: ${smsId}`);
        
        try {
            // Attendre la réception du SMS avec timeout
            const smsResult = await sms.waitForSMS(smsId, this.timeout);
            
            if (!smsResult.success) {
                throw new Error(`Impossible de recevoir le SMS: ${smsResult.error}`);
            }
            
            console.log(`📝 Code SMS reçu: ${smsResult.code}`);
            
            // Sauvegarder le code dans le contexte
            context.setSMSCode(smsResult.code);
            
            // Enregistrer les métriques
            context.recordMetric('sms_wait_time', smsResult.waitTime || 0);
            context.recordMetric('sms_code_received', true);
            
            return {
                success: true,
                smsCode: smsResult.code,
                waitTime: smsResult.waitTime,
                data: smsResult
            };
            
        } catch (error) {
            console.error(`❌ Erreur attente SMS: ${error.message}`);
            
            // Enregistrer l'échec dans les métriques
            context.recordMetric('sms_wait_failed', true);
            context.recordMetric('sms_wait_error', error.message);
            
            throw error;
        }
    }

    /**
     * Nettoyage si l'étape échoue
     */
    async cleanup(context) {
        try {
            console.log('🧹 Nettoyage WaitForSMS terminé');
        } catch (error) {
            console.warn(`⚠️ Erreur nettoyage WaitForSMS: ${error.message}`);
        }
    }

    /**
     * Obtenir les métriques de l'étape
     */
    getStepMetrics(context) {
        return {
            sms_id: context.getSMSId(),
            wait_timeout: this.timeout,
            sms_code_received: context.getSMSCode() ? true : false
        };
    }
}

module.exports = {
    WaitForSMSStep
};