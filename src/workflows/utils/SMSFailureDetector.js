/**
 * Détecteur d'échecs SMS pour WhatsApp
 * Analyse les captures d'écran pour identifier les erreurs d'envoi SMS
 */

const { OCRAnalyzer } = require('./OCRAnalyzer');

class SMSFailureDetector {
    constructor() {
        this.ocrAnalyzer = new OCRAnalyzer();
        this.initialized = false;
    }

    /**
     * Initialiser le détecteur
     */
    async initialize() {
        if (!this.initialized) {
            await this.ocrAnalyzer.initialize();
            this.initialized = true;
        }
        return this.initialized;
    }

    /**
     * Analyser un screenshot pour détecter les erreurs SMS
     */
    async analyzePostSMSSubmission(screenshotPath) {
        console.log('🔍 Analyse post-soumission SMS...');
        
        try {
            if (!screenshotPath || !require('fs').existsSync(screenshotPath)) {
                throw new Error('Screenshot non trouvé pour l\'analyse post-soumission');
            }
            
            // Analyser avec OCR
            const analysisResult = await this.ocrAnalyzer.analyzeVerificationOptions(screenshotPath);
            const text = analysisResult.extractedText;
            
            console.log('📝 Texte extrait:', text.substring(0, 300) + '...');
            
            // Détecter les erreurs SMS spécifiques
            const smsFailureAnalysis = this.detectSMSFailure(text);
            
            if (smsFailureAnalysis.isSMSFailure) {
                console.error('🚨 ERREUR SMS DÉTECTÉE !');
                console.error(`📝 Type: ${smsFailureAnalysis.failureType}`);
                console.error(`💬 Message: ${smsFailureAnalysis.errorMessage}`);
                console.error(`🎯 Confiance: ${Math.round(smsFailureAnalysis.confidence * 100)}%`);
                
                return {
                    success: false,
                    isSMSFailure: true,
                    failureType: smsFailureAnalysis.failureType,
                    errorMessage: smsFailureAnalysis.errorMessage,
                    confidence: smsFailureAnalysis.confidence,
                    shouldRetryWithNewNumber: smsFailureAnalysis.shouldRetryWithNewNumber,
                    extractedText: text,
                    details: smsFailureAnalysis
                };
            }
            
            // Pas d'erreur détectée
            return {
                success: true,
                isSMSFailure: false,
                details: analysisResult,
                extractedText: text
            };
            
        } catch (error) {
            console.error(`❌ Erreur analyse post-soumission: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Détecter spécifiquement les erreurs d'envoi SMS de WhatsApp
     */
    detectSMSFailure(text) {
        const textLower = text.toLowerCase();
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        
        console.log('🔍 Analyse des erreurs SMS...');
        
        // Patterns d'erreurs SMS spécifiques
        const failurePatterns = this.getFailurePatterns();
        
        // Détecter le type d'erreur
        let failureType = null;
        let confidence = 0;
        let shouldRetryWithNewNumber = false;
        let errorMessage = '';
        
        // Analyser chaque catégorie d'erreur
        for (const [category, patterns] of Object.entries(failurePatterns)) {
            for (const pattern of patterns) {
                if (pattern.test(textLower)) {
                    failureType = category;
                    
                    // Extraire le message d'erreur complet
                    const match = text.match(new RegExp(pattern.source, 'i'));
                    if (match) {
                        for (const line of lines) {
                            if (pattern.test(line.toLowerCase())) {
                                errorMessage = line.trim();
                                break;
                            }
                        }
                    }
                    
                    // Définir la confiance selon le type d'erreur
                    const errorConfig = this.getErrorConfig(category);
                    confidence = errorConfig.confidence;
                    shouldRetryWithNewNumber = errorConfig.shouldRetryWithNewNumber;
                    
                    break;
                }
            }
            if (failureType) break;
        }
        
        // Patterns combinés pour augmenter la confiance
        const combinedPatterns = [
            /we\s*couldn.*t.*sms.*number/i,
            /check.*number.*try\s*again/i,
            /verifying.*number.*couldn.*t/i,
            /can't\s*send/i,
            /can't\s*send/i,
            /because\s*you('|')?ve\s*tried/i,
            /wait\s*before\s*requesting/i
        ];
        
        for (const pattern of combinedPatterns) {
            if (pattern.test(textLower)) {
                confidence = Math.min(confidence + 0.1, 1.0);
                shouldRetryWithNewNumber = true;
            }
        }
        
        // Détection générique si pas de pattern spécifique
        if (!failureType) {
            const genericError = this.detectGenericSMSError(textLower);
            if (genericError.found) {
                failureType = 'genericError';
                confidence = genericError.confidence;
                shouldRetryWithNewNumber = true;
                errorMessage = genericError.message;
            }
        }
        
        // Seuil strict pour détection d'échec SMS
        const isSMSFailure = failureType !== null && confidence >= 0.75;
        
        this.logSMSFailureResult(isSMSFailure, failureType, errorMessage, confidence, shouldRetryWithNewNumber);
        
        return {
            isSMSFailure,
            failureType,
            errorMessage,
            confidence,
            shouldRetryWithNewNumber,
            detectedPatterns: failureType ? failurePatterns[failureType] : [],
            extractedText: text
        };
    }

    /**
     * Obtenir les patterns d'erreurs SMS
     */
    getFailurePatterns() {
        return {
            cantSendSMS: [
                /we\s*couldn.*t\s*send\s*an?\s*sms/i,
                /unable\s*to\s*send\s*sms/i,
                /cannot\s*send\s*sms/i,
                /failed\s*to\s*send\s*sms/i,
                /sms\s*sending\s*failed/i,
                /sms\s*delivery\s*failed/i,
                /can't\s*send/i,
                /can't\s*send/i,
                /because\s*you('|')?ve\s*tried/i,
                /wait\s*before\s*requesting/i
            ],
            
            retryLater: [
                /try\s*again\s*in\s*\d+\s*hour/i,
                /try\s*again\s*in\s*\d+\s*minute/i,
                /try\s*again\s*later/i,
                /please\s*wait.*try\s*again/i,
                /temporarily\s*unavailable/i
            ],
            
            numberIssues: [
                /check\s*your\s*number/i,
                /invalid\s*number/i,
                /number\s*not\s*supported/i,
                /number\s*cannot\s*receive/i,
                /this\s*number\s*is\s*not\s*available/i
            ],
            
            serviceErrors: [
                /service\s*temporarily\s*unavailable/i,
                /server\s*error/i,
                /network\s*error/i,
                /connection\s*failed/i
            ],
            
            verificationErrors: [
                /verifying\s*your\s*number.*couldn.*t/i,
                /verifying.*unable\s*to\s*send/i,
                /verification.*failed/i
            ],
            
            phoneCall: [
                /phone\s*call/i,
                /call\s*you/i,
                /calling\s*you/i,
                /we'll\s*call/i,
                /by\s*call/i,
                /sent\s*by\s*phone\s*call/i
            ]
        };
    }

    /**
     * Obtenir la configuration d'erreur par type
     */
    getErrorConfig(category) {
        const configs = {
            cantSendSMS: {
                confidence: 0.95,
                shouldRetryWithNewNumber: true
            },
            numberIssues: {
                confidence: 0.90,
                shouldRetryWithNewNumber: true
            },
            retryLater: {
                confidence: 0.85,
                shouldRetryWithNewNumber: true
            },
            verificationErrors: {
                confidence: 0.80,
                shouldRetryWithNewNumber: true
            },
            serviceErrors: {
                confidence: 0.70,
                shouldRetryWithNewNumber: false
            },
            phoneCall: {
                confidence: 1.0,
                shouldRetryWithNewNumber: true
            }
        };
        
        return configs[category] || {
            confidence: 0.60,
            shouldRetryWithNewNumber: true
        };
    }

    /**
     * Détecter les erreurs SMS génériques
     */
    detectGenericSMSError(textLower) {
        const errorKeywords = ['error', 'failed', 'unable', 'cannot', "couldn't", 'problem'];
        const smsKeywords = ['sms', 'message', 'text', 'verification', 'code'];
        
        const hasErrorKeyword = errorKeywords.some(keyword => textLower.includes(keyword));
        const hasSMSKeyword = smsKeywords.some(keyword => textLower.includes(keyword));
        
        if (hasErrorKeyword && hasSMSKeyword) {
            return {
                found: true,
                confidence: 0.6,
                message: 'Erreur générique détectée dans le contexte SMS'
            };
        }
        
        return {
            found: false,
            confidence: 0,
            message: ''
        };
    }

    /**
     * Logger le résultat de la détection d'échec SMS
     */
    logSMSFailureResult(isSMSFailure, failureType, errorMessage, confidence, shouldRetryWithNewNumber) {
        if (isSMSFailure) {
            console.log(`🚨 Erreur SMS détectée: ${failureType}`);
            console.log(`📝 Message: ${errorMessage}`);
            console.log(`🎯 Confiance: ${Math.round(confidence * 100)}%`);
            console.log(`🔄 Retry recommandé: ${shouldRetryWithNewNumber ? 'OUI' : 'NON'}`);
        } else {
            console.log('✅ Aucune erreur SMS détectée');
        }
    }

    /**
     * Vérifier si le détecteur est disponible
     */
    isAvailable() {
        return this.initialized;
    }

    /**
     * Obtenir des statistiques sur les erreurs détectées
     */
    getStats() {
        return {
            initialized: this.initialized,
            ocrAvailable: this.ocrAnalyzer.initialized,
            version: '1.0.0'
        };
    }
}

module.exports = { SMSFailureDetector };