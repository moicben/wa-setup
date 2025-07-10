/**
 * WorkflowDatabaseIntegration - Intégration Supabase avec WorkflowContext
 * Phase 4: Supabase Integration
 * 
 * Extension du WorkflowContext pour ajouter les fonctionnalités Supabase
 * avec persistance automatique et collecte de métriques
 */

const { getDatabaseManager } = require('../DatabaseManager');
const { getAccountRepository } = require('../repositories/AccountRepository');
const { getMetricsCollector } = require('../collectors/MetricsCollector');

/**
 * WorkflowDatabaseIntegration - Mixin pour WorkflowContext
 */
class WorkflowDatabaseIntegration {
    constructor(workflowContext) {
        this.context = workflowContext;
        this.accountId = null;
        this.workflowId = null;
        this.isInitialized = false;
        this.metricsCollector = getMetricsCollector();
        this.accountRepository = getAccountRepository();
        
        // Bind des méthodes
        this.initializeDatabase = this.initializeDatabase.bind(this);
        this.saveAccount = this.saveAccount.bind(this);
        this.updateAccount = this.updateAccount.bind(this);
        this.recordMetric = this.recordMetric.bind(this);
        this.finalizeWorkflow = this.finalizeWorkflow.bind(this);
    }

    /**
     * Initialiser la base de données
     */
    async initializeDatabase() {
        if (this.isInitialized) {
            return;
        }

        try {
            console.log('🔄 Initialisation intégration base de données...');
            
            // Initialiser le DatabaseManager
            const dbManager = getDatabaseManager();
            await dbManager.initialize();
            
            // Générer un ID de workflow unique
            this.workflowId = `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            this.isInitialized = true;
            console.log('✅ Intégration base de données initialisée');
            
            // Enregistrer le début du workflow
            await this.recordMetric('workflow_start', {
                workflow_id: this.workflowId,
                country: this.context.getCountry(),
                start_time: new Date().toISOString(),
                status: 'started'
            });
            
        } catch (error) {
            console.error('❌ Erreur initialisation base de données:', error);
            throw error;
        }
    }

    /**
     * Sauvegarder le compte en base
     */
    async saveAccount(phoneNumber, additionalData = {}) {
        try {
            if (!this.isInitialized) {
                await this.initializeDatabase();
            }
            
            console.log('💾 Sauvegarde compte en base:', phoneNumber);
            
            const accountData = {
                phone: phoneNumber,
                country: this.context.getCountry(),
                status: 'created',
                sms_provider: 'sms-activate',
                sms_number_id: this.context.getSMSId(),
                creation_attempts: this.context.getCurrentAttempt(),
                verification_status: 'pending',
                workflow_context: {
                    workflow_id: this.workflowId,
                    session: this.context.getSession(),
                    config: this.context.config,
                    cloud_metrics: this.context.getCloudMetrics()
                },
                ...additionalData
            };
            
            // Sauvegarder via le repository
            const account = await this.accountRepository.createAccount(accountData);
            this.accountId = account.id;
            
            // Enregistrer la métrique
            await this.recordMetric('account_created', {
                account_id: this.accountId,
                phone: phoneNumber,
                country: this.context.getCountry(),
                workflow_id: this.workflowId,
                status: 'created'
            });
            
            console.log('✅ Compte sauvegardé avec ID:', this.accountId);
            return account;
            
        } catch (error) {
            console.error('❌ Erreur sauvegarde compte:', error);
            
            // Enregistrer l'erreur en métrique
            await this.recordMetric('account_save_error', {
                workflow_id: this.workflowId,
                phone: phoneNumber,
                error_type: error.name,
                error_message: error.message
            });
            
            throw error;
        }
    }

    /**
     * Mettre à jour le compte
     */
    async updateAccount(updates) {
        try {
            if (!this.accountId) {
                console.warn('⚠️ Aucun compte à mettre à jour');
                return null;
            }
            
            console.log('🔄 Mise à jour compte:', this.accountId);
            
            // Ajouter des informations contextuelles
            const updateData = {
                ...updates,
                workflow_context: {
                    workflow_id: this.workflowId,
                    session: this.context.getSession(),
                    current_attempt: this.context.getCurrentAttempt(),
                    executed_steps: Array.from(this.context.executedSteps),
                    metrics: this.context.getMetrics()
                }
            };
            
            // Mettre à jour via le repository
            const updatedAccount = await this.accountRepository.updateAccount(this.accountId, updateData);
            
            // Enregistrer la métrique
            await this.recordMetric('account_updated', {
                account_id: this.accountId,
                workflow_id: this.workflowId,
                updates: Object.keys(updates)
            });
            
            console.log('✅ Compte mis à jour');
            return updatedAccount;
            
        } catch (error) {
            console.error('❌ Erreur mise à jour compte:', error);
            
            // Enregistrer l'erreur en métrique
            await this.recordMetric('account_update_error', {
                account_id: this.accountId,
                workflow_id: this.workflowId,
                error_type: error.name,
                error_message: error.message
            });
            
            throw error;
        }
    }

    /**
     * Enregistrer une métrique
     */
    async recordMetric(metricType, data) {
        try {
            if (!this.isInitialized) {
                await this.initializeDatabase();
            }
            
            const metricData = {
                workflow_id: this.workflowId,
                account_id: this.accountId,
                phone: this.context.getPhoneNumber(),
                country: this.context.getCountry(),
                status: data.status || 'unknown',
                start_time: this.context.session.startTime,
                end_time: Date.now(),
                duration_ms: Date.now() - this.context.session.startTime,
                sms_provider: 'sms-activate',
                error_type: data.error_type,
                error_message: data.error_message,
                retry_count: this.context.getCurrentAttempt() - 1,
                ocr_confidence: data.ocr_confidence,
                decision_engine_used: data.decision_engine_used || false,
                cleanup_performed: data.cleanup_performed || false,
                metadata: {
                    metric_type: metricType,
                    cloud_metrics: this.context.getCloudMetrics(),
                    step_durations: this.context.metrics.stepDurations,
                    ...data
                }
            };
            
            // Enregistrer via le MetricsCollector
            await this.metricsCollector.recordWorkflowMetric(metricData);
            
        } catch (error) {
            console.error('❌ Erreur enregistrement métrique:', error);
            // Ne pas faire échouer le workflow pour un problème de métrique
        }
    }

    /**
     * Enregistrer une métrique de performance
     */
    async recordPerformanceMetric(component, operation, startTime, success = true, error = null) {
        try {
            const performanceData = {
                component,
                operation,
                duration_ms: Date.now() - startTime,
                success,
                error_type: error?.name,
                error_message: error?.message,
                metadata: {
                    workflow_id: this.workflowId,
                    account_id: this.accountId,
                    attempt: this.context.getCurrentAttempt()
                }
            };
            
            await this.metricsCollector.recordPerformanceMetric(performanceData);
            
        } catch (error) {
            console.error('❌ Erreur enregistrement métrique performance:', error);
        }
    }

    /**
     * Enregistrer une métrique système
     */
    async recordSystemMetric(component, metricName, value, unit = 'count') {
        try {
            const systemData = {
                component,
                metric_name: metricName,
                metric_value: value,
                unit,
                metadata: {
                    workflow_id: this.workflowId,
                    account_id: this.accountId
                }
            };
            
            await this.metricsCollector.recordSystemMetric(systemData);
            
        } catch (error) {
            console.error('❌ Erreur enregistrement métrique système:', error);
        }
    }

    /**
     * Finaliser le workflow
     */
    async finalizeWorkflow(success, result = {}) {
        try {
            console.log('🏁 Finalisation workflow:', success ? 'SUCCÈS' : 'ÉCHEC');
            
            // Mise à jour finale du compte
            if (this.accountId) {
                const finalStatus = success ? 'completed' : 'failed';
                const verificationStatus = success ? 'verified' : 'failed';
                
                await this.updateAccount({
                    status: finalStatus,
                    verification_status: verificationStatus,
                    last_sms_code: result.smsCode || null,
                    error_messages: success ? [] : [result.error || 'Unknown error'],
                    completed_at: new Date().toISOString()
                });
            }
            
            // Métrique finale du workflow
            await this.recordMetric('workflow_complete', {
                status: success ? 'completed' : 'failed',
                final_result: result,
                total_duration: Date.now() - this.context.session.startTime,
                attempts: this.context.getCurrentAttempt(),
                steps_executed: this.context.executedSteps.size,
                errors_count: this.context.metrics.errors.length,
                screenshots_count: this.context.metrics.screenshots.length,
                decision_engine_used: result.decision_engine_used || false,
                cleanup_performed: result.cleanup_performed || false
            });
            
            // Flush final des métriques
            await this.metricsCollector.flushBuffer();
            
            console.log('✅ Workflow finalisé en base de données');
            
        } catch (error) {
            console.error('❌ Erreur finalisation workflow:', error);
            // Ne pas faire échouer le workflow pour un problème de base de données
        }
    }

    /**
     * Gérer les erreurs de workflow
     */
    async handleWorkflowError(error, stepName = null) {
        try {
            console.log('🚨 Gestion erreur workflow:', error.message);
            
            // Enregistrer l'erreur dans le contexte
            this.context.recordError(stepName || 'unknown', error);
            
            // Mettre à jour le compte avec l'erreur
            if (this.accountId) {
                await this.updateAccount({
                    status: 'failed',
                    verification_status: 'failed',
                    error_messages: [error.message],
                    failed_at: new Date().toISOString()
                });
            }
            
            // Enregistrer la métrique d'erreur
            await this.recordMetric('workflow_error', {
                status: 'failed',
                error_type: error.name,
                error_message: error.message,
                failed_step: stepName,
                attempt: this.context.getCurrentAttempt()
            });
            
        } catch (dbError) {
            console.error('❌ Erreur gestion erreur workflow:', dbError);
        }
    }

    /**
     * Sauvegarder l'état du workflow pour reprise
     */
    async saveWorkflowState() {
        try {
            if (!this.accountId) {
                return;
            }
            
            const workflowState = {
                workflow_id: this.workflowId,
                session: this.context.getSession(),
                config: this.context.config,
                executed_steps: Array.from(this.context.executedSteps),
                step_results: this.context.getAllStepResults(),
                metrics: this.context.getMetrics(),
                cloud_metrics: this.context.getCloudMetrics(),
                timestamp: new Date().toISOString()
            };
            
            await this.updateAccount({
                workflow_context: workflowState
            });
            
            console.log('💾 État workflow sauvegardé');
            
        } catch (error) {
            console.error('❌ Erreur sauvegarde état workflow:', error);
        }
    }

    /**
     * Restaurer l'état du workflow
     */
    async restoreWorkflowState(accountId) {
        try {
            console.log('🔄 Restauration état workflow:', accountId);
            
            if (!this.isInitialized) {
                await this.initializeDatabase();
            }
            
            // Récupérer le compte
            const account = await this.accountRepository.getAccountById(accountId);
            if (!account) {
                throw new Error('Compte non trouvé');
            }
            
            this.accountId = accountId;
            
            // Restaurer l'état si disponible
            if (account.workflow_context) {
                const state = account.workflow_context;
                
                // Restaurer les données de session
                this.context.updateSession({
                    ...state.session,
                    startTime: new Date(state.timestamp).getTime()
                });
                
                // Restaurer les résultats d'étapes
                if (state.step_results) {
                    Object.entries(state.step_results).forEach(([stepName, result]) => {
                        this.context.setStepResult(stepName, result);
                    });
                }
                
                // Restaurer les étapes exécutées
                if (state.executed_steps) {
                    state.executed_steps.forEach(stepName => {
                        this.context.executedSteps.add(stepName);
                    });
                }
                
                // Restaurer la configuration cloud
                if (state.config?.cloud) {
                    this.context.config.cloud = state.config.cloud;
                }
                
                this.workflowId = state.workflow_id;
                
                console.log('✅ État workflow restauré');
            }
            
            return account;
            
        } catch (error) {
            console.error('❌ Erreur restauration état workflow:', error);
            throw error;
        }
    }

    /**
     * Obtenir les métriques en temps réel
     */
    async getRealTimeMetrics() {
        try {
            const metrics = this.metricsCollector.getRealTimeMetrics();
            return {
                ...metrics,
                current_workflow: {
                    workflow_id: this.workflowId,
                    account_id: this.accountId,
                    phone: this.context.getPhoneNumber(),
                    country: this.context.getCountry(),
                    attempt: this.context.getCurrentAttempt(),
                    steps_executed: this.context.executedSteps.size,
                    duration: Date.now() - this.context.session.startTime
                }
            };
            
        } catch (error) {
            console.error('❌ Erreur récupération métriques temps réel:', error);
            return {};
        }
    }

    /**
     * Vérifier la santé de la base de données
     */
    async checkDatabaseHealth() {
        try {
            const dbManager = getDatabaseManager();
            return await dbManager.healthCheck();
            
        } catch (error) {
            console.error('❌ Erreur vérification santé base de données:', error);
            return {
                status: 'error',
                error: error.message
            };
        }
    }

    /**
     * Nettoyer les ressources de base de données
     */
    async cleanup() {
        try {
            console.log('🧹 Nettoyage ressources base de données...');
            
            // Flush final des métriques
            await this.metricsCollector.flushBuffer();
            
            // Réinitialiser les IDs
            this.accountId = null;
            this.workflowId = null;
            this.isInitialized = false;
            
            console.log('✅ Nettoyage base de données terminé');
            
        } catch (error) {
            console.error('❌ Erreur nettoyage base de données:', error);
        }
    }
}

/**
 * Fonction utilitaire pour étendre un WorkflowContext avec les fonctionnalités Supabase
 */
function extendWorkflowContextWithDatabase(workflowContext) {
    const integration = new WorkflowDatabaseIntegration(workflowContext);
    
    // Ajouter les méthodes au contexte
    workflowContext.database = integration;
    workflowContext.initializeDatabase = integration.initializeDatabase;
    workflowContext.saveAccount = integration.saveAccount;
    workflowContext.updateAccount = integration.updateAccount;
    workflowContext.recordMetric = integration.recordMetric;
    workflowContext.recordPerformanceMetric = integration.recordPerformanceMetric;
    workflowContext.recordSystemMetric = integration.recordSystemMetric;
    workflowContext.finalizeWorkflow = integration.finalizeWorkflow;
    workflowContext.handleWorkflowError = integration.handleWorkflowError;
    workflowContext.saveWorkflowState = integration.saveWorkflowState;
    workflowContext.restoreWorkflowState = integration.restoreWorkflowState;
    workflowContext.getRealTimeMetrics = integration.getRealTimeMetrics;
    workflowContext.checkDatabaseHealth = integration.checkDatabaseHealth;
    
    // Étendre le cleanup existant
    const originalCleanup = workflowContext.cleanup.bind(workflowContext);
    workflowContext.cleanup = async function() {
        await integration.cleanup();
        await originalCleanup();
    };
    
    return workflowContext;
}

module.exports = {
    WorkflowDatabaseIntegration,
    extendWorkflowContextWithDatabase
};