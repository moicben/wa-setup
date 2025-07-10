/**
 * WorkflowLogger - Utilitaire de logging pour les workflows
 * Extrait de workflow.js lignes 1447-1449
 */

class WorkflowLogger {
    /**
     * Logger une étape du workflow
     * @param {string} stepName - Nom de l'étape
     * @param {WorkflowContext} context - Contexte du workflow (optionnel)
     */
    static async logStep(stepName, context = null) {
        console.log(`\n${stepName}...`);
        
        // Enregistrer dans le contexte si disponible
        if (context && context.recordStepStart) {
            context.recordStepStart(stepName);
        }
    }

    /**
     * Logger le démarrage du workflow
     * @param {string} workflowName - Nom du workflow
     * @param {object} config - Configuration du workflow
     */
    static logWorkflowStart(workflowName, config = {}) {
        console.log(`🚀 ${workflowName}`);
        console.log('═'.repeat(40));
        
        if (config.country) {
            console.log(`🌍 Pays: ${config.country}`);
        }
        
        if (config.attempt && config.maxRetries) {
            console.log(`🔄 Tentative ${config.attempt}/${config.maxRetries}`);
        }
        
        console.log('');
    }

    /**
     * Logger le succès du workflow
     * @param {object} result - Résultat du workflow
     */
    static logWorkflowSuccess(result) {
        console.log('\n🎉 === COMPTE CRÉÉ AVEC SUCCÈS ===');
        console.log(`📱 Numéro: ${result.phone}`);
        console.log(`⏱️ Durée: ${result.duration}s`);
        if (result.smsId) {
            console.log(`🆔 SMS ID: ${result.smsId}`);
        }
        console.log(`🔄 Tentative réussie: ${result.attempts}/${result.maxRetries || 'N/A'}\n`);
    }

    /**
     * Logger l'échec du workflow
     * @param {Error} error - Erreur rencontrée
     * @param {number} attempt - Numéro de tentative
     * @param {number} maxRetries - Nombre maximum de tentatives
     */
    static logWorkflowFailure(error, attempt, maxRetries) {
        console.error(`\n❌ === ÉCHEC TENTATIVE ${attempt}/${maxRetries} ===`);
        console.error(`💥 Erreur: ${error.message}`);
        
        if (attempt === maxRetries) {
            console.error(`\n💥 === ÉCHEC DÉFINITIF APRÈS ${maxRetries} TENTATIVES ===`);
        }
    }

    /**
     * Logger les informations de retry
     * @param {number} attempt - Tentative actuelle
     * @param {number} maxRetries - Nombre maximum de tentatives
     * @param {number} delaySeconds - Délai d'attente en secondes
     */
    static logRetryInfo(attempt, maxRetries, delaySeconds = 10) {
        console.log(`🔄 Retry automatique ${attempt + 1}/${maxRetries} dans ${delaySeconds} secondes...\n`);
    }

    /**
     * Logger les métriques du workflow
     * @param {object} metrics - Métriques du workflow
     */
    static logMetrics(metrics) {
        if (metrics.duration) {
            console.log(`📊 Métriques enregistrées`);
        }
        if (metrics.workflowId) {
            console.log(`🆔 Workflow ID: ${metrics.workflowId}`);
        }
    }
}

module.exports = {
    WorkflowLogger
};