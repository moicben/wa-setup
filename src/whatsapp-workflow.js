/**
 * WhatsApp Workflow - Version simplifiée fusionnée
 * Fusion de WorkflowFactory + WhatsAppAccountWorkflow + WorkflowOrchestrator + WorkflowContext
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Import des steps
const { InitializeAppStep } = require('./steps/InitializeAppStep');
const { BuyPhoneNumberStep } = require('./steps/BuyPhoneNumberStep');
const { InputPhoneNumberStep } = require('./steps/InputPhoneNumberStep');
const { CheckSMSAvailabilityStep } = require('./steps/CheckSMSAvailabilityStep');
const { RequestSMSCodeStep } = require('./steps/RequestSMSCodeStep');
const { AnalyzePostSMSStep } = require('./steps/AnalyzePostSMSStep');
const { WaitForSMSStep } = require('./steps/WaitForSMSStep');
const { InputSMSCodeStep } = require('./steps/InputSMSCodeStep');
const { FinalizeAccountStep } = require('./steps/FinalizeAccountStep');

/**
 * Contexte de workflow simplifié
 */
class SimpleWorkflowContext {
    constructor(config = {}) {
        this.config = {
            country: config.country || 'UK',
            deviceId: config.deviceId || '127.0.0.1:5585',
            smsApiKey: config.smsApiKey || process.env.SMS_ACTIVATE_API_KEY,
            verbose: config.verbose !== false,
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 10000,
            enableCloud: config.enableCloud || false,
            deviceProvider: config.deviceProvider || (config.enableCloud ? 'morelogin' : 'bluestacks'),
            ...config
        };

        this.services = {};
        this.session = {
            startTime: Date.now(),
            country: this.config.country,
            phone: null,
            smsId: null,
            smsCode: null,
            accountName: null,
            currentStep: null,
            currentStepNumber: 0,
            attempt: 1,
            maxRetries: this.config.maxRetries
        };

        this.stepResults = new Map();
        this.executedSteps = new Set();
        this.metrics = {
            totalDuration: 0,
            stepDurations: {},
            errors: [],
            screenshots: []
        };
    }

    // Accesseurs essentiels
    getStartTime() { return this.session.startTime; }
    getCountry() { return this.session.country; }
    getPhoneNumber() { return this.session.phone; }
    getSMSId() { return this.session.smsId; }
    getSMSCode() { return this.session.smsCode; }
    getAccountName() { return this.session.accountName; }
    getMetrics() { return this.metrics; }
    getCurrentStep() { return this.session.currentStep; }
    getRetryCount() { return this.session.attempt - 1; }

    // Setters
    setCountry(country) { this.session.country = country; }
    setPhoneNumber(phone) { this.session.phone = phone; }
    setSMSId(smsId) { this.session.smsId = smsId; }
    setSMSCode(code) { this.session.smsCode = code; }
    setAccountName(name) { this.session.accountName = name; }
    setCurrentStep(stepName, stepNumber) { 
        this.session.currentStep = stepName; 
        this.session.currentStepNumber = stepNumber;
    }

    // Gestion des résultats d'étapes
    hasStepResult(stepName) {
        return this.stepResults.has(stepName);
    }
    
    getStepResult(stepName) {
        return this.stepResults.get(stepName);
    }
    
    setStepResult(stepName, result) {
        this.stepResults.set(stepName, result);
        this.executedSteps.add(stepName);
    }

    // Services (seront injectés)
    get bluestack() { return this.services.bluestack; }
    get sms() { return this.services.sms; }
    get whatsapp() { return this.services.whatsapp; }

    // Méthodes utilitaires
    async takeScreenshot(filename) {
        const screenshotPath = await this.bluestack.takeScreenshot(filename);
        this.metrics.screenshots.push({
            filename,
            timestamp: Date.now(),
            attempt: this.session.attempt
        });
        return screenshotPath;
    }

    recordError(stepName, error) {
        this.metrics.errors.push({
            step: stepName,
            error: error.message,
            timestamp: Date.now(),
            attempt: this.session.attempt
        });
    }

    resetForRetry() {
        this.session.phone = null;
        this.session.smsId = null;
        this.session.smsCode = null;
        this.stepResults.clear();
        this.executedSteps.clear();
        this.session.attempt++;
    }

    async cleanup() {
        try {
            // Nettoyage SMS
            if (this.session.smsId && this.sms) {
                try {
                    await this.sms.cancelNumber(this.session.smsId);
                } catch (e) {
                    console.warn('⚠️ Impossible d\'annuler le SMS lors du nettoyage');
                }
            }

            // Nettoyage services
            if (this.services.bluestack && this.services.bluestack.cleanup) {
                await this.services.bluestack.cleanup();
            }
        } catch (error) {
            console.warn(`⚠️ Erreur nettoyage: ${error.message}`);
        }
    }

    async initialize() {
        try {
            console.log('🔧 Initialisation du contexte workflow...');

            // Créer les services
            await this._createServices();

            // Initialiser les services
            await this._initializeServices();

            console.log('✅ Contexte workflow initialisé');
            return true;
        } catch (error) {
            console.error(`❌ Erreur initialisation contexte: ${error.message}`);
            throw error;
        }
    }

    async _createServices() {
        // Import dynamique des services
        const { createBlueStacksDevice } = require('./services/device');
        const { createSMSManager } = require('./services/sms');
        const { createWhatsAppService } = require('./services/whatsapp');

        // Créer les services
        this.services.bluestack = await createBlueStacksDevice(this.config);
        this.services.sms = await createSMSManager(this.config);
        this.services.whatsapp = createWhatsAppService(this.config);
    }

    async _initializeServices() {
        // Initialiser BlueStack
        if (this.services.bluestack.initialize) {
            await this.services.bluestack.initialize();
        }

        // Initialiser WhatsApp avec device
        if (this.services.whatsapp.initialize) {
            await this.services.whatsapp.initialize(this.services.bluestack);
        }

        // Vérifier le solde SMS
        if (this.services.sms.getBalance) {
            try {
                const balance = await this.services.sms.getBalance();
                console.log(`💰 Solde SMS: ${balance.balance}₽`);
            } catch (e) {
                console.warn('⚠️ Impossible de vérifier le solde SMS');
            }
        }
    }
}

/**
 * Workflow WhatsApp simplifié
 */
class WhatsAppWorkflow {
    constructor(config = {}) {
        this.config = this._validateAndNormalizeConfig(config);
        this.context = null;
        this.steps = [];
        this.currentStep = null;
        this.executedSteps = [];
    }

    _validateAndNormalizeConfig(config) {
        const normalizedConfig = {
            country: config.country || 'UK',
            deviceId: config.deviceId || '127.0.0.1:5585',
            smsApiKey: config.smsApiKey || process.env.SMS_ACTIVATE_API_KEY,
            verbose: config.verbose !== false,
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 10000,
            enableCloud: config.enableCloud || false,
            deviceProvider: config.deviceProvider || (config.enableCloud ? 'morelogin' : 'bluestacks'),
            ...config
        };

        // Validation
        if (!normalizedConfig.smsApiKey) {
            throw new Error('Clé API SMS requise. Utilisez "npm run setup" pour configurer.');
        }
        
        const validCountries = ['UK', 'FR', 'US'];
        if (!validCountries.includes(normalizedConfig.country)) {
            throw new Error(`Pays non supporté: ${normalizedConfig.country}. Pays supportés: ${validCountries.join(', ')}`);
        }

        return normalizedConfig;
    }

    async initialize() {
        try {
            const cloudMode = this.config.enableCloud ? '🌥️ CLOUD' : '📱 LOCAL';
            console.log(`🚀 Initialisation du workflow WhatsApp ${cloudMode}`);

            // Vérifier la disponibilité cloud si demandé
            if (this.config.enableCloud && !process.env.MORELOGIN_API_URL) {
                console.warn('⚠️ Cloud activé mais MORELOGIN_API_URL manquant, fallback vers mode local');
                this.config.enableCloud = false;
                this.config.deviceProvider = 'bluestacks';
            }

            // Créer le dossier screenshots
            this._ensureScreenshotDirectory();

            // Créer le contexte
            this.context = new SimpleWorkflowContext(this.config);
            
            // Initialiser le contexte
            await this.context.initialize();
            
            // Construire les étapes
            this.steps = this._buildSteps();
            
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

    _ensureScreenshotDirectory() {
        const screenshotDir = path.join(__dirname, '../screenshots');
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }
    }

    _buildSteps() {
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

    async execute(country = null) {
        try {
            // Mettre à jour le pays si spécifié
            if (country) {
                this.context.setCountry(country);
            }

            // Exécuter avec retry
            const result = await this._executeWithRetry();
            
            return this._processResult(result);
        } catch (error) {
            console.error(`❌ Erreur exécution workflow: ${error.message}`);
            throw error;
        }
    }

    async _executeWithRetry() {
        let lastError = null;
        
        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                this._logExecutionStart(attempt);
                
                const result = await this._executeSteps();
                
                this._logExecutionSuccess(result, attempt);
                
                return result;
            } catch (error) {
                lastError = error;
                
                this._logExecutionFailure(error, attempt);
                
                // Nettoyage en cas d'erreur
                await this._performCleanup(error);
                
                if (attempt < this.config.maxRetries) {
                    console.log(`🔄 Tentative ${attempt}/${this.config.maxRetries} échouée, retry dans ${this.config.retryDelay/1000}s`);
                    await this._delay(this.config.retryDelay);
                    this._resetForRetry();
                } else {
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

    async _executeSteps() {
        const results = [];
        
        for (let i = 0; i < this.steps.length; i++) {
            const step = this.steps[i];
            this.currentStep = step;
            
            try {
                // Marquer l'étape comme en cours
                this.context.setCurrentStep(step.name, i + 1);
                
                // Exécuter l'étape
                const stepResult = await step.execute(this.context);
                
                // Sauvegarder le résultat
                this.context.setStepResult(step.name, stepResult);
                this.executedSteps.push({
                    name: step.name,
                    success: true,
                    result: stepResult
                });
                
                results.push(stepResult);
            } catch (error) {
                // Sauvegarder l'échec
                this.context.recordError(step.name, error);
                this.executedSteps.push({
                    name: step.name,
                    success: false,
                    error: error.message
                });
                
                throw error;
            }
        }
        
        return {
            success: true,
            results: results,
            executedSteps: this.executedSteps
        };
    }

    _logExecutionStart(attempt) {
        console.log(`\n🚀 === WORKFLOW WHATSAPP - TENTATIVE ${attempt}/${this.config.maxRetries} ===`);
        console.log(`🌍 Pays: ${this.context.getCountry()}`);
        console.log(`📱 Device: ${this.config.deviceId}`);
        console.log(`🔧 Mode: ${this.config.enableCloud ? 'Cloud' : 'Local'}`);
        console.log('═'.repeat(50));
    }

    _logExecutionSuccess(result, attempt) {
        const duration = Math.round((Date.now() - this.context.getStartTime()) / 1000);
        console.log(`\n🎉 === WORKFLOW TERMINÉ AVEC SUCCÈS ===`);
        console.log(`📱 Téléphone: ${this.context.getPhoneNumber()}`);
        console.log(`⏱️ Durée: ${duration}s`);
        console.log(`🔄 Tentatives: ${attempt}`);
        console.log(`🌍 Pays: ${this.context.getCountry()}`);
        console.log(`📋 Nom: ${this.context.getAccountName()}`);
        console.log('═'.repeat(50));
    }

    _logExecutionFailure(error, attempt) {
        console.error(`\n💥 === WORKFLOW ÉCHOUÉ - TENTATIVE ${attempt}/${this.config.maxRetries} ===`);
        console.error(`❌ Erreur: ${error.message}`);
        console.error(`🔄 Tentatives: ${attempt}`);
        console.error(`🌍 Pays: ${this.context.getCountry()}`);
        console.error('═'.repeat(50));
    }

    async _performCleanup(error) {
        try {
            await this.context.cleanup();
        } catch (cleanupError) {
            console.warn('⚠️ Erreur lors du nettoyage:', cleanupError.message);
        }
    }

    _resetForRetry() {
        this.currentStep = null;
        this.executedSteps = [];
        this.context.resetForRetry();
    }

    async _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    _processResult(result) {
        if (result.success) {
            const duration = Math.round((Date.now() - this.context.getStartTime()) / 1000);
            
            return {
                success: true,
                phone: this.context.getPhoneNumber(),
                country: this.context.getCountry(),
                duration: duration,
                smsId: this.context.getSMSId(),
                accountName: this.context.getAccountName(),
                attempts: this.context.getRetryCount() + 1,
                metrics: this.context.getMetrics()
            };
        } else {
            return {
                success: false,
                error: result.error,
                country: this.context.getCountry(),
                attempts: result.attempts,
                executedSteps: result.executedSteps,
                metrics: this.context.getMetrics()
            };
        }
    }

    getStatus() {
        return {
            initialized: this.context !== null,
            currentStep: this.currentStep?.name,
            executedSteps: this.executedSteps.length,
            totalSteps: this.steps.length,
            country: this.context?.getCountry(),
            phone: this.context?.getPhoneNumber(),
            cloudMode: this.config.enableCloud,
            deviceProvider: this.config.deviceProvider
        };
    }

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

    async cleanup() {
        await this.stop();
    }
}

/**
 * Factory pour créer des workflows
 */
class WorkflowFactory {
    static createWhatsAppWorkflow(config = {}) {
        return new WhatsAppWorkflow(config);
    }

    static createForCountry(country) {
        return new WhatsAppWorkflow({ country });
    }

    static createTestWorkflow() {
        return new WhatsAppWorkflow({
            country: 'UK',
            verbose: true,
            maxRetries: 1
        });
    }
}

module.exports = {
    WhatsAppWorkflow,
    WhatsAppWorkflowFactory: WorkflowFactory,
    WorkflowFactory,
    SimpleWorkflowContext
};