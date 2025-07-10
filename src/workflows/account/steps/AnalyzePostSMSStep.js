/**
 * Étape d'analyse post-soumission SMS
 * Analyse l'écran après la demande de SMS pour détecter les erreurs
 */

const { BaseStep } = require('../../base/BaseStep');
const { SMSFailureDetector } = require('../../utils/SMSFailureDetector');
const { CleanupManager } = require('../../../core/cleanup/CleanupManager');
const { getWorkflowStatusManager } = require('../../utils/WorkflowStatusManager');

class AnalyzePostSMSStep extends BaseStep {
    constructor() {
        super('Analyze Post SMS', ['Request SMS Code']);
        this.smsFailureDetector = new SMSFailureDetector();
    }

    /**
     * Exécuter l'étape d'analyse post-SMS
     */
    async _execute(context) {
        try {
            // Récupérer le screenshot de l'étape précédente
            const requestResult = this._getDependencyResult(context, 'Request SMS Code');
            const screenshotPath = requestResult.screenshotPath;
            
            if (!screenshotPath) {
                throw new Error('Screenshot post-soumission non disponible');
            }

            console.log('📸 Analyse Post-Soumission SMS...');

            // Initialiser le détecteur d'erreurs SMS
            await this.smsFailureDetector.initialize();

            // Analyser le screenshot pour détecter les erreurs
            const postSMSAnalysis = await this.smsFailureDetector.analyzePostSMSSubmission(screenshotPath);

            // Traiter les résultats selon le type d'analyse
            const result = await this._processAnalysisResult(context, postSMSAnalysis);

            console.log('✅ Analyse post-SMS terminée');

            return result;

        } catch (error) {
            // Prendre un screenshot d'erreur
            await this._takeScreenshot(context, 'error');
            
            // Mettre à jour le statut en base de données
            const statusManager = getWorkflowStatusManager();
            await statusManager.initialize();
            await statusManager.markAsError(context, 'POST_SMS_ANALYSIS_FAILED', error.message, context.getCurrentAttempt());
            
            throw new Error(`Erreur analyse post-SMS: ${error.message}`);
        }
    }

    /**
     * Traiter les résultats de l'analyse
     */
    async _processAnalysisResult(context, postSMSAnalysis) {
        // Vérifier les textes d'erreur WhatsApp critiques
        const extractedText = postSMSAnalysis.extractedText || '';
        const criticalErrors = [
            'Login not available',
            'For security reasons',
            'we can\'t log you in'
        ];
        
        const hasCriticalError = criticalErrors.some(errorText => 
            extractedText.toLowerCase().includes(errorText.toLowerCase())
        );
        
        if (hasCriticalError) {
            console.error('🚨 ERREUR CRITIQUE WHATSAPP DÉTECTÉE - ARRÊT IMMÉDIAT');
            console.error(`📝 Texte détecté: ${extractedText}`);
            throw new Error('CRITICAL_WHATSAPP_ERROR_ABORT');
        }

        if (postSMSAnalysis.isSMSFailure) {
            // Erreur SMS détectée
            await this._handleSMSFailure(context, postSMSAnalysis);
        } else if (!postSMSAnalysis.success) {
            // Échec de l'analyse elle-même
            await this._handleAnalysisFailure(context, postSMSAnalysis);
        } else {
            // Analyse réussie, pas d'erreur détectée
            console.log('✅ Aucune erreur SMS détectée');
        }

        return {
            success: postSMSAnalysis.success,
            isSMSFailure: postSMSAnalysis.isSMSFailure,
            failureType: postSMSAnalysis.failureType,
            errorMessage: postSMSAnalysis.errorMessage,
            confidence: postSMSAnalysis.confidence,
            shouldRetryWithNewNumber: postSMSAnalysis.shouldRetryWithNewNumber,
            extractedText: postSMSAnalysis.extractedText,
            details: postSMSAnalysis.details,
            timestamp: Date.now()
        };
    }

    /**
     * Gérer une erreur SMS détectée
     */
    async _handleSMSFailure(context, postSMSAnalysis) {
        console.error('\n🚨 === ERREUR SMS DÉTECTÉE ===');
        console.error(`💥 Type: ${postSMSAnalysis.failureType}`);
        console.error(`📝 Message: ${postSMSAnalysis.errorMessage}`);
        console.error(`🎯 Confiance: ${Math.round(postSMSAnalysis.confidence * 100)}%`);
        
        if (postSMSAnalysis.shouldRetryWithNewNumber) {
            console.log('🔄 Retry automatique avec nouveau numéro recommandé');
            
            // Tenter d'annuler le numéro actuel (ne pas échouer si ça ne marche pas)
            const cancelled = await this._cancelCurrentNumber(context);
            if (!cancelled) {
                console.log('💡 Annulation impossible, mais le retry continuera quand même');
            }
            
            // Déclencher retry avec nouveau numéro
            throw new Error('SMS_SENDING_FAILED_RETRY_NEEDED');
        } else {
            console.warn('⚠️ Erreur de service détectée, tentative de continuation...');
            // Continuer malgré l'erreur de service (pas un problème de numéro)
        }
    }

    /**
     * Gérer un échec d'analyse
     */
    async _handleAnalysisFailure(context, postSMSAnalysis) {
        console.error('🚨 ANALYSE POST-SMS ÉCHOUÉE - ABANDON IMMÉDIAT');
        
        // Mettre à jour le statut en base de données
        const statusManager = getWorkflowStatusManager();
        await statusManager.initialize();
        await statusManager.handlePostSMSAnalysisError(context, 'Analyse post-SMS échouée', context.getCurrentAttempt());
        
        await CleanupManager.performFullCleanup(context);
        throw new Error('POST_SMS_ANALYSIS_FAILED_ABORT');
    }

    /**
     * Annuler le numéro actuel avec gestion améliorée
     */
    async _cancelCurrentNumber(context) {
        try {
            const buyResult = this._getDependencyResult(context, 'Buy Phone Number');
            const numberId = buyResult?.smsId;
            
            if (!numberId) {
                console.warn('⚠️ Aucun numéro SMS à annuler');
                return false;
            }
            
            console.log(`🗑️ Tentative d'annulation du numéro SMS: ${numberId}`);
            
            // Utiliser la nouvelle gestion d'annulation avec options
            const cancelOptions = {
                purchaseTime: buyResult.timestamp || buyResult.purchaseTime,
                minDelay: 30000, // 30 secondes minimum
                force: false // Ne pas forcer, respecter les délais
            };
            
            const success = await context.cancelSMS(numberId, cancelOptions);
            
            if (success) {
                console.log('✅ Numéro SMS annulé avec succès');
                return true;
            } else {
                console.warn('⚠️ Annulation SMS échouée - probablement trop tôt ou déjà utilisé');
                console.log('💡 Le numéro sera marqué comme utilisé pour éviter les frais supplémentaires');
                return false;
            }
        } catch (error) {
            console.warn(`⚠️ Erreur lors de l'annulation SMS: ${error.message}`);
            return false;
        }
    }

    /**
     * Vérifications préalables
     */
    async canExecute(context) {
        try {
            // Vérifier la demande de SMS
            const requestResult = this._getDependencyResult(context, 'Request SMS Code');
            if (!requestResult || !requestResult.success) {
                throw new Error('Demande de SMS non terminée');
            }

            if (!requestResult.screenshotPath) {
                throw new Error('Screenshot post-soumission non disponible');
            }

            // Vérifier que le screenshot existe
            const fs = require('fs');
            if (!fs.existsSync(requestResult.screenshotPath)) {
                throw new Error('Fichier screenshot introuvable');
            }

            // Initialiser le détecteur d'erreurs SMS
            const detectorAvailable = await this.smsFailureDetector.initialize();
            if (!detectorAvailable) {
                console.warn('⚠️ Détecteur SMS non disponible, utilisation du fallback');
            }

            return true;
        } catch (error) {
            console.error(`❌ Prérequis non satisfaits pour analyse post-SMS: ${error.message}`);
            return false;
        }
    }

    /**
     * Nettoyage si l'étape échoue
     */
    async cleanup(context) {
        try {
            // Prendre un screenshot de l'état actuel
            await this._takeScreenshot(context, 'cleanup');
            
            console.log('🧹 Nettoyage AnalyzePostSMS terminé');
        } catch (error) {
            console.warn(`⚠️ Erreur nettoyage AnalyzePostSMS: ${error.message}`);
        }
    }

    /**
     * Gestion des erreurs spécifiques
     */
    handleError(error, context) {
        if (error.message.includes('CRITICAL_WHATSAPP_ERROR_ABORT')) {
            return {
                shouldRetry: false,
                isFatal: true,
                reason: 'Erreur critique WhatsApp détectée, arrêt définitif'
            };
        }

        if (error.message.includes('SMS_SENDING_FAILED_RETRY_NEEDED')) {
            return {
                shouldRetry: true,
                isFatal: false,
                reason: 'Erreur SMS détectée, retry avec nouveau numéro'
            };
        }

        if (error.message.includes('POST_SMS_ANALYSIS_FAILED_ABORT')) {
            return {
                shouldRetry: true,
                isFatal: false,
                reason: 'Analyse post-SMS échouée, retry complet'
            };
        }

        if (error.message.includes('screenshot') || error.message.includes('Screenshot')) {
            return {
                shouldRetry: true,
                isFatal: false,
                reason: 'Problème screenshot, retry possible'
            };
        }

        if (error.message.includes('OCR') || error.message.includes('analyse')) {
            return {
                shouldRetry: true,
                isFatal: false,
                reason: 'Erreur analyse OCR, retry possible'
            };
        }

        return {
            shouldRetry: true,
            isFatal: false,
            reason: 'Erreur générique, retry possible'
        };
    }

    /**
     * Validation des résultats
     */
    validateResult(result) {
        if (typeof result.success !== 'boolean') {
            throw new Error('Statut de succès manquant dans le résultat');
        }

        if (typeof result.isSMSFailure !== 'boolean') {
            throw new Error('Statut d\'erreur SMS manquant dans le résultat');
        }

        if (result.isSMSFailure && !result.failureType) {
            throw new Error('Type d\'erreur SMS manquant pour une erreur détectée');
        }

        if (result.confidence !== undefined && (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1)) {
            throw new Error('Confiance invalide dans le résultat');
        }

        return true;
    }

    /**
     * Obtenir le numéro d'étape pour les screenshots
     */
    _getStepNumber() {
        return '06';
    }

    /**
     * Informations sur cette étape
     */
    getDescription() {
        return {
            name: this.name,
            description: 'Analyse l\'écran post-soumission SMS pour détecter les erreurs WhatsApp',
            inputs: ['Screenshot post-soumission', 'ID SMS', 'Détecteur SMS'],
            outputs: ['Analyse erreurs', 'Décision retry', 'Texte extrait'],
            duration: '~5-20 secondes',
            canFail: true,
            retryable: true,
            dependencies: ['SMSFailureDetector', 'OCR Tesseract', 'CleanupManager'],
            specialFeatures: ['Détection erreurs SMS', 'Retry automatique', 'Nettoyage intelligent']
        };
    }
}

module.exports = { AnalyzePostSMSStep };