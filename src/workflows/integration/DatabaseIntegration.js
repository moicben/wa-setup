/**
 * DatabaseIntegration - Intégration centralisée de la base de données pour les workflows
 * Extrait et unifie la logique de sauvegarde de workflow.js
 */

const { getDatabaseManager } = require('../../database/DatabaseManager');
const { getAccountRepository } = require('../../database/repositories/AccountRepository');
const { getMetricsCollector } = require('../../database/collectors/MetricsCollector');
const { getWorkflowStatusManager } = require('../utils/WorkflowStatusManager');

class DatabaseIntegration {
    constructor() {
        this.database = null;
        this.accountRepo = null;
        this.metrics = null;
        this.statusManager = null;
        this.initialized = false;
    }

    /**
     * Initialiser l'intégration database
     */
    async initialize() {
        try {
            console.log('🗄️ Connexion base de données...');
            
            // Initialiser le gestionnaire de base de données
            this.database = getDatabaseManager();
            await this.database.initialize();
            
            // Initialiser les repositories
            this.accountRepo = getAccountRepository();
            this.metrics = getMetricsCollector();
            this.statusManager = getWorkflowStatusManager();
            
            // Initialiser le gestionnaire de statut
            await this.statusManager.initialize();
            
            this.initialized = true;
            console.log('✅ Base de données connectée');
            
            return true;
            
        } catch (error) {
            console.warn('⚠️ Base de données non disponible:', error.message);
            return false;
        }
    }

    /**
     * Vérifier si la base de données est disponible
     * @returns {boolean} True si disponible
     */
    isAvailable() {
        return this.initialized && this.database && this.accountRepo;
    }

    /**
     * Sauvegarder un nouveau compte
     * @param {WorkflowContext} context - Contexte du workflow
     * @param {Object} accountData - Données du compte
     * @returns {Object} Résultat de la sauvegarde
     */
    async saveAccount(context, accountData) {
        if (!this.isAvailable()) {
            console.warn('⚠️ Base de données non disponible pour sauvegarde');
            return { success: false, reason: 'database_unavailable' };
        }

        try {
            const account = {
                phone: accountData.phone,
                country: accountData.country,
                status: accountData.status || 'created',
                sms_provider: accountData.sms_provider || 'sms-activate',
                sms_number_id: accountData.sms_number_id,
                creation_attempts: accountData.creation_attempts || 1,
                last_sms_code: accountData.last_sms_code,
                verification_status: accountData.verification_status || 'pending',
                error_messages: accountData.error_messages || [],
                workflow_context: this._buildWorkflowContext(context),
                ...accountData
            };

            const result = await this.accountRepo.createAccount(account);
            
            console.log('💾 Compte sauvegardé en base');
            
            // Enregistrer dans les métriques
            context.recordDatabaseOperation('account_created', {
                accountId: result.id,
                phone: result.phone
            });
            
            return { success: true, account: result };
            
        } catch (error) {
            console.warn('⚠️ Erreur sauvegarde compte:', error.message);
            
            // Enregistrer l'erreur dans les métriques
            context.recordDatabaseOperation('account_save_failed', {
                error: error.message,
                phone: accountData.phone
            });
            
            return { success: false, error: error.message };
        }
    }

    /**
     * Mettre à jour le statut d'un compte
     * @param {WorkflowContext} context - Contexte du workflow
     * @param {string} status - Nouveau statut
     * @param {Object} details - Détails supplémentaires
     * @returns {Object} Résultat de la mise à jour
     */
    async updateAccountStatus(context, status, details = {}) {
        if (!this.isAvailable()) {
            return { success: false, reason: 'database_unavailable' };
        }

        const phone = context.getPhoneNumber();
        if (!phone) {
            return { success: false, reason: 'phone_not_available' };
        }

        try {
            const success = await this.statusManager.updateAccountStatus(phone, status, details);
            
            if (success) {
                // Enregistrer dans les métriques
                context.recordDatabaseOperation('status_updated', {
                    phone: phone,
                    status: status,
                    details: details
                });
                
                return { success: true, status: status };
            } else {
                return { success: false, reason: 'update_failed' };
            }
            
        } catch (error) {
            console.warn('⚠️ Erreur mise à jour statut:', error.message);
            
            // Enregistrer l'erreur dans les métriques
            context.recordDatabaseOperation('status_update_failed', {
                phone: phone,
                status: status,
                error: error.message
            });
            
            return { success: false, error: error.message };
        }
    }

    /**
     * Marquer un compte comme réussi
     * @param {WorkflowContext} context - Contexte du workflow
     * @param {number} duration - Durée en secondes
     * @param {number} attempt - Numéro de tentative
     * @param {Object} additionalData - Données supplémentaires
     * @returns {Object} Résultat de la mise à jour
     */
    async markAccountAsSuccess(context, duration, attempt, additionalData = {}) {
        if (!this.statusManager.isAvailable()) {
            return { success: false, reason: 'status_manager_unavailable' };
        }

        try {
            const success = await this.statusManager.markAsSuccess(context, duration, attempt, additionalData);
            
            if (success) {
                console.log('📊 Statut mis à jour: success');
                
                // Enregistrer dans les métriques du contexte
                context.recordMetric('account_success_recorded', true);
                context.recordMetric('final_duration', duration);
                context.recordMetric('final_attempt', attempt);
                
                return { success: true };
            } else {
                return { success: false, reason: 'status_update_failed' };
            }
            
        } catch (error) {
            console.warn('⚠️ Erreur mise à jour statut succès:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Marquer un compte comme échoué
     * @param {WorkflowContext} context - Contexte du workflow
     * @param {Error} error - Erreur rencontrée
     * @param {number} attempt - Numéro de tentative
     * @returns {Object} Résultat de la mise à jour
     */
    async markAccountAsFailed(context, error, attempt) {
        if (!this.statusManager.isAvailable()) {
            return { success: false, reason: 'status_manager_unavailable' };
        }

        try {
            const success = await this.statusManager.markAsFailed(context, error, attempt);
            
            if (success) {
                console.log('📊 Statut mis à jour: failed');
                
                // Enregistrer dans les métriques du contexte
                context.recordMetric('account_failure_recorded', true);
                context.recordMetric('failure_reason', error.message);
                context.recordMetric('failure_attempt', attempt);
                
                return { success: true };
            } else {
                return { success: false, reason: 'status_update_failed' };
            }
            
        } catch (error) {
            console.warn('⚠️ Erreur mise à jour statut échec:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Enregistrer les métriques du workflow
     * @param {WorkflowContext} context - Contexte du workflow
     * @param {Object} additionalMetrics - Métriques supplémentaires
     * @returns {Object} Résultat de l'enregistrement
     */
    async recordWorkflowMetrics(context, additionalMetrics = {}) {
        if (!this.metrics) {
            return { success: false, reason: 'metrics_unavailable' };
        }

        try {
            const workflowMetrics = {
                workflow_id: context.getWorkflowId(),
                phone: context.getPhoneNumber(),
                country: context.getCountry(),
                status: 'completed',
                start_time: new Date(context.getStartTime()).toISOString(),
                end_time: new Date().toISOString(),
                duration_ms: Date.now() - context.getStartTime(),
                sms_provider: 'sms-activate',
                retry_count: context.getRetryCount(),
                decision_engine_used: true,
                cleanup_performed: false,
                ...additionalMetrics
            };

            await this.metrics.recordWorkflowMetric(workflowMetrics);
            console.log('📊 Métriques enregistrées');
            
            return { success: true, metrics: workflowMetrics };
            
        } catch (error) {
            console.warn('⚠️ Erreur sauvegarde métriques:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Construire le contexte de workflow pour la sauvegarde
     * @param {WorkflowContext} context - Contexte du workflow
     * @returns {Object} Contexte sérialisé
     */
    _buildWorkflowContext(context) {
        return {
            workflow_id: context.getWorkflowId(),
            start_time: context.getStartTime(),
            country: context.getCountry(),
            device_id: context.getDeviceId(),
            metrics: context.getMetrics(),
            current_step: context.getCurrentStep()
        };
    }

    /**
     * Nettoyer les ressources
     */
    async cleanup() {
        try {
            if (this.database) {
                await this.database.cleanup();
            }
        } catch (error) {
            console.warn('⚠️ Erreur nettoyage database:', error.message);
        }
    }
}

// Instance singleton
let databaseIntegration = null;

/**
 * Obtenir l'instance singleton de DatabaseIntegration
 * @returns {DatabaseIntegration} Instance de l'intégration
 */
function getDatabaseIntegration() {
    if (!databaseIntegration) {
        databaseIntegration = new DatabaseIntegration();
    }
    return databaseIntegration;
}

module.exports = {
    DatabaseIntegration,
    getDatabaseIntegration
};