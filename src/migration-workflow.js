/**
 * Migration Workflow - Pour la migration de comptes WhatsApp existants
 * Version simplifiée sans étapes SMS/finalisation, optimisée pour la migration
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');

// Import des steps spécifiques à la migration
const { InitializeAppStep } = require('./steps/InitializeAppStep');
const { InputPhoneNumberStep } = require('./steps/InputPhoneNumberStep');
// Note: Pas de BuyPhoneNumber, CheckSMS, RequestSMS, WaitSMS, InputSMS pour la migration

/**
 * Contexte de workflow simplifié pour migration
 */
class MigrationWorkflowContext {
    constructor(config = {}) {
        this.config = {
            country: config.country || 'UK',
            deviceId: config.deviceId || '127.0.0.1:5585',
            verbose: config.verbose !== false,
            maxRetries: config.maxRetries || 10,
            retryDelay: config.retryDelay || 10000,
            enableCloud: config.enableCloud || false,
            deviceProvider: config.deviceProvider || (config.enableCloud ? 'morelogin' : 'bluestacks'),
            
            // Spécifique à la migration
            migrationMode: true,
            sourceAccount: config.sourceAccount || null,
            targetAccount: config.targetAccount || null,
            backupPath: config.backupPath || null,
            ...config
        };

        this.services = {};
        this.session = {
            startTime: Date.now(),
            country: this.config.country,
            sourcePhone: this.config.sourceAccount?.phone || null,
            targetPhone: this.config.targetAccount?.phone || null,
            backupRestored: false,
            migrationStep: 'init',
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
            screenshots: [],
            migrationSpecific: {
                backupSize: 0,
                dataTransferred: 0,
                contactsCount: 0,
                messagesCount: 0
            }
        };
    }

    // Accesseurs essentiels (similaires au workflow principal)
    getStartTime() { return this.session.startTime; }
    getCountry() { return this.session.country; }
    getSourcePhone() { return this.session.sourcePhone; }
    getTargetPhone() { return this.session.targetPhone; }
    getMigrationStep() { return this.session.migrationStep; }
    getMetrics() { return this.metrics; }
    getCurrentStep() { return this.session.currentStep; }
    getRetryCount() { return this.session.attempt - 1; }

    // Setters spécifiques migration
    setCountry(country) { this.session.country = country; }
    setSourcePhone(phone) { this.session.sourcePhone = phone; }
    setTargetPhone(phone) { this.session.targetPhone = phone; }
    setMigrationStep(step) { this.session.migrationStep = step; }
    setCurrentStep(stepName, stepNumber) { 
        this.session.currentStep = stepName; 
        this.session.currentStepNumber = stepNumber;
    }
    setBackupRestored(restored) { this.session.backupRestored = restored; }

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

    recordMigrationMetric(key, value) {
        this.metrics.migrationSpecific[key] = value;
    }

    resetForRetry() {
        this.session.backupRestored = false;
        this.session.migrationStep = 'init';
        this.stepResults.clear();
        this.executedSteps.clear();
        this.session.attempt++;
    }

    async cleanup() {
        try {
            // Nettoyage spécifique migration
            if (this.services.bluestack && this.services.bluestack.cleanup) {
                await this.services.bluestack.cleanup();
            }
        } catch (error) {
            console.warn(`⚠️ Erreur nettoyage migration: ${error.message}`);
        }
    }

    async initialize() {
        try {
            console.log('🔧 Initialisation du contexte migration...');

            // Créer les services (même logique que le workflow principal)
            await this._createServices();
            await this._initializeServices();

            console.log('✅ Contexte migration initialisé');
            return true;
        } catch (error) {
            console.error(`❌ Erreur initialisation contexte migration: ${error.message}`);
            throw error;
        }
    }

    async _createServices() {
        // Import dynamique des services (pas de SMS pour la migration)
        const { createBlueStacksDevice } = require('./services/device-service');
        const { createWhatsAppService } = require('./services/whatsapp-service');

        // Créer les services
        this.services.bluestack = await createBlueStacksDevice(this.config);
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
    }
}

/**
 * Workflow de migration WhatsApp
 */
class MigrationWorkflow {
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
            verbose: config.verbose !== false,
            maxRetries: config.maxRetries || 10,
            retryDelay: config.retryDelay || 10000,
            enableCloud: config.enableCloud || false,
            deviceProvider: config.deviceProvider || (config.enableCloud ? 'morelogin' : 'bluestacks'),
            
            // Spécifique migration
            migrationMode: true,
            sourceAccount: config.sourceAccount || null,
            targetAccount: config.targetAccount || null,
            backupPath: config.backupPath || null,
            ...config
        };

        // Validation migration
        if (!normalizedConfig.sourceAccount && !normalizedConfig.targetAccount) {
            console.warn('⚠️ Aucun compte source/cible spécifié pour la migration');
        }

        return normalizedConfig;
    }

    async initialize() {
        try {
            const cloudMode = this.config.enableCloud ? '🌥️ CLOUD' : '📱 LOCAL';
            console.log(`🔄 Initialisation du workflow Migration WhatsApp ${cloudMode}`);

            // Vérifier la disponibilité cloud si demandé
            if (this.config.enableCloud && !process.env.MORELOGIN_API_URL) {
                console.warn('⚠️ Cloud activé mais MORELOGIN_API_URL manquant, fallback vers mode local');
                this.config.enableCloud = false;
                this.config.deviceProvider = 'bluestacks';
            }

            // Créer le dossier screenshots
            this._ensureScreenshotDirectory();

            // Créer le contexte
            this.context = new MigrationWorkflowContext(this.config);
            
            // Initialiser le contexte
            await this.context.initialize();
            
            // Construire les étapes de migration (sans SMS)
            this.steps = this._buildMigrationSteps();
            
            const modeInfo = this.config.enableCloud ? 
                `Mode cloud (${this.config.deviceProvider})` : 
                `Mode local (${this.config.deviceProvider})`;
            
            console.log(`✅ Workflow Migration initialisé avec succès - ${modeInfo}`);
            console.log(`📋 Étapes de migration: ${this.steps.length} (sans SMS)`);
            return true;
        } catch (error) {
            console.error(`❌ Erreur initialisation workflow migration: ${error.message}`);
            throw error;
        }
    }

    _ensureScreenshotDirectory() {
        const screenshotDir = path.join(__dirname, '../screenshots');
        if (!fs.existsSync(screenshotDir)) {
            fs.mkdirSync(screenshotDir, { recursive: true });
        }
    }

    /**
     * Construire les étapes de migration (pas de SMS)
     */
    _buildMigrationSteps() {
        // Étapes spécifiques à la migration - sans SMS
        return [
            new InitializeAppStep(),
            new InputPhoneNumberStep(), // Saisir le numéro cible
            // Pas de BuyPhoneNumberStep
            // Pas de CheckSMSAvailabilityStep  
            // Pas de RequestSMSCodeStep
            // Pas de AnalyzePostSMSStep
            // Pas de WaitForSMSStep
            // Pas de InputSMSCodeStep
            // Pas de FinalizeAccountStep
            
            // À la place, étapes spécifiques migration (à développer plus tard)
            // new RestoreBackupStep(),
            // new VerifyMigrationStep(),
            // new CompleteMigrationStep()
        ];
    }

    async execute(migrationConfig = null) {
        try {
            // Mettre à jour la configuration migration si spécifiée
            if (migrationConfig) {
                Object.assign(this.config, migrationConfig);
                this.context.config = { ...this.context.config, ...migrationConfig };
            }

            // Exécuter avec retry
            const result = await this._executeWithRetry();
            
            return this._processResult(result);
        } catch (error) {
            console.error(`❌ Erreur exécution workflow migration: ${error.message}`);
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
                    console.log(`🔄 Tentative migration ${attempt}/${this.config.maxRetries} échouée, retry dans ${this.config.retryDelay/1000}s`);
                    await this._delay(this.config.retryDelay);
                    this._resetForRetry();
                } else {
                    return {
                        success: false,
                        error: lastError.message,
                        attempts: attempt,
                        executedSteps: this.executedSteps,
                        migrationType: 'account_migration'
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
            executedSteps: this.executedSteps,
            migrationType: 'account_migration'
        };
    }

    _logExecutionStart(attempt) {
        console.log(`\n🔄 === WORKFLOW MIGRATION WHATSAPP - TENTATIVE ${attempt}/${this.config.maxRetries} ===`);
        console.log(`🌍 Pays: ${this.context.getCountry()}`);
        console.log(`📱 Device: ${this.config.deviceId}`);
        console.log(`🔧 Mode: ${this.config.enableCloud ? 'Cloud' : 'Local'}`);
        console.log(`📞 Source: ${this.context.getSourcePhone() || 'Non spécifié'}`);
        console.log(`📞 Cible: ${this.context.getTargetPhone() || 'Non spécifié'}`);
        console.log('═'.repeat(50));
    }

    _logExecutionSuccess(result, attempt) {
        const duration = Math.round((Date.now() - this.context.getStartTime()) / 1000);
        console.log(`\n🎉 === WORKFLOW MIGRATION TERMINÉ AVEC SUCCÈS ===`);
        console.log(`📞 Compte source: ${this.context.getSourcePhone() || 'Non spécifié'}`);
        console.log(`📞 Compte cible: ${this.context.getTargetPhone() || 'Non spécifié'}`);
        console.log(`⏱️ Durée: ${duration}s`);
        console.log(`🔄 Tentatives: ${attempt}`);
        console.log(`🌍 Pays: ${this.context.getCountry()}`);
        console.log(`📋 Étapes de migration: ${this.executedSteps.length}`);
        console.log('═'.repeat(50));
    }

    _logExecutionFailure(error, attempt) {
        console.error(`\n💥 === WORKFLOW MIGRATION ÉCHOUÉ - TENTATIVE ${attempt}/${this.config.maxRetries} ===`);
        console.error(`❌ Erreur: ${error.message}`);
        console.error(`🔄 Tentatives: ${attempt}`);
        console.error(`🌍 Pays: ${this.context.getCountry()}`);
        console.error('═'.repeat(50));
    }

    async _performCleanup(error) {
        try {
            await this.context.cleanup();
        } catch (cleanupError) {
            console.warn('⚠️ Erreur lors du nettoyage migration:', cleanupError.message);
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
                sourcePhone: this.context.getSourcePhone(),
                targetPhone: this.context.getTargetPhone(),
                country: this.context.getCountry(),
                duration: duration,
                attempts: this.context.getRetryCount() + 1,
                metrics: this.context.getMetrics(),
                migrationType: 'account_migration',
                migrationStep: this.context.getMigrationStep()
            };
        } else {
            return {
                success: false,
                error: result.error,
                country: this.context.getCountry(),
                attempts: result.attempts,
                executedSteps: result.executedSteps,
                metrics: this.context.getMetrics(),
                migrationType: 'account_migration'
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
            sourcePhone: this.context?.getSourcePhone(),
            targetPhone: this.context?.getTargetPhone(),
            migrationStep: this.context?.getMigrationStep(),
            cloudMode: this.config.enableCloud,
            deviceProvider: this.config.deviceProvider,
            workflowType: 'migration'
        };
    }

    async stop() {
        try {
            if (this.context) {
                await this.context.cleanup();
            }
            console.log('🛑 Workflow migration arrêté');
        } catch (error) {
            console.warn('⚠️ Erreur arrêt workflow migration:', error.message);
        }
    }

    async cleanup() {
        await this.stop();
    }
}

/**
 * Factory pour créer des workflows de migration
 */
class MigrationWorkflowFactory {
    static createMigrationWorkflow(config = {}) {
        return new MigrationWorkflow({ ...config, migrationMode: true });
    }

    static createForAccounts(sourceAccount, targetAccount, country = 'UK') {
        return new MigrationWorkflow({ 
            sourceAccount, 
            targetAccount, 
            country, 
            migrationMode: true 
        });
    }

    static createTestMigrationWorkflow() {
        return new MigrationWorkflow({
            country: 'UK',
            verbose: true,
            maxRetries: 1,
            migrationMode: true,
            sourceAccount: { phone: '+44123456789' },
            targetAccount: { phone: '+44987654321' }
        });
    }
}

module.exports = {
    MigrationWorkflow,
    MigrationWorkflowFactory,
    MigrationWorkflowContext
};