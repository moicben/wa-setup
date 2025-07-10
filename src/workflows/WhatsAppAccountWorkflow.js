/**
 * WhatsAppAccountWorkflow - Workflow spécialisé pour la création de comptes WhatsApp
 * Remplace la logique monolithique de workflow.js
 */

const { WorkflowOrchestrator } = require('./WorkflowOrchestrator');
const { WorkflowContext } = require('./base/WorkflowContext');
const { WorkflowLogger } = require('./utils/WorkflowLogger');

// Import des steps
const { InitializeAppStep } = require('./account/steps/InitializeAppStep');
const { BuyPhoneNumberStep } = require('./account/steps/BuyPhoneNumberStep');
const { InputPhoneNumberStep } = require('./account/steps/InputPhoneNumberStep');
const { CheckSMSAvailabilityStep } = require('./account/steps/CheckSMSAvailabilityStep');
const { RequestSMSCodeStep } = require('./account/steps/RequestSMSCodeStep');
const { AnalyzePostSMSStep } = require('./account/steps/AnalyzePostSMSStep');
const { WaitForSMSStep } = require('./account/steps/WaitForSMSStep');
const { InputSMSCodeStep } = require('./account/steps/InputSMSCodeStep');
const { FinalizeAccountStep } = require('./account/steps/FinalizeAccountStep');

class WhatsAppAccountWorkflow {
    constructor(config = {}) {
        this.config = {
            country: config.country || 'UK',
            deviceId: config.deviceId || '127.0.0.1:5585',
            smsApiKey: config.smsApiKey || process.env.SMS_ACTIVATE_API_KEY,
            verbose: config.verbose !== false,
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 10000,
            
            // Options cloud MoreLogin
            enableCloud: config.enableCloud || false,
            deviceProvider: config.deviceProvider || (config.enableCloud ? 'morelogin' : 'bluestacks')
        };

        this.orchestrator = new WorkflowOrchestrator();
        this.context = null;
        this.steps = [];
    }

    /**
     * Initialiser le workflow
     */
    async initialize() {
        try {
            const cloudMode = this.config.enableCloud ? '🌥️ CLOUD' : '📱 LOCAL';
            WorkflowLogger.logStep(`🚀 Initialisation du workflow WhatsApp ${cloudMode}`);

            // Vérifier la disponibilité cloud si demandé
            if (this.config.enableCloud && !process.env.MORELOGIN_API_URL) {
                console.warn('⚠️ Cloud activé mais MORELOGIN_API_URL manquant, fallback vers mode local');
                this.config.enableCloud = false;
                this.config.deviceProvider = 'bluestacks';
            }

            // Créer le contexte du workflow
            this.context = new WorkflowContext(this.config);
            
            // Initialiser le contexte
            await this.context.initialize();
            
            // Construire la pipeline d'étapes
            this.steps = this._buildStepPipeline();
            
            const modeInfo = this.config.enableCloud ? 
                `Mode cloud (${this.config.deviceProvider})` : 
                `Mode local (${this.config.deviceProvider})`;
            
            console.log(`✅ Workflow initialisé avec succès - ${modeInfo}`);
            return true;
            
        } catch (error) {
            console.error(`❌ Erreur initialisation workflow: ${error.message}`);
            throw error;
        }
    }

    /**
     * Construire la pipeline d'étapes
     * @returns {Array} Liste des étapes
     */
    _buildStepPipeline() {
        return [
            new InitializeAppStep(),
            new BuyPhoneNumberStep(),
            new InputPhoneNumberStep(),
            new CheckSMSAvailabilityStep(),
            new RequestSMSCodeStep(),
            new AnalyzePostSMSStep(),
            new WaitForSMSStep(),
            new InputSMSCodeStep(),
            new FinalizeAccountStep()
        ];
    }

    /**
     * Exécuter le workflow de création de compte
     * @param {string} country - Pays pour le compte (optionnel)
     * @returns {Object} Résultat de l'exécution
     */
    async execute(country = null) {
        try {
            // Mettre à jour le pays si spécifié
            if (country) {
                this.context.setCountry(country);
            }

            // Configurer les options d'exécution
            const executionOptions = {
                maxRetries: this.config.maxRetries,
                retryDelay: this.config.retryDelay,
                continueOnError: false,
                enableCleanup: true
            };

            // Exécuter les étapes via l'orchestrateur
            const result = await this.orchestrator.executeSteps(
                this.steps,
                this.context,
                executionOptions
            );

            // Traiter le résultat
            return this._processResult(result);
            
        } catch (error) {
            console.error(`❌ Erreur exécution workflow: ${error.message}`);
            throw error;
        }
    }

    /**
     * Traiter le résultat de l'exécution
     * @param {Object} result - Résultat de l'orchestrateur
     * @returns {Object} Résultat formaté
     */
    _processResult(result) {
        if (result.success) {
            // Succès - collecter les informations finales
            const duration = Math.round((Date.now() - this.context.getStartTime()) / 1000);
            
            return {
                success: true,
                phone: this.context.getPhoneNumber(),
                country: this.context.getCountry(),
                duration: duration,
                smsId: this.context.getSMSId(),
                accountName: this.context.getAccountName(),
                attempts: this.orchestrator.getExecutedSteps().length,
                stepResults: result.stepResults,
                metrics: this.context.getMetrics()
            };
        } else {
            // Échec - retourner les informations d'erreur
            return {
                success: false,
                error: result.error,
                country: this.context.getCountry(),
                attempts: result.attempts,
                executedSteps: result.executedSteps,
                stepResults: result.stepResults || {},
                metrics: this.context.getMetrics()
            };
        }
    }

    /**
     * Obtenir les métriques du workflow
     * @returns {Object} Métriques collectées
     */
    getMetrics() {
        return this.context ? this.context.getMetrics() : {};
    }

    /**
     * Obtenir le statut actuel du workflow
     * @returns {Object} Statut du workflow
     */
    getStatus() {
        return {
            initialized: this.context !== null,
            currentStep: this.orchestrator.getCurrentStep()?.name,
            executedSteps: this.orchestrator.getExecutedSteps().length,
            totalSteps: this.steps.length,
            country: this.context?.getCountry(),
            phone: this.context?.getPhoneNumber(),
            cloudMode: this.config.enableCloud,
            deviceProvider: this.config.deviceProvider
        };
    }

    /**
     * Arrêter le workflow
     */
    async stop() {
        try {
            if (this.context) {
                await this.context.cleanup();
            }
            
            console.log('🛑 Workflow arrêté');
            
        } catch (error) {
            console.warn('⚠️ Erreur arrêt workflow:', error.message);
        }
    }

    /**
     * Nettoyer les ressources
     */
    async cleanup() {
        await this.stop();
    }
}

module.exports = {
    WhatsAppAccountWorkflow
};