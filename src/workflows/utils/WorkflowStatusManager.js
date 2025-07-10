/**
 * Gestionnaire des statuts de workflow en base de données
 * Centralise la logique de mise à jour des statuts pour éviter la duplication
 */

const { getAccountRepository } = require('../../database/repositories/AccountRepository');

class WorkflowStatusManager {
    constructor() {
        this.accountRepo = null;
    }

    /**
     * Initialiser le gestionnaire avec le repository
     */
    async initialize() {
        try {
            this.accountRepo = getAccountRepository();
            return true;
        } catch (error) {
            console.warn('⚠️ Repository non disponible:', error.message);
            return false;
        }
    }

    /**
     * Mettre à jour le statut d'un compte
     */
    async updateAccountStatus(phone, status, details = {}) {
        if (!this.accountRepo || !phone) {
            return false;
        }

        try {
            await this.accountRepo.updateAccountStatus(phone, status, details);
            console.log(`📊 Statut mis à jour: ${status}`);
            return true;
        } catch (error) {
            console.warn(`⚠️ Erreur mise à jour statut: ${error.message}`);
            return false;
        }
    }

    /**
     * Créer un nouveau compte en base
     */
    async createAccount(accountData) {
        if (!this.accountRepo) {
            return false;
        }

        try {
            await this.accountRepo.createAccount(accountData);
            console.log('💾 Compte sauvegardé en base');
            return true;
        } catch (error) {
            console.warn(`⚠️ Erreur sauvegarde compte: ${error.message}`);
            return false;
        }
    }

    /**
     * Marquer un compte comme échoué lors d'une tentative
     */
    async markAsFailed(context, error, attempt) {
        const phone = context.getPhoneNumber();
        if (!phone) return false;

        return await this.updateAccountStatus(phone, 'failed', {
            error: error.message,
            attempt: attempt,
            failed_at: new Date().toISOString()
        });
    }

    /**
     * Marquer un compte comme ayant échoué avec une erreur spécifique
     */
    async markAsError(context, errorType, reason, attempt, additionalData = {}) {
        const phone = context.getPhoneNumber();
        if (!phone) return false;

        return await this.updateAccountStatus(phone, 'error', {
            error: errorType,
            reason: reason,
            attempt: attempt,
            failed_at: new Date().toISOString(),
            ...additionalData
        });
    }

    /**
     * Marquer un compte comme définitivement échoué
     */
    async markAsFinalFailure(context, error, totalAttempts) {
        const phone = context.getPhoneNumber();
        if (!phone) return false;

        return await this.updateAccountStatus(phone, 'failed_final', {
            error: error.message,
            total_attempts: totalAttempts,
            final_failure_at: new Date().toISOString()
        });
    }

    /**
     * Marquer un compte comme réussi
     */
    async markAsSuccess(context, duration, attempt, additionalData = {}) {
        const phone = context.getPhoneNumber();
        if (!phone) return false;

        return await this.updateAccountStatus(phone, 'success', {
            completed_at: new Date().toISOString(),
            duration_seconds: duration,
            final_attempt: attempt,
            ...additionalData
        });
    }

    /**
     * Gestion des erreurs de confiance faible
     */
    async handleLowConfidenceError(context, decision, attempt) {
        return await this.markAsError(context, 'SMS_CONFIDENCE_TOO_LOW_RETRY_NEEDED', decision.reason, attempt, {
            confidence: decision.confidence,
            decision_type: decision.decision
        });
    }

    /**
     * Gestion des erreurs de validation
     */
    async handleValidationError(context, reason, attempt) {
        return await this.markAsError(context, 'SMS_VALIDATION_REQUIRED_ABORT', reason, attempt);
    }

    /**
     * Gestion des erreurs d'analyse post-SMS
     */
    async handlePostSMSAnalysisError(context, reason, attempt) {
        return await this.markAsError(context, 'POST_SMS_ANALYSIS_FAILED_ABORT', reason, attempt);
    }

    /**
     * Vérifier si le gestionnaire est disponible
     */
    isAvailable() {
        return this.accountRepo !== null;
    }

    /**
     * Obtenir des statistiques sur les comptes
     */
    async getAccountStats() {
        if (!this.accountRepo) {
            return null;
        }

        try {
            // Cette méthode devrait être implémentée dans AccountRepository
            // return await this.accountRepo.getStats();
            return {
                message: 'Statistiques non implémentées',
                available: true
            };
        } catch (error) {
            console.warn(`⚠️ Erreur récupération statistiques: ${error.message}`);
            return null;
        }
    }
}

// Instance singleton
let workflowStatusManager = null;

/**
 * Obtenir l'instance singleton du WorkflowStatusManager
 */
function getWorkflowStatusManager() {
    if (!workflowStatusManager) {
        workflowStatusManager = new WorkflowStatusManager();
    }
    return workflowStatusManager;
}

module.exports = {
    WorkflowStatusManager,
    getWorkflowStatusManager
};