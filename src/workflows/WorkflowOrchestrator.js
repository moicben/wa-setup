/**
 * WorkflowOrchestrator - Orchestrateur générique pour l'exécution de workflows
 * Gère l'exécution séquentielle des steps avec retry, logging et nettoyage
 */

const { WorkflowLogger } = require('./utils/WorkflowLogger');

class WorkflowOrchestrator {
    constructor() {
        this.currentStep = null;
        this.executedSteps = [];
        this.stepResults = new Map();
    }

    /**
     * Exécuter une série d'étapes avec gestion des erreurs et retry
     * @param {Array} steps - Liste des étapes à exécuter
     * @param {WorkflowContext} context - Contexte du workflow
     * @param {Object} options - Options d'exécution
     * @returns {Object} Résultat de l'exécution
     */
    async executeSteps(steps, context, options = {}) {
        const {
            maxRetries = 3,
            retryDelay = 10000,
            continueOnError = false,
            enableCleanup = true
        } = options;

        let lastError = null;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // Logger le début de l'exécution
                this._logExecutionStart(context, attempt, maxRetries);
                
                // Exécuter toutes les étapes
                const result = await this._executeStepsSequentially(steps, context, attempt);
                
                // Logger le succès
                this._logExecutionSuccess(context, result, attempt);
                
                return result;
                
            } catch (error) {
                lastError = error;
                
                // Logger l'échec
                this._logExecutionFailure(error, attempt, maxRetries);
                
                // Nettoyage en cas d'erreur
                if (enableCleanup) {
                    await this._performCleanup(context, error);
                }
                
                // Si ce n'est pas la dernière tentative, attendre avant retry
                if (attempt < maxRetries) {
                    WorkflowLogger.logRetryInfo(attempt, maxRetries, retryDelay / 1000);
                    await this._delay(retryDelay);
                    
                    // Réinitialiser pour la prochaine tentative
                    this._resetForRetry(context);
                } else {
                    // Dernière tentative échouée
                    return {
                        success: false,
                        error: lastError.message,
                        attempts: attempt,
                        executedSteps: this.executedSteps
                    };
                }
            }
        }
    }

    /**
     * Exécuter les étapes séquentiellement
     * @param {Array} steps - Liste des étapes
     * @param {WorkflowContext} context - Contexte
     * @param {number} attempt - Numéro de tentative
     * @returns {Object} Résultat de l'exécution
     */
    async _executeStepsSequentially(steps, context, attempt) {
        const results = [];
        
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            this.currentStep = step;
            
            try {
                // Marquer l'étape comme en cours
                context.setCurrentStep(step.name, i + 1);
                
                // Exécuter l'étape
                const stepResult = await step.execute(context);
                
                // Sauvegarder le résultat
                this.stepResults.set(step.name, stepResult);
                this.executedSteps.push({
                    name: step.name,
                    success: true,
                    result: stepResult,
                    attempt: attempt
                });
                
                // Synchroniser avec le contexte pour les dépendances
                context.setStepResult(step.name, stepResult);
                
                results.push(stepResult);
                
            } catch (error) {
                // Sauvegarder l'échec
                this.stepResults.set(step.name, { success: false, error: error.message });
                this.executedSteps.push({
                    name: step.name,
                    success: false,
                    error: error.message,
                    attempt: attempt
                });
                
                // Nettoyage de l'étape
                if (step.cleanup) {
                    await step.cleanup(context, error);
                }
                
                throw error;
            }
        }
        
        return {
            success: true,
            results: results,
            executedSteps: this.executedSteps,
            stepResults: Object.fromEntries(this.stepResults)
        };
    }

    /**
     * Logger le début de l'exécution
     */
    _logExecutionStart(context, attempt, maxRetries) {
        const config = {
            country: context.getCountry(),
            attempt: attempt,
            maxRetries: maxRetries
        };
        
        WorkflowLogger.logWorkflowStart('WORKFLOW WHATSAPP', config);
    }

    /**
     * Logger le succès de l'exécution
     */
    _logExecutionSuccess(context, result, attempt) {
        const duration = Math.round((Date.now() - context.getStartTime()) / 1000);
        
        const successResult = {
            phone: context.getPhoneNumber(),
            duration: duration,
            country: context.getCountry(),
            attempts: attempt,
            smsId: context.getSMSId()
        };
        
        WorkflowLogger.logWorkflowSuccess(successResult);
    }

    /**
     * Logger l'échec de l'exécution
     */
    _logExecutionFailure(error, attempt, maxRetries) {
        WorkflowLogger.logWorkflowFailure(error, attempt, maxRetries);
    }

    /**
     * Effectuer le nettoyage après erreur
     */
    async _performCleanup(context, error) {
        try {
            // Nettoyage du contexte
            if (context.cleanup) {
                await context.cleanup(error);
            }
            
            // Nettoyage de l'étape courante
            if (this.currentStep && this.currentStep.cleanup) {
                await this.currentStep.cleanup(context, error);
            }
            
        } catch (cleanupError) {
            console.warn('⚠️ Erreur lors du nettoyage:', cleanupError.message);
        }
    }

    /**
     * Réinitialiser pour une nouvelle tentative
     */
    _resetForRetry(context) {
        this.currentStep = null;
        this.executedSteps = [];
        this.stepResults.clear();
        
        // Réinitialiser le contexte pour retry
        if (context.resetForRetry) {
            context.resetForRetry();
        }
    }

    /**
     * Attendre un délai
     */
    async _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Obtenir le résultat d'une étape spécifique
     * @param {string} stepName - Nom de l'étape
     * @returns {Object} Résultat de l'étape
     */
    getStepResult(stepName) {
        return this.stepResults.get(stepName);
    }

    /**
     * Obtenir toutes les étapes exécutées
     * @returns {Array} Liste des étapes exécutées
     */
    getExecutedSteps() {
        return [...this.executedSteps];
    }

    /**
     * Obtenir l'étape courante
     * @returns {BaseStep} Étape en cours d'exécution
     */
    getCurrentStep() {
        return this.currentStep;
    }
}

module.exports = {
    WorkflowOrchestrator
};