/**
 * WaitForSMSStep - Étape d'attente et réception du SMS
 * Extrait de workflow.js lignes 307-315
 */

const { BaseStep } = require('../workflows/base/BaseStep');

class WaitForSMSStep extends BaseStep {
    constructor() {
        super('WaitForSMSStep');
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
        
        if (!context.smsManager) {
            throw new Error('SMS Manager requis pour attendre la réception');
        }
        
        return true;
    }

    /**
     * Exécuter l'étape d'attente SMS
     */
    async _execute(context) {
        const smsId = context.getSMSId();
        const smsManager = context.smsManager;
        
        console.log(`📨 Attente SMS pour numéro ID: ${smsId}`);
        
        try {
            // Attendre la réception du SMS avec timeout
            const smsResult = await smsManager.waitForSMS(smsId, this.timeout);
            
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
     * Nettoyage en cas d'erreur
     */
    async cleanup(context, error) {
        if (error) {
            console.warn(`⚠️ Nettoyage après erreur d'attente SMS: ${error.message}`);
            
            // Tenter d'annuler le numéro SMS si possible
            const smsId = context.getSMSId();
            if (smsId && context.smsManager) {
                try {
                    await context.smsManager.cancelNumber(smsId);
                    console.log('🗑️ Numéro SMS annulé après erreur');
                } catch (cancelError) {
                    console.warn('⚠️ Impossible d\'annuler le numéro SMS');
                }
            }
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