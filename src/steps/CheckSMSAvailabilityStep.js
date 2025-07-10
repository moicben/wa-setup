/**
 * Étape de vérification de la disponibilité SMS
 * Analyse l'écran de vérification et détermine si le SMS est disponible
 */

const { BaseStep } = require('../workflows/base/BaseStep');
const { getOCRService } = require('../utils/ocr');
const { getLogger } = require('../utils/logger');

class CheckSMSAvailabilityStep extends BaseStep {
    constructor() {
        super('Check SMS Availability', ['Input Phone Number']);
        this.ocrService = getOCRService();
    }

    /**
     * Exécuter l'étape de vérification SMS
     */
    async _execute(context) {
        try {
            // Récupérer l'ID SMS depuis l'étape d'achat
            const buyResult = this._getDependencyResult(context, 'Buy Phone Number');
            const smsId = buyResult.smsId;
            
            console.log(`🔍 Vérification SMS pour le numéro ID: ${smsId}`);

            // Étape 1: Naviguer vers les options de vérification
            await this._navigateToVerificationOptions(context);

            // Étape 2: Prendre un screenshot pour analyse
            const screenshotPath = await this._takeScreenshot(context, 'verification_options');

            // Étape 3: Analyser les options avec OCR
            const ocrResult = await this._analyzeVerificationOptions(context, screenshotPath);

            // Étape 4: Évaluer la disponibilité SMS
            const availabilityResult = await this._evaluateSMSAvailability(context, ocrResult, smsId);

            // Étape 5: Prendre décision selon la confiance
            await this._makeDecisionBasedOnConfidence(context, availabilityResult);

            return {
                success: true,
                canReceiveSMS: availabilityResult.canReceiveSMS,
                confidence: availabilityResult.confidence,
                reason: availabilityResult.reason,
                phoneNumber: availabilityResult.phoneNumber,
                ocrDetails: ocrResult,
                timestamp: Date.now()
            };

        } catch (error) {
            // Prendre un screenshot d'erreur
            await this._takeScreenshot(context, 'error');
            
            // Mettre à jour le statut en base de données
            const statusManager = getWorkflowStatusManager();
            await statusManager.initialize();
            await statusManager.markAsError(context, 'SMS_AVAILABILITY_CHECK_FAILED', error.message, context.getCurrentAttempt());
            
            throw new Error(`Erreur vérification SMS: ${error.message}`);
        }
    }

    /**
     * Naviguer vers les options de vérification
     */
    async _navigateToVerificationOptions(context) {
        console.log('🧭 Navigation vers les options de vérification...');

        // Afficher les méthodes de vérification
        await this._pressKey(context, 61); // Tab
        await this._wait(context, 'short');
        await this._pressKey(context, 61); // Tab
        await this._wait(context, 'short');
        await this._pressKey(context, 61); // Tab
        await this._wait(context, 'medium');
        await this._pressKey(context, 62); // Space
        await this._wait(context, 'long');
        
        // Sélectionner l'option SMS
        console.log('🔘 Sélection de l\'option SMS...');
        const smsRadioButton = { x: 840, y: 1540 };
        
        console.log(`🎯 Clic sur option SMS à (${smsRadioButton.x}, ${smsRadioButton.y})`);
        await this._click(context, smsRadioButton.x, smsRadioButton.y);
        await this._wait(context, 'short');
    }

    /**
     * Analyser les options de vérification avec OCR
     */
    async _analyzeVerificationOptions(context, screenshotPath) {
        console.log('🔍 Analyse OCR des options de vérification...');
        
        // Initialiser le service OCR
        await this.ocrService.initialize();
        
        // Analyser le screenshot
        const ocrResult = await this.ocrService.analyzeVerificationOptions(screenshotPath);
        
        return ocrResult;
    }

    /**
     * Évaluer la disponibilité SMS
     */
    async _evaluateSMSAvailability(context, ocrResult, smsId) {
        if (ocrResult.smsAvailable) {
            console.log('✅ SMS disponible - Options de vérification détectées');
            console.log(`📱 Numéro détecté: ${ocrResult.phoneNumber || 'N/A'}`);
            
            return {
                success: true,
                canReceiveSMS: true,
                confidence: ocrResult.confidence,
                reason: ocrResult.reason,
                phoneNumber: ocrResult.phoneNumber,
                details: ocrResult
            };
        } else {
            console.log('❌ SMS non disponible - Options désactivées ou absentes');
            return {
                success: false,
                canReceiveSMS: false,
                confidence: ocrResult.confidence,
                reason: ocrResult.reason || 'Options SMS non disponibles',
                phoneNumber: ocrResult.phoneNumber,
                details: ocrResult
            };
        }
    }

    /**
     * Prendre une décision basée sur la confiance
     */
    async _makeDecisionBasedOnConfidence(context, availabilityResult) {
        if (!availabilityResult.canReceiveSMS) {
            console.error(`❌ SMS non disponible: ${availabilityResult.reason}`);
            console.log(`🎯 Confiance: ${Math.round(availabilityResult.confidence * 100)}%`);
            
            // Utiliser StrictDecisionEngine pour décider
            const confidence = availabilityResult.confidence || 0;
            const decision = StrictDecisionEngine.evaluateConfidence(confidence, 'SMS_CHECK');
            
            // Journaliser la décision
            StrictDecisionEngine.logDecision(decision, 'SMS_AVAILABILITY_CHECK');
            
            // Traitement selon la décision
            await this._handleDecision(context, decision);
        } else {
            console.log(`✅ SMS disponible: ${availabilityResult.reason}`);
            console.log(`🎯 Confiance: ${Math.round(availabilityResult.confidence * 100)}%`);
        }
    }

    /**
     * Gérer la décision du moteur de décision
     */
    async _handleDecision(context, decision) {
        const statusManager = getWorkflowStatusManager();
        await statusManager.initialize();

        if (decision.decision === 'CONTINUE') {
            console.log(`✅ ${decision.reason} - Continuation autorisée`);
            // Ne rien faire, continuer normalement
        } else if (decision.decision === 'VALIDATE') {
            console.log(`🔍 ${decision.reason} - Tests supplémentaires requis`);
            console.error('🚨 VALIDATION SUPPLÉMENTAIRE REQUISE = ABANDON IMMÉDIAT');
            
            // Mettre à jour le statut en base de données
            await statusManager.handleValidationError(context, 'Validation supplémentaire requise', context.getCurrentAttempt());
            
            await CleanupManager.performFullCleanup(context);
            throw new Error('SMS_VALIDATION_REQUIRED_ABORT');
        } else {
            // ABORT ou PANIC
            console.error(`❌ ${decision.reason} - ABANDON IMMÉDIAT`);
            
            // Mettre à jour le statut en base de données
            await statusManager.handleLowConfidenceError(context, decision, context.getCurrentAttempt());
            
            await CleanupManager.performFullCleanup(context);
            throw new Error('SMS_CONFIDENCE_TOO_LOW_RETRY_NEEDED');
        }
    }

    /**
     * Vérifications préalables
     */
    async canExecute(context) {
        try {
            // Vérifier la saisie du numéro
            const inputResult = this._getDependencyResult(context, 'Input Phone Number');
            if (!inputResult || !inputResult.success) {
                throw new Error('Saisie du numéro non terminée');
            }

            // Vérifier l'achat du numéro (pour l'ID SMS)
            const buyResult = this._getDependencyResult(context, 'Buy Phone Number');
            if (!buyResult || !buyResult.smsId) {
                throw new Error('ID SMS non disponible');
            }

            // Vérifier le service BlueStack
            if (!context.bluestack) {
                throw new Error('Service BlueStack non configuré');
            }

            // Initialiser le service OCR
            const ocrInitialized = await this.ocrService.initialize();
            if (!ocrInitialized) {
                console.warn('⚠️ OCR non disponible, utilisation du fallback');
            }

            return true;
        } catch (error) {
            console.error(`❌ Prérequis non satisfaits pour vérification SMS: ${error.message}`);
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
            
            console.log('🧹 Nettoyage CheckSMSAvailability terminé');
        } catch (error) {
            console.warn(`⚠️ Erreur nettoyage CheckSMSAvailability: ${error.message}`);
        }
    }

    /**
     * Gestion des erreurs spécifiques
     */
    handleError(error, context) {
        if (error.message.includes('SMS_CONFIDENCE_TOO_LOW')) {
            return {
                shouldRetry: true,
                isFatal: false,
                reason: 'Confiance trop faible, retry avec nouveau numéro'
            };
        }

        if (error.message.includes('SMS_VALIDATION_REQUIRED')) {
            return {
                shouldRetry: true,
                isFatal: false,
                reason: 'Validation supplémentaire requise, retry'
            };
        }

        if (error.message.includes('OCR') || error.message.includes('analyse')) {
            return {
                shouldRetry: true,
                isFatal: false,
                reason: 'Erreur d\'analyse OCR, retry possible'
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
        if (!result.success) {
            throw new Error('Résultat de vérification invalide');
        }

        if (typeof result.canReceiveSMS !== 'boolean') {
            throw new Error('Statut SMS manquant dans le résultat');
        }

        if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 1) {
            throw new Error('Confiance invalide dans le résultat');
        }

        return true;
    }

    /**
     * Obtenir le numéro d'étape pour les screenshots
     */
    _getStepNumber() {
        return '04';
    }

    /**
     * Informations sur cette étape
     */
    getDescription() {
        return {
            name: this.name,
            description: 'Vérifie la disponibilité SMS avec analyse OCR et moteur de décision strict',
            inputs: ['Numéro saisi', 'ID SMS', 'Écran options de vérification'],
            outputs: ['Disponibilité SMS', 'Confiance', 'Décision moteur'],
            duration: '~10-25 secondes',
            canFail: true,
            retryable: true,
            dependencies: ['OCR Tesseract', 'StrictDecisionEngine', 'CleanupManager'],
            specialFeatures: ['Analyse OCR avancée', 'Moteur de décision strict', 'Fallback automatique']
        };
    }
}

module.exports = { CheckSMSAvailabilityStep };